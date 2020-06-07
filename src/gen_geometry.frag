#version 300 es

precision mediump usampler2D;
precision mediump isampler2D;
precision mediump float;

uniform usampler2D case_ids;
uniform isampler2D tris_out; // 5 * 256!

uniform usampler2D densities;

/*layout (location = 0)*/ out uvec4 out_vtx;
// layout (location = 1) out uint out_idx;

const ivec2 edge_vtxes[12] = ivec2[12](
	ivec2(0, 1),
	ivec2(1, 2),
	ivec2(2, 3),
	ivec2(3, 0),
	ivec2(4, 5),
	ivec2(5, 6),
	ivec2(6, 7),
	ivec2(7, 4),
	ivec2(0, 4),
	ivec2(1, 5),
	ivec2(2, 6),
	ivec2(3, 7));

const ivec3 grid_offsets[8] = ivec3[8](
	ivec3(0, 0, 0),
	ivec3(0, 0, 1),
	ivec3(1, 0, 1),
	ivec3(1, 0, 0),
	ivec3(0, 1, 0),
	ivec3(0, 1, 1),
	ivec3(1, 1, 1),
	ivec3(1, 1, 0));

void main() {

	// gl_FragCoord = vec4(10.5, 15.5, gl_FragCoord.zw);

	/*

	const int voxel_grid_dim = 32;
	const int max_vtxes_per_voxel = 3 * 5;
	ivec2 out_id = ivec2(gl_FragCoord.xy - vec2(0.5, 0.5));
	ivec2 invocation_dims = ivec2(
		// x and z of voxel_id (32 * 32)
		voxel_grid_dim * voxel_grid_dim,
		// y of voxel_id and max vertices emitted per voxel (32 * (3 * 5))
		voxel_grid_dim * max_vtxes_per_voxel);

	ivec3 voxel_id = ivec3(
		out_id.x % voxel_grid_dim,
		out_id.y / max_vtxes_per_voxel,
		out_id.x / voxel_grid_dim);

	// 0 to 15! 
	int vtx_out_id = out_id.y % max_vtxes_per_voxel;
	int tri_out_id = vtx_out_id / 3;
	int local_vtx_out_id = vtx_out_id % 3;

	// given voxel id and triangle id
	// look up which case ID and number it is

	ivec2 lookup_tex = ivec2((voxel_id.z * voxel_grid_dim) + voxel_id.x, voxel_id.y);

	uvec2 case_id_info =  texelFetch(case_ids, lookup_tex, 0).xy;
	uint case_id = case_id_info.x;
	uint num_tris_out = case_id_info.y;

	// uint edge_id = 69u;

	if (uint(tri_out_id) < num_tris_out) {
		ivec4 tri_info = texelFetch(tris_out, ivec2(tri_out_id, case_id), 0);
		uint edge_id;
		switch(local_vtx_out_id) {
			case 0:
				edge_id = uint(tri_info.x);
				break;
			case 1:
				edge_id = uint(tri_info.y);
				break;
			case 2:
				edge_id = uint(tri_info.z);
				break;
		}

		ivec2 evs = edge_vtxes[edge_id];
		int v0_id = evs.x;
		int v1_id = evs.y;

		ivec3 v0_density_id = voxel_id + grid_offsets[v0_id];
		ivec3 v1_density_id = voxel_id + grid_offsets[v1_id];

		ivec2 v0_density_lookup = 
			ivec2((v0_density_id.z * 33) + v0_density_id.x, v0_density_id.y);
		ivec2 v1_density_lookup = 
			ivec2((v1_density_id.z * 33) + v1_density_id.x, v1_density_id.y);

		uint v0_density_uint = 
			texelFetch(densities, v0_density_lookup, 0).x;
		uint v1_density_uint = 
			texelFetch(densities, v1_density_lookup, 0).x;

		float v0_density = uintBitsToFloat(v0_density_uint);
		float v1_density = uintBitsToFloat(v1_density_uint);

		// edge_id points to 2 density values in the density map!


		out_vtx = uvec4(
			floatBitsToUint(v0_density),
			floatBitsToUint(v1_density),
			floatBitsToUint(float(case_id * 1000u) + float(edge_id)),
			floatBitsToUint(float(v0_id) * 1000. + float(v1_id)));

	} else {
		out_vtx = uvec4(0, 0, 0, 0);
	}

	*/



}