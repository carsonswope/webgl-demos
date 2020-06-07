#version 300 es

precision mediump float;

flat in vec4 v_normal;
flat in vec4 v_color;

layout (location = 0) out uvec4 out_normal;
layout (location = 1) out uvec4 out_color;

void main() {
	out_normal = floatBitsToUint(v_normal);
	out_color = floatBitsToUint(v_color);
}
