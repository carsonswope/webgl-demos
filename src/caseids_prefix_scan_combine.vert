#version 300 es

precision mediump usampler2D;

flat out uvec4 v_data;

uniform vec2 dim;
uniform uint stage;
uniform uint num_stages;

// parallel image to the output image.
uniform usampler2D img_in;

// given a coord position on output image, put vtx at proper NDC
// so the (single point) fragment it generates is at the coord.
void set_coord_out(uvec2 c) {
	vec2 coord = (2. * (vec2(c) + vec2(0.5, 0.5)) / (dim)) - 1.;
	gl_Position = vec4(coord, 0, 1);
}

uvec2 get_img_coord(uint idx) {
	return uvec2(idx % uint(dim.x), idx / uint(dim.x));
}

void set_idx_out(uint idx) {
	set_coord_out(get_img_coord(idx));
}

// nice diagram here:
// https://www.cs.cmu.edu/~guyb/papers/Ble93.pdf
void main() {
	gl_PointSize = 1.2;
	// threadID
	uint _t = uint(gl_VertexID);
	uint t = _t / 2u;
	bool t_left = _t % 2u == 0u;

	uint step = 1u << stage;
	uint i0 = (step - 1u) + (t * step * 2u);
	uint i1 = i0 + step;
	set_idx_out(t_left ? i0 : i1);

	bool first_stage = stage == num_stages - 1u;

	uvec4 info0 = texelFetch(img_in, ivec2(get_img_coord(i0)), 0);
	uvec4 info1 = texelFetch(img_in, ivec2(get_img_coord(i1)), 0);

	// reset root
	if (first_stage) { info1.z = 0u; }

	uvec4 info_out = t_left ? info0 : info1;

	info_out.z = t_left ? info1.z : info0.z + info1.z;
	// if (t_left) {
		// info_out.z = info1.z;
	// } else {
		// info_out.z = info0.z + info1.z;
	// }

	v_data = info_out;
}
