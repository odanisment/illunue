// ✅ script.js (Solar System Offset Applied + Gravitational Lensing + PRELOADER)

import * as THREE from 'three';
window.THREE = THREE;

// 🎬 ============================================================
// PRELOADER SYSTEM
// ============================================================
import { Preloader } from './modules/Preloader.js';

const preloader = new Preloader();

// 📦 LoadingManager - Tüm asset yüklemelerini takip eder
const loadingManager = new THREE.LoadingManager(
  // onLoad - Tüm yüklemeler tamamlandı
  () => {
    console.log('✅ All assets loaded successfully!');
    preloader.complete();
  },
  
  // onProgress - Her asset yüklendiğinde
  (url, loaded, total) => {
    console.log(`📦 Loading: ${loaded}/${total} - ${url}`);
    preloader.updateProgress(loaded, total);
    
    // Status mesajları (countdown stili - uppercase)
    if (url.includes('.jpg') || url.includes('.png')) {
      preloader.updateStatus('LOADING TEXTURES...');
    } else if (url.includes('.mp3') || url.includes('.wav')) {
      preloader.updateStatus('LOADING AUDIO...');
    } else if (url.includes('.glb') || url.includes('.gltf')) {
      preloader.updateStatus('LOADING MODELS...');
    } else {
      preloader.updateStatus('LOADING ASSETS...');
    }
  },
  
  // onError - Hata durumunda
  (url) => {
    console.error(`❌ Error loading: ${url}`);
    preloader.updateStatus('ERROR LOADING');
  }
);

// 🌍 SOLAR SYSTEM OFFSET - Tüm güneş sistemi bu pozisyonda olacak
import { SOLAR_SYSTEM_OFFSET, CAMERA_START_POSITION } from './solarSystemConfig.js';

// ------------------------------------------------------------------------
// 📊 AudioContext tracking - EN BAŞTA ÇALIŞTIR
// ------------------------------------------------------------------------
window.__audioContexts = window.__audioContexts || [];

// AudioContext constructor'ını wrap et (import'lardan önce)
if (window.AudioContext) {
  const OriginalAudioContext = window.AudioContext;
  window.AudioContext = function(...args) {
    const ctx = new OriginalAudioContext(...args);
    window.__audioContexts.push(ctx);
    console.log('🎵 New AudioContext created and tracked');
    return ctx;
  };
}

import { LensFlareEffect } from './LensFlare';
import { addSceneHelpers, addSunAndMoonLights } from './modules/helpers.js';
import { setupGUI } from './modules/gui.js';
import { setupCamera } from './modules/camera.js';
import { updateCelestialBodies } from './modules/updateCelestial.js';
import { Moon } from './Moon.js';
import { Earth } from './Earth.js';
import { ShootingStar } from './modules/ShootingStar.js';
import { ChunkManager } from './modules/ChunkManager.js';
import { NewsPlanetManager } from './modules/NewsPlanetManager.js';
import { AudioVisualizer } from './modules/AudioVisualizer.js';
import Stats from 'stats.js';
import * as SunCalc from 'suncalc';
import { calculateLST } from './modules/astroUtils.js';

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { createAdvancedScan } from './modules/scan.js';
import { createAudioProximityHUD } from './modules/audioProximityHUD.js';

// 🕳️ Gravitational Lensing - Black Hole efekti
import { GravitationalLensing } from './modules/GravitationalLensing.js';

window.SunCalc = SunCalc;

// ------------------------------------------------------------------------
// 📊 Performance stats
// ------------------------------------------------------------------------
const stats = new Stats();
stats.showPanel(0);
stats.dom.style.position = 'fixed';
stats.dom.style.left = '10px';
stats.dom.style.top = '10px';
document.body.appendChild(stats.dom);

