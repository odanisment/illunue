// PerformantNebula.js - ENHANCED VERSION
// GerÃ§ekÃ§i nebula: Neon renkler, filament yapÄ±sÄ±, 3D derinlik, parlak Ã§ekirdek

import * as THREE from 'three';

export class PerformantNebula {
  constructor(scene, position, config = {}, camera = null) {
    this.scene = scene;
    
    // KonfigÃ¼rasyon
    this.config = {
      size: config.size || 1200,                                      // Nebula boyutu (4x bÃ¼yÃ¼k!)
      // ðŸŽ¨ Ã‡OK KATMANLI NEON RENKLER
      coreColor: config.coreColor || new THREE.Color(0xc298ff),      // Ã‡ekirdek: beyaz
      innerColor1: config.innerColor1 || new THREE.Color(0x00ffff),  // Ä°Ã§: cyan/turkuaz
      innerColor2: config.innerColor2 || new THREE.Color(0x00ff88),  // Ä°Ã§-orta: yeÅŸil-mavi
      midColor1: config.midColor1 || new THREE.Color(0xff6600),      // Orta: turuncu
      midColor2: config.midColor2 || new THREE.Color(0xff0088),      // Orta-dÄ±ÅŸ: pembe
      outerColor: config.outerColor || new THREE.Color(0x8800ff),    // DÄ±ÅŸ: mor
      layers: config.layers || 4,                                     // 4 katman (3D derinlik)
      brightness: config.brightness || 1.5,
      coreIntensity: config.coreIntensity || 1.8,                    // Ã‡ekirdek parlaklÄ±ÄŸÄ± (dÃ¼ÅŸÃ¼rÃ¼ldÃ¼)
      filamentDetail: config.filamentDetail || 3.0,                  // Filament detay seviyesi
      animated: config.animated !== false,
      ...config
    };

    this.group = new THREE.Group();
    this.group.position.copy(position);
    
    // ðŸŽ¯ Ä°lk rotasyonu kameraya gÃ¶re ayarla (atlama Ã¶nleme)
    if (camera) {
      const nebulaToCamera = new THREE.Vector3();
      nebulaToCamera.subVectors(camera.position, position);
      nebulaToCamera.y = 0;
      nebulaToCamera.normalize();
      this.group.rotation.y = Math.atan2(nebulaToCamera.x, nebulaToCamera.z);
    }
    
    // ðŸŽ­ ALPHA MASK SÄ°STEMÄ°
    this.textureLoader = new THREE.TextureLoader();
    this.alphaMasks = [];
    this.masksLoaded = false;
    
    // Alpha mask dosya isimleri (her layer için)
    // ⚡ ÖNEMLİ: Z-DEPTH BAZLI SIRALANMIŞ
    // Sparse (az detay) = ÖN layer (ilk fade in)
    // Dense (çok detay) = ARKA layer (son fade in)
    this.maskPaths = [
      '/textures/dense.jpg',           // Layer 0 (z=-300, EN ARKA): Yoğun mask
      '/textures/medium_dense.jpg',    // Layer 1 (z=-150, arka): Orta-yoğun
      '/textures/medium_sparse.jpg',   // Layer 2 (z=0, merkez): Orta-seyrek
      '/textures/sparse.jpg'           // Layer 3 (z=+150, EN ÖN): Seyrek mask ✅
    ];
    
    this.layers = [];
    this.loadMasksAndCreateNebula();
    
    scene.add(this.group);
  }

  // Maskeleri yÃ¼kle ve nebula'yÄ± oluÅŸtur
  loadMasksAndCreateNebula() {
    let loadedCount = 0;
    
    // TÃ¼m maskeleri yÃ¼kle
    this.maskPaths.forEach((path, index) => {
      this.textureLoader.load(
        path,
        (texture) => {
          // Texture ayarlarÄ±
          texture.wrapS = THREE.ClampToEdgeWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          
          this.alphaMasks[index] = texture;
          loadedCount++;
          
          console.log(`âœ… Alpha mask loaded: ${path}`);
          
          // TÃ¼m maskeler yÃ¼klendiyse nebula'yÄ± oluÅŸtur
          if (loadedCount === this.maskPaths.length) {
            this.masksLoaded = true;
            this.createNebula();
            console.log('ðŸŒŒ Nebula created with alpha masks!');
          }
        },
        undefined,
        (error) => {
          console.warn(`âš ï¸ Could not load mask: ${path}`, error);
          // Hata durumunda bile devam et (maskesiz oluÅŸtur)
          loadedCount++;
          if (loadedCount === this.maskPaths.length) {
            this.masksLoaded = true;
            this.createNebula();
            console.log('ðŸŒŒ Nebula created without some masks');
          }
        }
      );
    });
  }

