#version 300 es

// simplest pass-through 
in vec4 uv;
void main() { gl_Position = vec4(uv.xy, 0, 1); }