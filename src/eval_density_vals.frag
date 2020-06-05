#version 300 es

precision mediump float;

uniform vec4 sample_origin;
uniform vec4 sample_scale;

out uint out_density;

void main() {

	const uint grid_dim = uint(33);
	const uint out_dim_x = uint(1089);
	const uint out_dim_y = grid_dim;
	ivec2 out_coord = ivec2(gl_FragCoord.xy - vec2(0.5, 0.5));

	// xyz invocation coord
	vec3 in_coord = vec3(
		uint(out_coord.x) % grid_dim,
		uint(out_coord.y),
		uint(out_coord.x) / grid_dim);

	// get world coord from invocation coord
	vec3 in_world_coord =
		sample_origin.xyz + (in_coord * sample_scale.xyz);
	
	// flat plane at y = 0!
	float density = -in_world_coord.y;

	// write bits as uint..
	out_density = floatBitsToUint(density);
}
