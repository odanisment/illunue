import * as THREE from 'three';

export function createAudioPlanet({
  chunkSize,
  audioListener,
  audioLoader,
  audioFile = '/sounds/space_howling.mp3',
  radius = 10,
  planetId = 0, // 1=Fire, 2=Water, 3=Earth, 4=Wind, 5=Sun
  volume = 0.5,
  loop = true,
} = {}) {

  const group = new THREE.Group();

  const uniforms = {
    planetId: { value: planetId },
    odinFactor: { value: 0.0 },
    revealAlpha: { value: 0.0 },
    time: { value: 0.0 },
    glowIntensity: { value: 1.0 },
    flowSpeed: { value: 0.05 },
    distortionAmount: { value: 0.15 },
  };

  /* =========================
     VERTEX SHADER (UNCHANGED)
     ========================= */
  const vertexShader = /* glsl */`
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vWorldPosition;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);

      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;

      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;

      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  /* =====================================
     FRAGMENT SHADER (UPDATED – PROCEDURAL)
     ===================================== */
  const fragmentShader = /* glsl */`
    uniform int planetId;
    uniform float odinFactor;
    uniform float revealAlpha;
    uniform float time;
    uniform float glowIntensity;
    uniform float flowSpeed;
    uniform float distortionAmount;

    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vWorldPosition;

    vec2 rotate2D(vec2 uv, float th) {
      return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
    }

    // Procedural Neural Noise (mask)
    float neuro_shape(vec2 uv, float t, float p) {
      vec2 sine_acc = vec2(0.0);
      vec2 res = vec2(0.0);
      float scale = 8.0;

      for (int j = 0; j < 15; j++) {
        uv = rotate2D(uv, 1.0);
        sine_acc = rotate2D(sine_acc, 1.0);
        vec2 layer = uv * scale + float(j) + sine_acc - t;
        sine_acc += sin(layer) + 2.4 * p;
        res += (0.5 + 0.5 * cos(layer)) / scale;
        scale *= 1.2;
      }
      return res.x + res.y;
    }

    void main() {

      if (odinFactor < 0.01) discard;

      // UV flow (original behavior preserved)
      vec2 flowUv = vUv;
      float timeFlow = time * flowSpeed;

      float angle = timeFlow * 0.3;
      vec2 center = vec2(0.5);
      vec2 toCenter = flowUv - center;
      float dist = length(toCenter);

      vec2 flow = vec2(
        cos(dist * 3.0 + angle),
        sin(dist * 3.0 + angle)
      ) * distortionAmount;

      float wave = sin(flowUv.y * 10.0 + timeFlow * 2.0) * 0.02;
      flowUv.x += wave;
      flowUv += flow;

      // Neural noise mask
      vec2 uv = 0.5 * flowUv;
      float p = 0.18;
      float t = 0.001 * (time * 1000.0);

      float n = neuro_shape(uv, t, p);
      n = 1.2 * pow(n, 3.0);
      n += pow(n, 10.0);
      n = max(0.0, n - 0.5);
      n *= (1.0 - length(flowUv - 0.5));

      float signalSample = clamp(1.0 - n, 0.0, 1.0);

      float glowMask  = pow(1.0 - signalSample, 0.9);
      float alphaMask = 1.0 - signalSample;

      vec3 viewDir = normalize(vViewPosition);
      float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.0);

      // X-RAY PHASE
      float xrayIntensity = pow(1.0 - odinFactor, 1.5);
      float scanPulse = sin(time * 2.0 + vWorldPosition.y * 0.05) * 0.5 + 0.5;
      xrayIntensity *= (0.8 + scanPulse * 0.2);

      vec3 xrayGlow = vec3(0.0, 0.4, 1.0) * xrayIntensity * fresnel * 1.2;

      // Element colors
      float colorShift = sin(time * 0.3) * 0.1 + 0.9;
      vec3 centerColor;
      vec3 edgeColor;

      if (planetId == 1) {
        centerColor = vec3(1.0, 0.5, 0.1) * colorShift;
        edgeColor   = vec3(1.0, 0.0, 0.0);
      } else if (planetId == 2) {
        centerColor = vec3(0.3, 0.9, 1.0) * colorShift;
        edgeColor   = vec3(0.0, 0.5, 0.8);
      } else if (planetId == 3) {
        centerColor = vec3(0.8, 0.5, 0.2) * colorShift;
        edgeColor   = vec3(0.4, 0.25, 0.1);
      } else if (planetId == 4) {
        centerColor = vec3(1.0) * colorShift;
        edgeColor   = vec3(0.7, 0.8, 0.9);
      } else if (planetId == 5) {
        centerColor = vec3(1.0, 0.9, 0.3) * colorShift;
        edgeColor   = vec3(1.0, 0.6, 0.0);
      } else {
        centerColor = vec3(0.5) * colorShift;
        edgeColor   = vec3(0.3);
      }

      vec3 gradientColor = mix(centerColor, edgeColor, fresnel);

      vec3 baseColor = gradientColor * 0.75;
      vec3 rimColor  = gradientColor * fresnel * 0.25;
      vec3 materialColor = baseColor + glowMask * glowIntensity * baseColor + rimColor;

      vec3 finalColor = mix(xrayGlow, materialColor, odinFactor);
      finalColor = clamp(finalColor, 0.0, 1.0);

      float finalAlpha = alphaMask * revealAlpha;
      finalAlpha *= 1.25;
      finalAlpha += xrayIntensity * 0.25;
      finalAlpha = clamp(finalAlpha, 0.0, 1.0);

      gl_FragColor = vec4(finalColor, finalAlpha);
    }
  `;

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 32, 32),
    material
  );

  sphere.position.set(
    THREE.MathUtils.randFloatSpread(chunkSize),
    THREE.MathUtils.randFloatSpread(chunkSize),
    THREE.MathUtils.randFloatSpread(chunkSize)
  );

  sphere.userData.odinUniform = uniforms.odinFactor;
  sphere.userData.revealUniform = uniforms.revealAlpha;
  sphere.userData.discovered = false;
  sphere.userData.isAudioPlanet = true;

  sphere.visible = false;

  let currentGlow = 1.0;
  let targetGlow = 1.0;
  let lastGlowChangeTime = 0;

  let currentFlowSpeed = 0.05;
  let targetFlowSpeed = 0.05;
  let lastFlowChangeTime = 0;

  sphere.onBeforeRender = () => {
    uniforms.time.value = performance.now() / 1000;
    sphere.rotation.y += 0.0015;

    const now = performance.now();

    if (now - lastGlowChangeTime > 500) {
      targetGlow = THREE.MathUtils.randFloat(1.0, 1.4);
      lastGlowChangeTime = now;
    }

    currentGlow = THREE.MathUtils.lerp(currentGlow, targetGlow, 0.02);
    uniforms.glowIntensity.value = currentGlow;

    if (now - lastFlowChangeTime > 3000) {
      targetFlowSpeed = THREE.MathUtils.randFloat(0.03, 0.08);
      lastFlowChangeTime = now;
    }

    currentFlowSpeed = THREE.MathUtils.lerp(currentFlowSpeed, targetFlowSpeed, 0.01);
    uniforms.flowSpeed.value = currentFlowSpeed;
  };

  // AUDIO (UNCHANGED)
  const sound = new THREE.PositionalAudio(audioListener);
  audioLoader.load(
    audioFile,
    buffer => {
      sound.setBuffer(buffer);
      sound.setRefDistance(20);
      sound.setRolloffFactor(2.0);
      sound.setDistanceModel('exponential');
      sound.setMaxDistance(500);
      sound.setLoop(loop);
      sound.setVolume(volume);
      sound.play();
    },
    undefined,
    () => {}
  );

  sound.position.copy(sphere.position);

  group.add(sphere);
  group.add(sound);

  return group;
}
