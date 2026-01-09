// modules/debugHelpers.js
// 🔍 DEBUG HELPERS - Cosmic Objects Finder
// Development amaçlı debug fonksiyonları - production'da disable edilebilir

/**
 * Tüm debug helper fonksiyonlarını window objesine ekler
 * @param {THREE.Scene} scene - Ana sahne
 * @param {THREE.Camera} camera - Ana kamera
 * @param {ChunkManager} chunkManager - Chunk yönetici
 */
export function initDebugHelpers(scene, camera, chunkManager) {
  
  /**
   * 🌌 Tüm cosmic objects hakkında özet bilgi
   * @returns {Object} Chunk ve cosmic object istatistikleri
   */
  window.findCosmicObjects = function() {
    const result = {
      loadedChunks: chunkManager.chunks.size,
      cosmicChunks: chunkManager.cosmicManager.objects.size,
      activeCosmicObjects: chunkManager.cosmicManager.activeObjects.size,
      blackholes: [],
      nebulas: []
    };
    
    // Active objects'i ayır
    chunkManager.cosmicManager.activeObjects.forEach(obj => {
      if (obj.eventHorizon) {
        // Black hole detected (has eventHorizon property)
        result.blackholes.push({
          object: obj,
          position: obj.group.position,
          distance: camera.position.distanceTo(obj.group.position)
        });
      } else if (obj.layers) {
        // Nebula detected (has layers property)
        result.nebulas.push({
          object: obj,
          position: obj.group.position,
          distance: camera.position.distanceTo(obj.group.position)
        });
      }
    });
    
    // Sort by distance
    result.blackholes.sort((a, b) => a.distance - b.distance);
    result.nebulas.sort((a, b) => a.distance - b.distance);
    
    return result;
  };

  /**
   * 🕳️ Sadece black hole'ları bul
   * @returns {Array} Black hole objelerinin array'i
   */
  window.findBlackHoles = function() {
    const blackholes = [];
    
    chunkManager.cosmicManager.activeObjects.forEach(obj => {
      if (obj.eventHorizon) {
        blackholes.push({
          object: obj,
          group: obj.group,
          position: obj.group.position.clone(),
          distance: camera.position.distanceTo(obj.group.position)
        });
      }
    });
    
    // Sort by distance (closest first)
    blackholes.sort((a, b) => a.distance - b.distance);
    
    return blackholes;
  };

  /**
   * 🌌 Sadece nebula'ları bul
   * @returns {Array} Nebula objelerinin array'i
   */
  window.findNebulas = function() {
    const nebulas = [];
    
    chunkManager.cosmicManager.activeObjects.forEach(obj => {
      if (obj.layers) {
        nebulas.push({
          object: obj,
          group: obj.group,
          position: obj.group.position.clone(),
          distance: camera.position.distanceTo(obj.group.position)
        });
      }
    });
    
    // Sort by distance (closest first)
    nebulas.sort((a, b) => a.distance - b.distance);
    
    return nebulas;
  };

  /**
   * 🎵 Audio planet'leri bul
   * @returns {Array} Audio planet objelerinin array'i
   */
  window.findAudioPlanets = function() {
    const planets = [];
    
    scene.traverse(obj => {
      if (obj.userData?.isAudioPlanet === true) {
        planets.push({
          mesh: obj,
          planetId: obj.userData.audioPlanetId,
          position: obj.position.clone(),
          discovered: obj.userData.discovered || false,
          distance: camera.position.distanceTo(obj.position)
        });
      }
    });
    
    // Sort by distance
    planets.sort((a, b) => a.distance - b.distance);
    
    return planets;
  };

  /**
   * 🎯 Kameraya en yakın black hole'u bul
   * @returns {Object|null} En yakın black hole veya null
   */
  window.findNearestBlackHole = function() {
    const blackholes = window.findBlackHoles();
    return blackholes.length > 0 ? blackholes[0] : null;
  };

  /**
   * 🎯 Kameraya en yakın nebula'yı bul
   * @returns {Object|null} En yakın nebula veya null
   */
  window.findNearestNebula = function() {
    const nebulas = window.findNebulas();
    return nebulas.length > 0 ? nebulas[0] : null;
  };

  /**
   * 📊 Debug paneli göster (console'da özet bilgi)
   */
  window.showCosmicStats = function() {
    const stats = window.findCosmicObjects();
    
    console.log('╔══════════════════════════════════════╗');
    console.log('║     🌌 COSMIC OBJECTS STATS         ║');
    console.log('╚══════════════════════════════════════╝');
    console.log(`📦 Loaded Chunks: ${stats.loadedChunks}`);
    console.log(`🌌 Chunks with Cosmic Objects: ${stats.cosmicChunks}`);
    console.log(`✨ Active Cosmic Objects: ${stats.activeCosmicObjects}`);
    console.log(`🕳️  Black Holes: ${stats.blackholes.length}`);
    console.log(`🌫️  Nebulas: ${stats.nebulas.length}`);
    console.log('');
    
    if (stats.blackholes.length > 0) {
      console.log('🕳️  BLACK HOLES (sorted by distance):');
      stats.blackholes.forEach((bh, i) => {
        console.log(`   ${i + 1}. Distance: ${bh.distance.toFixed(0)} units`);
        console.log(`      Position: (${bh.position.x.toFixed(0)}, ${bh.position.y.toFixed(0)}, ${bh.position.z.toFixed(0)})`);
      });
      console.log('');
    }
    
    if (stats.nebulas.length > 0) {
      console.log('🌫️  NEBULAS (sorted by distance):');
      stats.nebulas.forEach((neb, i) => {
        console.log(`   ${i + 1}. Distance: ${neb.distance.toFixed(0)} units`);
        console.log(`      Position: (${neb.position.x.toFixed(0)}, ${neb.position.y.toFixed(0)}, ${neb.position.z.toFixed(0)})`);
      });
    }
    
    return stats;
  };

  /**
   * 🎯 Belirli bir objeye kamerayı yönlendir
   * @param {THREE.Vector3} position - Hedef pozisyon
   * @param {number} distance - Hedefe olan mesafe (default: 200)
   * @param {OrbitControls} controls - Kamera kontrolleri (window.controls'dan alınır)
   */
  window.flyToPosition = function(position, distance = 200) {
    // window.controls global olarak tanımlı olmalı (script.js'de: window.controls = controls;)
    if (!window.controls) {
      console.error('❌ window.controls not found! Make sure controls are exposed globally.');
      return;
    }
    
    const direction = new THREE.Vector3()
      .subVectors(camera.position, position)
      .normalize();
    
    const targetCamPos = position.clone().add(direction.multiplyScalar(distance));
    
    console.log(`🚀 Flying to: (${position.x.toFixed(0)}, ${position.y.toFixed(0)}, ${position.z.toFixed(0)})`);
    
    // Smooth camera transition
    camera.position.copy(targetCamPos);
    window.controls.target.copy(position);
    window.controls.update();
  };

  /**
   * 🕳️ En yakın black hole'a uç
   */
  window.flyToNearestBlackHole = function() {
    const bh = window.findNearestBlackHole();
    if (bh) {
      console.log('🕳️ Flying to nearest black hole...');
      window.flyToPosition(bh.position, 300);
    } else {
      console.log('❌ No black holes found. Move around to load more chunks!');
    }
  };

  /**
   * 🌌 En yakın nebula'ya uç
   */
  window.flyToNearestNebula = function() {
    const neb = window.findNearestNebula();
    if (neb) {
      console.log('🌌 Flying to nearest nebula...');
      window.flyToPosition(neb.position, 500);
    } else {
      console.log('❌ No nebulas found. Move around to load more chunks!');
    }
  };

  // ========================================================================
  // 📝 BONUS: Ekstra Debug Fonksiyonları
  // ========================================================================

  /**
   * 🎵 Keşfedilmiş audio planet sayısını göster
   * @returns {number} Keşfedilmiş planet sayısı
   */
  window.getDiscoveredPlanetsCount = function() {
    const planets = window.findAudioPlanets();
    const discovered = planets.filter(p => p.discovered).length;
    console.log(`🎵 Discovered planets: ${discovered}/${planets.length}`);
    return discovered;
  };

  /**
   * 🗺️ Tüm audio planet'lerin koordinatlarını göster
   */
  window.listAllAudioPlanets = function() {
    const planets = window.findAudioPlanets();
    
    console.log('╔══════════════════════════════════════╗');
    console.log('║     🎵 AUDIO PLANETS LIST          ║');
    console.log('╚══════════════════════════════════════╝');
    
    const planetNames = ['', 'Tletl (Fire)', 'Ātl (Water)', 'Tlalli (Earth)', 'Ehecatl (Wind)', 'Tonatiuh (Sun)'];
    
    planets.forEach((planet, i) => {
      const status = planet.discovered ? '✅ DISCOVERED' : '❌ HIDDEN';
      const name = planetNames[planet.planetId] || `Planet ${planet.planetId}`;
      
      console.log(`${i + 1}. ${name} - ${status}`);
      console.log(`   Position: (${planet.position.x.toFixed(0)}, ${planet.position.y.toFixed(0)}, ${planet.position.z.toFixed(0)})`);
      console.log(`   Distance: ${planet.distance.toFixed(0)} units`);
      console.log('');
    });
    
    return planets;
  };

  /**
   * 🎯 Belirli bir audio planet'e teleport
   * @param {number} planetId - Planet ID (1-5)
   */
  window.flyToAudioPlanet = function(planetId) {
    const planets = window.findAudioPlanets();
    const planet = planets.find(p => p.planetId === planetId);
    
    if (planet) {
      const planetNames = ['', 'Tletl (Fire)', 'Ātl (Water)', 'Tlalli (Earth)', 'Ehecatl (Wind)', 'Tonatiuh (Sun)'];
      console.log(`🎵 Flying to ${planetNames[planetId]}...`);
      window.flyToPosition(planet.position, 150);
    } else {
      console.log(`❌ Planet ${planetId} not found or not loaded yet!`);
    }
  };

  /**
   * 📊 Tüm sistemlerin durumunu göster (comprehensive debug)
   */
  window.showFullStats = function() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║              🌌 FULL SYSTEM STATS                       ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
    
    // Cosmic objects
    const cosmicStats = window.findCosmicObjects();
    console.log('📦 CHUNKS & COSMIC OBJECTS:');
    console.log(`   Loaded Chunks: ${cosmicStats.loadedChunks}`);
    console.log(`   Cosmic Chunks: ${cosmicStats.cosmicChunks}`);
    console.log(`   Active Objects: ${cosmicStats.activeCosmicObjects}`);
    console.log(`   Black Holes: ${cosmicStats.blackholes.length}`);
    console.log(`   Nebulas: ${cosmicStats.nebulas.length}`);
    console.log('');
    
    // Audio planets
    const planets = window.findAudioPlanets();
    const discovered = planets.filter(p => p.discovered).length;
    console.log('🎵 AUDIO PLANETS:');
    console.log(`   Total: ${planets.length}`);
    console.log(`   Discovered: ${discovered}/${planets.length}`);
    console.log('');
    
    // Camera position
    console.log('🎥 CAMERA:');
    console.log(`   Position: (${camera.position.x.toFixed(0)}, ${camera.position.y.toFixed(0)}, ${camera.position.z.toFixed(0)})`);
    console.log('');
    
    return {
      cosmic: cosmicStats,
      planets: planets,
      discovered: discovered
    };
  };

  /**
   * 🧹 Console'u temizle ve logo göster
   */
  window.clearConsole = function() {
    console.clear();
    printWelcomeMessage();
  };

  // ========================================================================
  // 🎮 Konsola başlangıç mesajı
  // ========================================================================
  function printWelcomeMessage() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║         🌌 COSMIC OBJECTS DEBUG HELPERS LOADED         ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('📊 Available Commands:');
    console.log('');
    console.log('  🔍 SEARCH & FIND:');
    console.log('    • findCosmicObjects()        - Full cosmic stats');
    console.log('    • findBlackHoles()           - List all black holes');
    console.log('    • findNebulas()              - List all nebulas');
    console.log('    • findAudioPlanets()         - List all audio planets');
    console.log('    • findNearestBlackHole()     - Get closest black hole');
    console.log('    • findNearestNebula()        - Get closest nebula');
    console.log('');
    console.log('  📊 STATS & INFO:');
    console.log('    • showCosmicStats()          - Pretty print cosmic stats');
    console.log('    • listAllAudioPlanets()      - Show all planets with status');
    console.log('    • getDiscoveredPlanetsCount() - Count discovered planets');
    console.log('    • showFullStats()            - Comprehensive system stats');
    console.log('');
    console.log('  🚀 NAVIGATION:');
    console.log('    • flyToPosition(pos, dist)   - Fly to specific position');
    console.log('    • flyToNearestBlackHole()    - Teleport to black hole');
    console.log('    • flyToNearestNebula()       - Teleport to nebula');
    console.log('    • flyToAudioPlanet(1-5)      - Teleport to specific planet');
    console.log('');
    console.log('  🧹 UTILITY:');
    console.log('    • clearConsole()             - Clear and show this message');
    console.log('');
    console.log('💡 Tip: Move around to load more chunks and discover objects!');
    console.log('💡 Tip: Use Space key to trigger Odin\'s Sight scan!');
    console.log('');
  }

  // İlk yüklemede welcome mesajını göster
  printWelcomeMessage();
  
  console.log('✅ Debug helpers initialized successfully!');
}

/**
 * 🚫 Debug helpers'ı devre dışı bırak (production için)
 * Tüm window fonksiyonlarını kaldırır
 */
export function disableDebugHelpers() {
  const helperNames = [
    'findCosmicObjects',
    'findBlackHoles',
    'findNebulas',
    'findAudioPlanets',
    'findNearestBlackHole',
    'findNearestNebula',
    'showCosmicStats',
    'flyToPosition',
    'flyToNearestBlackHole',
    'flyToNearestNebula',
    'getDiscoveredPlanetsCount',
    'listAllAudioPlanets',
    'flyToAudioPlanet',
    'showFullStats',
    'clearConsole'
  ];
  
  helperNames.forEach(name => {
    if (window[name]) {
      delete window[name];
    }
  });
  
  console.log('🚫 Debug helpers disabled (production mode)');
}