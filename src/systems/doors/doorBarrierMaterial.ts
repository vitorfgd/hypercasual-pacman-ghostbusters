import { Color, DoubleSide, ShaderMaterial } from 'three'

/**
 * Semi-transparent barrier with UV rim + slow pulse (no textures).
 */
export function createDoorBarrierMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new Color(0x4a98d8) },
      uEdge: { value: new Color(0xb8e8ff) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      uniform vec3 uEdge;
      varying vec2 vUv;
      void main() {
        float pulse = 0.88 + 0.12 * sin(uTime * 2.2);
        float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
        float rim = 1.0 - smoothstep(0.0, 0.2, edge);
        vec3 col = mix(uColor, uEdge, rim * 0.75);
        float alpha = (0.34 + rim * 0.32) * pulse;
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  })
}