// ------------------------------------------------------------------------
// 🖼 Renderer / Scene / Canvas
// ------------------------------------------------------------------------
const canvas = document.querySelector('canvas.webgl');
const scene = new THREE.Scene();
THREE.ColorManagement.enabled = false;
window.scene = scene;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance'
});
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ------------------------------------------------------------------------
// 🎥 Camera + OrbitControls
// ------------------------------------------------------------------------
const { camera, controls } = setupCamera(scene, renderer);
window.camera = camera;

// 📍 Optimal izometrik pozisyon (Big Bang için mükemmel açı ve mesafe)
camera.position.set(400, 400, 400);
controls.target.set(0, 0, 0); // Patlama merkezi
camera.lookAt(0, 0, 0);
controls.update();
console.log('🎥 Kamera optimal pozisyonda - Big Bang izlemeye hazır!');

// ------------------------------------------------------------------------
// 🎬 Post-processing pipeline
// ------------------------------------------------------------------------
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.7,
  0.4,
  0.85
);
composer.addPass(bloomPass);

// 🕳️ Gravitational Lensing Pass - Bloom'dan sonra
const gravitationalLensing = new GravitationalLensing(composer, camera);
window.gravitationalLensing = gravitationalLensing;
console.log('🕳️ Gravitational Lensing initialized');

// ------------------------------------------------------------------------
// 🧭 Helpers + Sun / Moon lights (OFFSET UYGULANMIŞ)
// ------------------------------------------------------------------------
const { helpers, gridHelper, axesHelper } = addSceneHelpers(scene);
const { sunLight, moonLight, sunHelper, moonHelper } =
  addSunAndMoonLights(scene);

// 🔒 Grid ve Axes başlangıçta görünmez
if (gridHelper) gridHelper.visible = false;
if (axesHelper) axesHelper.visible = false;

const scanExclusionTargets = [];
if (gridHelper) scanExclusionTargets.push(gridHelper);
if (axesHelper) scanExclusionTargets.push(axesHelper);
if (helpers) {
  if (Array.isArray(helpers)) {
    scanExclusionTargets.push(...helpers);
  } else {
    scanExclusionTargets.push(helpers);
  }
}

scanExclusionTargets.forEach((obj) => {
  if (!obj) return;
  if (obj.isObject3D && obj.traverse) {
    obj.traverse((child) => {
      child.userData = child.userData || {};
      child.userData.ignoreScan = true;
    });
  } else {
    obj.userData = obj.userData || {};
    obj.userData.ignoreScan = true;
  }
});

// ------------------------------------------------------------------------
// 🌍 Earth / 🌙 Moon / Chunks / News planets / AudioVisualizer
// ------------------------------------------------------------------------
const chunkManager = new ChunkManager(scene, camera, loadingManager); // ⭐ LoadingManager eklendi
window.chunkManager = chunkManager;

// 🕳️ Black Hole Lensing Callback'leri
chunkManager.cosmicManager.onBlackHoleCreated = (group) => {
  gravitationalLensing.addBlackHole(group);
  console.log('🕳️ Black hole registered for lensing effect');
};
chunkManager.cosmicManager.onBlackHoleRemoved = (group) => {
  gravitationalLensing.removeBlackHole(group);
  console.log('🕳️ Black hole removed from lensing effect');
};

const audioVisualizer = new AudioVisualizer(scene, camera);
window.audioVisualizer = audioVisualizer;

// 🔐 HIDDEN COORDINATES SYSTEM - Spektrogramda gizli koordinatlar
audioVisualizer.setHiddenMessage(1, '5000,100,5000');   // Planet 1 - Fire (Tletl)
audioVisualizer.setHiddenMessage(2, '3200,0,-4500');    // Planet 2 - Water (Ātl)
audioVisualizer.setHiddenMessage(3, '-1000,500,8000');  // Planet 3 - Earth (Tlalli)
audioVisualizer.setHiddenMessage(4, '0,-300,0');        // Planet 4 - Wind (Ehecatl)
audioVisualizer.setHiddenMessage(5, '7777,777,7777');   // Planet 5 - Sun (Tonatiuh)
console.log('🔐 Hidden coordinate system initialized - check spectrograms for secrets!');

