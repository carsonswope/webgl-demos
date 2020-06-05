import * as twgl from '../node_modules/twgl.js/dist/4.x/twgl-full'

import {LookupTablesData} from './lookuptablesdata'

export class LookupTables {

	num_out: WebGLTexture;
	edge_list: WebGLTexture;

	public constructor(gl: WebGL2RenderingContext) {

		this.num_out = gl.createTexture()
		gl.bindTexture(gl.TEXTURE_2D, this.num_out)
		gl.texImage2D(
			gl.TEXTURE_2D, 
			0, gl.R8UI, 
			16, 16, 0,
			gl.RED_INTEGER,
			gl.UNSIGNED_BYTE,
			new Uint8Array(LookupTablesData.num_out))
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		/*
		Copy back for debugging!
	    // Create a framebuffer backed by the texture
	    var framebuffer = gl.createFramebuffer();
	    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
	    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.num_out, 0);
		let copy_back = new Uint8Array(256)
		gl.readPixels(0, 0, 16, 16, gl.RED_INTEGER, gl.UNSIGNED_BYTE, copy_back)
		copy_back.forEach(a => { console.log(a) })
		gl.bindFramebuffer(gl.FRAMEBUFFER, null)
		*/


		// this.edge_list = gl.createTexture()

	}
}

export class GeometryGenerator {

	static voxels_dim: number = 32;

	lookup_tables: LookupTables;

	gen_density_program: twgl.ProgramInfo;
	_densities_vao: WebGLVertexArrayObject;
	_densities_idxes: WebGLBuffer;
	_densities_uvs: WebGLBuffer;

	densities: WebGLTexture;
	densities_fbo: WebGLFramebuffer;

	densities_dim_x() : number {
		const e = GeometryGenerator.voxels_dim + 1;
		return e * e;
	}

	densities_dim_y(): number {
		const e = GeometryGenerator.voxels_dim + 1;
		return e;
	}

	densities_size(): number {
		return this.densities_dim_x() * this.densities_dim_y();
	}

	public constructor(private gl: WebGL2RenderingContext) {
		this.lookup_tables = new LookupTables(gl);

		this.setup_densities_sampler();

	}

	public run() {

		const edge_dim: number = (GeometryGenerator.voxels_dim + 1) 

		// 1. generate density values for 33x33x33 grid
		this.gl.useProgram(this.gen_density_program.program)
		this.gl.bindVertexArray(this._densities_vao)
		twgl.setUniforms(this.gen_density_program, {
      		'sample_origin': [-16, -16, -16, 1],
      		'sample_scale':  [1, 1, 1, 0],
		});
		this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.densities_fbo);
		this.gl.viewport(0, 0, this.densities_dim_x(), this.densities_dim_y())

		this.gl.drawElements(this.gl.TRIANGLES, 6, this.gl.UNSIGNED_SHORT, 0)

		/*
		Read buffer back to CPU
		let copy_back_buff = new ArrayBuffer(this.densities_size() * 4)
		this.gl.readPixels(
			0, 0, 
			this.densities_dim_x(), 
			this.densities_dim_y(), 
			this.gl.RED_INTEGER, 
			this.gl.UNSIGNED_INT, 
			new Uint32Array(copy_back_buff))
		let copy_back_floats = new Float32Array(copy_back_buff);
		console.log(copy_back_floats[1])
		*/

		this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);



		// 2. for each voxel in grid (32x32x32 voxels) determine case ID 
		// 3. use lookup table for each case ID to generate num-triangles buffer
		//    for each voxel
		// 4. run prefix scan on buffer
	}

	private setup_densities_sampler() {
		const gl = this.gl;

		this.gen_density_program = twgl.createProgramInfo(this.gl, ['eval_density_vals_vert', 'eval_density_vals_frag'])
  // const programInfo = 
      // twgl.createProgramInfo(gl, ["phong_vert", "phong_frag"])

      this.densities = this.gl.createTexture();
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.densities);
	  this.gl.texImage2D(
	  	this.gl.TEXTURE_2D, 0, this.gl.R32UI, 
		this.densities_dim_x(), this.densities_dim_y(), 0,
		this.gl.RED_INTEGER,
		this.gl.UNSIGNED_INT,
		null)

	  this.densities_fbo = this.gl.createFramebuffer();   
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.densities_fbo);
      this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.densities, 0);
	

	  this._densities_vao = gl.createVertexArray()
	  gl.bindVertexArray(this._densities_vao)

	  this._densities_uvs = this.gl.createBuffer()
	  this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this._densities_uvs);
	  let d_uvs = [ -1, -1, 1, -1, -1,  1, 1,  1];
	  this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(d_uvs), gl.STATIC_DRAW);
	  const attr = this.gl.getAttribLocation(this.gen_density_program.program, 'uv');
	  this.gl.enableVertexAttribArray(attr);
	  this.gl.vertexAttribPointer(attr, 2, this.gl.FLOAT, false, 0, 0);

	  this._densities_idxes = this.gl.createBuffer()
	  this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this._densities_idxes)
	  let d_idxes = [0, 1, 2, 2, 1, 3]
	  this.gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(d_idxes), gl.STATIC_DRAW)
	  this.gl.bindVertexArray(null)
	  this.gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)

	}

}