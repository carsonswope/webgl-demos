#version 300 es

// precision mediump uint;

// every possible voxel / triangle / vtx given unique input
// { voxel_id (0-(dim^3)), triangle_id (0-4), vtx_id (0-2), 0 }
in uvec4 a_id;

// dimensions of output image of RGBA32F values (1 vtx per!)
uniform vec2 out_dim;

uniform uint voxel_grid_dim;

// given a coord position on output image, put vtx at proper NDC
// so the (single point) fragment it generates is at the coord.
void set_coord_out(uvec2 c) {
	vec2 coord = (2. * vec2(c) / (out_dim - 1.)) - 1.;
	gl_Position = vec4(coord, 0, 1);
}

void main() { 

	// desired coord on output image!
	set_coord_out(a_id.xy);

	// just a little bigger than a pixel so rasterizer always picks it up!
	gl_PointSize = 1.2;


/*
	uint voxel_idx = a_id.x;
	uint tri_id = a_id.y;
	uint vtx_id = a_id.z;

	uint d = voxel_grid_dim;

	uvec3 voxel_id = uvec3(
		voxel_idx % d,
		voxel_idx / (d * d),
		(voxel_idx / d) % d);

	int i = gl_VertexID;

	// float _x = (i == 0 || i =)

	gl_Position = vec4(
		0.,
		0.,
		// ((float(voxel_id.x) / (32. * 32)) * 2.) - 1.,
		// ((float(voxel_id.y) / (32. * 15.)) * 2.) - 1.,
		0.,
		1.);
		*/

}
