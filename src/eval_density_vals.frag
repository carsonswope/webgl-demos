#version 300 es

precision mediump float;
precision mediump sampler3D;

uniform uint density_grid_dim;

uniform vec4 sample_origin;
uniform vec4 sample_scale;

// dummy uniform to test realtime!
uniform float z_density_mult;

uniform sampler3D noise_tex;

out uint out_density;

void main() {
	uint d = density_grid_dim;
	ivec2 out_coord = ivec2(gl_FragCoord.xy - vec2(0.5, 0.5));

	// xyz invocation index on voxel grid
	vec3 id = vec3(
		uint(out_coord.x) % d,
		uint(out_coord.y),
		uint(out_coord.x) / d);

	// get world coord from invocation coord
	vec3 c = sample_origin.xyz + (id * sample_scale.xyz);
	
	float n = texture(noise_tex, (c)).x  * 0.1;

	float density = c.y;

	density -= n;
		// eventually byo density function!
		// 0.2 + c.y + (0.5 * cos(c.x * 1.5)) + (0.02 * c.z * c.z * z_density_mult);

	// write bits as uint..
	out_density = floatBitsToUint(density);
}
