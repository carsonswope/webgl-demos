'use strict';

import * as twgl from '../node_modules/twgl.js/dist/4.x/twgl-full'

import { Cube } from './cube'

(() => {

  const canvas = document.querySelector('canvas') as HTMLCanvasElement;
  const gl = canvas.getContext('webgl2')
  if (!gl) { alert('WebGL2 not enabled for your browser!') }

  const programInfo = 
      twgl.createProgramInfo(gl, ["phong_vert", "phong_frag"])
  
  // configure vertex array!
  const vao = gl.createVertexArray()
  gl.bindVertexArray(vao)

  const positionBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  const posAttrLocation = 
      gl.getAttribLocation(programInfo.program, "position")
  gl.enableVertexAttribArray(posAttrLocation)
  gl.vertexAttribPointer(posAttrLocation, 4, gl.FLOAT, false, 0, 0)

  const normalBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer)
  const nAttrLocation = 
      gl.getAttribLocation(programInfo.program, "normal")
  gl.enableVertexAttribArray(nAttrLocation)
  gl.vertexAttribPointer(nAttrLocation, 4, gl.FLOAT, false, 0, 0);

  const colorBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer)
  const colAttrLocation = 
      gl.getAttribLocation(programInfo.program, 'color');
  gl.enableVertexAttribArray(colAttrLocation)
  gl.vertexAttribPointer(colAttrLocation, 4, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, null)

  // const colorBuffer = gl.createBuffer()
  // gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer)
  // const colAttrLocation = 
  //     gl.getAttribLocation(programInfo.program, 'color');
  // gl.enableVertexAttribArray(colAttrLocation)
  // gl.vertexAttribPointer(colAttrLocation, 4, gl.FLOAT, false, 0, 0);
  // gl.bindBuffer(gl.ARRAY_BUFFER, null)

  const indexBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
  gl.bindVertexArray(null)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)

  const cube_info = Cube.vtxes();

  // post data!
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cube_info.idxes, gl.STATIC_DRAW)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, cube_info.pts, gl.STATIC_DRAW)
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, cube_info.normals, gl.STATIC_DRAW)
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, cube_info.colors, gl.STATIC_DRAW)
  gl.bindBuffer(gl.ARRAY_BUFFER, null)

  gl.enable(gl.DEPTH_TEST)

  const render = (time) => {

    twgl.resizeCanvasToDisplaySize(canvas)
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    const aspect = canvas.clientWidth / canvas.clientHeight;
    const cam_proj = twgl.m4.perspective(60 * Math.PI / 180, aspect, 1, 2000)

    const cam_pos = 
      twgl.m4.translate(twgl.m4.identity(), twgl.v3.create(0.5, 0, 10))
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

    const light_pos = [0, 4, 0, 1]

  	gl.useProgram(programInfo.program)
    gl.bindVertexArray(vao)
  	twgl.setUniforms(programInfo, {
      'cam_proj': cam_proj,
      'cam_pos': [cam_coords[0], cam_coords[1], cam_coords[2], 1],
      'cam_pos_inv': cam_pos_inv,
      'obj_pos': obj_pos,
      'obj_pos_inv_tpose': obj_pos_inv_tpose,
      'light_pos': light_pos,
    })

    gl.drawElements(gl.TRIANGLES, cube_info.num_idxes, gl.UNSIGNED_SHORT, 0)

  	requestAnimationFrame(render)
  }
  requestAnimationFrame(render)

})();
