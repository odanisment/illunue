// StarShader.js

export const starShader = {
  uniforms: {
    uTime: { value: 0 },
    uSpeed: { value: 1.0 },
    uColor1: { value: null },
    uColor2: { value: null },
    uTailLength: { value: 1.0 },
    uBloomIntensity: { value: 1.0 },
  },

  vertexShader: `
    varying vec2 vUv;
    varying vec3 vPosition;
    varying float vLifeProgress;

    void main() {
      vUv = uv;
      vPosition = position;
      vLifeProgress = uv.x; // Kuyruk uzunluğu geçişi için

      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: `
    uniform float uTime;
    uniform float uSpeed;
    uniform float uTailLength;
    uniform float uBloomIntensity;
    uniform vec3 uColor1;
    uniform vec3 uColor2;

    varying vec2 vUv;
    varying vec3 vPosition;
    varying float vLifeProgress;

    // Basit bir gürültü fonksiyonu (placeholder)
    float rand(vec2 co) {
      return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
    }

    void main() {
      vec2 noiseCoord = vPosition.xy * 2.0 + vec2(uTime * uSpeed * 0.5);
      float noise = rand(noiseCoord) * 0.5 + 0.5;

      float alpha = smoothstep(0.3, 0.7, noise);
      float tailFade = smoothstep(uTailLength, 0.0, vLifeProgress);
      alpha *= tailFade;

      // 🔥 Siyah leke koruması
      alpha = max(alpha, 0.05);

      // Renk geçişi (çekirdekten kuyruğa)
      vec3 coreColor = mix(uColor1, uColor2, alpha * 2.0);
      vec3 finalColor = coreColor * (0.5 + 0.5 * alpha);

      // Bloom etkisi ve fade
      finalColor *= uBloomIntensity;
      alpha *= 1.0 - smoothstep(0.8, 1.0, vLifeProgress);

      gl_FragColor = vec4(finalColor, alpha * 0.9);
    }
  `
};
