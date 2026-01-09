import * as THREE from 'three';

export function createGradientBackgroundPlane() {
  // 🔁 Plane yerine büyük iç yüzeyli küre
  const geometry = new THREE.SphereGeometry(5000, 70, 70);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      iResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      realTimeRatio: { value: 0.0 },
      time: { value: 0.0 }
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec2 iResolution;
      uniform float realTimeRatio;
      uniform float time;

      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p ,vec2(127.1,311.7))) * 43758.5453123);
      }

      float starField(vec2 uv) {
        vec2 grid = floor(uv * 150.0);                // 🔼 Grid yoğunluğu artırıldı (100 → 120)
        vec2 f = fract(uv * 120.0);
        float h = hash(grid);
        float star = smoothstep(0.05, 0.0, length(f - 0.5)) * step(0.95, h);  // 🔽 %0.5 → %1 olasılık
        return star;
        }

      vec3 getTimeBasedTopColor(float t) {
        vec3 gece = vec3(0.05, 0.1, 0.2);
        vec3 sabah = vec3(0.212, 0.063, 0.0);
        vec3 gunduz = vec3(0.122, 0.2, 0.251);
        vec3 gunbatimi = vec3(0.231, 0.075, 0.231);

        if (t < 0.25) return mix(gece, sabah, t / 0.25);
        else if (t < 0.5) return mix(sabah, gunduz, (t - 0.25) / 0.25);
        else if (t < 0.75) return mix(gunduz, gunbatimi, (t - 0.5) / 0.25);
        else return mix(gunbatimi, gece, (t - 0.75) / 0.25);
      }

      void main() {
        vec2 uv = vUv;

        float t = realTimeRatio;
        vec3 topColor = getTimeBasedTopColor(t);
        vec3 bottomColor = vec3(0.0);
        vec3 bg = mix(bottomColor, topColor, uv.y);

        float stars = starField(uv + time * 0.0002); // yavaş parlayan yıldızlar

        vec3 finalColor = bg + vec3(stars);
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
    depthWrite: false,
    depthTest: false,
    side: THREE.BackSide // 🌌 Kamera içinden bakılan küre
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;

  return { mesh, material };
}
