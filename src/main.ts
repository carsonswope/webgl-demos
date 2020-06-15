'use strict';

import * as twgl from '../node_modules/twgl.js/dist/4.x/twgl-full'

import {PhongObj } from './phongshader'
import { Cube } from './cube'
import {Terrain1} from './terrain1'
import {GeometryGenerator} from './lookuptables'
import {FovChecker, FovVoxelHit} from './fov_checker'
import {GlCtx} from './glctx'

const get_voxel_block_id = (coords: number[]) => {
  return `${coords[0]}c${coords[1]}c${coords[2]}`
}

const get_voxel_block_coords = (id: string) => {
  return id.split('c').map(a => +a);
}

export class ProfileTimestamp {
  id: string;
  t: number; // ms since epoch...
}

export class ProfileTimer {



  private els: ProfileTimestamp[] = [];

  public constructor() {}

  public clear() { this.els.length = 0 }

  public push(id: string) {
    this.els.push({id, t: +new Date()})
  }

  public log(title: string) {
    console.log(title)
    this.els.forEach((ts0, i0) => {
      const i1 = i0 + 1;
      if (i1 == this.els.length) return;
      const ts1 = this.els[i1];
      console.log(ts0.id, ts1.t - ts0.t)
    })
  }
}

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

  const blocks_diameter = 5; // only items within a sphere of radius d/2 from camera/target pt. are rendered. must be odd!
  const max_blocks_eval_per_frame = 1;
  const voxel_grid_world_dim = 0.1; // every voxel block is this big in world space


  const grid_scale = voxel_grid_world_dim / voxel_grid_dim;
  const max_blocks_length = blocks_diameter + 2;
  const max_blocks = max_blocks_length * max_blocks_length;
  let surrounding_coords = []
  for (let i = 0; i < max_blocks_length; i++) {
    for (let j = 0; j < max_blocks_length; j++) {
      surrounding_coords.push([
        i - (max_blocks_length - 1) / 2, 
        j - (max_blocks_length - 1) / 2]);
    }
  }

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


  const get_block_origin = (coords: number[]): number[] => {
    const s = voxel_grid_world_dim * 0.5;
    return [
        s + (coords[0] * voxel_grid_world_dim),
        s + (coords[1] * voxel_grid_world_dim),
        s + (coords[2] * voxel_grid_world_dim)];
  }

  const block_wireframes_checkbox = document.getElementById('block-wireframes') as HTMLInputElement;
  const fps_el = document.getElementById('fps');


  const render = (time) => {

    // let t = new ProfileTimer()
    // t.push('vars/matrices');

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

    const current_cam_block = [
      Math.round(cam_xyz_pos[0] / voxel_grid_world_dim),
      Math.round(cam_xyz_pos[2] / voxel_grid_world_dim)
    ];

    // all xy coords 
    const all_voxel_xz_hits = surrounding_coords
        .map((c0): number[] => [c0[0] + current_cam_block[0], c0[1] + current_cam_block[1]]);

    const missing_block_xz_hits = all_voxel_xz_hits
        .filter(v => current_evaluated_blocks[get_voxel_block_id([v[0], 0, v[1]])] == null)
        .map(c => {
          const world_coords = get_block_origin([c[0], 0, c[1]])
          let diff = twgl.v3.subtract(world_coords, cam_xyz_pos);
          diff[1] = 0;
          const dist = twgl.v3.length(diff);
          return {
            c,
            dist
          };
        })
        .sort((a, b) => a.dist - b.dist);

    let all_voxel_xz_hit_ids = {};
    all_voxel_xz_hits.forEach(h => { all_voxel_xz_hit_ids[get_voxel_block_id([h[0], 0, h[1]])] = true; });

    let current_hit_idx = 0;
    let i =0;

    // make list of current blocks that are eligible to be replaced
    const available_obj_blocks = Object.keys(current_evaluated_blocks)
        .filter(b_id => { return !all_voxel_xz_hit_ids[b_id]; })
        .map(b_id => {
          const idx = current_evaluated_blocks[b_id];
          return { b_id, idx};
        });

    // current_evaluated_blocks.
    const s = voxel_grid_world_dim * 0.5;

    while (i < max_blocks_eval_per_frame && current_hit_idx < missing_block_xz_hits.length) {

      const hit = missing_block_xz_hits[current_hit_idx++];
      for (let j = 0; j < 1 && i < max_blocks_eval_per_frame; j++) {

        const c = [hit.c[0], j, hit.c[1]];
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
          o = new PhongObj(gl, phongShader.program, null);
          geometry_generator.init_buffers(o);
          idx = blocks_geometry.length;
          blocks_geometry.push(o);

        // third try: find furthest currently evaluated block that is behind the camera
        } else if (available_obj_blocks.length) {
          const info = available_obj_blocks.pop();
          delete current_evaluated_blocks[info.b_id];
          idx = info.idx;
          o = blocks_geometry[idx];
        } else {

          // can't find block to replace. just stop the process then
          i = max_blocks_eval_per_frame;
          break;
        }     

        const scale = [grid_scale, grid_scale, grid_scale, 0]
        // const _s = voxel_grid_world_dim / 2.;
        const origin = [
            c[0] * voxel_grid_world_dim - s,
            c[1] * voxel_grid_world_dim - s,
            c[2] * voxel_grid_world_dim - s,
            1
            ]

        geometry_generator.run(o, origin, scale);

        if (o.num_idxes > 0) {
          current_evaluated_blocks[c_id] = idx;
          o.created_timestamp = time;
        } else {
          known_empty_blocks[c_id] = true;
          empty_geometry_block_idxs.push(idx);
        }

        i++;
      }

    }

    // t.push('draw');

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
      'light_pos': light_pos,
      'flat_color': false,
      'fog_level': 0.03,
      'max_cam_dist': (blocks_diameter / 2) * voxel_grid_world_dim,
    });

    (Object as any).keys(current_evaluated_blocks).forEach(id => {
      const i = current_evaluated_blocks[id]
      let o = blocks_geometry[i];
      gl.bindVertexArray(o.vao);
      gl.drawArrays(gl.TRIANGLES, 0, o.num_idxes);
    });

    twgl.setUniforms(phongShader, {
      'flat_color': true,
      'fog_level': 0.,
      'max_cam_dist': 0,
    });

    if (draw_block_wireframes) {

      gl.bindVertexArray(cube_wireframe.vao);

      const s = voxel_grid_world_dim * 0.5;
      const scale = twgl.m4.scaling([s, s, s]);

      ;(Object as any).keys(current_evaluated_blocks).forEach(id => {
        const c = get_voxel_block_coords(id);



        const t = twgl.m4.translation([
          (c[0] * voxel_grid_world_dim),
          (c[1] * voxel_grid_world_dim),
          (c[2] * voxel_grid_world_dim)
        ])

        const block_tform = twgl.m4.multiply(t, scale);
        const block_tform_inverse = twgl.m4.transpose(twgl.m4.inverse(block_tform));

        twgl.setUniforms(phongShader, {
          'obj_pos': block_tform,
          'obj_pos_inv_tpose': block_tform_inverse,
        });

        gl.drawElements(gl.LINES, cube_wireframe.num_idxes, gl.UNSIGNED_SHORT, 0);
        

      })

    }

  	requestAnimationFrame(render)
  }
  requestAnimationFrame(render)

};

document.addEventListener('DOMContentLoaded', run_fn);