  createNebula() {
    // 🎲 Her nebula için rastgele layer spacing (150-300 birim)
    // ⬆️ Artırılmış range = daha belirgin derinlik algısı
    this.layerSpacing = 150 + Math.random() * 150; // 150-300
    console.log(`🌌 Nebula layer spacing: ${this.layerSpacing.toFixed(0)} units`);
    
    // 4 katman - her biri farklÄ± derinlikte
    for (let i = 0; i < this.config.layers; i++) {
      const layer = this.createNebulaLayer(i);
      this.layers.push(layer);
      this.group.add(layer);
    }
  }

  createNebulaLayer(index) {
    // Her katman biraz daha bÃ¼yÃ¼k (derinlik hissi)
    const size = this.config.size * (1 + index * 0.3);
    const geometry = new THREE.PlaneGeometry(size, size, 1, 1);

    const uniforms = {
      time: { value: 0 },
      coreColor: { value: this.config.coreColor },
      innerColor1: { value: this.config.innerColor1 },
      innerColor2: { value: this.config.innerColor2 },
      midColor1: { value: this.config.midColor1 },
      midColor2: { value: this.config.midColor2 },
      outerColor: { value: this.config.outerColor },
      brightness: { value: this.config.brightness },
      coreIntensity: { value: this.config.coreIntensity },
      filamentDetail: { value: this.config.filamentDetail },
      seed: { value: Math.random() * 100 },
      layerOffset: { value: index * 0.5 },                           // Katmanlar arasÄ± offset
      layerDepth: { value: index / this.config.layers },             // 0.0 - 1.0 (derinlik)
      opacity: { value: 0.8 / (index + 1) },                         // DÄ±ÅŸ katmanlar daha transparan
      alphaMap: { value: this.alphaMasks[index] || null },           // ðŸŽ­ ALPHA MASK
      useAlphaMap: { value: this.alphaMasks[index] ? 1.0 : 0.0 }     // ðŸŽ­ ALPHA MASK KULLAN MI?
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `
        varying vec2 vUv;
        
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 coreColor;
        uniform vec3 innerColor1;
        uniform vec3 innerColor2;
        uniform vec3 midColor1;
        uniform vec3 midColor2;
        uniform vec3 outerColor;
        uniform float brightness;
        uniform float coreIntensity;
        uniform float filamentDetail;
        uniform float seed;
        uniform float layerOffset;
        uniform float layerDepth;
        uniform float opacity;
        uniform sampler2D alphaMap;        // ðŸŽ­ ALPHA MASK TEXTURE
        uniform float useAlphaMap;         // ðŸŽ­ ALPHA MASK KULLANIM FLAG
        
        varying vec2 vUv;
        
        // ========================================
        // MAIN SHADER (MASK-ONLY MODE)
        // ========================================
        
        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center);
          
          // 1ï¸âƒ£ MASK DEÄžERÄ°NÄ° AL (eÄŸer varsa)
          float maskValue = 1.0;
          if (useAlphaMap > 0.5) {
            maskValue = texture2D(alphaMap, vUv).r;
          }
          
          // 2ï¸âƒ£ RADIAL FALLOFF (sadece kenar yumuÅŸatma iÃ§in)
          float radialMask = 1.0 - smoothstep(0.45, 0.5, dist);
          
          // 3ï¸âƒ£ ANIMASYON ZAMANI (sadece hafif hareket iÃ§in)
          float t = time * 0.02 + layerOffset;
          
          // 4ï¸âƒ£ PARLAK Ã‡EKÄ°RDEK BÃ–LGE (Ã§ok hafif)
          float coreMask = 1.0 - smoothstep(0.0, 0.2, dist);
          float coreGlow = pow(coreMask, 4.0) * coreIntensity * 0.3; // AzaltÄ±ldÄ±
          
          // 5ï¸âƒ£ RENK GRADYANI (sadece mesafeye gÃ¶re)
          vec3 nebulaColor;
          
          // Merkez -> DÄ±ÅŸ renk geÃ§iÅŸi
          if (dist < 0.1) {
            // Ã‡ekirdek: Beyaz
            nebulaColor = coreColor;
          } else if (dist < 0.2) {
            // Ä°Ã§ bÃ¶lge: Beyaz -> Cyan
            float t = (dist - 0.1) / 0.1;
            nebulaColor = mix(coreColor, innerColor1, t);
          } else if (dist < 0.3) {
            // Ä°Ã§-orta: Cyan -> YeÅŸil-mavi
            float t = (dist - 0.2) / 0.1;
            nebulaColor = mix(innerColor1, innerColor2, t);
          } else if (dist < 0.4) {
            // Orta: YeÅŸil-mavi -> Turuncu
            float t = (dist - 0.3) / 0.1;
            nebulaColor = mix(innerColor2, midColor1, t);
          } else if (dist < 0.5) {
            // Orta-dÄ±ÅŸ: Turuncu -> Pembe
            float t = (dist - 0.4) / 0.1;
            nebulaColor = mix(midColor1, midColor2, t);
          } else {
            // DÄ±ÅŸ: Pembe -> Mor
            float t = (dist - 0.5) / 0.05;
            nebulaColor = mix(midColor2, outerColor, clamp(t, 0.0, 1.0));
          }
          
          // 6ï¸âƒ£ MASK Ä°LE RENGÄ° MODÃœLE ET
          // Mask deÄŸeri parlaklÄ±ÄŸÄ± belirler
          float intensity = maskValue * brightness;
          
          // 7ï¸âƒ£ Ã‡EKIRDEK GLOW EKLENÄ°YOR (Ã§ok hafif)
          nebulaColor += coreColor * coreGlow * maskValue;
          
          // 8ï¸âƒ£ EDGE FADE (kenarlar yumuÅŸak)
          float edgeFade = smoothstep(0.0, 0.05, radialMask);
          
          // 9ï¸âƒ£ FINAL ALPHA
          float alpha = intensity * opacity * edgeFade * radialMask;
          alpha = clamp(alpha, 0.0, 1.0);
          
          gl_FragColor = vec4(nebulaColor * intensity, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneFactor,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    
    console.log(`ðŸŽ­ Layer ${index} created with ${this.alphaMasks[index] ? 'alpha mask' : 'no mask'}`);
    
    // Her katmanÄ± farklÄ± aÃ§Ä±da dÃ¶ndÃ¼r (3D derinlik illÃ¼zyonu)
    mesh.rotation.z = (index * Math.PI * 0.6) / this.config.layers;
    
    // KatmanlarÄ± dinamik spacing ile Ã¶ne-arkaya kaydÄ±r (gerÃ§ek 3D derinlik)
    // Her nebula'nÄ±n kendi spacing'i var (90-200 birim arasÄ±)
    mesh.position.z = (index - this.config.layers / 2) * this.layerSpacing;
    
    return mesh;
  }

  update(deltaTime, camera) {
    if (!this.config.animated) return;
    
    // 🎯 DİNAMİK KATMAN SIRALAMA
    // Kameraya yakın katmanlar -> önce görünür
    // Kameraya uzak katmanlar -> sonra görünür
    // Kamera hangi taraftan bakarsa baksın aynı fade davranışı!
    
    let anyLayerVisible = false; // Herhangi bir katman görünür mü?
    
    // 1️⃣ KATMANLARI KAMERAYA OLAN MESAFEYE GÖRE SIRALA
    const layersWithDistance = this.layers.map((layer, index) => {
      const layerWorldPos = new THREE.Vector3();
      layer.getWorldPosition(layerWorldPos);
      const distance = camera.position.distanceTo(layerWorldPos);
      
      return { layer, index, distance };
    });
    
    // En yakından en uzağa sırala
    layersWithDistance.sort((a, b) => a.distance - b.distance);
    
    // 2️⃣ SIRALANAN HER KATMANA DİNAMİK FADE UYGULA
    layersWithDistance.forEach((item, sortedIndex) => {
      const { layer, index, distance } = item;
      
      // Time animasyonu
      layer.material.uniforms.time.value += deltaTime;
      layer.rotation.z += deltaTime * 0.01 * (1 + index * 0.2);
      
      // 🎯 DİNAMİK FADE RANGE
      // sortedIndex = 0 (en yakın katman) -> ilk fade
      // sortedIndex = 3 (en uzak katman) -> son fade
      const INDEX_DELAY = 150; // Her katman arası 150 birim gecikme
      
      const FADE_START = 2500 + (sortedIndex * INDEX_DELAY);
      const FADE_END = 800 + (sortedIndex * INDEX_DELAY);
      
      let opacity = 0;
      
      if (distance <= FADE_END) {
        // Çok yakın - tam görünür
        opacity = 1.0;
      } 
      else if (distance < FADE_START) {
        // Geçiş bölgesi - smooth gradient
        const fadeRange = FADE_START - FADE_END;
        const distanceInRange = distance - FADE_END;
        const fadeProgress = 1.0 - (distanceInRange / fadeRange);
        
        opacity = fadeProgress;
      }
      // else: distance >= FADE_START -> opacity = 0 (görünmez)
      
      // EXTRA SMOOTH EASING (S-curve)
      if (opacity > 0 && opacity < 1) {
        // ease-in-out cubic
        opacity = opacity < 0.5 
          ? 4 * opacity * opacity * opacity
          : 1 - Math.pow(-2 * opacity + 2, 3) / 2;
      }
      
      // BASE OPACITY (orijinal katman indexine göre - mask density)
      // Dış katmanlar (sparse) daha transparan
      const baseOpacity = 0.8 / (index + 1);
      const finalOpacity = opacity * baseOpacity;
      
      // Material'e uygula
      layer.material.uniforms.opacity.value = finalOpacity;
      
      // Performance: Tamamen görünmez katmanları gizle
      layer.visible = finalOpacity > 0.01;
      
      // Herhangi bir katman görünür mü kontrol et
      if (finalOpacity > 0.01) {
        anyLayerVisible = true;
      }
      
      // DEBUG: Kapatıldı - çok fazla log basıyordu
      // if (Math.random() < 0.003) {
      //   console.log(`🌌 Layer ${index} (sorted #${sortedIndex}): dist=${distance.toFixed(0)}, fade=${FADE_START}-${FADE_END}, opacity=${finalOpacity.toFixed(3)}`);
      // }
    });
    
    // ✅ TÜM KATMANLAR KAYBOLDUYSA GROUP'U GİZLE
    // Bu sayede chunk unload olduğunda ani kapanma olmaz
    // Katmanlar smooth fade out tamamlandıktan sonra group kapanır
    this.group.visible = anyLayerVisible;
    
    // 🚫 BILLBOARD KAPALI - Nebula artık sabit duruyor!
    // Gerçek 3D derinlik için katmanlar kendi pozisyonlarında kalıyor
    // Kamera etrafında döndüğünde nebula dönmüyor
  }

