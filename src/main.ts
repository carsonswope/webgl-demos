'use strict';

import * as twgl from '../node_modules/twgl.js/dist/4.x/twgl-full'

import {PhongObj } from './phongshader'
import { Cube } from './cube'
import {Terrain1} from './terrain1'
import {GeometryGenerator} from './lookuptables'

const run_fn = () => {

  const canvas = document.querySelector('canvas') as HTMLCanvasElement;
  const gl = canvas.getContext('webgl2')
  if (!gl) { 
    alert('WebGL2 not enabled for your browser!')
    return;
  }

  const ext_names = ['EXT_float_blend', 'OES_texture_float_linear'];
  ext_names.forEach(e => {
    const ext = gl.getExtension(e);
    if (ext == null) { alert(`Required WebGL2 extension ${e} not available`) }
  });

  const programInfo = 
      twgl.createProgramInfo(gl, ["phong_vert", "phong_frag"])
  
  const cube_info = Cube.vtxes();
  let cube_obj = new PhongObj(gl, programInfo.program, cube_info);

  const terrain_info = Terrain1.make();
  let terr_obj = new PhongObj(gl, programInfo.program, terrain_info);

  const voxel_grid_dim = 32;
  let geometry_generator = new GeometryGenerator(gl, voxel_grid_dim);

  const grid_dim = [16, 4, 16]
  const grid_scale = 0.00025;
  const voxel_grid_world_dim = grid_scale * voxel_grid_dim;

  const num_objs = grid_dim[0] * grid_dim[1] * grid_dim[2];

  const full_size = [
    grid_dim[0] * voxel_grid_world_dim,
    grid_dim[1] * voxel_grid_world_dim,
    grid_dim[2] * voxel_grid_world_dim]

  const start_origin = [-full_size[0] / 2, -full_size[1] / 2, -full_size[2] / 2]
  
  let gen_objs = [];
  let i = 0;

  // const init = 

  for (let x =0; x < grid_dim[0]; x++) {
    for (let y =0; y < grid_dim[1]; y++) {
      for (let z =0; z < grid_dim[2]; z++) {

        let o = new PhongObj(gl, programInfo.program, null);
        geometry_generator.init_buffers(o);
        gen_objs.push(o);

        // low-left 
        const origin = [
          start_origin[0] + x * voxel_grid_world_dim,
          start_origin[1] + y * voxel_grid_world_dim,
          start_origin[2] + z * voxel_grid_world_dim,
          1
        ]
        const scale = [grid_scale, grid_scale, grid_scale, 0]

        geometry_generator.run(o, origin, scale)

        // keeps blocking the thread!
        document.getElementById('loading').getElementsByTagName('span')[0].innerText = '' + i;
        // can't be bothered to iterate like that..
        i++;
      }
    }
  }


  gl.enable(gl.DEPTH_TEST)

  let last_time = null;

  const render = (time) => {

    if (last_time != null) {
      document.getElementById('fps').innerText = (1000 / (time - last_time)).toFixed(1);
    }
    last_time = time;

    const get_val = (v: string) => +(document.getElementById(v) as HTMLInputElement).value;

    const v0 = get_val('v0');
    const v1 = get_val('v1');
    const v2 = get_val('v2');

    const cam_dist = v0 * 0.01;
    const cam_tX = -v1 * (Math.PI / 2.) / 100;
    const cam_tY = v2 * (Math.PI) / 100;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    twgl.resizeCanvasToDisplaySize(canvas)
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    const aspect = canvas.clientWidth / canvas.clientHeight;
    const cam_proj = twgl.m4.perspective(60 * Math.PI / 180, aspect, 0.01, 20)
    const cam_translate = twgl.m4.translation(twgl.v3.create(0., 0, cam_dist))
    const cam_rX = twgl.m4.rotationX(cam_tX);
    const cam_rY = twgl.m4.rotationY(cam_tY);
    const cam_pos = 
      twgl.m4.multiply(cam_rY, twgl.m4.multiply(cam_rX, cam_translate));

    const cam_coords = 
      twgl.m4.transformPoint(cam_pos, twgl.v3.create(0, 0, 0));
    const cam_pos_inv = twgl.m4.inverse(cam_pos)

    const op = twgl.m4.identity();
    const op_inv_tp = twgl.m4.identity();

    const light_pos = [0, 10, 0, 1]

  	gl.useProgram(programInfo.program)
    twgl.setUniforms(programInfo, {
      'cam_proj': cam_proj,
      'cam_pos': [cam_coords[0], cam_coords[1], cam_coords[2], 1],
      'cam_pos_inv': cam_pos_inv,
      'obj_pos': op,
      'obj_pos_inv_tpose': op_inv_tp,
      'light_pos': light_pos,
    })

    gen_objs.forEach(o => {
      if (o.num_idxes) {
        gl.bindVertexArray(o.vao)
        gl.drawArrays(gl.TRIANGLES, 0, o.num_idxes);
      }
    });
  	requestAnimationFrame(render)
  }
  requestAnimationFrame(render)

};

document.addEventListener('DOMContentLoaded', run_fn);
