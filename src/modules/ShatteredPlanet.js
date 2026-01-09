// ShatteredPlanet.js - Sinematik Kırık Gezegen
// Yarısı kırılmış, içinden erimiş lav çekirdeği görünen gezegen
import * as THREE from 'three';

export class ShatteredPlanet {
  constructor(scene, position = new THREE.Vector3(0, 0, 0), config = {}) {
    this.scene = scene;
    this.config = {
      radius: config.radius || 20,
      craterCount: config.craterCount || 150,
      crackIntensity: config.crackIntensity || 0.8,
      lavaSpeed: config.lavaSpeed || 0.3,
      magmaPulseSpeed: config.magmaPulseSpeed || 1.5,
      debrisCount: config.debrisCount || 50,
      emberCount: config.emberCount || 200,
      ...config
    };

    this.group = new THREE.Group();
    this.group.position.copy(position);
    
    this.time = 0;
    this.debrisChunks = [];
    this.emberParticles = null;
    
    this.textureLoader = new THREE.TextureLoader();
    
    // Texture'ları yükle
    this.loadTextures().then(() => {
      this.createPlanet();
    });
    
    scene.add(this.group);
  }

  async loadTextures() {
    // Dış kabuk texture'ları (kraterli yüzey)
    this.surfaceTexture = await this.loadTexture('./textures/moon.png');
    this.surfaceNormal = await this.loadTexture('./textures/moon_normal.png');
    
    // Lav texture'ı (optional - procedural yapacağız)
    // this.lavaTexture = await this.loadTexture('./textures/lava.jpg');
  }

