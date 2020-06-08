
export class PhongObjInfo {
	pts: Float32Array;
	normals: Float32Array;
	colors: Float32Array;
	idxes: Uint16Array;
	num_idxes: number;
}

export class PhongObj {
	vao: WebGLVertexArrayObject;
	pts: WebGLBuffer;
	normals: WebGLBuffer;
	colors: WebGLBuffer;
	idxes: WebGLBuffer;
	num_idxes: number;

	public constructor(
		gl: WebGL2RenderingContext,
		public program: WebGLProgram,
		data: PhongObjInfo) {

	  // configure vertex array!
	  this.vao = gl.createVertexArray()
	  gl.bindVertexArray(this.vao)

	  const buff = (name: string, size: number, type: number): WebGLBuffer => {
	  	const b = gl.createBuffer();
	  	gl.bindBuffer(gl.ARRAY_BUFFER, b)
	  	const attr = gl.getAttribLocation(program, name)
	    gl.enableVertexAttribArray(attr)
	    gl.vertexAttribPointer(attr, size, type, false, 0, 0)
	    gl.bindBuffer(gl.ARRAY_BUFFER, null);
	    return b;
	  }

	  this.pts = buff('position', 4, gl.FLOAT);
	  this.normals = buff('normal', 4, gl.FLOAT);
	  this.colors = buff('color', 4, gl.FLOAT);

	  this.idxes = gl.createBuffer()
	  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.idxes)
	  gl.bindVertexArray(null)
	  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)

	  if (data != null) {
	  	this.num_idxes = data.idxes.length;

		  // post data!
		  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.idxes)
		  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.idxes, gl.STATIC_DRAW)
		  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

		  gl.bindBuffer(gl.ARRAY_BUFFER, this.pts)
		  gl.bufferData(gl.ARRAY_BUFFER, data.pts, gl.STATIC_DRAW)
		  gl.bindBuffer(gl.ARRAY_BUFFER, null);

		  gl.bindBuffer(gl.ARRAY_BUFFER, this.normals)
		  gl.bufferData(gl.ARRAY_BUFFER, data.normals, gl.STATIC_DRAW)
		  gl.bindBuffer(gl.ARRAY_BUFFER, null);

		  gl.bindBuffer(gl.ARRAY_BUFFER, this.colors)
		  gl.bufferData(gl.ARRAY_BUFFER, data.colors, gl.STATIC_DRAW)
		  gl.bindBuffer(gl.ARRAY_BUFFER, null)
		}

	}
}
