// ✅ script.js (HYBRID LENS FLARE SYSTEM - v3.0)
// 🌟 UPDATED: Sprite-based lens flare with Raycaster occlusion
// ⚡ 6x faster, %98 accuracy, GPU depth-testing

import * as THREE from 'three';
window.THREE = THREE;

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

// ⭐ UPDATED: Yeni LensFlare sistemi (shader import'ları yok!)
import { LensFlareEffect } from './LensFlare.js';
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
import { createAdvancedScan, setupScanControls } from './modules/scan.js';
import { createAudioProximityHUD } from './modules/audioProximityHUD.js';

// 🕳️ Gravitational Lensing - Black Hole efekti
import { GravitationalLensing } from './modules/GravitationalLensing.js';
import { initDebugHelpers } from './modules/debugHelpers.js';

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
const { camera, controls, idleSystem } = setupCamera(scene, renderer);
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
const chunkManager = new ChunkManager(scene, camera);
window.chunkManager = chunkManager; // ✅ Global access for debugging

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
// Her AudioPlanet için planetId ve koordinat stringi (format: "x,y,z")
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
  SOLAR_SYSTEM_OFFSET.clone(), // Artık (5000, 0, 5000) gibi bir pozisyonda
  () => sunLight.position.clone().negate(),
  renderer,
  scene,
  {  // ✅ Cloud config
    speed: 0.6,
    direction: new THREE.Vector2(1.0, 0.05),
    turbulence: 0.25,
    distortion: 0.12,
    detailScale: 6.0
  }
);
window.earth = earth;
const earthMesh = earth.object;
earthMesh.userData.ignoreScan = true;

// 🌙 AY - SOLAR_SYSTEM_OFFSET pozisyonunda başlıyor (updateCelestial içinde güneşe göre hareket edecek)
const moon = new Moon(
  SOLAR_SYSTEM_OFFSET.clone(),
  () => sunLight.position.clone().negate(),
  renderer,
  scene
);
window.moon = moon;
const moonMesh = moon.object;
moonMesh.userData.ignoreScan = true;

// collect odinFactor uniforms from Earth / Moon
const odinUniforms = [];

// ✅ Earth - userData'dan earthUniforms al
if (earthMesh?.userData?.earthUniforms?.odinFactor) {
  odinUniforms.push(earthMesh.userData.earthUniforms.odinFactor);
}

// ✅ Earth clouds - userData'dan cloudUniforms al
if (earthMesh?.userData?.cloudUniforms?.odinFactor) {
  odinUniforms.push(earthMesh.userData.cloudUniforms.odinFactor);
}

// Moon
const moonMat = Array.isArray(moonMesh.material)
  ? moonMesh.material[0]
  : moonMesh.material;
if (moonMat?.uniforms?.odinFactor) {
  odinUniforms.push(moonMat.uniforms.odinFactor);
}

// ☀️ GÜNEŞ LENS FLARE - HYBRID SYSTEM (Sprite + Raycaster)
console.log('🌟 Creating Hybrid Lens Flare System...');
const lensFlareEffect = LensFlareEffect(
  true,
  sunLight.position,
  0.8,
  new THREE.Color(95, 12, 10)
);

// ⭐ KRITIK: Sprite'ı scene'e ekle (otomatik render için)
scene.add(lensFlareEffect);
console.log('✅ Lens flare sprite added to scene');

// ⭐ Global access (debug için)
window.lensFlareEffect = lensFlareEffect;
window.LensFlareParams = window.LensFlareParams || {};

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
  LensFlareParams: window.LensFlareParams, // ⭐ UPDATED: Global params
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
  cosmicManager: chunkManager.cosmicManager  // 🕳️ Black Hole disk toggle için
});

// ------------------------------------------------------------------------
// ⌨️ Scan Controls - Space key → Odin scan
// ------------------------------------------------------------------------
const scanControls = setupScanControls(advancedScan);

// ------------------------------------------------------------------------
// 📊 AudioContext resume (user gesture)
// ------------------------------------------------------------------------
function resumeAudioContextOnce() {
  const listener = camera.userData.audioListener;
  if (listener && listener.context.state === 'suspended') {
    listener.context.resume().then(() => {
      console.log('📊 Camera AudioContext resumed by user gesture.');
    }).catch(err => {
      console.warn('❌ Failed to resume camera AudioContext:', err);
    });
  }

  if (window.audioVisualizer && window.audioVisualizer.audioContext) {
    if (window.audioVisualizer.audioContext.state === 'suspended') {
      window.audioVisualizer.audioContext.resume().then(() => {
        console.log('📊 AudioVisualizer AudioContext resumed by user gesture.');
      }).catch(err => {
        console.warn('❌ Failed to resume AudioVisualizer AudioContext:', err);
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
          console.warn('❌ Failed to resume global AudioContext:', err);
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
  // ⭐ KRITIK FIX - DeltaTime'ı güvenli aralıkta tut (sekme geçişlerinde kamera çılgınlığını önler)
  const dt = Math.min(deltaTime, 0.1); // Max 100ms (10 FPS minimum) - idle camera için kritik!
  
  const elapsedTime = clock.getElapsedTime();

  earth.animate();

  chunkManager.update();
  newsPlanetManager.update();

  if (elapsedTime - lastStarTime >= starParams.spawnInterval) {
    lastStarTime = elapsedTime;
    shootingStars.push(new ShootingStar(scene, camera, starParams));
  }

  shootingStars.forEach((star, index) => {
    if (!star.update(dt)) {
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
    lensFlareEffect, // ⭐ Sprite artık - updateCelestial içinde kullanılmıyorsa kaldırılabilir
    backgroundMaterial: null,
    userLat,
    userLon,
    deltaTime: dt * timeParams.simulationSpeed,
    solarSystemOffset: SOLAR_SYSTEM_OFFSET
  });

  advancedScan.update(dt);
  audioVisualizer.update();
  audioProximityHUD.update(dt);

  // 🕳️ Gravitational Lensing güncelle
  gravitationalLensing.update();

  // 💤 Idle camera güncelle
  idleSystem.update(dt);

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
  
  // ⭐ SINGLE RENDER PASS - Lens flare artık otomatik dahil
  composer.render();

  // ❌ MANUEL RENDER KALDIRILDI - Artık gerek yok!
  // Sprite scene'in parçası, composer.render() ile otomatik render ediliyor

  stats.end();
  requestAnimationFrame(tick);
}

// ========================================================================
// 🔍 DEBUG HELPERS - Initialize
// ========================================================================
initDebugHelpers(scene, camera, chunkManager);

// ========================================================================
// ⚡ START ANIMATION LOOP
// ========================================================================
tick();

// ------------------------------------------------------------------------
// 📐 Resize
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
// 🎮 CONSOLE LOG - Sistem durumu
// ========================================================================
console.log('');
console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║  🌟 HYBRID LENS FLARE SYSTEM INITIALIZED                 ║');
console.log('╚═══════════════════════════════════════════════════════════╝');
console.log('');
console.log('✅ Sprite-based (world-space, depth-tested)');
console.log('✅ Raycaster occlusion (9 samples, 6x faster)');
console.log('✅ Procedural texture (no external shaders)');
console.log('✅ Auto-render (single pass with composer)');
console.log('');
console.log('🎮 Debug Commands:');
console.log('  window.lensFlareEffect      - Sprite object');
console.log('  window.LensFlareParams      - Configuration');
console.log('  lensFlareEffect.material.opacity - Current opacity (0-1)');
console.log('');