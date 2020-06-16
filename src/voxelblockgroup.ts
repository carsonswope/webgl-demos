import * as twgl from '../node_modules/twgl.js/dist/4.x/twgl-full'
import {GeometryGenerator} from './lookuptables'
import {PhongObj } from './phongshader'



const get_voxel_block_id = (coords: number[]) => {
  return `${coords[0]}c${coords[1]}c${coords[2]}`
}

const get_voxel_block_coords = (id: string) => {
  return id.split('c').map(a => +a);
}


export class VoxelBlockGroup {

  public constructor(
      private readonly gen: GeometryGenerator,
      private readonly blocks_diameter: number,
      private readonly blocks_diameter_y: number,
      private readonly max_blocks_eval_per_frame: number,
      private readonly voxel_grid_world_dim: number,
      private readonly fog_factor: number,
      private readonly make_obj: () => PhongObj,
      ) {

    this.surrounding_coords = [];
    const l = this.max_blocks_length();
    const h = this.max_blocks_height();
    for (let i = 0; i < l; i++) {
      for (let j = 0; j < l; j++) {
        for (let k = 0; k < h; k++) {
          this.surrounding_coords.push([
              i - (l - 1) / 2, 
              k - (h - 1) / 2,
              j - (l - 1) / 2]);
        }
      }
    }
  }

  public tick(
      // where to put 'origin' of LOD level
      pos: number[]) {

    this.last_eval_pos = pos;

    const current_block = [
      Math.round(pos[0] / this.voxel_grid_world_dim),
      Math.round(pos[1] / this.voxel_grid_world_dim),
      Math.round(pos[2] / this.voxel_grid_world_dim)
    ];

    // all xy coords 
    const all_voxel_xz_hits = this.surrounding_coords
        .map((c0): number[] => [
            c0[0] + current_block[0], 
            c0[1] + current_block[1],
            c0[2] + current_block[2]]);

    const missing_block_xz_hits = all_voxel_xz_hits
        .filter(c => {
          const c_id = get_voxel_block_id(c);
          return this.current_evaluated_blocks[c_id] == null &&
              !this.known_empty_blocks[c_id];
        })
        // .filter(c => this.known_empty_blocks)
        .map(c => {
          const world_coords = this.get_block_origin(c)
          let diff = twgl.v3.subtract(world_coords, pos);
          const dist = twgl.v3.length(diff);
          return { c, dist };
        })
        .sort((a, b) => a.dist - b.dist);

    let all_voxel_xz_hit_ids = {};
    all_voxel_xz_hits.forEach(h => { all_voxel_xz_hit_ids[get_voxel_block_id(h)] = true; });

    let current_hit_idx = 0;
    let i =0;

    // make list of current blocks that are eligible to be replaced
    const available_obj_blocks = Object.keys(this.current_evaluated_blocks)
        .filter(b_id => { return !all_voxel_xz_hit_ids[b_id]; })
        .map(b_id => {
          const idx = this.current_evaluated_blocks[b_id];
          return { b_id, idx};
        });

    // current_evaluated_blocks.
    const s = this.voxel_grid_world_dim * 0.5;

    while (i < this.max_blocks_eval_per_frame && current_hit_idx < missing_block_xz_hits.length) {

      const hit = missing_block_xz_hits[current_hit_idx++];

      const c = [hit.c[0], hit.c[1], hit.c[2]];
      const c_id = get_voxel_block_id(c);


      let o;
      let idx;

      // need to fetch a new o to operate on!
      // first try: if there are any known empty evaluated blocks..
      if (this.empty_geometry_block_idxs.length) {
        idx = this.empty_geometry_block_idxs.pop();
        o = this.blocks_geometry[idx];

      // second try: just make a new object because not at max yet
      } else if (this.blocks_geometry.length < this.max_blocks()) {
        o = this.make_obj();
        this.gen.init_buffers(o);
        idx = this.blocks_geometry.length;
        this.blocks_geometry.push(o);

      // third try: find furthest currently evaluated block that is behind the camera
      } else if (available_obj_blocks.length) {
        const info = available_obj_blocks.pop();
        delete this.current_evaluated_blocks[info.b_id];
        idx = info.idx;
        o = this.blocks_geometry[idx];
      } else {

        // can't find block to replace. just stop the process then
        i = this.max_blocks_eval_per_frame;
        break;
      }     

      const scale = [this.grid_scale(), this.grid_scale(), this.grid_scale(), 0]
      // const _s = voxel_grid_world_dim / 2.;
      const origin = [
          c[0] * this.voxel_grid_world_dim - s,
          c[1] * this.voxel_grid_world_dim - s,
          c[2] * this.voxel_grid_world_dim - s,
          1
          ]

      this.gen.run(o, origin, scale);

      if (o.num_idxes > 0) {
        this.current_evaluated_blocks[c_id] = idx;
        o.created_timestamp = new Date();
      } else {
        this.known_empty_blocks[c_id] = true;
        this.empty_geometry_block_idxs.push(idx);
      }

      i++;

    }

    // if not fully initialized and have spare cycles, just initialize objects
    while (this.blocks_geometry.length < this.max_blocks() && i < this.max_blocks_eval_per_frame) {
      const o = this.make_obj();
      this.gen.init_buffers(o);
      const idx = this.blocks_geometry.length;
      this.blocks_geometry.push(o);
      this.empty_geometry_block_idxs.push(idx);
    }

  }

