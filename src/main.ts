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

  // const blocks_diameter = 5; // only items within a sphere of radius d/2 from camera/target pt. are rendered. must be odd!
  // const max_blocks_eval_per_frame = 1;
  // const voxel_grid_world_dim = 0.1; // every voxel block is this big in world space

  const voxel_block_group = new VoxelBlockGroup(
      geometry_generator, 
      5, 
      1, 
      0.1,
      () => new PhongObj(gl, phongShader.program, null));

  let last_time = null;

  let s_forward = false;
  let s_backward = false;
  let s_left = false;
  let s_right =false;

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

  let cam_xyz_pos = [0, 0.04, 0];
  let cam_y_rot = 0.;
  let cam_x_rot = -0.35;

  const cam_x_rot_min = -0.75;
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

    voxel_block_group.tick(cam_xyz_pos)

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    twgl.resizeCanvasToDisplaySize(gl.canvas as HTMLCanvasElement)
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  	gl.useProgram(phongShader.program)
    twgl.setUniforms(phongShader, {
      'cam_proj': cam_proj,
      'cam_pos': [cam_coords[0], cam_coords[1], cam_coords[2], 1],
      'v_cam_pos': [cam_coords[0], cam_coords[1], cam_coords[2], 1],
      'cam_pos_inv': cam_pos_inv,
      'obj_pos': op,
      'obj_pos_inv_tpose': op_inv_tp,
      'light_pos': light_pos
    });

    voxel_block_group.draw(phongShader);

    if (draw_block_wireframes) {
      voxel_block_group.draw_wireframes(phongShader, cube_wireframe);
    }

  	requestAnimationFrame(render)
  }
  requestAnimationFrame(render)

};

document.addEventListener('DOMContentLoaded', run_fn);
