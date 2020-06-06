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

    const z = LookupTablesData.tris_out;


    /*
    Copy back for debugging!
      // Create a framebuffer backed by the texture
      var framebuffer = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.num_out, 0);
    let copy_back = new Uint8Array(256)
    gl.readPixels(0, 0, 16, 16, gl.RED_INTEGER, gl.UNSIGNED_BYTE, copy_back)
    copy_back.forEach(a => { console.log(a) })
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    */

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

  gen_geometry_program: twgl.ProgramInfo;
  gen_geometry_fbo: WebGLFramebuffer;
  gen_geometry_vtxes: WebGLTexture;
  gen_geometry_idxes: WebGLTexture;

  gen_caseids_program: twgl.ProgramInfo;
  caseids_fbo: WebGLFramebuffer;
  caseids: WebGLTexture;

  sample_origin = [-16, -16, -16, 1]
  sample_scale = [1, 1, 1, 0]

  public constructor(private gl: WebGL2RenderingContext) {
    this.lookup_tables = new LookupTables(gl);

    this.setup_densities_sampler();
    this.setup_caseids_sampler();
    this.setup_gen_geometry();

    this.setup_compute_vao();

  }

  public run(obj: PhongObj) {

    // Run the whole thing on the CPU!
    const voxel_grid_dim = 64;
    const d = voxel_grid_dim;

    // 2d array.
    // x*y grids put side by side along x axis, as different z layers
    let densities = new Float32Array(Math.pow(d + 1, 3));

    const get_density_idx = (x: number, y :number, z: number) => {
      const _d = d + 1;
      return (y * _d * _d) + (z * _d) + x;
    }

    this.sample_origin = [-6.5, -6.5, -6.5, 1]
    this.sample_scale = [0.2, 0.2, 0.2, 0]

    for (let x =0; x < d + 1; x++) {
        for (let y =0; y < d + 1; y++) {
          for (let z =0; z < d + 1; z++) {
            const _x = this.sample_origin[0] + (this.sample_scale[0] * x);
            const _y = this.sample_origin[1] + (this.sample_scale[1] * y);
            const _z = this.sample_origin[2] + (this.sample_scale[2] * z);
            const density = 0.2 + _y + (0.5 * Math.cos(_x * 1.5)) + (0.02 * _z * _z);
            const i = get_density_idx(x, y, z);
            densities[i] = density;
          }
      }
    }

    const grid_offsets = [
      [0, 0, 0],
      [0, 0, 1],
      [1, 0, 1],
      [1, 0, 0],
      [0, 1, 0],
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0]];

    const edge_vtxes = [
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

    let caseids = new Uint8Array(Math.pow(d, 3));

    let vtx_count = 0;
    let vtxes_out = []
    let normals_out = []
    let idxes_out = []
    let colors_out = []

    // by voxel coord
    const get_caseid_idx = (x: number, y: number, z: number) => {
      return (y * d * d) + (z * d) + x;
    }

    const lookup_density = (x, y, z, v) => {
      const off = grid_offsets[v]
      const coord = [x + off[0], y + off[1], z + off[2]]
      const i = get_density_idx(coord[0], coord[1], coord[2])
      return densities[i];
    }

    const get_sample_pos = (x, y, z, v) => {
      const off = grid_offsets[v]
      const coord = [x + off[0], y + off[1], z + off[2]]
      return [
        this.sample_origin[0] + (this.sample_scale[0] * coord[0]),
        this.sample_origin[1] + (this.sample_scale[1] * coord[1]),
        this.sample_origin[2] + (this.sample_scale[2] * coord[2]),
      ]
    }

    for (let x = 0; x < d; x++) {
      for (let y = 0; y < d; y++) {
        for (let z = 0; z < d; z++) {


          let caseid = 0;
          for (let i = 0; i < 8; i++) {
            const off = grid_offsets[i];
            const coord = [x + off[0], y + off[1], z + off[2]];
            const density_idx = get_density_idx(coord[0], coord[1], coord[2]);
            const density = densities[density_idx];
            if (density > 0.) { caseid |= (1 << i) }
          }

          const voxel_idx = get_caseid_idx(x, y, z);
          caseids[voxel_idx] = caseid;
          const num_tris = LookupTablesData.num_out[caseid];

          for (let i =0; i < num_tris; i++) {

            let tri_vtxes = [];

            const edge_idx_start = (caseid * 20) + (i * 4);
            for (let j = 0; j < 3; j++) {
              const edge = LookupTablesData.tris_out[edge_idx_start + j]
              const edge_vs = edge_vtxes[edge];

              const pos_0 = get_sample_pos(x, y, z, edge_vs[0])
              const pos_1 = get_sample_pos(x, y, z, edge_vs[1])

              const d0 = lookup_density(x, y, z, edge_vs[0])
              const d1 = lookup_density(x, y, z, edge_vs[1])

              if ((d0 > 0 && d1 > 0) || (d0 < 0 && d1 < 0)) { console.error('densities both positive or negative'); }
              // number from 0 to 1 for where on line between p0 and p1 to
              // put the vtx!
              const interp = -(d0 / (d1 - d0))
              const p = [
                pos_0[0] + (interp * (pos_1[0] - pos_0[0])),
                pos_0[1] + (interp * (pos_1[1] - pos_0[1])),
                pos_0[2] + (interp * (pos_1[2] - pos_0[2])),
                1
              ];
              tri_vtxes.push(p);
            }

            const u = [
              tri_vtxes[1][0] - tri_vtxes[0][0],
              tri_vtxes[1][1] - tri_vtxes[0][1],
              tri_vtxes[1][2] - tri_vtxes[0][2]]

            const v = [
              tri_vtxes[2][0] - tri_vtxes[0][0],
              tri_vtxes[2][1] - tri_vtxes[0][1],
              tri_vtxes[2][2] - tri_vtxes[0][2]]

            const n = twgl.v3.normalize(twgl.v3.cross(u, v));

            for (let j =0;  j < 3; j++) {
              vtxes_out.push(tri_vtxes[j])
              
              const idx = idxes_out.length;
              idxes_out.push(idx);
              normals_out.push([n[0], n[1], n[2], 0]);
              colors_out.push([0., 0.3, 0.8, 1.]);
            }

          }

        }
      }
    }


    obj.num_idxes = idxes_out.length;

    console.log('num triangles', obj.num_idxes / 3)

    const gl = this.gl;

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj.idxes);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idxes_out), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    
    let vtxes_flat = []
    vtxes_out.forEach(vtx => vtx.forEach(c => vtxes_flat.push(c)));

    gl.bindBuffer(gl.ARRAY_BUFFER, obj.pts);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vtxes_flat), gl.STATIC_DRAW)

    let normals_flat = []
    normals_out.forEach(n => n.forEach(c => normals_flat.push(c)));

    gl.bindBuffer(gl.ARRAY_BUFFER, obj.normals);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals_flat), gl.STATIC_DRAW)

    let colors_flat = []
    colors_out.forEach(c => c.forEach(v => colors_flat.push(v)));

    gl.bindBuffer(gl.ARRAY_BUFFER, obj.colors);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors_flat), gl.STATIC_DRAW)

    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    // 1. generate density values for 33x33x33 grid
    // this.run_densities_sampler();

    // 2. for each voxel in grid (32x32x32 voxels) determine case ID & num triangles
    // this.run_caseids_sampler();

    // 3. generate geometry (vtxes and idxes!)
    // this.run_gen_geometry();

    // 4. run prefix scan on case id/num triangles buffer

    
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
  }

  private setup_caseids_sampler() {
    const gl = this.gl;
    this.gen_caseids_program = 
      twgl.createProgramInfo(gl, ['pixel_compute_vert', 'eval_caseids_frag']);

    this.caseids = this.gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.caseids);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RG32UI,
      this.caseids_dim_x(), this.caseids_dim_y(), 0, 
      gl.RG_INTEGER, 
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
  }

  private setup_gen_geometry() {
    const gl = this.gl;

    this.gen_geometry_program = 
      twgl.createProgramInfo(gl, ['pixel_compute_vert', 'gen_geometry_frag']);

      this.gen_geometry_vtxes = this.gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.gen_geometry_vtxes);
    gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA32UI, 
      this.gen_geometry_vtxes_dim_x, this.gen_geometry_vtxes_dim_y, 0,
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

  }

  private run_densities_sampler() {
    const gl = this.gl;

    gl.useProgram(this.gen_density_program.program)
    gl.bindVertexArray(this.compute_vao)
    twgl.setUniforms(this.gen_density_program, {
          'sample_origin': this.sample_origin,
          'sample_scale':  this.sample_scale,
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.densities_fbo);
    gl.viewport(0, 0, this.densities_dim_x(), this.densities_dim_y())

    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0)

    // Read buffer back to CPU
    // size in bytes: 4 bytes = 1 uint or 1 float
    let copy_back_buff = new ArrayBuffer(this.densities_size() * 4) 
    this.gl.readPixels(
      0, 0, 
      this.densities_dim_x(), 
      this.densities_dim_y(), 
      this.gl.RED_INTEGER, 
      this.gl.UNSIGNED_INT, 
      new Uint32Array(copy_back_buff))
    let copy_back_floats = new Float32Array(copy_back_buff);
    console.log(copy_back_floats[1])

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  }


  private run_caseids_sampler() {
    const gl = this.gl;

    gl.useProgram(this.gen_caseids_program.program)
    gl.bindVertexArray(this.compute_vao)

    twgl.setUniforms(this.gen_caseids_program, {
          'densities_texture': this.densities,
          'num_tris_texture': this.lookup_tables.num_out,
    });

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.caseids_fbo);
    gl.viewport(0, 0, this.caseids_dim_x(), this.caseids_dim_y())
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0)
    
    // Read buffer back to CPU
    let copy_back_buff = new ArrayBuffer(this.caseids_size() * 2 * 4)
    let copy_back = new Uint32Array(copy_back_buff)
    this.gl.readPixels(
      0, 0, 
      this.caseids_dim_x(), 
      this.caseids_dim_y(), 
      this.gl.RG_INTEGER, 
      this.gl.UNSIGNED_INT, 
      copy_back)
    console.log(copy_back[1000])

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private run_gen_geometry() {
    const gl = this.gl;
    gl.useProgram(this.gen_geometry_program.program);
    gl.bindVertexArray(this.compute_vao);

    twgl.setUniforms(this.gen_geometry_program, {
          'case_ids': this.caseids,
          'tris_out': this.lookup_tables.tris_out,
          'densities': this.densities,
    });

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.gen_geometry_fbo)
    gl.viewport(0, 0, this.gen_geometry_vtxes_dim_x, this.gen_geometry_vtxes_dim_y)
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0)

    // Read buffer back to CPU
    let copy_back_buff = new ArrayBuffer(this.gen_geometry_vtxes_size)
    let copy_back = new Uint32Array(copy_back_buff)
    this.gl.readPixels(
      0, 0, 
      this.gen_geometry_vtxes_dim_x, 
      this.gen_geometry_vtxes_dim_y, 
      this.gl.RGBA_INTEGER, 
      this.gl.UNSIGNED_INT, 
      copy_back)

    let copy_back_floats = new Float32Array(copy_back_buff);

    // let copy_back_floats = new Float32Array(copy_back_buff);
    // let copy_back_uints = new Uint16Array(copy_back_buff);
    console.log(copy_back[3]);

    let count = 0;

    for (let i =0; i < (1024  * 480) ; i++) {

      let _i = i * 4;
      let vtx = [copy_back[_i], copy_back[_i + 1], copy_back[_i + 2], copy_back[_i + 3]];
      let vtx_f = [copy_back_floats[_i], copy_back_floats[_i + 1], copy_back_floats[_i + 2], copy_back_floats[_i + 3]];

      if (vtx[3] != 0) {
        count++;
        if (count < 100) {
          console.log('vtx', vtx_f)
        }
        // console.log('vtx: ', vtx)
      }

    }

    console.log('vtxes count', count)

    // debugger;
    // console.log(copy_back[1000])


    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }


  private densities_dim_x() : number {
    const e = GeometryGenerator.voxels_dim + 1;
    return e * e;
  }

  private densities_dim_y(): number {
    const e = GeometryGenerator.voxels_dim + 1;
    return e;
  }

  private densities_size(): number {
    return this.densities_dim_x() * this.densities_dim_y();
  }

  private caseids_dim_x(): number {
    const e = GeometryGenerator.voxels_dim;
    return e * e;
  }

  private caseids_dim_y(): number {
    const e = GeometryGenerator.voxels_dim;
    return e; 
  }

  private caseids_size(): number {
    return this.caseids_dim_x() * this.caseids_dim_y();
  }

  // private readonly density_grid_dim = 33;
  // private readonly gen_density_dim_x = 1089;
  // private readonly gen_den

  private readonly voxel_grid_dim = 32;
  private readonly gen_geometry_vtxes_dim_x = 1024;
  private readonly gen_geometry_vtxes_dim_y = 480;
  // (1024 * 480 * 4floats_per_pixel * 4byes_per_float)
  private readonly gen_geometry_vtxes_size = 7864320; 



}