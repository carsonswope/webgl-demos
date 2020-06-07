#version 300 es

precision mediump usampler2D;

flat out uvec4 v_data;

uniform vec2 dim;
uniform uint stage;

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


void main() {
	gl_PointSize = 1.2;
	// threadID
	uint _t = uint(gl_VertexID);

	uint t = _t / 2u;
	bool t_reduce = _t % 2u == 0u;

	uint step = 1u << stage;
	uint i0 = (step - 1u) + (t * step * 2u);
	uint i1 = i0 + step;

	uvec4 info0 = texelFetch(img_in, ivec2(get_img_coord(i0)), 0);
	uvec4 info1 = texelFetch(img_in, ivec2(get_img_coord(i1)), 0);

	set_idx_out(t_reduce ? i1 : i0);

	uvec4 info_out = t_reduce ? info1 : info0;

	if (t_reduce) { info_out.z = info0.z + info1.z; }

	v_data = info_out;
}
