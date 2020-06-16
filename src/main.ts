'use strict';

import * as twgl from '../node_modules/twgl.js/dist/4.x/twgl-full'

import {PhongObj } from './phongshader'
import { Cube } from './cube'
import {Terrain1} from './terrain1'
import {GeometryGenerator} from './lookuptables'
import {FovChecker, FovVoxelHit} from './fov_checker'
import {GlCtx} from './glctx'
import {VoxelBlockGroup} from './voxelblockgroup'

const run_fn = () => {

  const glCtx = new GlCtx();
  const gl = glCtx.gl;
  const canvas = glCtx.canvas();

  const phongShader = 
      twgl.createProgramInfo(gl, ["phong_vert", "phong_frag"])
  
  let cube_obj = new PhongObj(gl, phongShader.program, Cube.vtxes());
  let terr_obj = new PhongObj(gl, phongShader.program, Terrain1.make());
  let cube_wireframe = new PhongObj(gl, phongShader.program, Cube.wireframe());

  const voxel_grid_dim = 32; // a voxel block consists of cube of voxels with this side length
  let geometry_generator = new GeometryGenerator(gl, voxel_grid_dim);


  const make_group = (diam, diam_y, max_eval, world_dim, fog) => new VoxelBlockGroup(
    geometry_generator, diam, diam_y, max_eval, world_dim, fog, () => new PhongObj(gl, phongShader.program, null));


  const f = 3.;
  const voxel_block_groups = [
    make_group(3, 1, 1, 0.12, f),
    make_group(5, 3, 1, 0.02, f),
  ]


  let last_time = null;

  let s_forward = false;
  let s_backward = false;
  let s_left = false;
  let s_right = false;

  let draw_block_wireframes = false;

  document.addEventListener('keydown', (ev) => {
    switch (ev.key) {
    case 'ArrowUp': case 'w': s_forward = true; s_backward = false; break;
    case 'ArrowDown': case 's': s_backward = true; s_forward = false; break;
    case 'ArrowLeft': case 'a': s_left = true; s_right = false; break;
    case 'ArrowRight': case 'd': s_right = true; s_left = false; break;
    }

  });

  document.addEventListener('keyup', (ev) => {
    switch (ev.key) {
    case 'ArrowUp': case 'w': s_forward = false; break;
    case 'ArrowDown': case 's':  s_backward = false; break;
    case 'ArrowLeft':  case 'a': s_left = false; break;
    case 'ArrowRight':  case 'd': s_right = false; break;
    }
  });

  document.getElementById('lock-mouse').addEventListener('click', (ev) => {
    let c = (gl.canvas as HTMLCanvasElement);
    c.requestPointerLock = c.requestPointerLock || (c as any).mozRequestPointerLock;
    c.requestPointerLock()
  })

  let cam_xyz_pos = [0, 0.03, 0];
  let cam_y_rot = 0.;
  let cam_x_rot = -0.35;

  const cam_x_rot_min = -Math.PI / 2;//-0.75;
  const cam_x_rot_max = -0.35;

  document.addEventListener('mousemove', (ev) => {
    if (document.pointerLockElement === gl.canvas || (document as any).mozPointerLockElement === gl.canvas) {
      let m = [ev.movementX, ev.movementY]
      cam_y_rot -= m[0] * 0.005;
      cam_x_rot -= m[1] * 0.005;

      cam_x_rot = Math.max(cam_x_rot, cam_x_rot_min);
      cam_x_rot = Math.min(cam_x_rot, cam_x_rot_max);
    }
  });

  const block_wireframes_checkbox = document.getElementById('block-wireframes') as HTMLInputElement;
  const fps_el = document.getElementById('fps');

  const pct_initialized_el = document.getElementById('pct-initialized');

  const render = (time) => {


    let diff = 0;
    if (last_time != null) {
      diff = (1000 / (time - last_time));
      fps_el.innerText = diff.toFixed(1);
    }
    last_time = time;

    const move_rate = 0.000011; // change per ms..
    const update_cam_xz = (dir: number) => {
      const theta = (dir * Math.PI / 2) - cam_y_rot
      cam_xyz_pos[0] += Math.cos(theta) * diff * move_rate
      cam_xyz_pos[2] += Math.sin(theta) * diff * move_rate
    }

    if (s_forward) { update_cam_xz(3) }
    if (s_backward) { update_cam_xz(1) }
    if (s_left) { update_cam_xz(2) }
    if (s_right) { update_cam_xz(0) }

    draw_block_wireframes = block_wireframes_checkbox.checked;

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

    // eval each block group with 'target' at y=0 

    // const cam_target_pos = [cam_xyz_pos[0] + 0.05, 0, cam_xyz_pos[2] + 0.05, 1]

    // -z axis of cam is where it is looking!

    const cam_pos_const_y = twgl.m4.multiply(twgl.m4.multiply(cam_translate, cam_rY), 
      twgl.m4.rotationX(Math.min(-0.4, cam_x_rot)));

    const cam_look_target = twgl.m4.transformPoint(cam_pos_const_y, [0, 0, -1]);
    const cam_look_dir = twgl.v3.normalize(twgl.v3.subtract(cam_look_target, cam_xyz_pos));

    const _t = -cam_xyz_pos[1] / cam_look_dir[1];
    const cam_look_hit_plane_pt = twgl.v3.add(cam_xyz_pos, twgl.v3.mulScalar(cam_look_dir, _t));
    const ctp = [cam_look_hit_plane_pt[0], cam_look_hit_plane_pt[1], cam_look_hit_plane_pt[2], 1]

    voxel_block_groups.forEach((v, i) => { v.tick(ctp); });

    const pct_initialized =
        voxel_block_groups.map(v => v.percent_initialized()).reduce((a, b) => a + b, 0) / voxel_block_groups.length;

    // debugger;
    pct_initialized_el.innerText = (pct_initialized * 100).toFixed(1);

    // console.log(pct_initialized);


    // voxel_block_groups.forEach(v => v.tick([0, 0, 0]));

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    twgl.resizeCanvasToDisplaySize(gl.canvas as HTMLCanvasElement)
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  	gl.useProgram(phongShader.program)


    twgl.setUniforms(phongShader, {
      'cam_proj': cam_proj,
      'cam_pos': [cam_coords[0], cam_coords[1], cam_coords[2], 1],
      'v_cam_pos': [cam_coords[0], cam_coords[1], cam_coords[2], 1],
      'cam_pos_inv': cam_pos_inv,
      'light_pos': light_pos,
      'obj_pos': op,
      'obj_pos_inv_tpose': op_inv_tp,
    });


    gl.enable(gl.CULL_FACE)
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    voxel_block_groups.forEach(v => {
      gl.clear(gl.DEPTH_BUFFER_BIT);
      v.draw(phongShader)
    })


    // the depth buffer clearing messes this up..
    if (draw_block_wireframes) {
      voxel_block_groups.forEach(v => {
        v.draw_wireframes(phongShader, cube_wireframe);
      })
    }

  	requestAnimationFrame(render)
  }
  requestAnimationFrame(render)

};

document.addEventListener('DOMContentLoaded', run_fn);