  public draw(shader: twgl.ProgramInfo) {
    this.gen.gl.useProgram(shader.program)
    twgl.setUniforms(shader, {
      'flat_color': false,
      'fog_level': this.fog_factor,
      'max_cam_dist': (this.blocks_diameter / 2) * this.voxel_grid_world_dim,
      'lod_origin_pos': this.last_eval_pos,
    });

    (Object as any).keys(this.current_evaluated_blocks).forEach(id => {
      const i = this.current_evaluated_blocks[id]
      let o = this.blocks_geometry[i];
      this.gen.gl.bindVertexArray(o.vao);
      this.gen.gl.drawArrays(this.gen.gl.TRIANGLES, 0, o.num_idxes);
    });
  }

  public draw_wireframes(shader: twgl.ProgramInfo, obj: PhongObj) {
    const gl = this.gen.gl;

    gl.bindVertexArray(obj.vao);

    const s = this.voxel_grid_world_dim * 0.5;
    const scale = twgl.m4.scaling([s, s, s]);

    ;(Object as any).keys(this.current_evaluated_blocks).forEach(id => {
      const c = get_voxel_block_coords(id);

      const t = twgl.m4.translation([
        (c[0] * this.voxel_grid_world_dim),
        (c[1] * this.voxel_grid_world_dim),
        (c[2] * this.voxel_grid_world_dim)
      ])

      const block_tform = twgl.m4.multiply(t, scale);
      const block_tform_inverse = twgl.m4.transpose(twgl.m4.inverse(block_tform));

      twgl.setUniforms(shader, {
        'obj_pos': block_tform,
        'obj_pos_inv_tpose': block_tform_inverse,
        'flat_color': true,
        'v_color': [1., 0., 1., 1.],
        'max_cam_dist': 0.,
      });

      gl.drawElements(gl.LINES, obj.num_idxes, gl.UNSIGNED_SHORT, 0);
      

    });
  }

  public percent_initialized() {
    return this.blocks_geometry.length / this.max_blocks();
  }

  private grid_scale(): number {
    return this.voxel_grid_world_dim / this.gen.voxel_grid_dim;
  }

  private max_blocks_length() : number {
    return this.blocks_diameter + 2;
  }

  private max_blocks_height(): number {
    return this.blocks_diameter_y + 2;
  }

  private max_blocks() : number {
    const l = this.max_blocks_length();
    return l * l * this.max_blocks_height();
  }

  private get_block_origin(c: number[]): number[] {
    const s = this.voxel_grid_world_dim * 0.5;
    return [
        s + (c[0] * this.voxel_grid_world_dim),
        s + (c[1] * this.voxel_grid_world_dim),
        s + (c[2] * this.voxel_grid_world_dim)];
  }

  // private cube_wireframe = new PhongObj(gl, phongShader.program, Cube.wireframe());

  private last_eval_pos: number[];

  private surrounding_coords: number[][];

  // objects don't start off as initialized
  private blocks_geometry: PhongObj[] = [];
  // all blocks that are known to be empty
  private known_empty_blocks: { [key: string]: boolean } = {};
  // map of block ids to where block lives in blocks_geometry
  private current_evaluated_blocks: { [key: string]: number } = {};
  // idxes of empty geometry blocks
  private empty_geometry_block_idxs: number[] = []

}
