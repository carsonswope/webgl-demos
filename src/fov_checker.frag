#version 300 es
precision mediump float;
in float voxel_dist;
out uvec2 val;
void main() { 
	val = uvec2(1, floatBitsToUint(voxel_dist));
}
