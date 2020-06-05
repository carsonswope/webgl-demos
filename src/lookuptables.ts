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

	compute_vao: WebGLVertexArrayObject;
	compute_idxes: WebGLBuffer;
	compute_uvs: WebGLBuffer;

	gen_density_program: twgl.ProgramInfo;
	densities_fbo: WebGLFramebuffer;
	densities: WebGLTexture;

	gen_caseids_program: twgl.ProgramInfo;
	caseids_fbo: WebGLFramebuffer;
	caseids: WebGLTexture;

	sample_origin = [-16, -16, -16, 1]
	sample_scale = [1, 1, 1, 0]

	public constructor(private gl: WebGL2RenderingContext) {
		this.lookup_tables = new LookupTables(gl);

		this.setup_densities_sampler();
		this.setup_caseids_sampler();

		this.setup_compute_vao();

	}

	public run() {

		// 1. generate density values for 33x33x33 grid
		this.run_densities_sampler();

		// 2. for each voxel in grid (32x32x32 voxels) determine case ID 
		this.run_caseids_sampler();

		// 3. use lookup table for each case ID to generate num-triangles buffer
		//    for each voxel
		// 4. run prefix scan on buffer
	}

	private setup_compute_vao() {
		const gl = this.gl;
	  this.compute_vao = gl.createVertexArray()
	  gl.bindVertexArray(this.compute_vao)

	  this.compute_uvs = gl.createBuffer()
	  gl.bindBuffer(gl.ARRAY_BUFFER, this.compute_uvs);
	  let d_uvs = [ -1, -1, 1, -1, -1,  1, 1,  1];
	  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(d_uvs), gl.STATIC_DRAW);

	  // const attr = gl.getAttribLocation(this.gen_density_program.program, 'uv');
	  const attr = 0; // must be first attribute in shader?
	  gl.enableVertexAttribArray(attr);
	  gl.vertexAttribPointer(attr, 2, gl.FLOAT, false, 0, 0);

	  this.compute_idxes = gl.createBuffer()
	  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.compute_idxes)
	  let d_idxes = [0, 1, 2, 2, 1, 3]
	  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(d_idxes), gl.STATIC_DRAW)
	  gl.bindVertexArray(null)
	  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)
	}

	private setup_densities_sampler() {
		const gl = this.gl;

		this.gen_density_program = 
		twgl.createProgramInfo(gl, ['pixel_compute_vert', 'eval_density_vals_frag'])

      this.densities = this.gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.densities);
	  gl.texImage2D(
	  	gl.TEXTURE_2D, 0, gl.R32UI, 
		this.densities_dim_x(), this.densities_dim_y(), 0,
		gl.RED_INTEGER,
		gl.UNSIGNED_INT,
		null)

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

	  this.densities_fbo = gl.createFramebuffer();   
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.densities_fbo);
      gl.framebufferTexture2D(
      	gl.FRAMEBUFFER, 
      	gl.COLOR_ATTACHMENT0, 
      	gl.TEXTURE_2D, 
      	this.densities, 0);
	}

	private setup_caseids_sampler() {
		const gl = this.gl;
		this.gen_caseids_program = 
			twgl.createProgramInfo(gl, ['pixel_compute_vert', 'eval_caseids_frag']);

		this.caseids = this.gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, this.caseids);
		gl.texImage2D(
			gl.TEXTURE_2D, 0, gl.RG16UI,
			this.caseids_dim_x(), this.caseids_dim_y(), 0, 
			gl.RG_INTEGER, 
			gl.UNSIGNED_SHORT, 
			null);

		this.caseids_fbo = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.caseids_fbo);
		gl.framebufferTexture2D(
			gl.FRAMEBUFFER, 
			gl.COLOR_ATTACHMENT0, 
			gl.TEXTURE_2D, 
			this.caseids, 0)
	}

	private run_densities_sampler() {
		const gl = this.gl;
		// const edge_dim: number = (GeometryGenerator.voxels_dim + 1) 

		gl.useProgram(this.gen_density_program.program)
		gl.bindVertexArray(this.compute_vao)
		twgl.setUniforms(this.gen_density_program, {
      		'sample_origin': this.sample_origin,
      		'sample_scale':  this.sample_scale,
		});
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.densities_fbo);
		gl.viewport(0, 0, this.densities_dim_x(), this.densities_dim_y())

		gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0)

		/*
		// Read buffer back to CPU
		// size in bytes: 4 bytes = 1 uint or 1 float
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

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	}


	private run_caseids_sampler() {
		const gl = this.gl;

		gl.useProgram(this.gen_caseids_program.program)
		gl.bindVertexArray(this.compute_vao)

		twgl.setUniforms(this.gen_caseids_program, {
      		'densities_texture': this.densities,
      		'num_tris_texture': this.lookup_tables.num_out,
		});

		gl.bindFramebuffer(gl.FRAMEBUFFER, this.caseids_fbo);
		gl.viewport(0, 0, this.caseids_dim_x(), this.caseids_dim_y())

		gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0)

		/*
		// Read buffer back to CPU
		let copy_back_buff = new ArrayBuffer(this.caseids_size() * 4)
		let copy_back = new Uint16Array(copy_back_buff)
		this.gl.readPixels(
			0, 0, 
			this.caseids_dim_x(), 
			this.caseids_dim_y(), 
			this.gl.RG_INTEGER, 
			this.gl.UNSIGNED_SHORT, 
			copy_back)
		console.log(copy_back[1000])
		*/

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);

	}


	private densities_dim_x() : number {
		const e = GeometryGenerator.voxels_dim + 1;
		return e * e;
	}

	private densities_dim_y(): number {
		const e = GeometryGenerator.voxels_dim + 1;
		return e;
	}

	private densities_size(): number {
		return this.densities_dim_x() * this.densities_dim_y();
	}

	private caseids_dim_x(): number {
		const e = GeometryGenerator.voxels_dim;
		return e * e;
	}

	private caseids_dim_y(): number {
		const e = GeometryGenerator.voxels_dim;
		return e;	
	}

	private caseids_size(): number {
		return this.caseids_dim_x() * this.caseids_dim_y();
	}


}