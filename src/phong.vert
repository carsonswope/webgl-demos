#version 300 es

in vec4 position;
in vec4 normal;
in vec4 color;

uniform mat4 cam_proj;
uniform mat4 cam_pos_inv;
uniform mat4 obj_pos;
uniform mat4 obj_pos_inv_tpose;

out vec4 v_color;
out vec4 v_normal;
out vec4 v_frag_pos;

void main() {

  v_frag_pos = obj_pos * position;

  gl_Position = cam_proj * cam_pos_inv * v_frag_pos;

  v_normal = vec4(mat3(obj_pos_inv_tpose) * normal.xyz, 0);
  v_color = color;
}
