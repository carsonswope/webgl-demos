#version 300 es

precision mediump isampler2D;
precision mediump usampler2D;
precision mediump float;

flat in uint v_voxel_idx;
flat in uvec3 voxel_id;

flat in uint tri_idx;
flat in uint vtx_idx;

flat in uint case_id;

out uvec4 out_vtx;

flat in uint v_voxel_grid_dim;

uniform isampler2D tris_out; // 5 * 256!
uniform usampler2D densities;

uniform vec4 sample_origin;
uniform vec4 sample_scale;

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

float get_density(uvec3 v_id) {
	uint d = v_voxel_grid_dim;
	ivec2 c = ivec2((v_id.z * (d + 1u)) + v_id.x, v_id.y);
	uint d_uint = texelFetch(densities, c, 0).x;
	return uintBitsToFloat(d_uint);
}

vec3 get_sample_position(uvec3 v_id) {
	return sample_origin.xyz + (sample_scale.xyz * vec3(v_id));
}

void main() {

 	ivec4 edges_for_tri = texelFetch(tris_out, ivec2(tri_idx, case_id), 0);

 	int e;
 	switch (vtx_idx) {
	case 0u: e = edges_for_tri.x; break;
	case 1u: e = edges_for_tri.y; break;
	case 2u: e = edges_for_tri.z; break;
 	}

 	ivec2 _v = edge_vtxes[e];
 	int v0 = _v.x;
 	int v1 = _v.y;

 	uvec3 v0_id = voxel_id + uvec3(grid_offsets[v0]);
 	uvec3 v1_id = voxel_id + uvec3(grid_offsets[v1]);

 	float d0 = get_density(v0_id);
 	float d1 = get_density(v1_id);

 	vec3 p0 = get_sample_position(v0_id);
 	vec3 p1 = get_sample_position(v1_id);

 	float interp = -(d0 / (d1 - d0));
 	vec4 p = vec4(p0 + (interp * (p1 - p0)), 1.);

 	out_vtx = floatBitsToUint(p);
 }
