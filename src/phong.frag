#version 300 es

precision mediump float;

uniform vec4 cam_pos;
uniform vec4 light_pos;

in vec4 v_color;
in vec4 v_normal;
in vec4 v_frag_pos;

out vec4 outColor;

void main() {

  const vec3 light_color = vec3(1., 1., 1.);
  const float ambient_strength = .2;
  const float specular_strength = 0.5;

  vec3 ambient = ambient_strength * light_color;

  vec3 light_dir = normalize((light_pos - v_frag_pos).xyz);
  vec3 norm = normalize(v_normal.xyz);
  float diff = max(dot(norm, light_dir), 0.0);
  vec3 diffuse = diff * light_color;

  vec3 view_dir = normalize(cam_pos.xyz - v_frag_pos.xyz);
  vec3 reflect_dir = reflect(-light_dir, norm);

  // float spec = 0.;
  float spec = pow(max(dot(view_dir, reflect_dir), 0.), 64.);
  vec3 specular = specular_strength * spec * light_color;

  outColor = vec4((ambient + diffuse + specular) * v_color.xyz, 1);

}
