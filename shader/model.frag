// Model: 3D shader with vertex colors, lighting, and normals.
precision lowp float;

varying vec4 Color;
varying vec3 Position, Normal;

uniform vec3 LightColor[8], LightPos[8];

void main() {
  vec3 norm = normalize(Normal);
  // Light 0 is hard-coded to be ambient light, and we calculate it differently.
  // Light 1 is hard-coded to be the sun.
  vec3 lighting = LightColor[0] * (dot(norm, LightPos[0]) + 1.0) +
                  LightColor[1] * max(dot(norm, LightPos[1]), 0.0);
  for (int i = 2; i < 8; i++) {
    lighting +=
        LightColor[i] * max(dot(norm, normalize(LightPos[1] - Position)), 0.0);
  }
  gl_FragColor = Color * vec4(lighting, 1.0);
}
