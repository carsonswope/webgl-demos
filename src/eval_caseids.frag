#version 300 es

precision mediump float;
precision mediump usampler2D;

out uvec4 out_caseids;

uniform usampler2D densities_texture;
uniform usampler2D num_tris_texture;

uniform uint voxel_grid_dim;

const uvec3 grid_offsets[8] = uvec3[8](
	uvec3(0, 0, 0),
	uvec3(0, 0, 1),
	uvec3(1, 0, 1),
	uvec3(1, 0, 0),
	uvec3(0, 1, 0),
	uvec3(0, 1, 1),
	uvec3(1, 1, 1),
	uvec3(1, 1, 0));

void main() {

	const uint num_tris_grid_dim = 16u;

	uint d = voxel_grid_dim;
	ivec2 out_coord = ivec2(gl_FragCoord.xy - vec2(0.5, 0.5));

	// xyz invocation coord
	uvec3 in_coord = uvec3(
		uint(out_coord.x) % d,
		uint(out_coord.y),
		uint(out_coord.x) / d);

	uint case_id =uint(0);
	uint count = 0u;
	for (uint i = 0u; i < uint(8); i++) {
		uvec3 to_sample = in_coord + grid_offsets[i];
		uvec2 lookup_coord = uvec2((to_sample.z * (d + 1u)) + to_sample.x, to_sample.y);
		uint density_int = texelFetch(densities_texture, ivec2(lookup_coord), 0).x;
		float density_float = uintBitsToFloat(density_int);
		if (density_float > 0.) { case_id |= (uint(1) << i); }
	}

	uint num_tris_out = (case_id == 0u || case_id == 255u) 
		? 0u 
		: texelFetch(
			num_tris_texture, 
			ivec2(
				case_id % num_tris_grid_dim, 
				case_id / num_tris_grid_dim),
			0).x;

	out_caseids = uvec4(
		case_id, 
		num_tris_out, 
		num_tris_out, // 2nd entry as seeds for prefix scan
		0);
}