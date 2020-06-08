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

  let geometry_generator = new GeometryGenerator(
      gl,
      32);

  let gen_objs = [];
  for (let i = 0; i < 16; i++) {
    let o = new PhongObj(gl, programInfo.program, null);
    geometry_generator.init_idxes(o);
    gen_objs.push(o);
  }

  for (let i =0; i <16; i++) {
        const u = i / 4;
        const v = i % 4;

        const pos = [(u * 0.5) - .5, -.25, (v * 0.5) - .5, 1]
        const scale = [0.02, 0.02, 0.02, 0];

        geometry_generator.run(gen_objs[i], pos, scale)
  }

  // let gen_obj = new PhongObj(gl, programInfo.program, null);
  // let gen_obj2 = new PhongObj(gl, programInfo.program ,null);

  // geometry_generator.init_idxes(gen_obj);
  // geometry_generator.init_idxes(gen_obj2);

  gl.enable(gl.DEPTH_TEST)

  let last_time = null;

  const render = (time) => {

    if (last_time != null) {
      document.getElementById('fps').innerText = (1000 / (time - last_time)).toFixed(1);
    }
    last_time = time;


    const _v: string =
        (document.getElementById('val1') as HTMLInputElement).value;
    const v = +_v;

    const _v1: string =
        (document.getElementById('val2') as HTMLInputElement).value;
    const v1 = +_v1;

    const _v2: string =
        (document.getElementById('val3') as HTMLInputElement).value;
    const v2 = +_v2;

    geometry_generator.z_density_mult = (v2 * 0.02);

    const plane_rotate_y = v * Math.PI / 100;
    const plane_tform_x = v1 / 10.
    const plane_tform_y = 0

    // geometry_generator.run(gen_obj,
        // [-1., -1., -1., 1],
        // [0.05, 0.05, 0.05, 0])

    // geometry_generator.run(gen_obj2,
        // [2., -1., -3., 1],
        // [0.35, 0.35, 0.35, 0])

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    twgl.resizeCanvasToDisplaySize(canvas)
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    const aspect = canvas.clientWidth / canvas.clientHeight;
    const cam_proj = twgl.m4.perspective(60 * Math.PI / 180, aspect, 1, 2000)

    const cam_pos = 
      twgl.m4.translate(twgl.m4.identity(), twgl.v3.create(0., 0, 2))
    const cam_coords = 
      twgl.m4.transformPoint(cam_pos, twgl.v3.create(0, 0, 0));
    const cam_pos_inv = twgl.m4.inverse(cam_pos)

    const obj_scale = twgl.m4.scaling(twgl.v3.create(1, 1, 1));

    const obj_pos = 
      twgl.m4.axisRotate(
        obj_scale,
          twgl.v3.create(.8, 0.2, 0),
          time * 0.001)
    const obj_pos_inv_tpose =
        twgl.m4.transpose(twgl.m4.inverse(obj_pos));

    const light_pos = [0, 10, 0, 1]

  	gl.useProgram(programInfo.program)

    /*
  	twgl.setUniforms(programInfo, {
      'cam_proj': cam_proj,
      'cam_pos': [cam_coords[0], cam_coords[1], cam_coords[2], 1],
      'cam_pos_inv': cam_pos_inv,
      'obj_pos': obj_pos,
      'obj_pos_inv_tpose': obj_pos_inv_tpose,
      'light_pos': light_pos,
    })
    gl.bindVertexArray(cube_obj.vao)
    gl.drawElements(gl.TRIANGLES, cube_info.num_idxes, gl.UNSIGNED_SHORT, 0)
    */

    /*

    twgl.setUniforms(programInfo, {
      'cam_proj': cam_proj,
      'cam_pos': [cam_coords[0], cam_coords[1], cam_coords[2], 1],
      'cam_pos_inv': cam_pos_inv,
      'obj_pos': 
          twgl.m4.multiply(
              twgl.m4.rotationX(plane_rotate_x),
              twgl.m4.translation(twgl.v3.create(plane_tform_x,0,plane_tform_y))),
      'obj_pos_inv_tpose': twgl.m4.identity(),
      'light_pos': light_pos,
    })
    gl.bindVertexArray(terr_obj.vao)
    gl.drawElements(gl.TRIANGLES, terr_obj.num_idxes, gl.UNSIGNED_SHORT, 0)

    */

    // const obj_os
    const op =
        twgl.m4.multiply(
              twgl.m4.rotationX(plane_rotate_y),
              twgl.m4.rotationY(plane_tform_x));
    const op_inv_tp = twgl.m4.transpose(twgl.m4.inverse(op));

    twgl.setUniforms(programInfo, {
      'cam_proj': cam_proj,
      'cam_pos': [cam_coords[0], cam_coords[1], cam_coords[2], 1],
      'cam_pos_inv': cam_pos_inv,
      'obj_pos': op,
      'obj_pos_inv_tpose': op_inv_tp,
      // 'obj_pos_inv_tpose': twgl.m4.identity(),
      'light_pos': light_pos,
    })

    for (let i =0; i < 16; i++) {
      gl.bindVertexArray(gen_objs[i].vao)
      gl.drawElements(gl.TRIANGLES, gen_objs[i].num_idxes, gl.UNSIGNED_SHORT, 0);
    }

  	requestAnimationFrame(render)
  }
  requestAnimationFrame(render)

};

document.addEventListener('DOMContentLoaded', run_fn);
