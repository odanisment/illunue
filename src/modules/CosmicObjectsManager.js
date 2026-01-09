// CosmicObjectsManager.js v4.1 - UNIVERSAL SMOOTH LOADING + BACKGROUND NEBULA
// Tüm obje tipleri için unified fade-in system + Black hole arkasına nebula

import * as THREE from 'three';
import { PerformantNebula, NebulaPresets } from './PerformantNebula.js';
import { PerformantBlackHole, BlackHolePresets } from './PerformantBlackHole.js';

export class CosmicObjectsManager {
  constructor(scene, camera, chunkSize = 1000, options = {}) {
    this.scene = scene;
    this.camera = camera;
    this.chunkSize = chunkSize;
    
    // Gravitational Lensing callback (set from outside)
    this.onBlackHoleCreated = options.onBlackHoleCreated || null;
    this.onBlackHoleRemoved = options.onBlackHoleRemoved || null;
    
    this.objects = new Map(); // chunkKey -> [objects]
    this.activeObjects = new Set(); // Aktif chunk'lardaki objeler
    
    // 📏 FADE PARAMETRELERİ (nebula için geniş aralık = belirgin katman derinliği)
    this.fadeDistances = {
      fadeStart: 600,   // Nebula boyutuna uygun
      fadeEnd: 150,     // Tam görünür
      minOpacity: 0.0   // Minimum opacity
    };
    
    // Her chunk için max obje sayısı
    this.maxObjectsPerChunk = 2;
    
    // Spawn olasılıkları
    this.spawnProbability = {
      nebula: 0.15,         // %15 şans
      blackhole: 0.05       // %5 şans
    };
    
    // 🕳️ GARANTİLİ BLACK HOLE - Origin chunk'a yakın yerleştir
    this.guaranteedBlackHole = {
      chunkX: 0,
      chunkY: 0,
      chunkZ: 0,
      position: new THREE.Vector3(200, 100, 200),
      created: false
    };
    
    console.log('🌌 Universal Object Manager initialized (CosmicObjectsManager v4.1)');
    console.log(`   Fade range: ${this.fadeDistances.fadeStart} → ${this.fadeDistances.fadeEnd} birim`);
    console.log('🕳️ Guaranteed black hole will spawn at:', this.guaranteedBlackHole.position);
  }

  // ============================================================
  // 📏 UNIVERSAL DISTANCE-BASED OPACITY CALCULATOR
  // ============================================================
  
  calculateDistanceOpacity(distance) {
    const { fadeStart, fadeEnd, minOpacity } = this.fadeDistances;
    
    if (distance <= fadeEnd) {
      return 1.0;
    }
    
    if (distance >= fadeStart) {
      return minOpacity;
    }
    
    const t = (distance - fadeEnd) / (fadeStart - fadeEnd);
    const eased = 1 - Math.pow(t, 3);
    
    return minOpacity + (1.0 - minOpacity) * eased;
  }

  // ============================================================
  // 🌌 NEBULA - Kendi internal fade sistemini kullanır
  // ============================================================
  
  updateNebulaLayerOpacity(nebula, distanceToCamera) {
    // ✅ PerformantNebula kendi katman-bazlı fade sistemini kullanıyor
    // Her katman kendi mesafesine göre bağımsız fade yapıyor
    // Burada ekstra bir şey yapmaya gerek yok
  }

  // ============================================================
  // 🕳️ BLACK HOLE - SCALE BAZLI FADE (PerformantBlackHole ile uyumlu)
  // ============================================================
  
  updateBlackHoleOpacity(blackHole, distance) {
    // PerformantBlackHole kendi scale animasyonunu yapıyor
    // Burada sadece lensing callback için distance tracking
  }

  // ============================================================
  // 📦 CHUNK MANAGEMENT
  // ============================================================
  
  onChunkCreated(chunkX, chunkY, chunkZ) {
    const chunkKey = `${chunkX},${chunkY},${chunkZ}`;
    
    if (this.objects.has(chunkKey)) {
      this.activateChunkObjects(chunkKey);
      return;
    }
    
    const objects = this.generateChunkObjects(chunkX, chunkY, chunkZ);
    
    if (objects.length > 0) {
      this.objects.set(chunkKey, objects);
      this.activateChunkObjects(chunkKey);
      
      console.log(`✨ ${objects.length} cosmic objects spawned in chunk ${chunkKey}`);
    }
  }

