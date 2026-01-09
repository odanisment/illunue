// modules/camera.js
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

export function setupCamera(scene, renderer) {
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100000);
  camera.position.set(0, 0, 10);
  scene.add(camera);
  window.camera = camera;

  // 📊 AudioListener entegre edildi
  const listener = new THREE.AudioListener();
  camera.add(listener);
  camera.userData.audioListener = listener;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  controls.enablePan = true;
  controls.enableZoom = true;
  controls.minDistance = 0;
  controls.maxDistance = Infinity;

  // ⚡ Daha güçlü tepkiler
  controls.zoomSpeed = 20.0;
  controls.panSpeed = 20.0;

  renderer.setAnimationLoop(() => {
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    controls.target.copy(camera.position).add(direction);
  });

  // 📦 Akıcı geçiş destekli zoom animasyonu (kamera + target)
  let cameraTween = null;

  function smoothCameraMove(targetPosition, duration = 1000) {
    const startPosition = camera.position.clone();
    const startTarget = controls.target.clone();

    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    const targetTarget = targetPosition.clone().add(direction);

    const startTime = performance.now();

    if (cameraTween) cancelAnimationFrame(cameraTween);

    function animate(time) {
      const t = Math.min((time - startTime) / duration, 1);
      const easedT = 1 - Math.pow(1 - t, 3);

      camera.position.lerpVectors(startPosition, targetPosition, easedT);
      controls.target.lerpVectors(startTarget, targetTarget, easedT);

      if (t < 1) {
        cameraTween = requestAnimationFrame(animate);
      } else {
        cameraTween = null;
      }
    }

    cameraTween = requestAnimationFrame(animate);
  }

  // 🖱️ Çift tıklama ile tıklanan yöne doğru smooth zoom
  window.addEventListener('dblclick', (event) => {
    const mouse = new THREE.Vector2(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const direction = raycaster.ray.direction.clone();
    const target = camera.position.clone().add(direction.multiplyScalar(300));

    smoothCameraMove(target);
  });

  window.controls = controls;

  // 💤 Idle Camera System - Initialize
  const idleSystem = createIdleSystem(camera, controls);

  return { camera, controls, idleSystem };
}

// ========================================================================
// 💤 IDLE CAMERA SYSTEM
// ========================================================================

/**
 * Idle kamera sistemi oluşturur
 * Kullanıcı hareketsiz kaldığında yumuşak kamera rotasyonu başlatır
 * 
 * @param {THREE.Camera} camera - Ana kamera
 * @param {OrbitControls} controls - Kamera kontrolleri
 * @param {Object} config - Opsiyonel konfigürasyon
 * @returns {Object} { update, reset, isIdle } fonksiyonları
 */
function createIdleSystem(camera, controls, config = {}) {
  // Konfigürasyon
  const IDLE_TIMEOUT = config.timeout || 15000; // 15 saniye
  const TRANSITION_DURATION = config.transitionDuration || 2000;
  const ROTATION_SPEED = config.rotationSpeed || 0.00015;

  // State
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

  /**
   * Idle timer'ı sıfırla (kullanıcı hareket etti)
   */
  function resetIdleTimer() {
    lastInteractionTime = Date.now();
    
    if (isIdle) {
      console.log('🎮 Kullanıcı geri döndü - idle modu bitiyor');
    }
    isIdle = false;
  }

  /**
   * Idle kamera animasyonunu güncelle
   * @param {number} deltaTime - Frame arası geçen süre (saniye)
   */
  function updateIdleCamera(deltaTime) {
    const now = Date.now();
    const timeSinceInteraction = now - lastInteractionTime;

    // Idle moduna geçiş kontrolü
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

    // Idle değilse çık
    if (!isIdle) return;

    // Yeni rastgele hedef seç
    idleRotationState.changeTimer -= deltaTime;
    if (idleRotationState.changeTimer <= 0) {
      idleRotationState.targetYaw = (Math.random() - 0.5) * 0.15;
      idleRotationState.targetPitch = (Math.random() - 0.5) * 0.08;
      idleRotationState.changeTimer = 8 + Math.random() * 7;
    }

    // Yumuşak geçiş
    const lerpSpeed = 0.5 * deltaTime;
    idleRotationState.yaw += (idleRotationState.targetYaw - idleRotationState.yaw) * lerpSpeed;
    idleRotationState.pitch += (idleRotationState.targetPitch - idleRotationState.pitch) * lerpSpeed;

    // Kamera rotasyonu uygula
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
    
    // Kaydedilmiş target'ı koru
    if (idleRotationState.savedTarget) {
      controls.target.copy(idleRotationState.savedTarget);
    }
  }

  /**
   * Idle durumunu kontrol et
   * @returns {boolean} Idle modunda mı?
   */
  function getIsIdle() {
    return isIdle;
  }

  /**
   * Idle konfigürasyonunu güncelle
   * @param {Object} newConfig - Yeni konfigürasyon değerleri
   */
  function updateConfig(newConfig) {
    if (newConfig.timeout !== undefined) IDLE_TIMEOUT = newConfig.timeout;
    if (newConfig.rotationSpeed !== undefined) ROTATION_SPEED = newConfig.rotationSpeed;
  }

  // Event listener'ları ekle
  const events = ['mousemove', 'mousedown', 'wheel', 'keydown', 'touchstart', 'touchmove'];
  events.forEach(eventName => {
    window.addEventListener(eventName, resetIdleTimer);
  });

  console.log('💤 Idle camera system initialized');

  // Public API
  return {
    update: updateIdleCamera,
    reset: resetIdleTimer,
    get isIdle() { return getIsIdle(); },
    updateConfig,
    // Cleanup function (opsiyonel)
    dispose: () => {
      events.forEach(eventName => {
        window.removeEventListener(eventName, resetIdleTimer);
      });
      console.log('💤 Idle camera system disposed');
    }
  };
}

// Export etmek isterseniz (opsiyonel)
export { createIdleSystem };