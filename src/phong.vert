#version 300 es

in vec4 position;
in vec4 normal;
in vec4 color;

uniform vec4 v_cam_pos;
uniform mat4 cam_proj;
uniform mat4 cam_pos_inv;
uniform mat4 obj_pos;
uniform mat4 obj_pos_inv_tpose;

out vec4 v_color;
out vec4 v_normal;
out vec4 v_frag_pos;
out float dist_to_cam;

void main() {

  v_frag_pos = obj_pos * position;

  // ignore cam y for now!
  dist_to_cam = length(v_frag_pos.xyz - vec3(v_cam_pos.x, 0, v_cam_pos.z));

  gl_Position = cam_proj * cam_pos_inv * v_frag_pos;

  v_normal = vec4(mat3(obj_pos_inv_tpose) * normal.xyz, 0);
  v_color = color;
}
