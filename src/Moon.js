// Moon.js - Belirgin Ay Fazı ile Güncellenmiş
// ⭐ LoadingManager desteği eklendi
import * as THREE from 'three';
import * as SunCalc from 'suncalc';

export class Moon {
  constructor(position, sunDirectionFn, renderer, scene, loadingManager = null) {
    const geometry = new THREE.SphereGeometry(1, 64, 64);
    geometry.computeTangents();

    // ⭐ LoadingManager ile TextureLoader
    const textureLoader = loadingManager
      ? new THREE.TextureLoader(loadingManager)
      : new THREE.TextureLoader();

    const loadTexture = (url) =>
      textureLoader.load(url, undefined, undefined, (err) => {
        console.error('Moon texture error:', err);
      });

    const moonTexture = loadTexture('./textures/moon.png');
    const normalTexture = loadTexture('./textures/moon_normal.png');
    const specTexture = loadTexture('./textures/moon_spec_xray.png');

    if (renderer) {
      const maxAniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      moonTexture.anisotropy = maxAniso;
      normalTexture.anisotropy = maxAniso;
      specTexture.anisotropy = maxAniso;
    }

    const initialIllumination = SunCalc.getMoonIllumination(new Date());

    const uniforms = {
      moonIllumination: { value: initialIllumination.fraction },
      lightDirection: { value: new THREE.Vector3() },
      moonTexture: { value: moonTexture },
      normalMap: { value: normalTexture },
      glowPower: { value: 0.25 },
      glowSoftness: { value: 1.0 },
      specMap: { value: specTexture },
      odinFactor: { value: 0.0 }
    };

    const vertexShader = /* glsl */ `
      varying vec2 vUv;
      varying vec3 vViewPosition;
      varying vec3 vNormal;
      varying mat3 vTBN;
      attribute vec4 tangent;

      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;

        vec3 T = normalize(mat3(modelMatrix) * tangent.xyz);
        vec3 N = normalize(mat3(modelMatrix) * normal);
        vec3 B = cross(N, T);
        vTBN = mat3(T, B, N);

        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const fragmentShader = /* glsl */ `
      uniform float moonIllumination;
      uniform vec3 lightDirection;
      uniform sampler2D moonTexture;
      uniform sampler2D normalMap;
      uniform float glowPower;
      uniform float glowSoftness;
      uniform sampler2D specMap;
      uniform float odinFactor;

      varying vec2 vUv;
      varying vec3 vViewPosition;
      varying vec3 vNormal;
      varying mat3 vTBN;

      void main() {
        vec3 normalMapValue = texture2D(normalMap, vUv).xyz * 2.0 - 1.0;
        vec3 realNormal = normalize(vTBN * normalMapValue);

        vec3 lightDir = normalize(lightDirection);
        float nDotL = max(dot(realNormal, lightDir), 0.0);

        vec4 texColor = texture2D(moonTexture, vUv);
        
        // ========================================
        // 🌙 KESKİN AY FAZI (daha belirgin ama daha parlak)
        // ========================================
        float phaseSharpness = 2.0; // Biraz daha yumuşak (2.5'ten 2.0'a)
        float phaseFactor = pow(nDotL, phaseSharpness) * moonIllumination;
        
        // Daha aydınlık ambient
        float ambientMoon = 0.2; // Artırıldı (0.01'den 0.05'e)
        vec3 ambient = texColor.rgb * ambientMoon;
        vec3 lit = texColor.rgb * phaseFactor * 1.3; // %30 daha parlak
        
        // Smooth transition
        float dayNightMix = smoothstep(0.0, 0.25, phaseFactor); // Daha yumuşak geçiş
        vec3 litBase = mix(ambient, lit, dayNightMix);

        // Glow - daha belirgin
        float rawGlow = phaseFactor * glowSoftness;
        float glow = smoothstep(0.2, 0.8, rawGlow); // Daha erken başlayan glow
        vec3 normalLitColor = litBase + glow * vec3(0.95, 0.9, 0.85) * moonIllumination * 1.2; // %20 daha parlak glow

        // ========================================
        // 🌟 Fresnel Effect (Rim Lighting) - daha parlak
        // ========================================
        vec3 viewDir = normalize(vViewPosition);
        float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.0);
        vec3 rimColor = vec3(0.7, 0.75, 0.85) * fresnel * 0.35; // Daha parlak rim
        normalLitColor += rimColor * dayNightMix; // Sadece aydınlık tarafta

        // Spec map: siyah (kraterler) = 0.0, beyaz (düz alanlar) = 1.0
        float specSample = texture2D(specMap, vUv).r;
        
        // ========================================
        // 🎨 Yumuşak Blend: Normal ↔ Odin
        // ========================================
        
        // glowMask: siyah alanlar (kraterler) parlasın
        float glowMask = pow(1.0 - specSample, 0.9);
        
        // alphaMask: siyah alanlar görünsün, beyaz alanlar transparan
        float alphaMask = 1.0 - specSample;
        
        // Odin color'u hazırla
        float darken = 0.4;
        vec3 baseColorDark = normalLitColor * darken;
        vec3 odinColor = mix(
          vec3(0.25, 0.6, 1.0),
          vec3(1.0),
          glowMask * 0.5
        );
        float odinGlow = glowMask * 2.0;
        
        // Odin modunda rim light daha belirgin
        vec3 odinRimColor = vec3(0.3, 0.7, 1.0) * fresnel * 1.5;
        vec3 odinResult = baseColorDark + odinGlow * odinColor + odinRimColor * odinFactor;
        
        // Normal ve Odin arasında yumuşak geçiş
        vec3 finalColor = mix(normalLitColor, odinResult, odinFactor);
        
        // Alpha da yumuşak geçiş
        float finalAlpha = mix(1.0, alphaMask, odinFactor);
        
        gl_FragColor = vec4(finalColor, finalAlpha);
      }
    `;

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      lights: false,
      depthWrite: false,
      transparent: true
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    scene.add(mesh);

    this.mesh = mesh;
    this.material = material;
    this.uniforms = uniforms;
  }

  get object() {
    return this.mesh;
  }
}