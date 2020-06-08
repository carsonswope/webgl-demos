#version 300 es

precision mediump usampler2D;
precision mediump isampler2D;

flat out uvec3 voxel_id;
flat out uint tri_idx;
flat out uint vtx_idx;
flat out uint case_id;
flat out uint v_voxel_grid_dim; 

// dimensions of output image of RGBA32F values (1 vtx per!)
uniform vec2 out_dim;
uniform uint voxel_grid_dim;

uniform usampler2D case_ids;

// given a coord position on output image, put vtx at proper NDC
// so the (single point) fragment it generates is at the coord.
void set_coord_out(uvec2 c) {
	vec2 coord = (2. * (vec2(c) + vec2(0.5, 0.5)) / (out_dim)) - 1.;
	gl_Position = vec4(coord, 0, 1);
}

// convert raw vtx idx to coord, then write out
void set_idx_out(uint i) {
	set_coord_out(uvec2(i % uint(out_dim.x), i / uint(out_dim.x)));
}

uvec4 get_voxel_case_info(uvec3 v_id) {
	uint d = voxel_grid_dim;
	uvec2 voxel_lookup_coord = uvec2((v_id.z * d) + v_id.x, v_id.y);
	return texelFetch(case_ids, ivec2(voxel_lookup_coord), 0);
}

uvec3 get_voxel_id(uint v) {
	uint d = voxel_grid_dim;
	return uvec3(v % d, v / (d * d), (v / d) % d);
}

void main() { 

	// just a little bigger than a pixel so rasterizer always picks it up!
	gl_PointSize = 1.2;

	uint v = uint(gl_VertexID);
	uint voxel_idx = v / 15u;
	voxel_id = get_voxel_id(voxel_idx);
	uint tri_vtx = v % 15u;
	tri_idx = tri_vtx / 3u;
	vtx_idx = tri_vtx % 3u;

	uvec4 voxel_case_info = get_voxel_case_info(voxel_id);
	case_id = voxel_case_info.x;

	uint num_tris = voxel_case_info.y;
	uint start_tri_idx = voxel_case_info.z;

	v_voxel_grid_dim = voxel_grid_dim;
	
	if (tri_idx < num_tris) {
		set_idx_out((start_tri_idx * 3u) + (tri_idx * 3u) + vtx_idx);
	}
}
