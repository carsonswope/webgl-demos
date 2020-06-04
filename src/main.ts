'use strict';

import * as twgl from '../node_modules/twgl.js/dist/4.x/twgl-full'

import { Cube } from './cube'

// class ProgramData {
  // public ProgramData(gl: WebGL2RenderingContext, p: WebGLProgram) {
    // const num_attrs = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES)

  // }


// }

// function 

(() => {

  const canvas = document.querySelector('canvas') as HTMLCanvasElement;
  const gl = canvas.getContext('webgl2')
  if (!gl) { alert('WebGL2 not enabled for your browser!') }

  const programInfo = twgl.createProgramInfo(gl, ["vs1_vert", "fs1_frag"])
  
  // configure vertex array!
  const vao = gl.createVertexArray()
  gl.bindVertexArray(vao)

  const positionBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  const posAttrLocation = gl.getAttribLocation(programInfo.program, "position")
  gl.enableVertexAttribArray(posAttrLocation)
  gl.vertexAttribPointer(posAttrLocation, 4, gl.FLOAT, false, 0, 0)

  const colorBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer)
  const colAttrLocation = gl.getAttribLocation(programInfo.program, 'color');
  gl.enableVertexAttribArray(colAttrLocation)
  gl.vertexAttribPointer(colAttrLocation, 4, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, null)

  const indexBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
  gl.bindVertexArray(null)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)

  // post data!
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, Cube.idxes(), gl.STATIC_DRAW)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, Cube.vtxes(), gl.STATIC_DRAW)
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer)
  const colors = [
     0,  1,  0, 1,
     0,  0,  1, 1,
     0,  1,  0, 1,
     0,  0,  1, 1,
     0,  1,  0, 1,
     0,  0,  1, 1,
     0,  1,  0, 1,
     0,  0,  1, 1,
  ]
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW)
  gl.bindBuffer(gl.ARRAY_BUFFER, null)

  gl.enable(gl.DEPTH_TEST)

  const render = (time) => {

    twgl.resizeCanvasToDisplaySize(canvas)
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    const aspect = canvas.clientWidth / canvas.clientHeight;
    const cam_proj = twgl.m4.perspective(60 * Math.PI / 180, aspect, 1, 2000)
    const cam_pos = twgl.m4.translate(twgl.m4.identity(), twgl.v3.create(0.5, 0, -10))
    const cam_pos_inv = twgl.m4.inverse(cam_pos)
    const obj_pos = twgl.m4.axisRotate(twgl.m4.identity(), twgl.v3.create(0.707, 0.707, 0), time * 0.001)

  	gl.useProgram(programInfo.program)
    gl.bindVertexArray(vao)
  	twgl.setUniforms(programInfo, {
      'cam_proj': cam_proj,
      'cam_pos_inv': cam_pos,
      'obj_pos': obj_pos,
    })

    gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0)

  	requestAnimationFrame(render)
  }
  requestAnimationFrame(render)

})();
