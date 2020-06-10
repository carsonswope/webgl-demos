'use strict';

import * as twgl from '../node_modules/twgl.js/dist/4.x/twgl-full'

import {PhongObj } from './phongshader'
import { Cube } from './cube'
import {Terrain1} from './terrain1'
import {GeometryGenerator} from './lookuptables'
import {FovChecker} from './fov_checker'


const get_voxel_block_id = (coords: number[]) => {
  return `${coords[0]}c${coords[1]}c${coords[2]}`
}

const get_voxel_block_coords = (id: string) => {
  return id.split('c').map(a => +a);
}

const init_webgl = (): WebGL2RenderingContext => {

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

  gl.enable(gl.DEPTH_TEST)

  return gl;
}

const run_fn = () => {

  const gl = init_webgl();
  const canvas = gl.canvas as HTMLCanvasElement;

  const programInfo = 
      twgl.createProgramInfo(gl, ["phong_vert", "phong_frag"])
  
  let cube_obj = new PhongObj(gl, programInfo.program, Cube.vtxes());
  let terr_obj = new PhongObj(gl, programInfo.program, Terrain1.make());
  let cube_wireframe = new PhongObj(gl, programInfo.program, Cube.wireframe());

  const voxel_grid_dim = 32; // a voxel block consists of cube of voxels with this side length
  const voxel_grid_world_dim = 0.03; // every voxel block is this big in world space
  const grid_scale = voxel_grid_world_dim / voxel_grid_dim;
  
  let geometry_generator = new GeometryGenerator(gl, voxel_grid_dim);

  const vp_length = 1.;
  const fov_checker = new FovChecker(gl, vp_length, voxel_grid_world_dim);

  const max_blocks = 300;
  const max_blocks_eval_per_frame = 3;

  // objects don't start off as initialized
  let blocks_geometry: PhongObj[] = [];
  // all blocks that are known to be empty
  let known_empty_blocks: { [key: string]: boolean } = {};
  // map of block ids to where block lives in blocks_geometry
  let current_evaluated_blocks: { [key: string]: number } = {};
  // idxes of empty geometry blocks
  let empty_geometry_block_idxs: number[] = []


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


  const get_block_origin = (coords: number[]): number[] => {
    const s = voxel_grid_world_dim * 0.5;
    return [
        s + (coords[0] * voxel_grid_world_dim),
        s + (coords[1] * voxel_grid_world_dim),
        s + (coords[2] * voxel_grid_world_dim)];
  }

  const render = (time) => {

    let diff = 0;
    if (last_time != null) {
      diff = (1000 / (time - last_time));
      document.getElementById('fps').innerText = diff.toFixed(1);
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

    // let looping_voxels = true;
    // while (looping_voxels) {
    let current_hit_idx = 0;
    let i =0;

    // make list of current blocks that are eligible to be replaced, sorted by distance to camera
    const current_blocks_by_dist = Object.keys(current_evaluated_blocks).map(b_id => {
      const world_coords = get_block_origin(get_voxel_block_coords(b_id));
      let diff = twgl.v3.subtract(world_coords, cam_xyz_pos);
      diff[1] = 0; // clear y position
      const dist = twgl.v3.length(diff);
      const idx = current_evaluated_blocks[b_id];
      return { b_id, diff, idx, dist };
    }).filter(info => {
      // any very-far-out block is eligible
      if (info.dist > vp_length) return true;
      const t = cam_y_rot;
      const z = (info.diff[0] * Math.sin(t)) + (info.diff[2] * Math.cos(t));
      // positive z == behind camera
      return z > 0
    }).sort((a, b) => a.dist - b.dist); // end of array: furthest distance!

    // current_evaluated_blocks.
    const s = voxel_grid_world_dim * 0.5;

    while (i < max_blocks_eval_per_frame && current_hit_idx < voxel_xz_hits.length) {

      const hit = voxel_xz_hits[current_hit_idx++];
      for (let j = -1; j < 2 && i < max_blocks_eval_per_frame; j++) {

        const c = [hit.coord[0], j, hit.coord[1]];
        const c_id = get_voxel_block_id(c);
        // if block is already evaluated or known to be empty, continue
        if (current_evaluated_blocks[c_id] != null) continue;
        if (known_empty_blocks[c_id]) continue;

        let o;
        let idx;

        // need to fetch a new o to operate on!
        // first try: if there are any known empty evaluated blocks..
        if (empty_geometry_block_idxs.length) {
          idx = empty_geometry_block_idxs.pop();
          o = blocks_geometry[idx];

        // second try: just make a new object because not at max yet
        } else if (blocks_geometry.length < max_blocks) {
          o = new PhongObj(gl, programInfo.program, null);
          geometry_generator.init_buffers(o);
          idx = blocks_geometry.length;
          blocks_geometry.push(o);

        // third try: find furthest currently evaluated block that is behind the camera
        } else if (current_blocks_by_dist.length) {
          const info = current_blocks_by_dist.pop();
          delete current_evaluated_blocks[info.b_id];
          idx = info.idx;
          o = blocks_geometry[idx];
        } else {

          // can't find block to replace. just stop the process then
          i = max_blocks_eval_per_frame;
          break;
        }     

        const scale = [grid_scale, grid_scale, grid_scale, 0]
        const origin = [c[0] * voxel_grid_world_dim, c[1] * voxel_grid_world_dim, c[2] * voxel_grid_world_dim, 1]

        geometry_generator.run(o, origin, scale);

        if (o.num_idxes > 0) {
          current_evaluated_blocks[c_id] = idx;
        } else {
          known_empty_blocks[c_id] = true;
          empty_geometry_block_idxs.push(idx);
        }

        i++;
      }

    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    twgl.resizeCanvasToDisplaySize(gl.canvas as HTMLCanvasElement)
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  	gl.useProgram(programInfo.program)
    twgl.setUniforms(programInfo, {
      'cam_proj': cam_proj,
      'cam_pos': [cam_coords[0], cam_coords[1], cam_coords[2], 1],
      'v_cam_pos': [cam_coords[0], cam_coords[1], cam_coords[2], 1],
      'cam_pos_inv': cam_pos_inv,
      'obj_pos': op,
      'obj_pos_inv_tpose': op_inv_tp,
      'light_pos': light_pos,
      'flat_color': false,
      'fog_level': 16.,
    });

    (Object as any).keys(current_evaluated_blocks).forEach(id => {
      const i = current_evaluated_blocks[id]
      let o = blocks_geometry[i];

      const block_origin = get_block_origin(get_voxel_block_coords(id));
      const diff = [block_origin[0] - cam_xyz_pos[0], block_origin[2] - cam_xyz_pos[2]]
      const t = cam_y_rot;
      const z_r = (diff[0] * Math.sin(t)) + (diff[1] * Math.cos(t));
      if (z_r > (voxel_grid_world_dim * 2)) return; // skip drawing commands that would have no effect (behind camera)

      gl.bindVertexArray(o.vao);
      gl.drawArrays(gl.TRIANGLES, 0, o.num_idxes);
    });

  	requestAnimationFrame(render)
  }
  requestAnimationFrame(render)

};

document.addEventListener('DOMContentLoaded', run_fn);