  loadTexture(url) {
    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        url,
        (texture) => {
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.minFilter = THREE.LinearMipMapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          resolve(texture);
        },
        undefined,
        (error) => {
          console.warn(`Texture load failed: ${url}`, error);
          resolve(null);
        }
      );
    });
  }

  createPlanet() {
    // 1. İç Katman - Parlak Lav Çekirdeği
    this.createLavaCore();
    
    // 2. Dış Katman - Kırık Kabuk (yarım küre)
    this.createCrackedShell();
    
    // 3. Kırık Kenarlar - Parlak Lav Sızıntısı
    this.createCrackEdges();
    
    // 4. Debris Chunks - Uçan Parçalar
    this.createDebrisChunks();
    
    // 5. Ember Particles - Kıvılcımlar
    this.createEmberParticles();
    
    console.log('🌋 ShatteredPlanet created!');
  }

  // ============================================================
  // 1️⃣ LAV ÇEKİRDEĞİ - Animasyonlu Magma
  // ============================================================
  createLavaCore() {
    const geometry = new THREE.SphereGeometry(this.config.radius * 0.95, 64, 64);
    
    const uniforms = {
      time: { value: 0 },
      lavaSpeed: { value: this.config.lavaSpeed },
      magmaPulseSpeed: { value: this.config.magmaPulseSpeed },
      coreRadius: { value: this.config.radius * 0.95 }
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: this.getLavaCoreVertexShader(),
      fragmentShader: this.getLavaCoreFragmentShader(),
      side: THREE.DoubleSide,
      transparent: false,
      depthWrite: true
    });

    this.lavaCore = new THREE.Mesh(geometry, material);
    this.group.add(this.lavaCore);
  }

  getLavaCoreVertexShader() {
    return /* glsl */`
      varying vec2 vUv;
      varying vec3 vPosition;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;

      void main() {
        vUv = uv;
        vPosition = position;
        vNormal = normalize(normalMatrix * normal);
        
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
  }

  getLavaCoreFragmentShader() {
    return /* glsl */`
      uniform float time;
      uniform float lavaSpeed;
      uniform float magmaPulseSpeed;
      uniform float coreRadius;

      varying vec2 vUv;
      varying vec3 vPosition;
      varying vec3 vNormal;
      varying vec3 vWorldPosition;

      // ========================================
      // 🔥 PROCEDURAL NOISE FUNCTIONS
      // ========================================
      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      float noise(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        
        return mix(
          mix(
            mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
            mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x),
            f.y
          ),
          mix(
            mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
            mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x),
            f.y
          ),
          f.z
        );
      }

      float fbm(vec3 p) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;
        
        for(int i = 0; i < 5; i++) {
          value += amplitude * noise(p * frequency);
          frequency *= 2.0;
          amplitude *= 0.5;
        }
        
        return value;
      }

      void main() {
        // ========================================
        // 🌋 LAVA FLOW ANIMATION
        // ========================================
        vec3 flowPos = vWorldPosition * 0.3;
        flowPos.y += time * lavaSpeed * 0.5;
        flowPos.x += sin(time * 0.3 + vWorldPosition.z * 0.5) * 0.2;
        
        float lavaPattern = fbm(flowPos);
        
        // Magma pulseleri - kalp atışı gibi
        float pulse = sin(time * magmaPulseSpeed) * 0.5 + 0.5;
        pulse = pow(pulse, 2.0); // Daha keskin pulse
        
        // Sıcak ve soğuk lav bölgeleri
        float heatVariation = fbm(vWorldPosition * 0.5 + time * 0.1);
        
        // ========================================
        // 🎨 LAVA COLOR GRADIENT
        // ========================================
        // Çok sıcak (beyaz) -> Sıcak (sarı) -> Orta (turuncu) -> Soğuk (koyu kırmızı)
        vec3 hottest = vec3(1.0, 1.0, 0.95);     // Neredeyse beyaz
        vec3 hot = vec3(1.0, 0.9, 0.3);          // Parlak sarı
        vec3 medium = vec3(1.0, 0.4, 0.1);       // Turuncu
        vec3 cool = vec3(0.6, 0.1, 0.05);        // Koyu kırmızı
        vec3 coldest = vec3(0.2, 0.05, 0.02);    // Neredeyse siyah
        
        // Renk geçişi
        float temp = lavaPattern + heatVariation * 0.3 + pulse * 0.4;
        
        vec3 lavaColor;
        if (temp > 0.8) {
          lavaColor = mix(hot, hottest, (temp - 0.8) * 5.0);
        } else if (temp > 0.6) {
          lavaColor = mix(medium, hot, (temp - 0.6) * 5.0);
        } else if (temp > 0.3) {
          lavaColor = mix(cool, medium, (temp - 0.3) * 3.33);
        } else {
          lavaColor = mix(coldest, cool, temp * 3.33);
        }
        
        // Pulse ile parlaklık artışı
        lavaColor += vec3(0.3, 0.2, 0.1) * pulse;
        
        // 🔥 EXTREME Emissive boost (bloom için - sadece lav parlar!)
        // Normal emissive: 1.0-2.0
        // Lav emissive: 4.0-8.0 (bloom threshold 0.85'i geçmeli)
        float emissiveBoost = 5.0 + pulse * 3.0;
        lavaColor *= emissiveBoost;
        
        gl_FragColor = vec4(lavaColor, 1.0);
      }
    `;
  }

  // ============================================================
  // 2️⃣ KIRIK KABUK - Yarım Küre Kraterli Yüzey
  // ============================================================
  createCrackedShell() {
    // TAM küre geometry oluştur (yarım değil)
    const geometry = new THREE.SphereGeometry(
      this.config.radius,
      128,  // Yüksek detay
      128
    );
    
    // ============================================
    // 🔨 PARÇALANMIŞ BÖLGE OLUŞTURMA
    // ============================================
    this.createShatteredRegion(geometry);

    const uniforms = {
      time: { value: 0 },
      surfaceTexture: { value: this.surfaceTexture },
      surfaceNormal: { value: this.surfaceNormal },
      crackIntensity: { value: this.config.crackIntensity },
      lavaGlowColor: { value: new THREE.Color(1.0, 0.4, 0.1) }
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: this.getShellVertexShader(),
      fragmentShader: this.getShellFragmentShader(),
      side: THREE.DoubleSide,
      transparent: true,  // Alpha için
      depthWrite: true
    });

    this.crackedShell = new THREE.Mesh(geometry, material);
    this.group.add(this.crackedShell);
  }

  // ============================================
  // 🌋 PARÇALANMIŞ BÖLGE - Düzensiz Kenarlar
  // ============================================
  createShatteredRegion(geometry) {
    const positions = geometry.attributes.position;
    const posArray = positions.array;
    
    // Her vertex için visibility flag
    const vertexVisibility = new Float32Array(positions.count);
    
    for (let i = 0; i < positions.count; i++) {
      const x = posArray[i * 3];
      const y = posArray[i * 3 + 1];
      const z = posArray[i * 3 + 2];
      
      const vertex = new THREE.Vector3(x, y, z);
      const spherical = new THREE.Spherical().setFromVector3(vertex);
      
      // ============================================
      // 🎯 KIRILIK BÖLGE MASKELEME
      // ============================================
      // phi: 0 (üst kutup) - PI (alt kutup)
      // theta: 0 - 2*PI (etrafta dönüş)
      
      const phi = spherical.phi;
      const theta = spherical.theta;
      
      // Parçalanmış bölge: phi 0.4*PI ile 0.9*PI arası (yan taraf)
      const shatterStart = Math.PI * 0.3;
      const shatterEnd = Math.PI * 0.9;
      
      // Düzensiz kenarlar için noise
      const edgeNoise = this.fbm3D(x * 2, y * 2, z * 2);
      const crackNoise = this.fbm3D(x * 4, y * 4, z * 4);
      
      // Büyük çatlak hatları
      const crackLines = Math.abs(Math.sin(theta * 8.0 + edgeNoise * 3.0));
      const deepCracks = crackLines < 0.15 ? 1.0 : 0.0;
      
      // Kırık bölge maskesi
      let isInShatterZone = phi > shatterStart && phi < shatterEnd;
      
      // Düzensiz kenar - noise ile kenarları oyun
      const edgeDistance = Math.min(
        Math.abs(phi - shatterStart),
        Math.abs(phi - shatterEnd)
      );
      
      const edgeThreshold = 0.3 + edgeNoise * 0.4 + deepCracks * 0.3;
      
      if (isInShatterZone && edgeDistance < edgeThreshold) {
        // Kenar bölgesi - bazı vertex'ler silinecek
        const deletionChance = 1.0 - (edgeDistance / edgeThreshold);
        const shouldDelete = (edgeNoise + crackNoise) * 0.5 < deletionChance;
        
        if (shouldDelete) {
          isInShatterZone = false; // Bu vertex'i sil
        }
      }
      
      // Visibility flag (0 = gizle, 1 = göster)
      vertexVisibility[i] = isInShatterZone ? 0.0 : 1.0;
      
      // ============================================
      // 🏔️ YÜZEY DEFORMASYONU (kraterler, çatlaklar)
      // ============================================
      if (!isInShatterZone) {
        const length = vertex.length();
        const normalized = vertex.normalize();
        
        // Büyük kraterler
        const craterNoise = this.fbm3D(x * 1.5, y * 1.5, z * 1.5);
        const craterDepth = Math.max(0, craterNoise - 0.3) * this.config.radius * 0.12;
        
        // Küçük detaylar
        const detailNoise = this.fbm3D(x * 8, y * 8, z * 8);
        const detailDepth = detailNoise * this.config.radius * 0.03;
        
        // Çatlak hatları boyunca derin oyuklar
        const crackDepth = deepCracks * this.config.radius * 0.08;
        
        const totalDepth = craterDepth + detailDepth + crackDepth;
        const newLength = length - totalDepth;
        
        posArray[i * 3] = normalized.x * newLength;
        posArray[i * 3 + 1] = normalized.y * newLength;
        posArray[i * 3 + 2] = normalized.z * newLength;
      }
    }
    
    // Vertex visibility attribute ekle (shader'da kullanılacak)
    geometry.setAttribute('vertexVisibility', 
      new THREE.BufferAttribute(vertexVisibility, 1)
    );
    
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    
    console.log('🔨 Shattered region created with irregular edges');
  }

  // ============================================
  // 📐 3D FBM NOISE (Fractal Brownian Motion)
  // ============================================
  fbm3D(x, y, z) {
    let value = 0.0;
    let amplitude = 0.5;
    let frequency = 1.0;
    
    for (let i = 0; i < 4; i++) {
      value += amplitude * this.noise3D(x * frequency, y * frequency, z * frequency);
      frequency *= 2.0;
      amplitude *= 0.5;
    }
    
    return value;
  }

  noise3D(x, y, z) {
    // Basit 3D noise (Perlin benzeri)
    const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
    return (n - Math.floor(n));
  }

  getShellVertexShader() {
    return /* glsl */`
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vWorldPosition;
      varying float vVisibility;  // ⭐ Yeni - vertex görünürlüğü
      
      attribute float vertexVisibility;  // ⭐ Geometry'den gelen visibility

      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        vVisibility = vertexVisibility;  // ⭐ Fragment shader'a aktar
        
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
  }

  getShellFragmentShader() {
    return /* glsl */`
      uniform float time;
      uniform sampler2D surfaceTexture;
      uniform sampler2D surfaceNormal;
      uniform float crackIntensity;
      uniform vec3 lavaGlowColor;

      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vWorldPosition;
      varying float vVisibility;  // ⭐ Vertex görünürlüğü

      void main() {
        // ============================================
        // ⭐ KIRIK BÖLGE - Tamamen transparan
        // ============================================
        if (vVisibility < 0.5) {
          discard;  // Bu pixel'i render etme - lav görünsün
        }
        
        // Kraterlı yüzey texture'ı
        vec3 surfaceColor = texture2D(surfaceTexture, vUv).rgb;
        surfaceColor *= 0.7;  // Biraz karartılmış (ışık almıyor)
        
        // ============================================
        // 🔥 KIRIK KENARA YAKINLIK - Lav Işıması
        // ============================================
        // vVisibility: 0.5 (kenar) - 1.0 (merkez)
        float distanceToEdge = vVisibility - 0.5;  // 0.0 (kenar) - 0.5 (merkez)
        distanceToEdge = distanceToEdge * 2.0;     // 0.0 - 1.0 normalize
        
        // Kenar yakınındaki pixel'ler parlar
        float edgeProximity = 1.0 - distanceToEdge;
        edgeProximity = pow(edgeProximity, 2.0);  // Keskin falloff
        
        // Lav ışıması
        float crackGlow = edgeProximity * crackIntensity;
        
        // Pulse animasyonu
        float pulse = sin(time * 2.0) * 0.3 + 0.7;
        crackGlow *= pulse;
        
        // Lav sızıntısı - kenardan içeri
        vec3 finalColor = surfaceColor;
        finalColor = mix(finalColor, lavaGlowColor, crackGlow * 0.6);
        
        // Kenar parlaması (emissive boost)
        finalColor += lavaGlowColor * crackGlow * 3.0;
        
        // Kenar alpha fade (lav biraz görünsün)
        float alpha = 1.0;
        if (edgeProximity > 0.3) {
          alpha = mix(1.0, 0.8, (edgeProximity - 0.3) / 0.7);
        }
        
        gl_FragColor = vec4(finalColor, alpha);
      }
    `;
  }

  // ============================================================
  // 3️⃣ KIRIK KENARLAR - Parlak Lav Sızıntısı
  // ============================================================
  createCrackEdges() {
    // Kırık kenarın etrafında parlak lav çizgisi
    // TorusGeometry ile simüle edebiliriz
    const geometry = new THREE.TorusGeometry(
      this.config.radius * 0.98,  // radius
      this.config.radius * 0.08,  // tube thickness
      16,                         // radial segments
      64,                         // tubular segments
      Math.PI                     // arc (yarım tur)
    );
    
    geometry.rotateY(Math.PI / 2); // Doğru pozisyona çevir

    const material = new THREE.MeshBasicMaterial({
      color: 0xffaa33,
      emissive: 0xff6600,
      emissiveIntensity: 5.0,  // 3.0 -> 5.0 (bloom için)
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });

    this.crackEdge = new THREE.Mesh(geometry, material);
    this.group.add(this.crackEdge);
  }

  // ============================================================
  // 4️⃣ DEBRIS CHUNKS - Uçan Parçalar
  // ============================================================
  createDebrisChunks() {
    // TODO: Aşama 2'de eklenecek
    // - IcosahedronGeometry parçalar
    // - Rastgele orbit animasyonu
    // - Kendi rotasyonları
    console.log('🪨 Debris chunks - Aşama 2\'de eklenecek');
  }

  // ============================================================
  // 5️⃣ EMBER PARTICLES - Kıvılcımlar
  // ============================================================
  createEmberParticles() {
    // TODO: Aşama 2'de eklenecek
    // - Points geometry
    // - Yukarı doğru uçan animasyon
    // - Parıltılı shader
    console.log('✨ Ember particles - Aşama 2\'de eklenecek');
  }

  // ============================================================
  // 🔄 UPDATE LOOP
  // ============================================================
  update(deltaTime) {
    this.time += deltaTime;

    // Lav çekirdeği animasyonu
    if (this.lavaCore && this.lavaCore.material.uniforms) {
      this.lavaCore.material.uniforms.time.value = this.time;
    }

    // Kabuk animasyonu (opsiyonel hafif rotasyon)
    if (this.crackedShell && this.crackedShell.material.uniforms) {
      this.crackedShell.material.uniforms.time.value = this.time;
    }

    // Kırık kenar pulse animasyonu
    if (this.crackEdge && this.crackEdge.material) {
      const pulse = Math.sin(this.time * 2.0) * 0.5 + 0.5;
      this.crackEdge.material.emissiveIntensity = 4.0 + pulse * 4.0; // 2.0+2.0 -> 4.0+4.0
    }

    // Gezegen yavaş rotasyonu
    this.group.rotation.y += deltaTime * 0.05;
  }

  // ============================================================
  // 🧹 CLEANUP
  // ============================================================
  dispose() {
    if (this.lavaCore) {
      this.lavaCore.geometry.dispose();
      this.lavaCore.material.dispose();
    }
    
    if (this.crackedShell) {
      this.crackedShell.geometry.dispose();
      this.crackedShell.material.dispose();
    }
    
    if (this.crackEdge) {
      this.crackEdge.geometry.dispose();
      this.crackEdge.material.dispose();
    }
    
    this.scene.remove(this.group);
  }
}

