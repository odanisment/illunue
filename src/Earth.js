// Earth.js - İki Katmanlı Sistem: Yüzey + Ayrı Bulut Katmanı
import * as THREE from 'three';

export class Earth {
  constructor(position, sunDirectionFn, renderer, scene, cloudConfig = {}) {
    // ========================================
    // 🌍 ANA DÜNYA GEOMETRİSİ
    // ========================================
    const earthGeometry = new THREE.SphereGeometry(5, 64, 64);
    earthGeometry.computeTangents();

    const textureLoader = new THREE.TextureLoader();

    const loadTexture = (url) => {
      const texture = textureLoader.load(url, undefined, undefined, (err) => {
        console.error('Earth texture error:', err);
      });
      texture.minFilter = THREE.LinearMipMapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = true;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      return texture;
    };

    const dayTexture = loadTexture('./textures/earth_daymap.jpg');
    const nightTexture = loadTexture('./textures/earth_nightmap.jpg');
    const normalTexture = loadTexture('./textures/earth_normal.jpg');
    const cloudTexture = loadTexture('./textures/earth_clouds.png');
    const specTexture = loadTexture('./textures/earth_specular.jpg');

    if (renderer) {
      const maxAniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      [dayTexture, nightTexture, normalTexture, cloudTexture, specTexture].forEach(
        (texture) => {
          texture.anisotropy = maxAniso;
        }
      );
    }

    // ========================================
    // 🌍 DÜNYA YÜZEYİ SHADER (Bulutlar yok)
    // ========================================
    const earthUniforms = {
      lightDirection: { value: new THREE.Vector3() },
      dayTexture: { value: dayTexture },
      nightTexture: { value: nightTexture },
      normalMap: { value: normalTexture },
      specMap: { value: specTexture },
      odinFactor: { value: 0.0 }
    };

    const earthVertexShader = /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vViewPosition;
      varying mat3 vTBN;
      attribute vec4 tangent;

      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;

        vec3 T = normalize(mat3(modelMatrix) * tangent.xyz);
        vec3 N = normalize(mat3(modelMatrix) * normal);
        vec3 B = cross(N, T);
        vTBN = mat3(T, B, N);

        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const earthFragmentShader = /* glsl */ `
      uniform vec3 lightDirection;
      uniform sampler2D dayTexture;
      uniform sampler2D nightTexture;
      uniform sampler2D normalMap;
      uniform sampler2D specMap;
      uniform float odinFactor;

      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vViewPosition;
      varying mat3 vTBN;

      void main() {
        // ========================================
        // 🌍 NORMAL MAPPING
        // ========================================
        vec3 normalMapValue = (texture2D(normalMap, vUv).xyz * 2.0 - 1.0) * 0.6;
        vec3 realNormal = normalize(vTBN * normalMapValue);

        vec3 lightDir = normalize(lightDirection);
        float nDotL = max(dot(realNormal, lightDir), 0.0);

        // ========================================
        // 🌅 YUMUŞAK GECE-GÜNDÜZ GEÇİŞİ
        // ========================================
        vec3 dayColor = texture2D(dayTexture, vUv).rgb;
        vec3 nightColor = texture2D(nightTexture, vUv).rgb;
        
        float dayNightMix = smoothstep(0.0, 0.3, nDotL);
        vec3 dayLit = dayColor * (0.3 + nDotL * 0.7);
        vec3 nightLit = nightColor * 1.5;
        vec3 finalColor = mix(nightLit, dayLit, dayNightMix);
        
        // ========================================
        // 🌟 FRESNEL RIM LIGHT (Atmosfer etkisi)
        // ========================================
        vec3 viewDir = normalize(vViewPosition);
        float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.0);
        vec3 rimColor = vec3(0.4, 0.6, 0.9) * fresnel * 0.4;
        finalColor += rimColor * smoothstep(0.0, 0.5, nDotL);
        
        // ========================================
        // 🎨 ODIN'S SIGHT X-RAY MODE
        // ========================================
        float specSample = texture2D(specMap, vUv).r;
        float glowMask = pow(specSample, 0.9);
        float alphaMask = specSample;
        
        float darken = 0.3;
        vec3 baseColorDark = finalColor * darken;
        vec3 odinColor = mix(vec3(0.25, 0.6, 1.0), vec3(1.0), glowMask * 0.5);
        float odinGlow = glowMask * 1.0;
        
        vec3 odinRimColor = vec3(0.3, 0.7, 1.0) * fresnel * 1.2;
        vec3 odinResult = baseColorDark + odinGlow * odinColor + odinRimColor * odinFactor;
        
        finalColor = mix(finalColor, odinResult, odinFactor);
        float finalAlpha = mix(1.0, alphaMask, odinFactor);
        
        
        // ✨ BLOOM - Sadece aydınlık bölgeye (gündüz tarafı)
        // nDotL > 0.2 olan yerler (gün ışığı alan bölgeler) bloom alacak
        float bloomIntensity = smoothstep(0.1, 0.5, nDotL);  // Yumuşak geçiş
        vec3 bloomColor = finalColor * bloomIntensity * 0.3;  // 0.3 = bloom gücü (ayarlanabilir)
        
        // Odin mode'da bloom kapalı
        bloomColor *= (1.0 - odinFactor);
        
        finalColor += bloomColor;
        gl_FragColor = vec4(finalColor, finalAlpha);
      }
    `;

    const earthMaterial = new THREE.ShaderMaterial({
      uniforms: earthUniforms,
      vertexShader: earthVertexShader,
      fragmentShader: earthFragmentShader,
      lights: false,
      depthWrite: true,
      transparent: true
    });

    const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    earthMesh.rotation.y = THREE.MathUtils.degToRad(-180);
    earthMesh.rotation.z = THREE.MathUtils.degToRad(-23.4);

    // ========================================
    // ☁️ BULUT KATMANI (Ayrı Sphere - Biraz daha büyük)
    // ========================================
    const cloudGeometry = new THREE.SphereGeometry(5.05, 64, 64); // 5.0 → 5.05 (atmosfer yüksekliği)

    // ✅ Cloud config - default değerler + override
    const finalCloudConfig = {
      speed: 0.1,
      direction: new THREE.Vector2(1.0, 0.05),
      turbulence: 0.1,
      distortion: 0.05,
      detailScale: 3.0,
      ...cloudConfig  // User override
    };

    const cloudUniforms = {
      lightDirection: { value: new THREE.Vector3() },
      cloudTexture: { value: cloudTexture },
      time: { value: 0 },
      cloudSpeed: { value: finalCloudConfig.speed },
      cloudDirection: { value: finalCloudConfig.direction },
      cloudTurbulence: { value: finalCloudConfig.turbulence },
      cloudDistortion: { value: finalCloudConfig.distortion },
      cloudDetailScale: { value: finalCloudConfig.detailScale },
      odinFactor: { value: 0.0 }
    };

    const cloudVertexShader = /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldNormal;  // ✅ World space normal ekle

      void main() {
        vUv = uv;
        
        // ✅ Model space normal (yerel)
        vNormal = normalize(normalMatrix * normal);
        
        // ✅ World space normal (global - rotasyonlardan etkilenmez)
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const cloudFragmentShader = /* glsl */ `
      uniform vec3 lightDirection;
      uniform sampler2D cloudTexture;
      uniform float time;
      uniform float cloudSpeed;
      uniform vec2 cloudDirection;
      uniform float cloudTurbulence;
      uniform float cloudDistortion;
      uniform float cloudDetailScale;
      uniform float odinFactor;

      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorldNormal;  // ✅ World space normal

      // ========================================
      // 🌊 NOISE FUNCTIONS
      // ========================================
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      
      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;
        
        for(int i = 0; i < 4; i++) {
          value += amplitude * noise(p * frequency);
          frequency *= 2.0;
          amplitude *= 0.5;
        }
        
        return value;
      }
      
      float turbulence(vec2 p) {
        float t = 0.0;
        float amplitude = 1.0;
        float frequency = 1.0;
        
        for(int i = 0; i < 3; i++) {
          t += amplitude * abs(noise(p * frequency));
          frequency *= 2.0;
          amplitude *= 0.5;
        }
        
        return t;
      }

      void main() {
        // ✅ WORLD SPACE'de ışık hesaplama (rotasyondan etkilenmez)
        vec3 lightDir = normalize(lightDirection);
        float nDotL = max(dot(normalize(vWorldNormal), lightDir), 0.0);
        
        // ========================================
        // ☁️ FRACTAL BULUTLAR
        // ========================================
        vec2 baseFlow = vUv + (cloudDirection * time * cloudSpeed * 0.005);
        
        float distortion1 = fbm(vUv * cloudDetailScale + time * 0.008);  // 3x daha yavaş
        float distortion2 = fbm(vUv * cloudDetailScale * 0.5 - time * 0.005);  // 3x daha yavaş
        vec2 distortionOffset = vec2(distortion1, distortion2) * cloudDistortion;
        
        float turbulenceValue = turbulence(vUv * cloudDetailScale * 2.0 + time * 0.012);  // 3x daha yavaş
        vec2 turbulenceOffset = vec2(
          sin(turbulenceValue * 3.14159),
          cos(turbulenceValue * 3.14159)
        ) * cloudTurbulence * 0.02;
        
        vec2 cloudUV = baseFlow + distortionOffset + turbulenceOffset;
        vec4 cloudSample = texture2D(cloudTexture, fract(cloudUV));
        
        float proceduralDetail = fbm(cloudUV * cloudDetailScale * 3.0);
        cloudSample.rgb = mix(cloudSample.rgb, vec3(proceduralDetail), 0.12);  // Daha az detay
        
        float cloudDensity = dot(cloudSample.rgb, vec3(0.299, 0.587, 0.114));
        float cloudAlpha = smoothstep(0.40, 0.80, cloudDensity);  // Daha yüksek threshold = daha az bulut
        
        // ☀️ Bulut rengi - parlak beyaz
        float cloudBrightness = 0.85 + nDotL * 0.15;
        vec3 cloudColor = vec3(1.0) * cloudBrightness;
        
        // 🌑 Gölge efekti - sadece güneşe bağlı
        float cloudShadow = smoothstep(0.0, 0.2, nDotL);
        cloudColor *= (0.7 + cloudShadow * 0.3);
        
        // ✅ Atmosfer efekti KALDIRILDI - artık kameraya bağlı değil
        
        // Gece tarafında bulutlar kaybolsun (sadece güneş ışığına bağlı)
        float dayNightMix = smoothstep(0.0, 0.3, nDotL);
        
        // ========================================
        // 🎨 ODIN MODE - Bulutlar kaybolur
        // ========================================
        float finalAlpha = cloudAlpha * dayNightMix * (1.0 - odinFactor);
        
        gl_FragColor = vec4(cloudColor, finalAlpha);
      }
    `;

    const cloudMaterial = new THREE.ShaderMaterial({
      uniforms: cloudUniforms,
      vertexShader: cloudVertexShader,
      fragmentShader: cloudFragmentShader,
      transparent: true,
      depthWrite: false, // Önemli: Bulutlar şeffaf olduğu için depthWrite kapalı
      side: THREE.FrontSide
    });

    const cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
    cloudMesh.rotation.y = THREE.MathUtils.degToRad(-180);
    cloudMesh.rotation.z = THREE.MathUtils.degToRad(-23.4);

    // ========================================
    // 🌍 GROUP - Dünya + Bulutlar birlikte döner
    // ========================================
    const earthGroup = new THREE.Group();
    earthGroup.add(earthMesh);
    earthGroup.add(cloudMesh);
    earthGroup.position.copy(position);

    // ✅ userData'ya uniforms ekle (updateCelestial erişimi için)
    earthGroup.userData.earthUniforms = earthUniforms;
    earthGroup.userData.cloudUniforms = cloudUniforms;
    earthGroup.userData.earthMesh = earthMesh;  // İç mesh referansı
    earthGroup.userData.cloudMesh = cloudMesh;  // İç mesh referansı

    scene.add(earthGroup);

    this.group = earthGroup;
    this.earthMesh = earthMesh;
    this.cloudMesh = cloudMesh;
    this.earthUniforms = earthUniforms;
    this.cloudUniforms = cloudUniforms;
    this.startTime = Date.now();
  }

  animate() {
    if (!this.cloudMesh) return;
    
    // Bulut animasyonu
    this.cloudUniforms.time.value = (Date.now() - this.startTime) / 1000;
    
    // Bulutlar dünyadan biraz daha yavaş döner (görsel efekt)
    this.cloudMesh.rotation.y += 0.0001;
  }

  get object() {
    return this.group;
  }

  get mesh() {
    return this.earthMesh;
  }
}