const audioProximityHUD = createAudioProximityHUD({ scene, camera, maxDistance: 500 });
window.audioProximityHUD = audioProximityHUD;

// 🌍 DÜNYA - SOLAR_SYSTEM_OFFSET pozisyonunda oluşturuluyor
const earth = new Earth(
  SOLAR_SYSTEM_OFFSET.clone(),
  () => sunLight.position.clone().negate(),
  renderer,
  scene,
  loadingManager  // ⭐ LoadingManager eklendi
);
window.earth = earth;
const earthMesh = earth.object;
earthMesh.userData.ignoreScan = true;

// 🌙 AY - SOLAR_SYSTEM_OFFSET pozisyonunda başlıyor
const moon = new Moon(
  SOLAR_SYSTEM_OFFSET.clone(),
  () => sunLight.position.clone().negate(),
  renderer,
  scene,
  loadingManager  // ⭐ LoadingManager eklendi
);
window.moon = moon;
const moonMesh = moon.object;
moonMesh.userData.ignoreScan = true;

// collect odinFactor uniforms from Earth / Moon
const odinUniforms = [];
const earthMat = Array.isArray(earthMesh.material)
  ? earthMesh.material[0]
  : earthMesh.material;
if (earthMat?.uniforms?.odinFactor) {
  odinUniforms.push(earthMat.uniforms.odinFactor);
}
const moonMat = Array.isArray(moonMesh.material)
  ? moonMesh.material[0]
  : moonMesh.material;
if (moonMat?.uniforms?.odinFactor) {
  odinUniforms.push(moonMat.uniforms.odinFactor);
}

// ☀️ GÜNEŞ LENS FLARE - updateCelestial'da pozisyon güncellenecek
const lensFlareEffect = LensFlareEffect(
  true,
  sunLight.position,
  0.8,
  new THREE.Color(95, 12, 10)
);
lensFlareEffect.material.uniforms.enabled = { value: true };

// 📰 NEWS PLANETS - SOLAR_SYSTEM_OFFSET etrafında konumlandırılacak
const newsPlanetManager = new NewsPlanetManager(scene, camera, SOLAR_SYSTEM_OFFSET);
window.newsPlanetManager = newsPlanetManager;

// ------------------------------------------------------------------------
// ⏱ Time / Clouds / Shooting stars
// ------------------------------------------------------------------------
const timeParams = {
  realTime: true,
  hour: 12,
  minute: 0,
  second: 0,
  simulationSpeed: 1.0
};

const cloudParams = {
  speed: 0.5,
  direction: new THREE.Vector2(1.0, 0.05)
};

let lastStarTime = 0;
const shootingStars = [];
const starParams = {
  spawnInterval: 15,
  baseSpeed: 500,
  speedBoost: 1.5,
  spawnXRange: 30,
  tailLength: 1.0,
  bloomIntensity: 3.0,
  coreColor: '#ff0000',
  tailColor: '#fff8c7'
};

const userLat = 40.96;
const userLon = 29.08;

const cameraData = {
  x: 0,
  y: 0,
  z: 0,
  ra: '0h 0m',
  dec: '0°'
};

// ------------------------------------------------------------------------
// 🔍 Assassin's Creed style scan system
// ------------------------------------------------------------------------
const advancedScan = createAdvancedScan({
  scene,
  camera,
  bloomPass,
  maxRadius: 300,
  duration: 2.0,
  waveSpeed: 200,
  waveThickness: 20,
  odinUniforms // Earth + Moon odinFactor animation
});

// ------------------------------------------------------------------------
// 🧰 GUI
// ------------------------------------------------------------------------
const gui = setupGUI({
  gridHelper,
  axesHelper,
  sunHelper,
  moonHelper,
  sunLight,
  LensFlareParams: lensFlareEffect.material.uniforms,
  timeParams,
  moonMesh,
  earthMesh,
  moonGlowSprite: null,
  bloomPass,
  backgroundMaterial: null,
  cloudParams,
  starParams,
  cameraData,
  shootingStarsEnabled: true,
  cosmicManager: chunkManager.cosmicManager
});

