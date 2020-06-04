'use strict';

import * as twgl from '../node_modules/twgl.js/dist/4.x/twgl-full'

(() => {

  const gl = document.querySelector('canvas').getContext('webgl2')
  const programInfo = twgl.createProgramInfo(gl, ["vs1_vert", "fs1_frag"]);

  const arrays = {
     position: [
     	-1, -1, 0,
     	 1, -1, 0,
     	-1,  1, 0,
     	-1,  1, 0,
     	 1, -1, 0,
     	 1,  1, 0],
  };

  const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);

  // twgl.createBufferFromArray

  const render = (time) => {

  	// debugger;

  	twgl.resizeCanvasToDisplaySize(<HTMLCanvasElement>gl.canvas)

  	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  	const uniforms = {
  		time: time * 0.001,
  		resolution: [gl.canvas.width, gl.canvas.height],
  	}

  	gl.useProgram(programInfo.program)
  	twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo)
  	twgl.setUniforms(programInfo, uniforms)
  	twgl.drawBufferInfo(gl, bufferInfo)

  	requestAnimationFrame(render)
  }
  requestAnimationFrame(render)

})();
