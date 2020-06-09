import * as twgl from '../node_modules/twgl.js/dist/4.x/twgl-full'

import {PhongObj} from './phongshader'
import {GlUtil, TexFormat} from './glutil'

class FovVoxelHit {
  coord: number[];
  dist: number;
}

export class FovChecker {

  top_ortho_cam: twgl.ProgramInfo;
  vp_depth_voxels: number;
  img_dim: number;
  fov_image: WebGLTexture;
  fov_image_fbo: WebGLFramebuffer;

  fov_image_cpu_raw: ArrayBuffer;
  fov_image_cpu: Uint32Array;
  fov_image_cpu_floats: Float32Array;

  vao: WebGLVertexArrayObject;
  pts: WebGLBuffer;
  idxes: WebGLBuffer;

  public constructor(
      private readonly gl: WebGL2RenderingContext, 
      // max depth of viewport
      private readonly cam_vp_dist: number,
      // size of a single voxel block side length
      private readonly voxel_block_size: number) {

    this.top_ortho_cam = twgl.createProgramInfo(gl, ['fov_checker_vert', 'fov_checker_frag']);

    this.vp_depth_voxels = Math.ceil(cam_vp_dist / voxel_block_size);
    this.img_dim = this.vp_depth_voxels * 2 + 1;

    this.fov_image = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.fov_image);
    // empty to start
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32UI, this.img_dim, this.img_dim, 0, gl.RG_INTEGER, gl.UNSIGNED_INT, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.fov_image_fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fov_image_fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.fov_image, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    let vtxes = [
       // put simulated camera origin slightly behind actual origin
       0,-.03,  0, 1,
       1,   1,  1, 1,
      -1,   1,  1, 1,
      -1,   1, -1, 1,
       1,   1, -1, 1,
    ]

    let idxes = [
      0, 1, 2,
      0, 2, 3,
      0, 3, 4,
      0, 4, 1
    ]

    this.vao = gl.createVertexArray()
    gl.bindVertexArray(this.vao)

    this.pts = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pts)

    const attr = gl.getAttribLocation(this.top_ortho_cam.program, 'pos')
    gl.enableVertexAttribArray(attr)
    gl.vertexAttribPointer(attr, 4, gl.FLOAT, false, 0, 0)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vtxes), gl.STATIC_DRAW); 
    gl.bindBuffer(gl.ARRAY_BUFFER, null)

    this.idxes = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.idxes)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idxes), gl.STATIC_DRAW)
    gl.bindVertexArray(null)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)

    this.fov_image_cpu_raw = new ArrayBuffer(this.img_dim * this.img_dim * 2 * 4);
    this.fov_image_cpu = new Uint32Array(this.fov_image_cpu_raw);
    this.fov_image_cpu_floats = new Float32Array(this.fov_image_cpu_raw)
  }

  public run(
      // xyz coords of cam.
      cam_world_pos: number[],
      // cam fov in radians
      cam_fov: number,
      // cam aspect ratio
      cam_ar: number,
      // cam y rotation
      cam_y_rot,
      // cam x rotation
      cam_x_rot): FovVoxelHit[] {

    const gl = this.gl;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fov_image_fbo);
    gl.clearBufferuiv(gl.COLOR, 0, new Uint32Array([0, 0, 0, 0]));

    const d = ((this.img_dim - 1) / 2) + 0.5;
    const ortho = twgl.m4.ortho(-d, d, -d, d, -500, 500);
    const cam_tform = ortho


    const vp_rot = twgl.m4.multiply(
        twgl.m4.rotationZ(-cam_y_rot - (Math.PI / 1)),
        twgl.m4.rotationX(-cam_x_rot));
    const y_side = this.vp_depth_voxels * Math.tan(cam_fov / 2);
    const x_side = y_side * cam_ar;
    const vp_scale = twgl.m4.scaling([x_side, this.vp_depth_voxels, y_side])

    // xy integer coordinates for where the camera is currently
    const cam_xz_voxel_block = [
      Math.floor(cam_world_pos[0] / this.voxel_block_size),
      Math.floor(cam_world_pos[2] / this.voxel_block_size)];

    const vp_translate = twgl.m4.translation([
      (cam_world_pos[0] / this.voxel_block_size) - cam_xz_voxel_block[0], 
      (cam_world_pos[2] / this.voxel_block_size) - cam_xz_voxel_block[1],
      0])
    const vp_tform = twgl.m4.multiply(vp_translate, twgl.m4.multiply(vp_rot, vp_scale));
    
    gl.useProgram(this.top_ortho_cam.program);
    twgl.setUniforms(this.top_ortho_cam, {
      'cam': cam_tform,
      'vp': vp_tform,
    });

    gl.bindVertexArray(this.vao);
    gl.viewport(0, 0, this.img_dim, this.img_dim);
    gl.drawElements(gl.TRIANGLES, 12, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);

    gl.readPixels(0, 0, this.img_dim, this.img_dim, gl.RG_INTEGER, gl.UNSIGNED_INT, this.fov_image_cpu);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const hits: FovVoxelHit[] = []
    for (let y =0; y < this.img_dim; y++) {
      for (let x =0; x < this.img_dim; x++) {
        const i = ((y * this.img_dim) + x) * 2;
        if (this.fov_image_cpu[i] != 0) {
          hits.push({
            coord: [
                x + cam_xz_voxel_block[0] - this.vp_depth_voxels,
                y + cam_xz_voxel_block[1] - this.vp_depth_voxels],
            dist: this.fov_image_cpu_floats[i + 1]
          });
        }
      }
    }
    hits.sort((a, b) => a.dist - b.dist);
    return hits;
  }

}
