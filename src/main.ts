'use strict';

import * as twgl from '../node_modules/twgl.js/dist/4.x/twgl-full'

import {PhongObj } from './phongshader'
import { Cube } from './cube'
import {Terrain1} from './terrain1'
import {GeometryGenerator} from './lookuptables'
import {FovChecker} from './fov_checker'

const run_fn = () => {

  const canvas = document.querySelector('canvas') as HTMLCanvasElement;
  const gl = canvas.getContext('webgl2' /*, { antialias: false } */)
  if (!gl) { 
    alert('WebGL2 not enabled for your browser!')
    return;
  }

  const ext_names = ['EXT_float_blend', 'OES_texture_float_linear'];
  ext_names.forEach(e => {
    const ext = gl.getExtension(e);
    if (ext == null) { alert(`Required WebGL2 extension ${e} not available`) }
  });

  // const debug_ext_name = ['WEBGL_debug_renderer_info'];
  const debug_info = gl.getExtension('WEBGL_debug_renderer_info');
  let renderer_info = 'Unknown';
  if (debug_info != null) {
    renderer_info = gl.getParameter(debug_info.UNMASKED_RENDERER_WEBGL);
  }

  document.getElementById('gpu').getElementsByTagName('span')[0].innerText =
      renderer_info;

  const programInfo = 
      twgl.createProgramInfo(gl, ["phong_vert", "phong_frag"])
  
  const cube_info = Cube.vtxes();
  let cube_obj = new PhongObj(gl, programInfo.program, cube_info);

  const terrain_info = Terrain1.make();
  let terr_obj = new PhongObj(gl, programInfo.program, terrain_info);

  const cube_wireframe_info = Cube.wireframe();
  let cube_wireframe = new PhongObj(gl, programInfo.program, cube_wireframe_info);

  const voxel_grid_dim = 32;
  let geometry_generator = new GeometryGenerator(gl, voxel_grid_dim);

  const grid_dim = [8, 6, 8]
  const grid_scale = 0.0012;
  const voxel_grid_world_dim = grid_scale * voxel_grid_dim;

  const num_objs = grid_dim[0] * grid_dim[1] * grid_dim[2];

  const full_size = [
    grid_dim[0] * voxel_grid_world_dim,
    grid_dim[1] * voxel_grid_world_dim,
    grid_dim[2] * voxel_grid_world_dim]

  const start_origin = [-full_size[0] / 2, -full_size[1] / 2, -full_size[2] / 2]

  gl.enable(gl.DEPTH_TEST)

  let last_time = null;

  let s_forward = false;
  let s_backward = false;
  let s_left = false;
  let s_right =false;

  document.addEventListener('keydown', (ev) => {
    switch (ev.key) {
    case 'ArrowUp': s_forward = true; s_backward = false; break;
    case 'ArrowDown': s_backward = true; s_forward = false; break;
    case 'ArrowLeft': s_left = true; s_right = false; break;
    case 'ArrowRight': s_right = true; s_left = false; break;
    }

  });

  document.addEventListener('keyup', (ev) => {
    switch (ev.key) {
    case 'ArrowUp': s_forward = false; break;
    case 'ArrowDown': s_backward = false; break;
    case 'ArrowLeft': s_left = false; break;
    case 'ArrowRight': s_right = false; break;
    }
  });

  document.getElementById('lock-mouse').addEventListener('click', (ev) => {
    let c = (gl.canvas as HTMLCanvasElement);
    c.requestPointerLock = c.requestPointerLock || (c as any).mozRequestPointerLock;
    c.requestPointerLock()
  })

  let cam_xyz_pos = [0, 0.03, 0];
  let cam_y_rot = 0.;
  let cam_x_rot = -0.1;

  const cam_x_rot_min = -0.7;
  const cam_x_rot_max = -0.0;

  document.addEventListener('mousemove', (ev) => {
    if (document.pointerLockElement === gl.canvas || (document as any).mozPointerLockElement === gl.canvas) {
      let m = [ev.movementX, ev.movementY]
      cam_y_rot -= m[0] * 0.005;
      cam_x_rot -= m[1] * 0.005;

      cam_x_rot = Math.max(cam_x_rot, cam_x_rot_min);
      cam_x_rot = Math.min(cam_x_rot, cam_x_rot_max);
    }
  });

  const cam_fov = 50 * Math.PI / 180;
  const cam_aspect = canvas.clientWidth / canvas.clientHeight;

  const fov_checker = new FovChecker(gl, 0.5, voxel_grid_world_dim);

  const voxel_xz_hits = fov_checker.run(cam_xyz_pos, cam_fov, cam_aspect, cam_y_rot, cam_x_rot)

  let gen_objs = [];

  let o;

  let active_objs = [];

  voxel_xz_hits.forEach(v => {

    for (let i = -3; i < 3; i++) {
      if (o == null) {
        o = new PhongObj(gl, programInfo.program, null);
        geometry_generator.init_buffers(o);
      }

      const scale = [grid_scale, grid_scale, grid_scale, 0]
      const origin = [
        v.coord[0] * voxel_grid_world_dim,
        i * voxel_grid_world_dim,
        v.coord[1] * voxel_grid_world_dim,
        1]

      geometry_generator.run(o, origin, scale);

      if (o.num_idxes > 0) {
        gen_objs.push(o);
        active_objs.push([v.coord[0], i, v.coord[1]]);
        o = undefined;
      }


    }

  })

  const render = (time) => {

    let diff = 0;
    if (last_time != null) {
      diff = (1000 / (time - last_time));
      document.getElementById('fps').innerText = diff.toFixed(1);
    }
    last_time = time;

    const move_rate = 0.000015; // change per ms..
    const update_cam_xz = (dir: number) => {
      const theta = (dir * Math.PI / 2) - cam_y_rot
      cam_xyz_pos[0] += Math.cos(theta) * diff * move_rate
      cam_xyz_pos[2] += Math.sin(theta) * diff * move_rate
    }

    if (s_forward) { update_cam_xz(3) }
    if (s_backward) { update_cam_xz(1) }
    if (s_left) { update_cam_xz(2) }
    if (s_right) { update_cam_xz(0) }

    const cam_fov = 50 * Math.PI / 180;
    const cam_aspect = canvas.clientWidth / canvas.clientHeight;

    const cam_proj = twgl.m4.perspective(cam_fov, cam_aspect, 0.01, 20)
    const cam_translate = twgl.m4.translation(cam_xyz_pos)
    const cam_rX = twgl.m4.rotationX(cam_x_rot);
    const cam_rY = twgl.m4.rotationY(cam_y_rot);
    const cam_pos = twgl.m4.multiply(twgl.m4.multiply(cam_translate, cam_rY), cam_rX);

    const cam_coords = 
        twgl.m4.transformPoint(cam_pos, twgl.v3.create(0, 0, 0));
    const cam_pos_inv = twgl.m4.inverse(cam_pos)

    const op = twgl.m4.identity();
    const op_inv_tp = twgl.m4.identity();

    const light_pos = [0, 10, 0, 1]

    // returns xz coordinates of voxels in current viewport..
    const voxel_xz_hits = fov_checker.run(cam_xyz_pos, cam_fov, cam_aspect, cam_y_rot, cam_x_rot)

    // debugger;
    // console.log()

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    twgl.resizeCanvasToDisplaySize(canvas)
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  	gl.useProgram(programInfo.program)
    twgl.setUniforms(programInfo, {
      'cam_proj': cam_proj,
      'cam_pos': [cam_coords[0], cam_coords[1], cam_coords[2], 1],
      'cam_pos_inv': cam_pos_inv,
      'obj_pos': op,
      'obj_pos_inv_tpose': op_inv_tp,
      'light_pos': light_pos,
      'flat_color': false,
    })

    gen_objs.forEach(o => {
      if (o.num_idxes) {
        gl.bindVertexArray(o.vao)
        gl.drawArrays(gl.TRIANGLES, 0, o.num_idxes);
      }
    });


    

    // gl.useProgram(programInfo.program);

    gl.bindVertexArray(cube_wireframe.vao)

    voxel_xz_hits.forEach(v => {

      const s = voxel_grid_world_dim * 0.5;
      const scale = twgl.m4.scaling([s, s, s])
      const t = twgl.m4.translation([
        s + (v.coord[0] * voxel_grid_world_dim),
        s + (0 * voxel_grid_world_dim),
        s + (v.coord[1] * voxel_grid_world_dim)
        // start_origin[0] + s + (a[0] * s * 2),
        // start_origin[1] + s + (a[1] * s * 2),
        // start_origin[2] + s + (a[2] * s * 2),
        ])

      const block_tform = twgl.m4.multiply(t, scale);
      const block_tform_inverse = twgl.m4.transpose(twgl.m4.inverse(block_tform));

      twgl.setUniforms(programInfo, {
        'obj_pos': block_tform,
        'obj_pos_inv_tpose': block_tform_inverse,
        'flat_color': true,
      });
      gl.drawElements(gl.LINES, cube_wireframe.num_idxes, gl.UNSIGNED_SHORT, 0);
    })

    

    active_objs.forEach(a => {
      const s = voxel_grid_world_dim * 0.5;
      const scale = twgl.m4.scaling([s, s, s])
      const t = twgl.m4.translation([
        s + (a[0] * voxel_grid_world_dim),
        s + (a[1] * voxel_grid_world_dim),
        s + (a[2] * voxel_grid_world_dim)
        // start_origin[0] + s + (a[0] * s * 2),
        // start_origin[1] + s + (a[1] * s * 2),
        // start_origin[2] + s + (a[2] * s * 2),
        ])

      const block_tform = twgl.m4.multiply(t, scale);
      const block_tform_inverse = twgl.m4.transpose(twgl.m4.inverse(block_tform));

      twgl.setUniforms(programInfo, {
        'obj_pos': block_tform,
        'obj_pos_inv_tpose': block_tform_inverse,
        'flat_color': true,
      });
      gl.drawElements(gl.LINES, cube_wireframe.num_idxes, gl.UNSIGNED_SHORT, 0);
    });

    

    /*

    // debuggin...
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fov_checker.fov_image_fbo);
    gl.blitFramebuffer(
      0, 0, fov_checker.img_dim, fov_checker.img_dim,
      0, 0, fov_checker.img_dim, fov_checker.img_dim,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);

    */

  	requestAnimationFrame(render)
  }
  requestAnimationFrame(render)

};

document.addEventListener('DOMContentLoaded', run_fn);