// ------------------------------------------------------------------------
// 💤 Idle camera animation (smooth, minimal rotation)
// ------------------------------------------------------------------------
let lastInteractionTime = Date.now();
let isIdle = false;

const idleRotationState = {
  yaw: 0,
  pitch: 0,
  targetYaw: 0,
  targetPitch: 0,
  changeTimer: 0,
  savedTarget: null
};

const IDLE_TIMEOUT = 15000; // 15 saniye
const TRANSITION_DURATION = 2000;
const ROTATION_SPEED = 0.00015;

function resetIdleTimer() {
  lastInteractionTime = Date.now();
  
  if (isIdle) {
    console.log('🎮 Kullanıcı geri döndü - idle modu bitiyor');
  }
  isIdle = false;
}

window.addEventListener('mousemove', resetIdleTimer);
window.addEventListener('mousedown', resetIdleTimer);
window.addEventListener('wheel', resetIdleTimer);
window.addEventListener('keydown', resetIdleTimer);
window.addEventListener('touchstart', resetIdleTimer);
window.addEventListener('touchmove', resetIdleTimer);

function updateIdleCamera(deltaTime) {
  const now = Date.now();
  const timeSinceInteraction = now - lastInteractionTime;

  if (!isIdle && timeSinceInteraction > IDLE_TIMEOUT) {
    isIdle = true;
    idleRotationState.savedTarget = controls.target.clone();
    idleRotationState.yaw = 0;
    idleRotationState.pitch = 0;
    idleRotationState.targetYaw = 0;
    idleRotationState.targetPitch = 0;
    idleRotationState.changeTimer = 3 + Math.random() * 2;
    console.log('💤 İdeal mod başladı - ekran koruyucu aktif');
  }

  if (!isIdle) return;

  idleRotationState.changeTimer -= deltaTime;
  if (idleRotationState.changeTimer <= 0) {
    idleRotationState.targetYaw = (Math.random() - 0.5) * 0.15;
    idleRotationState.targetPitch = (Math.random() - 0.5) * 0.08;
    idleRotationState.changeTimer = 8 + Math.random() * 7;
  }

  const lerpSpeed = 0.5 * deltaTime;
  idleRotationState.yaw += (idleRotationState.targetYaw - idleRotationState.yaw) * lerpSpeed;
  idleRotationState.pitch += (idleRotationState.targetPitch - idleRotationState.pitch) * lerpSpeed;

  const rotationSpeed = deltaTime * 0.16;
  const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
  const radius = offset.length();
  
  let theta = Math.atan2(offset.x, offset.z);
  let phi = Math.acos(Math.max(-1, Math.min(1, offset.y / radius)));
  
  theta += idleRotationState.yaw * rotationSpeed;
  phi += idleRotationState.pitch * rotationSpeed;
  phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi));
  
  offset.x = radius * Math.sin(phi) * Math.sin(theta);
  offset.y = radius * Math.cos(phi);
  offset.z = radius * Math.sin(phi) * Math.cos(theta);
  
  camera.position.copy(controls.target).add(offset);
  
  if (idleRotationState.savedTarget) {
    controls.target.copy(idleRotationState.savedTarget);
  }
}

// ------------------------------------------------------------------------
// 🎮 Space key → Odin scan
// ------------------------------------------------------------------------
function setupScanControls() {
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && !event.repeat) {
      event.preventDefault();
      console.log("🌊 Odin's Sight Scan Triggered!");
      advancedScan.trigger();
    }
  });
}