  onChunkRemoved(chunkX, chunkY, chunkZ) {
    const chunkKey = `${chunkX},${chunkY},${chunkZ}`;
    this.deactivateChunkObjects(chunkKey);
  }

  generateChunkObjects(chunkX, chunkY, chunkZ) {
    const objects = [];
    const chunkWorldPos = new THREE.Vector3(
      chunkX * this.chunkSize,
      chunkY * this.chunkSize,
      chunkZ * this.chunkSize
    );
    
    // 🕳️ GARANTİLİ BLACK HOLE
    if (
      !this.guaranteedBlackHole.created &&
      chunkX === this.guaranteedBlackHole.chunkX &&
      chunkY === this.guaranteedBlackHole.chunkY &&
      chunkZ === this.guaranteedBlackHole.chunkZ
    ) {
      console.log('🕳️ Creating GUARANTEED black hole at origin chunk!');
      
      const result = this.createBlackHoleWithNebula(
        this.guaranteedBlackHole.position,
        Math.random
      );
      
      if (result) {
        objects.push({ type: 'blackhole', object: result.blackHole });
        objects.push({ type: 'nebula', object: result.backgroundNebula, isBackground: true });
        this.guaranteedBlackHole.created = true;
        console.log('✅ Guaranteed black hole + nebula created at:', this.guaranteedBlackHole.position);
      }
    }
    
    const seed = this.hashChunk(chunkX, chunkY, chunkZ);
    const rng = this.seededRandom(seed);
    
    const objectCount = Math.floor(rng() * this.maxObjectsPerChunk) + 1;
    
    for (let i = 0; i < objectCount; i++) {
      const roll = rng();
      
      const localPos = new THREE.Vector3(
        (rng() - 0.5) * this.chunkSize * 0.8,
        (rng() - 0.5) * this.chunkSize * 0.8,
        (rng() - 0.5) * this.chunkSize * 0.8
      );
      
      const worldPos = chunkWorldPos.clone().add(localPos);
      
      // Nebula spawn
      if (roll < this.spawnProbability.nebula) {
        const nebula = this.createRandomNebula(worldPos, rng);
        if (nebula) {
          nebula.type = 'nebula';
          objects.push({ type: 'nebula', object: nebula });
        }
      }
      // Black hole spawn (with background nebula)
      else if (roll < this.spawnProbability.nebula + this.spawnProbability.blackhole) {
        const result = this.createBlackHoleWithNebula(worldPos, rng);
        if (result) {
          result.blackHole.type = 'blackhole';
          result.backgroundNebula.type = 'nebula';
          objects.push({ type: 'blackhole', object: result.blackHole });
          objects.push({ type: 'nebula', object: result.backgroundNebula, isBackground: true });
        }
      }
    }
    
    return objects;
  }

  createRandomNebula(position, rng) {
    const presetNames = Object.keys(NebulaPresets);
    const presetName = presetNames[Math.floor(rng() * presetNames.length)];
    const preset = NebulaPresets[presetName];
    
    const config = {
      ...preset,
      size: 400 + rng() * 400,  // 400-800 birim (chunk'a orantılı)
      layers: 4,
      brightness: 0.8 + rng() * 0.8
    };
    
    return new PerformantNebula(this.scene, position, config, this.camera);
  }

