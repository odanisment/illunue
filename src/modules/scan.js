// modules/scan.js
// Odin's Sight wave + bloom + Earth/Moon/AudioPlanet odinFactor
// AudioPlanet'ler keşfedildikten sonra da her scan'de X-ray efekti gösterir

import * as THREE from 'three';

export function createAdvancedScan({
  scene,
  camera,
  bloomPass,
  maxRadius = 300,
  duration = 2.0,
  waveSpeed = 150,
  waveThickness = 20,
  odinUniforms = []
} = {}) {
  const state = {
    active: false,
    startTime: 0,
    currentRadius: 0,
    progress: 0,
    bloomTriggered: false,
    bloomStartProgress: 0,
    scanId: 0
  };

  const origin = new THREE.Vector3();
  const tmpWorldPos = new THREE.Vector3();
  const odinTargets = Array.isArray(odinUniforms) ? odinUniforms : [];
  
  const audioPlanetUniforms = [];
  const audioPlanetRevealUniforms = [];
  const audioPlanetMeshes = [];
  const discoveredAudioPlanets = new Set(); // Keşfedilmiş olanları sakla

  // 📊 ============================================
  // AUDIO SYSTEM - YENİ EKLENEN BÖLÜM
  // 📊 ============================================
  const audioListener = camera.userData.audioListener;
  const audioLoader = new THREE.AudioLoader();
  
  let scanSound = null;
  let soundLoaded = false;

  // Ses dosyasını yükle
  audioLoader.load(
    '/sounds/scan.mp3',
    (buffer) => {
      // ✅ Başarılı yükleme
      scanSound = new THREE.Audio(audioListener);
      scanSound.setBuffer(buffer);
      scanSound.setLoop(false); // Tek seferlik çal
      scanSound.setVolume(0.7); // %70 ses seviyesi
      soundLoaded = true;
      console.log('📊 Scan sound loaded successfully');
    },
    undefined,
    (error) => {
      // ⚠️ Hata durumunda sessiz devam et
      console.warn('⚠️ Scan sound not found or corrupt:', error);
      soundLoaded = false;
    }
  );
  // 📊 ============================================
  // AUDIO SYSTEM SONU
  // 📊 ============================================

  const waveMaterial = new THREE.ShaderMaterial({
    uniforms: {
      time:      { value: 0 },
      progress:  { value: 0 },
      baseColor: { value: new THREE.Color(0x0066ff) },
      glowColor: { value: new THREE.Color(0x00ffff) },
      thickness: { value: waveThickness },
      maxRadius: { value: maxRadius },
      origin:    { value: new THREE.Vector3() }
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      varying vec2 vUv;
      
      void main() {
        vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform float progress;
      uniform vec3 baseColor;
      uniform vec3 glowColor;
      uniform float thickness;
      uniform float maxRadius;
      uniform vec3 origin;
      
      varying vec3 vWorldPosition;
      varying vec2 vUv;
      
      void main() {
        vec3 toCenter = vWorldPosition - origin;
        float dist = length(toCenter);
        float waveFront = progress * maxRadius;
        float distanceToWave = abs(dist - waveFront);
        
        if (distanceToWave < thickness) {
          float intensity = 1.0 - (distanceToWave / thickness);
          
          float ring1 = sin(dist * 0.1 - time * 8.0) * 0.5 + 0.5;
          float ring2 = cos(dist * 0.05 - time * 6.0) * 0.5 + 0.5;
          float ring3 = sin(vUv.x * 20.0 + time * 10.0) * 0.3 + 0.7;
          
          vec3 color = mix(baseColor, glowColor, ring1 * ring2);
          color = mix(color, vec3(1.0), ring3 * 0.3);
          
          float alpha = intensity * (1.0 - progress) * 0.6;
          alpha *= ring1 * 0.8 + 0.2;
          
          gl_FragColor = vec4(color * intensity, alpha);
        } else {
          discard;
        }
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending
  });

  const waveGeometry = new THREE.SphereGeometry(1, 48, 32);
  const waveMesh = new THREE.Mesh(waveGeometry, waveMaterial);
  waveMesh.visible = false;
  waveMesh.renderOrder = 1000;
  scene.add(waveMesh);

  const baseBloomStrength = bloomPass?.strength ?? 0.7;

  function collectAudioPlanetUniforms() {
    audioPlanetUniforms.length = 0;
    audioPlanetRevealUniforms.length = 0;
    audioPlanetMeshes.length = 0;

    scene.traverse((object) => {
      // Only AudioPlanet meshes (avoid Earth/Moon etc.)
      if (
        object?.isMesh &&
        object.userData?.isAudioPlanet === true &&
        object.userData?.odinUniform &&
        object.userData?.revealUniform
      ) {
        audioPlanetUniforms.push(object.userData.odinUniform);
        audioPlanetRevealUniforms.push(object.userData.revealUniform);
        audioPlanetMeshes.push(object);
      }
    });

    console.log(`🎯 Scan hedefi: ${audioPlanetUniforms.length} AudioPlanet`);
  }

  function trigger() {
    if (state.active) return;

    state.scanId += 1;

    state.active = true;
    state.startTime = Date.now();
    state.currentRadius = 0;
    state.progress = 0;
    state.bloomTriggered = false;
    state.bloomStartProgress = 0;

    origin.copy(camera.position);
    waveMesh.position.copy(origin);
    waveMesh.visible = true;
    waveMesh.scale.set(1, 1, 1);
    waveMaterial.uniforms.origin.value.copy(origin);

    if (bloomPass)
      bloomPass.strength = baseBloomStrength;

    collectAudioPlanetUniforms();

    // 📊 ============================================
    // SES ÇALMA - YENİ EKLENEN BÖLÜM
    // 📊 ============================================
    if (soundLoaded && scanSound) {
      // Eğer ses çalıyorsa durdur ve başa sar
      if (scanSound.isPlaying) {
        scanSound.stop();
      }
      
      // AudioContext'i resume et (browser autoplay policy)
      if (audioListener.context.state === 'suspended') {
        audioListener.context.resume().then(() => {
          scanSound.play();
          console.log('📊 Scan sound playing (context resumed)');
        });
      } else {
        scanSound.play();
        console.log('📊 Scan sound playing');
      }
    } else {
      console.warn('⚠️ Scan sound not loaded yet');
    }
    // 📊 ============================================
    // SES ÇALMA SONU
    // 📊 ============================================

    // 🔵 TÜM OBJELERİ 0.0'A SIFIRLA (Earth/Moon + AudioPlanet)
    odinTargets.forEach((u) => u && (u.value = 0.0));
    
    // AudioPlanet'ler - keşfedilmiş olsalar bile 0'dan başlasın
    audioPlanetUniforms.forEach((u, index) => {
      if (!u) return;

      const mesh = audioPlanetMeshes[index];
      const revealU = audioPlanetRevealUniforms[index];

      if (!mesh || !revealU) return;

      const isDiscovered = mesh.userData?.discovered === true || discoveredAudioPlanets.has(mesh.uuid);

      if (isDiscovered) {
        // Keep visible in material state
        mesh.visible = true;
        revealU.value = 1.0;
        u.value = 1.0;
      } else {
        // Hidden until discovered
        mesh.visible = false;
        revealU.value = 0.0;
        u.value = 0.0;
      }
    });


    console.log("🌊 Odin's Sight başladı - tüm objeler X-ray moduna geçiyor");
  }

  function update(deltaTime) {
    if (!state.active) return;

    const currentTime = Date.now();
    const elapsed = (currentTime - state.startTime) / 1000;
    state.progress = Math.min(elapsed / duration, 1.0);
    state.currentRadius = state.progress * maxRadius;

    if (state.progress >= 1.0) {
      finishScan();
      return;
    }

    const scale = state.currentRadius;
    waveMesh.scale.set(scale, scale, scale);
    waveMaterial.uniforms.progress.value = state.progress;
    waveMaterial.uniforms.time.value = elapsed;
    waveMaterial.uniforms.origin.value.copy(origin);

    if (scanForHit() && !state.bloomTriggered) {
      state.bloomTriggered = true;
      state.bloomStartProgress = state.progress;
    }

    updateBloom();
    updateOdinFactor();
  }

  function scanForHit() {
    let hit = false;
    scene.traverse((object) => {
      if (!object.isMesh) return;
      if (object.userData?.ignoreScan) return;

      object.getWorldPosition(tmpWorldPos);
      const distance = origin.distanceTo(tmpWorldPos);
      const distanceToWave = Math.abs(distance - state.currentRadius);

      if (distanceToWave < waveThickness) {
        hit = true;
      }
    });
    return hit;
  }

  function easeInOutCubic(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function easeOutQuad(t) {
    return 1 - (1 - t) * (1 - t);
  }

  function updateBloom() {
    if (!bloomPass) return;

    const base = baseBloomStrength;

    if (!state.bloomTriggered) {
      bloomPass.strength = base;
      return;
    }

    const start = state.bloomStartProgress;
    const end = 1.0;
    const localProgress = THREE.MathUtils.clamp(
      (state.progress - start) / (end - start),
      0,
      1
    );

    const factor = 1.0 + 0.5 * (1.0 - easeOutQuad(localProgress));
    bloomPass.strength = base * factor;
  }

  function updateOdinFactor() {
    const t = state.progress;
    const easedT = easeInOutCubic(t);
    const odinValue = Math.sin(easedT * Math.PI);

    // 🌍 Earth & Moon: global x-ray pulse (0..1..0)
    odinTargets.forEach((u) => u && (u.value = odinValue));

    const nowMs = Date.now();

    // Tuning: proximity requirements for discovery
    const MAX_DISCOVERY_DISTANCE = 200; // Camera must be within 200 units
    const WAVE_DETECTION_RANGE = 450;   // Wave must reach the planet
    const REVEAL_DURATION_MS = 900;     // x-ray -> material duration

    // 🎯 Frustum check - planet must be in camera view
    const frustum = new THREE.Frustum();
    const projScreenMatrix = new THREE.Matrix4();
    projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projScreenMatrix);

    // 🔴 AudioPlanets: deterministic 1-shot reveal (no flicker)
    audioPlanetUniforms.forEach((u, index) => {
      if (!u) return;

      const mesh = audioPlanetMeshes[index];
      const revealU = audioPlanetRevealUniforms[index];

      if (!mesh || !revealU) return;

      const isDiscovered = mesh.userData?.discovered === true || discoveredAudioPlanets.has(mesh.uuid);

      // If not discovered yet, check ALL conditions
      if (!isDiscovered) {
        mesh.getWorldPosition(tmpWorldPos);
        
        // Distance from CAMERA
        const distanceFromCamera = camera.position.distanceTo(tmpWorldPos);
        
        // Distance from wave
        const distanceToScanOrigin = origin.distanceTo(tmpWorldPos);
        const distanceToWave = Math.abs(distanceToScanOrigin - state.currentRadius);

        // Check if planet is in camera frustum (screen view)
        const isInFrustum = frustum.containsPoint(tmpWorldPos);
        
        // Optional: Check if planet is in center area (not edges)
        // Project to screen space to check if in center region
        const screenPos = tmpWorldPos.clone().project(camera);
        const isInCenterArea = Math.abs(screenPos.x) < 0.7 && Math.abs(screenPos.y) < 0.7;

        // ⭐ DISCOVERY CONDITIONS (ALL must be true):
        // 1. Camera is within 200 units
        // 2. Wave has reached the planet
        // 3. Planet is visible in camera frustum
        // 4. Planet is in center area of screen (not at edges)
        const cameraIsClose = distanceFromCamera <= MAX_DISCOVERY_DISTANCE;
        const waveHasReached = distanceToWave < WAVE_DETECTION_RANGE;

        if (cameraIsClose && waveHasReached && isInFrustum && isInCenterArea) {
          // Mark discovered once
          discoveredAudioPlanets.add(mesh.uuid);
          mesh.userData.discovered = true;
          
          // Start reveal animation
          if (mesh.userData._scanLastId !== state.scanId) {
            mesh.userData._scanLastId = state.scanId;
            mesh.userData._revealStartMs = nowMs;
            
            mesh.visible = true;
            revealU.value = 1.0;
            u.value = 0.0; // Start at x-ray phase
          }
        } else {
          // Stay hidden (distance, wave, or view requirements not met)
          revealU.value = 0.0;
          mesh.visible = false;
          u.value = 0.0;
          return;
        }
      } else {
        // Discovered planets: stay visible and stable, no re-animation
        mesh.visible = true;
        revealU.value = 1.0;
        u.value = 1.0;
        return; // Skip the animation logic below
      }

      // If reveal is running (only for newly discovered planets), drive odinFactor monotonically 0 -> 1
      const startMs = mesh.userData._revealStartMs;
      if (typeof startMs === 'number') {
        const p = THREE.MathUtils.clamp((nowMs - startMs) / REVEAL_DURATION_MS, 0, 1);
        const eased = easeInOutCubic(p);

        u.value = eased; // 0=x-ray-only, 1=material

        if (p >= 1) {
          // lock to material; stop timer
          u.value = 1.0;
          delete mesh.userData._revealStartMs;
        }
      }
    });
  }

  function finishScan() {
    state.active = false;
    waveMesh.visible = false;

    if (bloomPass)
      bloomPass.strength = baseBloomStrength;

    // 🔵 Scan bittiğinde tüm objeler normal haline dönsün
    odinTargets.forEach((u) => u && (u.value = 0.0));
    
    audioPlanetUniforms.forEach((u, index) => {
      if (!u) return;
      const mesh = audioPlanetMeshes[index];
      
      // Keşfedilmişse görünür kal, değilse görünmez
      if (mesh && discoveredAudioPlanets.has(mesh.uuid)) {
        u.value = 1.0;
      } else {
        u.value = 0.0;
      }
    });

    console.log("🟢 Odin's Sight tamamlandı - objeler normal haline döndü");
  }

  return {
    trigger,
    update,
    dispose() {
      waveMaterial.dispose();
      waveGeometry.dispose();
      scene.remove(waveMesh);
      
      // 📊 ============================================
      // SES CLEANUP - YENİ EKLENEN BÖLÜM
      // 📊 ============================================
      if (scanSound) {
        if (scanSound.isPlaying) {
          scanSound.stop();
        }
        scanSound.disconnect();
        scanSound = null;
      }
      // 📊 ============================================
      // SES CLEANUP SONU
      // 📊 ============================================
    },
    get isActive() {
      return state.active;
    },
    get discoveredCount() {
      return discoveredAudioPlanets.size;
    }
  };
}

// ========================================================================
// ⌨️ SCAN CONTROLS - Keyboard Input Handler
// ========================================================================

/**
 * Odin's Sight scan için klavye kontrollerini kurar
 * Space tuşuna basıldığında scan tetiklenir
 * 
 * @param {Object} advancedScan - createAdvancedScan'den dönen scan objesi
 * @param {Object} config - Opsiyonel konfigürasyon
 * @returns {Object} { dispose } cleanup fonksiyonu
 */
export function setupScanControls(advancedScan, config = {}) {
  let scanKey = config.key || 'Space';
  const allowRepeat = config.allowRepeat || false;

  /**
   * Keydown event handler
   */
  function handleKeyDown(event) {
    // Space tuşu kontrolü
    if (event.code === scanKey) {
      // Repeat engelle (tuşa basılı tutma)
      if (!allowRepeat && event.repeat) return;
      
      // Default davranışı engelle (sayfa scroll vs)
      event.preventDefault();
      
      // Scan tetikle
      console.log("🌊 Odin's Sight Scan Triggered!");
      advancedScan.trigger();
    }
  }

  // Event listener ekle
  window.addEventListener('keydown', handleKeyDown);

  console.log(`⌨️ Scan controls initialized (key: ${scanKey})`);

  // Public API
  return {
    /**
     * Cleanup - Event listener'ı kaldır
     */
    dispose: () => {
      window.removeEventListener('keydown', handleKeyDown);
      console.log('⌨️ Scan controls disposed');
    },
    
    /**
     * Tuş değiştirme (runtime'da)
     */
    changeKey: (newKey) => {
      console.log(`⌨️ Scan key changed: ${scanKey} → ${newKey}`);
      scanKey = newKey;
    }
  };
}