// ============================================================
// 🎨 SHATTERED PLANET PRESETS
// ============================================================
export const ShatteredPlanetPresets = {
  // Küçük asteroid benzeri
  small: {
    radius: 10,
    craterCount: 80,
    crackIntensity: 0.6,
    lavaSpeed: 0.2,
    magmaPulseSpeed: 1.0,
    debrisCount: 20,
    emberCount: 100
  },
  
  // Orta boy gezegen
  medium: {
    radius: 20,
    craterCount: 150,
    crackIntensity: 0.8,
    lavaSpeed: 0.3,
    magmaPulseSpeed: 1.5,
    debrisCount: 50,
    emberCount: 200
  },
  
  // Dev gezegen
  large: {
    radius: 40,
    craterCount: 300,
    crackIntensity: 1.0,
    lavaSpeed: 0.5,
    magmaPulseSpeed: 2.0,
    debrisCount: 100,
    emberCount: 400
  },
  
  // Yavaş soğuyan
  cooling: {
    radius: 25,
    craterCount: 200,
    crackIntensity: 0.5,
    lavaSpeed: 0.1,
    magmaPulseSpeed: 0.8,
    debrisCount: 30,
    emberCount: 80
  },
  
  // Çok aktif volkanik
  volatile: {
    radius: 30,
    craterCount: 250,
    crackIntensity: 1.2,
    lavaSpeed: 0.8,
    magmaPulseSpeed: 3.0,
    debrisCount: 80,
    emberCount: 500
  }
};