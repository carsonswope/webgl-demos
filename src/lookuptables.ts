import * as twgl from '../node_modules/twgl.js/dist/4.x/twgl-full'

import {LookupTablesData} from './lookuptablesdata'
import {PhongObj} from './phongshader'

export class LookupTables {

  num_out: WebGLTexture;
  tris_out: WebGLTexture;

  public constructor(gl: WebGL2RenderingContext) {

    this.num_out = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.num_out)
    gl.texImage2D(
      gl.TEXTURE_2D, 
      0, gl.R8UI, 
      16, 16, 0,
      gl.RED_INTEGER,
      gl.UNSIGNED_BYTE,
      new Uint8Array(LookupTablesData.num_out))
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.tris_out = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.tris_out)
    gl.texImage2D(
      gl.TEXTURE_2D, 
      0, gl.RGBA16I, 
      5, 256, 0,
      gl.RGBA_INTEGER,
      gl.SHORT,
      new Int16Array(LookupTablesData.tris_out))
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindTexture(gl.TEXTURE_2D, null);

  }
}

export class GeometryGenerator {

  static voxels_dim: number = 32;

  lookup_tables: LookupTables;

  compute_vao: WebGLVertexArrayObject;
  compute_idxes: WebGLBuffer;
  compute_uvs: WebGLBuffer;

  gen_density_program: twgl.ProgramInfo;
  densities_fbo: WebGLFramebuffer;
  densities: WebGLTexture;
  densities_cpu_raw: ArrayBuffer;
  densities_cpu: Float32Array;

  gen_caseids_program: twgl.ProgramInfo;
  caseids_fbo: WebGLFramebuffer;
  caseids: WebGLTexture;
  caseids_cpu: Uint32Array;

  gen_geometry_program: twgl.ProgramInfo;
  gen_geom_ids: WebGLBuffer;
  gen_geom_num_idxes: number;
  gen_geom_idxs: WebGLBuffer;
  gen_geom_vao: WebGLVertexArrayObject;
  gen_geometry_fbo: WebGLFramebuffer;
  gen_geometry_vtxes: WebGLTexture;
  gen_geometry_idxes: WebGLTexture;

  gen_geom_floats: Float32Array;
  gen_geom_ints: Uint32Array;

  sample_origin = [0, 0, 0, 1]
  sample_scale = [1, 1, 1, 0]

  public constructor(
      private gl: WebGL2RenderingContext, 
      private readonly voxel_grid_dim: number) {

    this.lookup_tables = new LookupTables(gl);

    this.setup_densities_sampler();
    this.setup_caseids_sampler();
    this.setup_gen_geometry();

    this.setup_compute_vao();

  }

