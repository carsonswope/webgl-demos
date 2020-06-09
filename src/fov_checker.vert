#version 300 es

uniform mat4 cam;
uniform mat4 vp;

in vec4 pos;

out float voxel_dist;

void main() { 
	vec4 p = vp * pos;
	voxel_dist = length(p.xy); // length from 0 voxel
	gl_Position = cam * p;
 }