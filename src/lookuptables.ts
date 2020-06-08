import * as twgl from '../node_modules/twgl.js/dist/4.x/twgl-full'

import {LookupTablesData} from './lookuptablesdata'
import {PhongObj} from './phongshader'
import {GlUtil, TexFormat} from './glutil'

export class LookupTables {

  num_out: WebGLTexture;
  tris_out: WebGLTexture;

  public constructor(gl: WebGL2RenderingContext) {
    const num_out_f = new TexFormat(gl.R8UI, gl.RED_INTEGER, gl.UNSIGNED_BYTE);
    this.num_out = GlUtil.init_tex(gl);
    GlUtil.tex_img_2d(
        gl, this.num_out, num_out_f, 16, 16, new Uint8Array(LookupTablesData.num_out))

    const tris_out_f = new TexFormat(gl.RGBA16I, gl.RGBA_INTEGER, gl.SHORT);
    this.tris_out = GlUtil.init_tex(gl);
    GlUtil.tex_img_2d(
        gl, this.tris_out, tris_out_f, 5, 256, new Int16Array(LookupTablesData.tris_out));
  }
}

export class GeometryGenerator {

  static voxels_dim: number = 32;

  lookup_tables: LookupTables;

  random_noise_dim: number = 16;
  random_noise: WebGLTexture; // cube!

  compute_vao: WebGLVertexArrayObject;
  compute_idxes: WebGLBuffer;
  compute_uvs: WebGLBuffer;

  gen_density_program: twgl.ProgramInfo;
  densities_fbo: WebGLFramebuffer;
  densities: WebGLTexture;

  gen_caseids_program: twgl.ProgramInfo;
  caseids_fbo: WebGLFramebuffer;
  caseids0: WebGLTexture;
  caseids1: WebGLTexture;
  caseid_current = 0;
  caseids_prefix_scan_reduce_program: twgl.ProgramInfo;
  caseids_prefix_scan_combine_program: twgl.ProgramInfo;

  gen_geometry_program: twgl.ProgramInfo;
  gen_geometry_fbo: WebGLFramebuffer;
  gen_geometry_vtxes: WebGLTexture;

  gen_normals_program: twgl.ProgramInfo;
  gen_normals_fbo: WebGLFramebuffer;
  gen_normals_tex: WebGLBuffer;
  gen_colors_tex: WebGLBuffer;

  z_density_mult = 2.2;

  sample_origin = [0, 0, 0, 1]
  sample_scale = [1, 1, 1, 0]

  TexFormat_RGBA32UI: TexFormat;

  public constructor(
      private gl: WebGL2RenderingContext, 
      private readonly voxel_grid_dim: number) {

    this.lookup_tables = new LookupTables(gl);

    this.setup_densities_sampler();
    this.setup_caseids_sampler();
    this.setup_gen_geometry();
    this.setup_compute_vao();
    this.setup_gen_normals();

    this.TexFormat_RGBA32UI = {
      internal_format: gl.RGBA32UI,
      format: gl.RGBA_INTEGER,
      type: gl.UNSIGNED_INT,
    };

    this.make_random_grid();

  }