  // LOD - mesafeye gore gorunurluk
  updateLOD(cameraPosition) {
    // ARTIK GEREKLI DEGIL!
    // Her katman kendi opacity fade'i ile gorunurluguunu kontrol ediyor
    // Group'u her zaman visible tut, katmanlar kendi kendini yonetiyor
    
    this.group.visible = true;
    
    // Katman visibility'si update() fonksiyonunda hallediliyor:
    // layer.visible = finalOpacity > 0.01
    
    // NOT: En uzak katman (Layer 3) FADE_START = 2950 birimde kaybolur
    // Tum katmanlar kaybolduktan sonra bile group visible kalir ama
    // icinde hicbir sey render edilmez (performance icin idealdir)
  }

  dispose() {
    // Layer'larÄ± temizle
    this.layers.forEach(layer => {
      layer.geometry.dispose();
      layer.material.dispose();
      
      // Alpha map'i temizle
      if (layer.material.alphaMap) {
        layer.material.alphaMap.dispose();
      }
    });
    
    // Alpha mask array'ini temizle
    this.alphaMasks = [];
    
    this.scene.remove(this.group);
  }
}

// ============================================================
// GELÄ°ÅžMÄ°Åž PRESET'LER - GERÃ‡EK NEBULA TÄ°PLERÄ°
// ============================================================

