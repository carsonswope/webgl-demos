#version 300 es

precision mediump usampler2D;

flat out vec4 v_normal;
flat out vec4 v_color;

uniform vec2 dim;

// img containing vtxes
uniform usampler2D vtxes;

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

vec4 fetch_vtx(uint triangle_id, uint vtx_id) {
	uint idx = (triangle_id * 3u) + vtx_id;
	uint d = uint(dim.x);
	return uintBitsToFloat(texelFetch(vtxes, ivec2(idx % d, idx / d), 0));
}

// nice diagram here:
void main() {
	gl_PointSize = 1.2;

	uint idx = uint(gl_VertexID);
	set_idx_out(idx);
	uint triangle_id = idx / 3u;
	uint vtx_id = idx % 3u;

	vec4 vtx0 = fetch_vtx(triangle_id, 0u);
	vec4 vtx1 = fetch_vtx(triangle_id, 1u);
	vec4 vtx2 = fetch_vtx(triangle_id, 2u);

	vec3 u = (vtx1 - vtx0).xyz;
	vec3 v = (vtx2 - vtx0).xyz;

	v_normal = vec4(normalize(cross(u, v)), 0);
	v_color = vec4(0., 0.7, 0.3, 1.);
}