  // 🌌 BLACK HOLE + BACKGROUND NEBULA (birlikte oluştur)
  createBlackHoleWithNebula(position, rng) {
    const presetNames = Object.keys(BlackHolePresets);
    const presetName = presetNames[Math.floor(rng() * presetNames.length)];
    const preset = BlackHolePresets[presetName];
    
    const config = {
      ...preset,
      brightness: 1.0 + rng() * 0.3
    };
    
    const blackHole = new PerformantBlackHole(this.scene, position, config);
    
    // 🌌 ARKASINA HELIX NEBULA EKLE
    const nebulaOffset = (config.diskOuterRadius || 80) * 3;
    const nebulaPosition = position.clone();
    nebulaPosition.z -= nebulaOffset;
    
    const nebulaConfig = {
      ...NebulaPresets.helix,
      size: (config.diskOuterRadius || 80) * 4,  // Kara delik diskinin 4 katı
      layers: 4,
      brightness: 1.2
    };
    
    const backgroundNebula = new PerformantNebula(this.scene, nebulaPosition, nebulaConfig, this.camera);
    
    // Referansları sakla
    blackHole.backgroundNebula = backgroundNebula;
    blackHole.backgroundNebulaOffset = nebulaOffset;
    
    console.log(`🌀 Black hole + background nebula created at`, position);
    
    // Gravitational Lensing callback
    if (this.onBlackHoleCreated) {
      this.onBlackHoleCreated(blackHole.group);
    }
    
    return { blackHole, backgroundNebula };
  }

  activateChunkObjects(chunkKey) {
    const objects = this.objects.get(chunkKey);
    if (!objects) return;
    
    objects.forEach(({ object }) => {
      object.group.visible = true;
      this.activeObjects.add(object);
    });
  }

  deactivateChunkObjects(chunkKey) {
    const objects = this.objects.get(chunkKey);
    if (!objects) return;
    
    objects.forEach(({ type, object }) => {
      // ✅ ARTIK GROUP VISIBILİTY KAPATMA YOK!
      // Nebula katmanları kendi fade sistemleri ile kaybolacak
      // Black hole'lar da kendi scale animation'ı ile kaybolacak
      // 
      // Sadece activeObjects listesinden çıkar
      this.activeObjects.delete(object);
      
      // Blackhole remove callback
      if (type === 'blackhole' && this.onBlackHoleRemoved) {
        this.onBlackHoleRemoved(object.group);
      }
    });
  }

  update(deltaTime) {
    // ✅ TÜM objeler güncellenmeli (chunk unload olsa bile)
    // Çünkü nebula fade out tamamlanana kadar update() çağrılmalı!
    
    this.objects.forEach(objectList => {
      objectList.forEach(({ type, object }) => {
        // Sadece visible objeleri güncelle (performans için)
        if (!object.group.visible) return;
        
        const distance = object.group.position.distanceTo(this.camera.position);
        
        // Obje tipine göre güncelle
        if (type === 'nebula') {
          object.update(deltaTime, this.camera);
          object.updateLOD(this.camera.position);
          this.updateNebulaLayerOpacity(object, distance);
        } 
        else if (type === 'blackhole') {
          object.update(deltaTime, this.camera);
          object.updateLOD(this.camera.position);
        }
        else {
          // Generic update
          if (object.update) object.update(deltaTime, this.camera);
          if (object.updateLOD) object.updateLOD(this.camera.position);
        }
      });
    });
    
    // 🎯 Background nebula'ları black hole'ların ARKASINDA tut
    this.objects.forEach(objectList => {
      objectList.forEach(({ object }) => {
        if (!object.group.visible) return;
        
        if (object.backgroundNebula && object.backgroundNebulaOffset) {
          // Kameradan black hole'a yön vektörü
          const direction = new THREE.Vector3();
          direction.subVectors(object.group.position, this.camera.position).normalize();
          
          // Nebula'yı black hole'un arkasına konumlandır
          const nebulaPos = object.group.position.clone();
          nebulaPos.add(direction.multiplyScalar(object.backgroundNebulaOffset));
          
          object.backgroundNebula.group.position.copy(nebulaPos);
        }
      });
    });
  }

  hashChunk(x, y, z) {
    let hash = 0;
    const str = `${x},${y},${z}`;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return Math.abs(hash);
  }

  seededRandom(seed) {
    let value = seed;
    return function() {
      value = (value * 9301 + 49297) % 233280;
      return value / 233280;
    };
  }

  dispose() {
    this.objects.forEach(objects => {
      objects.forEach(({ object }) => {
        if (object.dispose) {
          object.dispose();
        }
      });
    });
    
    this.objects.clear();
    this.activeObjects.clear();
  }
}