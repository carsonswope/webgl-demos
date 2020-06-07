#version 300 es

flat in uvec4 v_data;
out uvec4 out_vtx;
void main() { out_vtx = v_data; }
