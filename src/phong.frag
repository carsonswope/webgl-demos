#version 300 es

precision mediump float;

uniform vec4 cam_pos;
uniform vec4 light_pos;
uniform bool flat_color;

uniform float fog_level;
uniform float max_cam_dist;
uniform vec4 lod_origin_pos;

in vec4 v_color;
in vec4 v_normal;
in vec4 v_frag_pos;
in float dist_to_cam;

out vec4 outColor;

void main() {

  float _dist_to_cam = 0.;
  if (max_cam_dist > 0.) {
    _dist_to_cam = length(v_frag_pos.xyz - lod_origin_pos.xyz);
  }

  if (max_cam_dist > 0. && _dist_to_cam >= max_cam_dist) discard;

  if (flat_color) {
  	outColor = v_color;
  	return;
  }

  const vec3 light_color = vec3(1., 1., 1.);
  const float ambient_strength = .2;
  const float specular_strength = 0.9;

  vec3 ambient = ambient_strength * light_color;

  vec3 light_dir = normalize((light_pos - v_frag_pos).xyz);
  vec3 norm = normalize(v_normal.xyz);
  float diff = max(dot(norm, light_dir), 0.0);
  vec3 diffuse = diff * light_color;

  vec3 view_dir = normalize(cam_pos.xyz - v_frag_pos.xyz);
  vec3 reflect_dir = reflect(-light_dir, norm);

  float spec = pow(max(dot(view_dir, reflect_dir), 0.), 64.);
  vec3 specular = specular_strength * spec * light_color;

  vec4 c = vec4((ambient + diffuse + specular) * v_color.xyz, 1);

  // if (max_cam_dist > 0.) {
    // dist_to_cam
    // float d2 = 1. / length(v_frag_pos.xyz - lod_origin_pos.xyz);
    // float d2 = 1. / (max_cam_dist - dist_to_cam);
    // c.w = 1. - (d2 * fog_level);
    // c.w = (dist_to_cam / max_cam_dist);
    // c.w = 0.5;
  // }

  if (fog_level > 0.) {
    if (dist_to_cam > 0.) {
      c.x += fog_level * dist_to_cam;
      c.y += fog_level * dist_to_cam;
      c.z += fog_level * dist_to_cam;
    }
  }

  outColor = c;

}
