#version 300 es

// precision mediump uint;

// every possible voxel / triangle / vtx given unique input
// { voxel_id (0-(dim^3)), triangle_id (0-4), vtx_id (0-2), 0 }
in uvec4 a_id;

// dimensions of output image of RGBA32F values (1 vtx per!)
uniform uvec2 out_dim;

uniform uint voxel_grid_dim;

void main() { 

	// desired coord on output image!
	float x = float(a_id.x);
	float y = float(a_id.y);

	float x_norm = (((x) / float(4 - 1)) * 2.) - 1.;
	float y_norm = (((y) / float(4 - 1)) * 2.) - 1.;

	// float px = (x == 0) ? 0. : 3.;
	// float py = (y == 0) ? 0. : 3.;

	// float ndc_x = (x == 0u) ? -1. : 0.75;
	// float ndc_y = (y == 0u) ? -1. : 0.75;

	gl_Position = vec4(x_norm, y_norm, 0, 1);

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
