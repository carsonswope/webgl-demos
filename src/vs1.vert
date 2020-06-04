#version 300 es

in vec4 position;
in vec4 color;

uniform mat4 cam_proj;
uniform mat4 cam_pos_inv;
uniform mat4 obj_pos;

out vec4 v_color;

void main() {
  gl_Position = cam_proj * cam_pos_inv * obj_pos * position;
  v_color = color;
}