  public make_random_grid() {
    const gl = this.gl;
    let noise = []
    const d = this.random_noise_dim;
    const d3 = Math.pow(d, 3);
    for (let i =0; i < d3; i++) { noise.push(Math.random() * 2 - 1) }

    this.random_noise = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_3D, this.random_noise);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.R32F, d, d, d, 0, gl.RED, gl.FLOAT, new Float32Array(noise), 0);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        // gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    // gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.REPEAT);

    gl.bindTexture(gl.TEXTURE_3D, null);
  }

  public init_buffers(obj: PhongObj) {
    const d = this.voxel_grid_dim;
    const d3 = d * d * d;

    const gl = this.gl;
    const max_vtxes_size = d3 * 5 * 3 * 4 * 4;

    // assume max of 10% filled at any point
    const max_vtx_fill = 0.10;
    const vtxes_size = Math.ceil(max_vtxes_size * max_vtx_fill);

    gl.bindBuffer(gl.ARRAY_BUFFER, obj.pts);
    gl.bufferData(gl.ARRAY_BUFFER, vtxes_size, gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, obj.normals);
    gl.bufferData(gl.ARRAY_BUFFER, vtxes_size, gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, obj.colors);
    gl.bufferData(gl.ARRAY_BUFFER, vtxes_size, gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  public run(obj: PhongObj, sample_origin: number[], sample_scale: number[]) {

    const gl = this.gl;
    const d = this.voxel_grid_dim;
    const d3 = d * d * d;

    this.sample_origin = sample_origin
    this.sample_scale = sample_scale;

    this.run_densities_sampler();
    this.run_caseids_sampler();
    const num_tris_out = this.run_caseids_prefix_scan();
    this.run_gen_geometry(obj, num_tris_out);
    this.run_gen_normals(obj, num_tris_out); // and colors!
    obj.num_idxes = num_tris_out * 3;
  }

  private setup_compute_vao() {
    const gl = this.gl;
    this.compute_vao = gl.createVertexArray()
    gl.bindVertexArray(this.compute_vao)

    this.compute_uvs = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.compute_uvs);
    let d_uvs = [ -1, -1, 1, -1, -1,  1, 1,  1];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(d_uvs), gl.STATIC_DRAW);

    // is this safe to do?
    // const attr = gl.getAttribLocation(this.gen_density_program.program, 'uv');
    const attr = 0;
    gl.enableVertexAttribArray(attr);
    gl.vertexAttribPointer(attr, 2, gl.FLOAT, false, 0, 0);

    this.compute_idxes = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.compute_idxes)
    let d_idxes = [0, 1, 2, 2, 1, 3]
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(d_idxes), gl.STATIC_DRAW)
    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)
  }

  private setup_densities_sampler() {
    const gl = this.gl;

    this.gen_density_program = 
    twgl.createProgramInfo(gl, ['pixel_compute_vert', 'eval_density_vals_frag'])

    const densities_tex_f = new TexFormat(gl.R32UI, gl.RED_INTEGER, gl.UNSIGNED_INT);
    this.densities = GlUtil.init_tex(gl);
    GlUtil.tex_img_2d(
        gl, this.densities, densities_tex_f, this.densities_dim_x(), this.densities_dim_y(), null);

    this.densities_fbo = gl.createFramebuffer();   
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.densities_fbo);
    gl.framebufferTexture2D(
        gl.FRAMEBUFFER, 
        gl.COLOR_ATTACHMENT0, 
        gl.TEXTURE_2D, 
        this.densities, 0);
  }

  private setup_caseids_sampler() {
    const gl = this.gl;
    this.gen_caseids_program = 
      twgl.createProgramInfo(gl, ['pixel_compute_vert', 'eval_caseids_frag']);

    const caseids_tex_f = new TexFormat(gl.RGBA32UI, gl.RGBA_INTEGER, gl.UNSIGNED_INT);
    // 2 copies of caseids texture, so prefix scan can go back and forth
    this.caseids0 = GlUtil.init_tex(gl);
    GlUtil.tex_img_2d(
        gl, this.caseids0, caseids_tex_f, this.caseids_dim_x(), this.caseids_dim_y(), null);
    this.caseids1 = GlUtil.init_tex(gl);
    GlUtil.tex_img_2d(
        gl, this.caseids1, caseids_tex_f, this.caseids_dim_x(), this.caseids_dim_y(), null);

    this.caseids_fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.caseids_fbo);
    gl.framebufferTexture2D(
        gl.FRAMEBUFFER, 
        gl.COLOR_ATTACHMENT0, 
        gl.TEXTURE_2D, 
        this.caseids0, 0)

    this.caseids_prefix_scan_reduce_program =
      twgl.createProgramInfo(gl, ['caseids_prefix_scan_reduce_vert', 'caseids_prefix_scan_reduce_frag'])

    this.caseids_prefix_scan_combine_program =
      twgl.createProgramInfo(gl, ['caseids_prefix_scan_combine_vert', 'caseids_prefix_scan_combine_frag'])

  }

  private setup_gen_normals() {  
    const gl = this.gl;

    this.gen_normals_program = 
      twgl.createProgramInfo(gl, ['gen_normals_vert', 'gen_normals_frag']);

    const gen_normals_tex_f = new TexFormat(gl.RGBA32UI, gl.RGBA_INTEGER, gl.UNSIGNED_INT);
    this.gen_normals_tex = GlUtil.init_tex(gl);
    // geom vtxes same dim as geom normals
    GlUtil.tex_img_2d(
        gl, this.gen_normals_tex, gen_normals_tex_f, this.gen_geom_vtxes_dim_x(), this.gen_geom_vtxes_dim_y(), null);

    this.gen_colors_tex = GlUtil.init_tex(gl);
    GlUtil.tex_img_2d(
        gl, this.gen_colors_tex, gen_normals_tex_f, this.gen_geom_vtxes_dim_x(), this.gen_geom_vtxes_dim_y(), null);

    this.gen_normals_fbo = gl.createFramebuffer();   
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.gen_normals_fbo);
    gl.framebufferTexture2D(
        gl.FRAMEBUFFER, 
        gl.COLOR_ATTACHMENT0, 
        gl.TEXTURE_2D, 
        this.gen_normals_tex, 0);

    gl.framebufferTexture2D(
        gl.FRAMEBUFFER, 
        gl.COLOR_ATTACHMENT1, 
        gl.TEXTURE_2D, 
        this.gen_colors_tex, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private setup_gen_geometry() {
    const gl = this.gl;

    this.gen_geometry_program = 
      twgl.createProgramInfo(gl, ['gen_geometry2_vert', 'gen_geometry2_frag']);

    const gen_geometry_vtxes_tex_f = new TexFormat(gl.RGBA32UI, gl.RGBA_INTEGER, gl.UNSIGNED_INT);
    this.gen_geometry_vtxes = GlUtil.init_tex(gl);
    GlUtil.tex_img_2d(
        gl, this.gen_geometry_vtxes, gen_geometry_vtxes_tex_f, this.gen_geom_vtxes_dim_x(), this.gen_geom_vtxes_dim_y(), null);

    this.gen_geometry_fbo = gl.createFramebuffer();   
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.gen_geometry_fbo);
    gl.framebufferTexture2D(
        gl.FRAMEBUFFER, 
        gl.COLOR_ATTACHMENT0, 
        gl.TEXTURE_2D, 
        this.gen_geometry_vtxes, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private run_densities_sampler() {
    const gl = this.gl;
    gl.useProgram(this.gen_density_program.program)
    gl.bindVertexArray(this.compute_vao)
    twgl.setUniforms(this.gen_density_program, {
          'sample_origin': this.sample_origin,
          'sample_scale':  this.sample_scale,
          'density_grid_dim': this.voxel_grid_dim + 1,
          'z_density_mult': this.z_density_mult,
          'noise_tex': this.random_noise,
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.densities_fbo);
    gl.viewport(0, 0, this.densities_dim_x(), this.densities_dim_y())
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private run_caseids_sampler() {
    const gl = this.gl;
    gl.useProgram(this.gen_caseids_program.program)
    gl.bindVertexArray(this.compute_vao)
    twgl.setUniforms(this.gen_caseids_program, {
          'densities_texture': this.densities,
          'num_tris_texture': this.lookup_tables.num_out,
          'voxel_grid_dim': this.voxel_grid_dim,
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.caseids_fbo);
    gl.viewport(0, 0, this.caseids_dim_x(), this.caseids_dim_y())
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private run_caseids_prefix_scan(): number {
    const gl = this.gl;
    const d = this.voxel_grid_dim;
    const d3 = d * d * d;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.caseids_fbo);

    const num_stages: number = (Math as any).log2(d3);
    let current_program = this.caseids_prefix_scan_reduce_program;
    gl.useProgram(current_program.program)
    let global_stage_count = 0;
    const execute_stage = (s: number) => {
          const even = global_stage_count++ % 2 == 0;
          const in_tex = even  ? this.caseids0 : this.caseids1;
          const out_tex = even ? this.caseids1 : this.caseids0;
          gl.framebufferTexture2D(
              gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, out_tex, 0);
          twgl.setUniforms(current_program, {
            'img_in': in_tex,
            'dim': [this.caseids_dim_x(), this.caseids_dim_y()],
            'stage': s,
            'num_stages': num_stages,
          });
          gl.viewport(0, 0, this.caseids_dim_x(), this.caseids_dim_y())
          const invoke_count = this.caseids_dim_x() * this.caseids_dim_y() / (1 << s);
          gl.drawArrays(gl.POINTS, 0, invoke_count);
    };

    for (let i =0; i < num_stages; i++) { execute_stage(i); }

    current_program = this.caseids_prefix_scan_combine_program;
    gl.useProgram(current_program.program)

    for (let i = num_stages - 1; i >= 0; i--) { execute_stage(i); }

    gl.useProgram(null);

    // read just last pixel to determine number of triangles generated!
    let copy_back_buff =  new ArrayBuffer(4 * 4)
    let copy_back = new Uint32Array(copy_back_buff);
    this.gl.readPixels(
        this.caseids_dim_x() - 1,  this.caseids_dim_y() - 1, 1, 1, this.gl.RGBA_INTEGER, this.gl.UNSIGNED_INT, copy_back)

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const num_tris_out = copy_back[2]; // Z value
    this.caseid_current = global_stage_count % 2;
    return num_tris_out;
  }

  private run_gen_geometry(obj: PhongObj, num_tris_out: number) {
    const gl = this.gl;
    const d = this.voxel_grid_dim;

    gl.useProgram(this.gen_geometry_program.program);
    twgl.setUniforms(this.gen_geometry_program, {
          'out_dim': [this.gen_geom_vtxes_dim_x(), this.gen_geom_vtxes_dim_y()],
          'case_ids': this.get_current_caseids_tex(),
          'voxel_grid_dim': d,
          'tris_out': this.lookup_tables.tris_out,
          'densities': this.densities,
          'sample_origin': this.sample_origin,
          'sample_scale':  this.sample_scale,
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.gen_geometry_fbo)
    gl.viewport(0, 0, this.gen_geom_vtxes_dim_x(), this.gen_geom_vtxes_dim_y())
    const max_vtxes = d * d * d * 3 * 5;
    gl.drawArrays(gl.POINTS, 0, max_vtxes);
    gl.bindVertexArray(null);
    gl.useProgram(null)

    // num_tris_out
    const out_dim_y = Math.ceil(num_tris_out * 3 / this.gen_geom_vtxes_dim_x());

    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, obj.pts);
    gl.readBuffer(gl.COLOR_ATTACHMENT0)
    gl.readPixels(0, 0,
        this.gen_geom_vtxes_dim_x(), out_dim_y, this.gl.RGBA_INTEGER, this.gl.UNSIGNED_INT, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private run_gen_normals(obj: PhongObj, num_tris: number) {
    const gl = this.gl;
    // generate normals and colors
    gl.useProgram(this.gen_normals_program.program);
    twgl.setUniforms(this.gen_normals_program, {
      'vtxes': this.gen_geometry_vtxes,
      'dim': [this.gen_geom_vtxes_dim_x(), this.gen_geom_vtxes_dim_y()],
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.gen_normals_fbo)
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1])
    gl.viewport(0, 0, this.gen_geom_vtxes_dim_x(), this.gen_geom_vtxes_dim_y())
    gl.drawArrays(gl.POINTS, 0, num_tris * 3);
    // back to default..
    gl.drawBuffers([gl.COLOR_ATTACHMENT0])

    const out_dim_y = Math.ceil(num_tris * 3 / this.gen_geom_vtxes_dim_x());

    // copy normals from texture to buffer
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, obj.normals);
    gl.readPixels(0, 0, this.gen_geom_vtxes_dim_x(), out_dim_y, this.gl.RGBA_INTEGER, this.gl.UNSIGNED_INT, 0);

    // flip framebuffer attachments to read colors from 0 
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.gen_normals_tex, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.gen_colors_tex, 0);

    // copy colors from texture to buffer
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, obj.colors);
    gl.readPixels(0, 0, this.gen_geom_vtxes_dim_x(), out_dim_y, this.gl.RGBA_INTEGER, this.gl.UNSIGNED_INT, 0);

    // unbind..
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    // flip framebuffer attachments back to normal
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.gen_normals_tex, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.gen_colors_tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private densities_dim_x() : number {
    const d = this.voxel_grid_dim + 1;
    return d * d;
  }

  private densities_dim_y(): number {
    return this.voxel_grid_dim + 1;
  }

  private densities_size(): number {
    return this.densities_dim_x() * this.densities_dim_y();
  }

  private caseids_dim_x(): number {
    const d = this.voxel_grid_dim;
    return d * d;
  }

  private caseids_dim_y(): number {
    return this.voxel_grid_dim; 
  }

  private caseids_size(): number {
    return this.caseids_dim_x() * this.caseids_dim_y();
  }

  private gen_geom_vtxes_dim_x() {
    return this.voxel_grid_dim * this.voxel_grid_dim;
  }
  private gen_geom_vtxes_dim_y() {
    return this.voxel_grid_dim * 3 * 5;
  }

  private get_current_caseids_tex(): WebGLTexture {
    return this.caseid_current == 0 ? this.caseids0 : this.caseids1;
  }

  private get_back_caseids_tex(): WebGLTexture {
    return this.caseid_current == 0 ? this.caseids1 : this.caseids0;
  }
}