  public run(obj: PhongObj, sample_origin: number[], sample_scale: number[]) {

    // Run the whole thing on the CPU!
    const d = this.voxel_grid_dim;
    const d3 = d * d * d;

    this.sample_origin = sample_origin
    this.sample_scale = sample_scale;

    this.run_densities_sampler();

    this.run_caseids_sampler();

    this.run_caseids_prefix_scan();
    
    this.run_gen_geometry(obj);


    const get_density_idx = (x: number, y :number, z: number) => {
      const _d = d + 1;
      return (y * _d * _d) + (z * _d) + x;
    }

    let vtx_count = 0;
    let vtxes_out = []
    let normals_out = []
    let idxes_out = []
    let colors_out = []

    // by voxel coord
    const get_caseid_idx = (x: number, y: number, z: number) => {
      return (y * d * d) + (z * d) + x;
   }

    for (let y = 0; y < d; y++) {
      for (let z = 0; z < d; z++) {
        for (let x = 0; x < d; x++) {

          const voxel_idx = get_caseid_idx(x, y, z);
          const caseid = this.caseids_cpu[voxel_idx * 4];
          const num_tris = this.caseids_cpu[voxel_idx * 4 + 1];
          const start_tri_idx = this.caseids_cpu[voxel_idx * 4 + 2];

          for (let i =0; i < num_tris; i++) {

            const p_idx = (start_tri_idx + i) * 3 * 4;

            const p0 = this.gen_geom_floats.slice(p_idx, p_idx + 4);
            const p1 = this.gen_geom_floats.slice(p_idx + 4, p_idx + 8);
            const p2 = this.gen_geom_floats.slice(p_idx + 8, p_idx + 12);

            const u = twgl.v3.subtract(p1, p0);
            const v = twgl.v3.subtract(p2, p0);
            const n = twgl.v3.normalize(twgl.v3.cross(u, v));

            for (let j =0;  j < 3; j++) {
              const idx = idxes_out.length; // 0, 1, 2, 3, 4, 5... blah
              idxes_out.push(idx);
              normals_out.push([n[0], n[1], n[2], 0]);
              colors_out.push([0., 0.3, 0.8, 1.]);
            }

          }

        }
      }
    }


    obj.num_idxes = idxes_out.length;

    const gl = this.gl;

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj.idxes);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idxes_out), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    
    let normals_flat = []
    normals_out.forEach(n => n.forEach(c => normals_flat.push(c)));

    gl.bindBuffer(gl.ARRAY_BUFFER, obj.normals);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals_flat), gl.STATIC_DRAW)

    let colors_flat = []
    colors_out.forEach(c => c.forEach(v => colors_flat.push(v)));

    gl.bindBuffer(gl.ARRAY_BUFFER, obj.colors);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors_flat), gl.STATIC_DRAW)

    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    
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

    this.densities = this.gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.densities);
    gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.R32UI, 
        this.densities_dim_x(), this.densities_dim_y(), 0,
        gl.RED_INTEGER,
        gl.UNSIGNED_INT,
        null)

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    this.densities_fbo = gl.createFramebuffer();   
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.densities_fbo);
    gl.framebufferTexture2D(
        gl.FRAMEBUFFER, 
        gl.COLOR_ATTACHMENT0, 
        gl.TEXTURE_2D, 
        this.densities, 0);

    this.densities_cpu_raw = new ArrayBuffer(this.densities_size() * 4) 
  }

  private setup_caseids_sampler() {
    const gl = this.gl;
    this.gen_caseids_program = 
      twgl.createProgramInfo(gl, ['pixel_compute_vert', 'eval_caseids_frag']);

    this.caseids = this.gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.caseids);
    gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA32UI,
        this.caseids_dim_x(), this.caseids_dim_y(), 0, 
        gl.RGBA_INTEGER, 
        gl.UNSIGNED_INT, 
        null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    this.caseids_fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.caseids_fbo);
    gl.framebufferTexture2D(
        gl.FRAMEBUFFER, 
        gl.COLOR_ATTACHMENT0, 
        gl.TEXTURE_2D, 
        this.caseids, 0)

    this.caseids_cpu = new Uint32Array(this.caseids_size() * 4)
  }

  private setup_gen_geometry() {
    const gl = this.gl;

    this.gen_geometry_program = 
      twgl.createProgramInfo(gl, ['gen_geometry2_vert', 'gen_geometry2_frag']);

    this.gen_geometry_vtxes = this.gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.gen_geometry_vtxes);
    gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA32UI,
        this.gen_geom_vtxes_dim_x(), this.gen_geom_vtxes_dim_y(), 0,
        gl.RGBA_INTEGER,
        gl.UNSIGNED_INT,
        null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    this.gen_geometry_fbo = gl.createFramebuffer();   
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.gen_geometry_fbo);
    gl.framebufferTexture2D(
        gl.FRAMEBUFFER, 
        gl.COLOR_ATTACHMENT0, 
        gl.TEXTURE_2D, 
        this.gen_geometry_vtxes, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // const gl = this.gl;
    this.gen_geom_vao = gl.createVertexArray()
    gl.bindVertexArray(this.gen_geom_vao)

    let gen_geom_ids = []
    let gen_geom_idxs = []
    
    // voxel ID
    const d = this.voxel_grid_dim;
    const d3 = d * d * d;
    for (let i = 0; i < d3; i++) {
      // max number of triangles per voxel
      for (let j = 0; j < 5; j++) {
        // vtxes per voxel
        for (let k = 0; k < 3; k++) {
          gen_geom_ids.push(i);
          gen_geom_ids.push(j);
          gen_geom_ids.push(k);
          gen_geom_ids.push(0);

          gen_geom_idxs.push(gen_geom_idxs.length)
        }
      }
    }

    this.gen_geom_ids = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.gen_geom_ids);
    gl.bufferData(gl.ARRAY_BUFFER, new Uint32Array(gen_geom_ids), gl.STATIC_DRAW);
    const attr = gl.getAttribLocation(this.gen_geometry_program.program, 'a_id');
    gl.enableVertexAttribArray(attr);
    gl.vertexAttribIPointer(attr, 4, gl.UNSIGNED_INT, 0, 0);

    this.gen_geom_idxs = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.gen_geom_idxs)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(gen_geom_idxs), gl.STATIC_DRAW)
    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)

    this.gen_geom_num_idxes = gen_geom_idxs.length;
  }

  private run_densities_sampler() {
    const gl = this.gl;

    gl.useProgram(this.gen_density_program.program)
    gl.bindVertexArray(this.compute_vao)
    twgl.setUniforms(this.gen_density_program, {
          'sample_origin': this.sample_origin,
          'sample_scale':  this.sample_scale,
          'density_grid_dim': this.voxel_grid_dim + 1,
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.densities_fbo);
    gl.viewport(0, 0, this.densities_dim_x(), this.densities_dim_y())

    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0)

    // Read buffer back to CPU
    this.gl.readPixels(
        0, 0, 
        this.densities_dim_x(), 
        this.densities_dim_y(), 
        this.gl.RED_INTEGER, 
        this.gl.UNSIGNED_INT, 
        new Uint32Array(this.densities_cpu_raw))

    this.densities_cpu = new Float32Array(this.densities_cpu_raw);
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
    
    this.gl.readPixels(
      0, 0, 
      this.caseids_dim_x(), 
      this.caseids_dim_y(), 
      this.gl.RGBA_INTEGER, 
      this.gl.UNSIGNED_INT, 
      this.caseids_cpu);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

private run_caseids_prefix_scan() {
  const gl = this.gl;

    // do it on the CPU for now!
    const d = this.voxel_grid_dim;
    const d3 = d * d * d;
    let current_count = 0;
    for (let i =0; i < d3; i++) {
      this.caseids_cpu[i * 4 + 2] = current_count;
      current_count += this.caseids_cpu[i * 4 + 1];
    }

    // and copy back to the texture in B channel
    gl.bindTexture(gl.TEXTURE_2D, this.caseids);
    gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA32UI,
        this.caseids_dim_x(), this.caseids_dim_y(), 0, 
        gl.RGBA_INTEGER, 
        gl.UNSIGNED_INT, 
        this.caseids_cpu);
    gl.bindTexture(gl.TEXTURE_2D, null);
}

  private run_gen_geometry(obj: PhongObj) {
    const gl = this.gl;

    gl.useProgram(this.gen_geometry_program.program);
    gl.bindVertexArray(this.gen_geom_vao);
    twgl.setUniforms(this.gen_geometry_program, {
          'out_dim': [this.gen_geom_vtxes_dim_x(), this.gen_geom_vtxes_dim_y()],
          'case_ids': this.caseids,
          'voxel_grid_dim': this.voxel_grid_dim,
          'tris_out': this.lookup_tables.tris_out,
          'densities': this.densities,
          'sample_origin': this.sample_origin,
          'sample_scale':  this.sample_scale,
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.gen_geometry_fbo)
    gl.viewport(0, 0, this.gen_geom_vtxes_dim_x(), this.gen_geom_vtxes_dim_y())
    gl.drawElements(gl.POINTS, this.gen_geom_num_idxes, gl.UNSIGNED_INT, 0)
    gl.bindVertexArray(null);
    gl.useProgram(null)

    // Read buffer back to CPU
    let copy_back_buff =
        new ArrayBuffer(
            this.gen_geom_vtxes_dim_x() * this.gen_geom_vtxes_dim_y() * 4 * 4)
    this.gen_geom_ints = new Uint32Array(copy_back_buff)
    this.gl.readPixels(
      0, 0, 
      this.gen_geom_vtxes_dim_x(),
      this.gen_geom_vtxes_dim_y(),
      this.gl.RGBA_INTEGER, 
      this.gl.UNSIGNED_INT, 
      this.gen_geom_ints)

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    this.gen_geom_floats = new Float32Array(copy_back_buff);
    gl.bindBuffer(gl.ARRAY_BUFFER, obj.pts);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.gen_geom_floats), gl.STATIC_DRAW)

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
    // const e = GeometryGenerator.voxels_dim;
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

  private readonly grid_offsets = [
        [0, 0, 0],
        [0, 0, 1],
        [1, 0, 1],
        [1, 0, 0],
        [0, 1, 0],
        [0, 1, 1],
        [1, 1, 1],
        [1, 1, 0]];

    private readonly edge_vtxes = [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 0],
        [4, 5],
        [5, 6],
        [6, 7],
        [7, 4],
        [0, 4],
        [1, 5],
        [2, 6],
        [3, 7]];

}