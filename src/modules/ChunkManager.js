// modules/ChunkManager.js - UPDATED WITH COSMIC OBJECTS (No Big Bang)
import * as THREE from 'three';
import { PhysicalStarField } from './PhysicalStarField.js';
import { createAudioPlanet } from './AudioPlanet.js';
import { CosmicObjectsManager } from './CosmicObjectsManager.js';
import { SOLAR_SYSTEM_OFFSET } from '../solarSystemConfig.js';

export class ChunkManager {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;

    this.chunkSize = 1000;
    this.renderDistance = 1;  // 3x3x3 = 27 chunks loaded around camera
    this.unloadDistance = 2;

    this.chunks = new Map();
    this.chunkPool = [];

    // Audio system
    this.audioLoader = new THREE.AudioLoader();
    this.audioListener = camera.userData.audioListener;
    this.textureLoader = new THREE.TextureLoader();

    // Audio planet positions
    this.audioPlanetPositions = this._generateRandomAudioPlanetPositions();
    this.placedAudioPlanets = new Set();

    // 🎨 UNIQUE CONFIGURATIONS - AZTEK 4 ELEMENT + BEŞİNCİ GÜNEŞ TEMASI
    // ✅ Dosya isimleri gerçek dosyalarla eşleştirildi
    this.audioPlanetConfigs = [
      {
        id: 1,
        name: 'Tletl',
        element: 'fire',
        audioFile: '/sounds/fire_tletl.mp3',  // ✅ Tek .mp3
        radius: 10,
        volume: 0.5,
        texture: './textures/signal.jpg',
        description: '🔥 Ateş - Kutsal Alev, Dönüşüm Enerjisi'
      },
      {
        id: 2,
        name: 'Ātl',
        element: 'water',
        audioFile: '/sounds/water_atl.mp3.mp3',  // ✅ Çift .mp3 (dosya ismindeki gibi)
        radius: 12,
        volume: 0.6,
        texture: './textures/signal.jpg',
        description: '💧 Su - Yaşamın Özü, Arınma'
      },
      {
        id: 3,
        name: 'Tlalli',
        element: 'earth',
        audioFile: '/sounds/earth_tlalli.mp3',  // ✅ Tek .mp3
        radius: 8,
        volume: 0.4,
        texture: './textures/signal.jpg',
        description: '🌍 Toprak - Yeryüzü, Maddesel Dünya'
      },
      {
        id: 4,
        name: 'Ehecatl',
        element: 'wind',
        audioFile: '/sounds/wind_ehecatl.mp3',  // ✅ Tek .mp3
        radius: 15,
        volume: 0.7,
        texture: './textures/signal.jpg',
        description: '🌬️ Hava - Rüzgar Tanrısı, Nefes'
      },
      {
        id: 5,
        name: 'Tonatiuh',
        element: 'sun',
        audioFile: '/sounds/sun_tonatiuh.mp3.mp3',  // ✅ Çift .mp3 (dosya ismindeki gibi)
        radius: 11,
        volume: 0.55,
        texture: './textures/signal.jpg',
        description: '☀️ Güneş - Beşinci Çağın Güneşi'
      }
    ];