// ------------------------------------------------------------------------
// 📊 AudioContext resume (user gesture)
// ------------------------------------------------------------------------
function resumeAudioContextOnce() {
  const listener = camera.userData.audioListener;
  if (listener && listener.context.state === 'suspended') {
    listener.context.resume().then(() => {
      console.log('📊 Camera AudioContext resumed by user gesture.');
    }).catch(err => {
      console.warn('⚠ Failed to resume camera AudioContext:', err);
    });
  }

  if (window.audioVisualizer && window.audioVisualizer.audioContext) {
    if (window.audioVisualizer.audioContext.state === 'suspended') {
      window.audioVisualizer.audioContext.resume().then(() => {
        console.log('📊 AudioVisualizer AudioContext resumed by user gesture.');
      }).catch(err => {
        console.warn('⚠ Failed to resume AudioVisualizer AudioContext:', err);
      });
    }
  }

  if (window.AudioContext || window.webkitAudioContext) {
    const contexts = window.__audioContexts || [];
    contexts.forEach(ctx => {
      if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
          console.log('📊 Global AudioContext resumed.');
        }).catch(err => {
          console.warn('⚠ Failed to resume global AudioContext:', err);
        });
      }
    });
  }

  window.removeEventListener('click', resumeAudioContextOnce);
  window.removeEventListener('keydown', resumeAudioContextOnce);
  window.removeEventListener('touchstart', resumeAudioContextOnce);
}

window.addEventListener('click', resumeAudioContextOnce);
window.addEventListener('keydown', resumeAudioContextOnce);
window.addEventListener('touchstart', resumeAudioContextOnce);

// ------------------------------------------------------------------------
// ⏱ Main loop
// ------------------------------------------------------------------------
const clock = new THREE.Clock();

function tick() {
  stats.begin();

  const deltaTime = clock.getDelta();
  const elapsedTime = clock.getElapsedTime();

  earth.animate();

  chunkManager.update();
  newsPlanetManager.update();

  if (elapsedTime - lastStarTime >= starParams.spawnInterval) {
    lastStarTime = elapsedTime;
    shootingStars.push(new ShootingStar(scene, camera, starParams));
  }

  shootingStars.forEach((star, index) => {
    if (!star.update(deltaTime)) {
      scene.remove(star.mesh);
      shootingStars.splice(index, 1);
    }
  });

  updateCelestialBodies({
    timeParams,
    sunLight,
    moonLight,
    moonMesh,
    earthMesh,
    cloudParams,
    lensFlareEffect,
    backgroundMaterial: null,
    userLat,
    userLon,
    deltaTime: deltaTime * timeParams.simulationSpeed,
    solarSystemOffset: SOLAR_SYSTEM_OFFSET
  });

  advancedScan.update(deltaTime);
  audioVisualizer.update();
  audioProximityHUD.update(deltaTime);

  // 🕳️ Gravitational Lensing güncelle
  gravitationalLensing.update();

  updateIdleCamera(deltaTime);

  controls.update();

  const camPos = camera.position;
  cameraData.x = camPos.x.toFixed(2);
  cameraData.y = camPos.y.toFixed(2);
  cameraData.z = camPos.z.toFixed(2);

  const now = new Date();
  const lstDeg = calculateLST(now, userLon);
  const r = camPos.length();
  const decRad = Math.asin(camPos.y / r);
  const raRad = Math.atan2(camPos.z, camPos.x);
  const raShifted =
    ((THREE.MathUtils.degToRad(lstDeg) - raRad) + 2 * Math.PI) %
    (2 * Math.PI);
  const raHours = (raShifted / (2 * Math.PI)) * 24;
  const h = Math.floor(raHours);
  const m = Math.floor((raHours - h) * 60);
  const decDeg = THREE.MathUtils.radToDeg(decRad);
  cameraData.ra = `${h}h ${m}m`;
  cameraData.dec = `${decDeg.toFixed(2)}°`;
  composer.render();

  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(lensFlareEffect, camera);
  renderer.autoClear = true;

  stats.end();
  requestAnimationFrame(tick);
}

setupScanControls();
tick();

// ------------------------------------------------------------------------
// 🔧 Resize
// ------------------------------------------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  
  // 🕳️ Gravitational Lensing aspect ratio güncelle
  gravitationalLensing.updateAspectRatio();
});