export const NebulaPresets = {
  // ðŸ¦€ CRAB NEBULA (Turuncu-Mavi)
  crab: {
    coreColor: new THREE.Color(0xffffff),
    innerColor1: new THREE.Color(0x00ddff),    // Cyan
    innerColor2: new THREE.Color(0x00ffaa),    // Turkuaz
    midColor1: new THREE.Color(0xffaa00),      // Turuncu
    midColor2: new THREE.Color(0xff6600),      // Koyu turuncu
    outerColor: new THREE.Color(0xff3300),     // KÄ±rmÄ±zÄ±-turuncu
    brightness: 1.6,
    coreIntensity: 2.0,
    filamentDetail: 3.5
  },
  
  // ðŸ’ HELIX NEBULA (Mavi-Pembe-Mor)
  helix: {
    coreColor: new THREE.Color(0xc298ff),
    innerColor1: new THREE.Color(0x88ddff),    // AÃ§Ä±k mavi
    innerColor2: new THREE.Color(0x00bbff),    // Mavi
    midColor1: new THREE.Color(0xff66aa),      // Pembe
    midColor2: new THREE.Color(0xff3388),      // Koyu pembe
    outerColor: new THREE.Color(0x8800ff),     // Mor
    brightness: 1.4,
    coreIntensity: 2.2,
    filamentDetail: 2.8
  },
  
  // ðŸŒ¸ ORION NEBULA (Pembe-Mor-Mavi)
  orion: {
    coreColor: new THREE.Color(0xffeecc),      // SÄ±cak beyaz
    innerColor1: new THREE.Color(0xff88dd),    // Pembe
    innerColor2: new THREE.Color(0xff66bb),    // Koyu pembe
    midColor1: new THREE.Color(0xaa44ff),      // Mor
    midColor2: new THREE.Color(0x6600ff),      // Koyu mor
    outerColor: new THREE.Color(0x4400aa),     // Ã‡ok koyu mor
    brightness: 1.5,
    coreIntensity: 2.0,
    filamentDetail: 3.0
  },
  
  // ðŸ”´ EMISSION NEBULA (KÄ±rmÄ±zÄ±-Turuncu)
  emission: {
    coreColor: new THREE.Color(0xffffee),      // SÄ±cak beyaz
    innerColor1: new THREE.Color(0xffdd88),    // SarÄ±
    innerColor2: new THREE.Color(0xffaa55),    // Turuncu
    midColor1: new THREE.Color(0xff6633),      // Koyu turuncu
    midColor2: new THREE.Color(0xff3311),      // KÄ±rmÄ±zÄ±-turuncu
    outerColor: new THREE.Color(0xaa0000),     // Koyu kÄ±rmÄ±zÄ±
    brightness: 1.7,
    coreIntensity: 2.5,
    filamentDetail: 3.2
  },
  
  // ðŸ’š REFLECTION NEBULA (Mavi-YeÅŸil with PURPLE core)
  reflection: {
    coreColor: new THREE.Color(0x70bbff),      // Mor Ã§ekirdek! ðŸ’œ
    innerColor1: new THREE.Color(0x66ffff),    // Cyan
    innerColor2: new THREE.Color(0x44ffcc),    // YeÅŸil-mavi
    midColor1: new THREE.Color(0x22ffaa),      // YeÅŸil
    midColor2: new THREE.Color(0x00dd88),      // Koyu yeÅŸil
    outerColor: new THREE.Color(0x008866),     // Ã‡ok koyu yeÅŸil
    brightness: 1.3,
    coreIntensity: 1.5,
    filamentDetail: 2.5
  },
  
  // ðŸŒˆ PLANETARY NEBULA (Ã‡ok renkli)
  planetary: {
    coreColor: new THREE.Color(0xffffff),
    innerColor1: new THREE.Color(0xaaffff),    // AÃ§Ä±k cyan
    innerColor2: new THREE.Color(0x66ffaa),    // YeÅŸil-cyan
    midColor1: new THREE.Color(0xffaa66),      // Turuncu
    midColor2: new THREE.Color(0xff66ff),      // Magenta
    outerColor: new THREE.Color(0x6666ff),     // Mavi-mor
    brightness: 1.6,
    coreIntensity: 2.8,
    filamentDetail: 3.8
  },
  
  // ðŸŸ£ CLASSIC PURPLE (Orijinal mor tema - gÃ¼ncellenmiÅŸ)
  purple: {
    coreColor: new THREE.Color(0xffeeff),      // AÃ§Ä±k pembe-beyaz
    innerColor1: new THREE.Color(0xff88ff),    // Pembe
    innerColor2: new THREE.Color(0xcc66ff),    // AÃ§Ä±k mor
    midColor1: new THREE.Color(0x8844ff),      // Mor
    midColor2: new THREE.Color(0x6622cc),      // Koyu mor
    outerColor: new THREE.Color(0x4400aa),     // Ã‡ok koyu mor
    brightness: 1.4,
    coreIntensity: 1.8,
    filamentDetail: 2.8
  },
  
  // ðŸ”µ CLASSIC BLUE (Orijinal mavi tema - gÃ¼ncellenmiÅŸ)
  blue: {
    coreColor: new THREE.Color(0xc298ff),
    innerColor1: new THREE.Color(0xaaeeff),    // AÃ§Ä±k mavi
    innerColor2: new THREE.Color(0x66ccff),    // Orta mavi
    midColor1: new THREE.Color(0x3399ff),      // Mavi
    midColor2: new THREE.Color(0x0066cc),      // Koyu mavi
    outerColor: new THREE.Color(0x003388),     // Ã‡ok koyu mavi
    brightness: 1.3,
    coreIntensity: 1.5,
    filamentDetail: 2.6
  }
};