    // Cosmic Objects Manager
    this.cosmicManager = new CosmicObjectsManager(scene, camera, this.chunkSize);
    console.log('🌌 Cosmic Objects Manager initialized in ChunkManager');
  }

  _generateRandomAudioPlanetPositions() {
    const positions = [];
    const minDistance = 2; // Minimum 2 chunk distance between planets

    // Kamera başlangıç pozisyonu (0, 0, 10) - chunk (0, 0, 0) civarı
    // renderDistance = 1 olduğu için -1 ile +1 arası chunk'lar yüklenir
    // Yani: X[-1,0,1] × Y[-1,0,1] × Z[-1,0,1] = 27 chunk
    
    const cameraStartChunkX = 0;
    const cameraStartChunkY = 0;
    const cameraStartChunkZ = 0;

    // İlk gezegen origin chunk'ta (0, 0, 0) - Tletl
    const firstPos = {
      x: cameraStartChunkX,
      y: cameraStartChunkY,
      z: cameraStartChunkZ
    };

    positions.push(firstPos);
    console.log(
      `🔥 AudioPlanet 1 "Tletl" (Ateş) at origin chunk: (${firstPos.x}, ${firstPos.y}, ${firstPos.z})`
    );

    const totalPlanets = 5;

    // Diğer 4 gezegeni başlangıç 27 chunk içinde dağıt
    // X: -1, 0, 1
    // Y: -1, 0, 1
    // Z: -1, 0, 1
    for (let i = 1; i < totalPlanets; i++) {
      let newPos;
      let attempts = 0;

      do {
        // Başlangıç chunk'ları içinde rastgele seç
        newPos = {
          x: cameraStartChunkX + Math.floor(Math.random() * 3 - 1), // -1, 0, 1
          y: cameraStartChunkY + Math.floor(Math.random() * 3 - 1), // -1, 0, 1
          z: cameraStartChunkZ + Math.floor(Math.random() * 3 - 1)  // -1, 0, 1
        };

        // Minimum mesafe kontrolü
        const tooClose = positions.some((pos) => {
          const dx = newPos.x - pos.x;
          const dy = newPos.y - pos.y;
          const dz = newPos.z - pos.z;
          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
          return distance < minDistance;
        });

        if (!tooClose) break;
        attempts++;
      } while (attempts < 100);

      positions.push(newPos);
      
      const planetNames = ['', 'Tletl (Ateş)', 'Ātl (Su)', 'Tlalli (Toprak)', 'Ehecatl (Hava)', 'Tonatiuh (Güneş)'];
      console.log(
        `🔴 AudioPlanet ${i + 1} "${planetNames[i + 1]}" chunk position: (${newPos.x}, ${newPos.y}, ${newPos.z})`
      );
    }

    console.log(`\n✅ ${totalPlanets} AudioPlanet başlangıç 27 chunk içinde dağıtıldı!`);
    console.log(`📦 Sahne açıldığında hepsi yüklü olacak.`);

    return positions;
  }

  update(deltaTime = 0.016) {
    const cameraChunkX = Math.floor(this.camera.position.x / this.chunkSize);
    const cameraChunkY = Math.floor(this.camera.position.y / this.chunkSize);
    const cameraChunkZ = Math.floor(this.camera.position.z / this.chunkSize);

    // Create chunks around the camera
    for (let x = -this.renderDistance; x <= this.renderDistance; x++) {
      for (let y = -this.renderDistance; y <= this.renderDistance; y++) {
        for (let z = -this.renderDistance; z <= this.renderDistance; z++) {
          const chunkKey = this._getChunkKey(
            cameraChunkX + x,
            cameraChunkY + y,
            cameraChunkZ + z
          );

          if (!this.chunks.has(chunkKey)) {
            this._createChunk(
              cameraChunkX + x,
              cameraChunkY + y,
              cameraChunkZ + z
            );
          }
        }
      }
    }

    // Remove far chunks
    for (const chunkKey of this.chunks.keys()) {
      const [x, y, z] = chunkKey.split(',').map(Number);
      const dx = Math.abs(x - cameraChunkX);
      const dy = Math.abs(y - cameraChunkY);
      const dz = Math.abs(z - cameraChunkZ);
      
      if (dx > this.unloadDistance || dy > this.unloadDistance || dz > this.unloadDistance) {
        this._removeChunk(chunkKey);
      }
    }

    // Update all chunks
    for (const [key, chunk] of this.chunks) {
      chunk.update(0.0001, deltaTime);
    }

    // Update cosmic objects
    this.cosmicManager.update(deltaTime);
  }

  _getChunkKey(x, y, z) {
    return `${x},${y},${z}`;
  }

  _createChunk(x, y, z) {
    const chunkKey = this._getChunkKey(x, y, z);
    
    // Chunk world position
    const chunkWorldPos = new THREE.Vector3(
      x * this.chunkSize,
      y * this.chunkSize,
      z * this.chunkSize
    );

    const chunk = this.chunkPool.pop() || new PhysicalStarField();

    // Position the chunk
    chunk.group.position.copy(chunkWorldPos);

    // Audio planet placement
    for (let i = 0; i < this.audioPlanetPositions.length; i++) {
      const pos = this.audioPlanetPositions[i];
      const audioPlanetKey = `${pos.x},${pos.y},${pos.z}`;

      if (
        pos.x === x &&
        pos.y === y &&
        pos.z === z &&
        !this.placedAudioPlanets.has(audioPlanetKey)
      ) {
        // Pass the specific config for this AudioPlanet index
        const config = this.audioPlanetConfigs[i];
        this._addAudioReference(chunk.group, config);
        this.placedAudioPlanets.add(audioPlanetKey);
        console.log(`🔴 AudioPlanet ${config.id} "${config.name}" (${config.element}) placed at chunk: ${chunkKey}`);
        console.log(`   └─ Radius: ${config.radius}, ${config.description}`);
      }
    }

    this.scene.add(chunk.group);
    this.chunks.set(chunkKey, chunk);

    // Create cosmic objects
    this.cosmicManager.onChunkCreated(x, y, z);
  }

  _addAudioReference(group, config) {
    const audioPlanetGroup = createAudioPlanet({
      chunkSize: this.chunkSize,
      audioListener: this.audioListener,
      audioLoader: this.audioLoader,
      audioFile: config.audioFile,
      radius: config.radius,
      planetId: config.id,  // ✅ color yerine planetId
      volume: config.volume,
      loop: true,
      textureLoader: this.textureLoader
    });

    if (!audioPlanetGroup) {
      console.warn('AudioPlanet group could not be created');
      return;
    }

    // Add unique ID to the mesh for tracking
    audioPlanetGroup.traverse((child) => {
      if (child.isMesh && child.userData.isAudioPlanet) {
        child.userData.audioPlanetId = config.id;
      }
    });

    group.add(audioPlanetGroup);
  }

  _removeChunk(key) {
    const chunk = this.chunks.get(key);
    if (chunk) {
      this.scene.remove(chunk.group);
      this.chunkPool.push(chunk);
      this.chunks.delete(key);
    }

    // Remove cosmic objects
    const [x, y, z] = key.split(',').map(Number);
    this.cosmicManager.onChunkRemoved(x, y, z);
  }

  dispose() {
    // Clear all chunks
    for (const [key, chunk] of this.chunks) {
      this.scene.remove(chunk.group);
    }
    this.chunks.clear();
    this.chunkPool = [];

    // Clear cosmic objects
    this.cosmicManager.dispose();
    
    console.log('🧹 ChunkManager disposed');
  }
}