// ========================================================================
// 🔍 DEBUG HELPERS - Cosmic Objects Finder
// ========================================================================

window.findCosmicObjects = function() {
  const result = {
    loadedChunks: chunkManager.chunks.size,
    cosmicChunks: chunkManager.cosmicManager.objects.size,
    activeCosmicObjects: chunkManager.cosmicManager.activeObjects.size,
    blackholes: [],
    nebulas: []
  };
  
  chunkManager.cosmicManager.activeObjects.forEach(obj => {
    if (obj.eventHorizon) {
      result.blackholes.push({
        object: obj,
        position: obj.group.position,
        distance: camera.position.distanceTo(obj.group.position)
      });
    } else if (obj.layers) {
      result.nebulas.push({
        object: obj,
        position: obj.group.position,
        distance: camera.position.distanceTo(obj.group.position)
      });
    }
  });
  
  result.blackholes.sort((a, b) => a.distance - b.distance);
  result.nebulas.sort((a, b) => a.distance - b.distance);
  
  return result;
};

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
  
  blackholes.sort((a, b) => a.distance - b.distance);
  
  return blackholes;
};

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
  
  nebulas.sort((a, b) => a.distance - b.distance);
  
  return nebulas;
};

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
  
  planets.sort((a, b) => a.distance - b.distance);
  
  return planets;
};

window.findNearestBlackHole = function() {
  const blackholes = window.findBlackHoles();
  return blackholes.length > 0 ? blackholes[0] : null;
};

window.findNearestNebula = function() {
  const nebulas = window.findNebulas();
  return nebulas.length > 0 ? nebulas[0] : null;
};

window.showCosmicStats = function() {
  const stats = window.findCosmicObjects();
  
  console.log('╔═════════════════════════════════════╗');
  console.log('║     🌌 COSMIC OBJECTS STATS         ║');
  console.log('╚═════════════════════════════════════╝');
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

window.flyToPosition = function(position, distance = 200) {
  const direction = new THREE.Vector3()
    .subVectors(camera.position, position)
    .normalize();
  
  const targetCamPos = position.clone().add(direction.multiplyScalar(distance));
  
  console.log(`🚀 Flying to: (${position.x.toFixed(0)}, ${position.y.toFixed(0)}, ${position.z.toFixed(0)})`);
  
  camera.position.copy(targetCamPos);
  controls.target.copy(position);
  controls.update();
};

window.flyToNearestBlackHole = function() {
  const bh = window.findNearestBlackHole();
  if (bh) {
    console.log('🕳️ Flying to nearest black hole...');
    window.flyToPosition(bh.position, 300);
  } else {
    console.log('⚠ No black holes found. Move around to load more chunks!');
  }
};

window.flyToNearestNebula = function() {
  const neb = window.findNearestNebula();
  if (neb) {
    console.log('🌌 Flying to nearest nebula...');
    window.flyToPosition(neb.position, 500);
  } else {
    console.log('⚠ No nebulas found. Move around to load more chunks!');
  }
};

// ========================================================================
// 🎮 Konsola başlangıç mesajı
// ========================================================================
console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║         🌌 COSMIC OBJECTS DEBUG HELPERS LOADED         ║');
console.log('╚═══════════════════════════════════════════════════════════╝');
console.log('');
console.log('📊 Available Commands:');
console.log('  • findCosmicObjects()      - Full cosmic stats');
console.log('  • findBlackHoles()         - List all black holes');
console.log('  • findNebulas()            - List all nebulas');
console.log('  • findAudioPlanets()       - List all audio planets');
console.log('  • findNearestBlackHole()   - Get closest black hole');
console.log('  • findNearestNebula()      - Get closest nebula');
console.log('  • showCosmicStats()        - Pretty print stats');
console.log('  • flyToNearestBlackHole()  - Teleport to black hole');
console.log('  • flyToNearestNebula()     - Teleport to nebula');
console.log('');
console.log('💡 Tip: Move around to load more chunks and discover objects!');
console.log('');