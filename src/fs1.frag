#version 300 es

precision mediump float;

in vec4 v_color;

// uniform vec2 resolution;
// uniform float time;

out vec4 outColor;

void main() {
  outColor = v_color;
}
