import SunCalc from 'suncalc';
import * as THREE from 'three';

export function updateCelestialBodies({
  timeParams,
  sunLight,
  moonLight,
  moonMesh,
  earthMesh,
  cloudParams,
  lensFlareEffect,
  backgroundMaterial,
  userLat,
  userLon,
  deltaTime,
  solarSystemOffset = new THREE.Vector3(0, 0, 0)
}) {
  let now;
  if (timeParams.realTime) {
    now = new Date();
  } else {
    now = new Date();
    now.setHours(timeParams.hour, timeParams.minute, timeParams.second);
  }

  // 1. ☀️ GÜNEŞ POZİSYONU (Dünya'nın etrafında + offset)
  const sunPos = SunCalc.getPosition(now, userLat, userLon);
  const sunDistance = 1000;
  const sunY = Math.sin(sunPos.altitude) * sunDistance;
  const horizonDist = Math.cos(sunPos.altitude) * sunDistance;

  sunLight.position.set(
    Math.sin(sunPos.azimuth) * horizonDist + solarSystemOffset.x,
    sunY + solarSystemOffset.y,
    Math.cos(sunPos.azimuth) * horizonDist + solarSystemOffset.z
  );

  // 2. 🌙 AY POZİSYONU (Dünya'nın etrafında + offset)
  const moonPos = SunCalc.getMoonPosition(now, userLat, userLon);
  const moonDistance = 200;
  const moonY = Math.sin(moonPos.altitude) * moonDistance;
  const moonHorizonDist = Math.cos(moonPos.altitude) * moonDistance;

  moonLight.position.set(
    Math.sin(moonPos.azimuth) * moonHorizonDist + solarSystemOffset.x,
    moonY + solarSystemOffset.y,
    Math.cos(moonPos.azimuth) * moonHorizonDist + solarSystemOffset.z
  );

  // 3. Ay mesh pozisyonu (ışık ile aynı pozisyon)
  if (moonMesh?.position) {
    moonMesh.position.copy(moonLight.position);
  }

  // 4. IŞIK YÖNÜ - DÜNYA'NIN GERÇEK WORLD POZİSYONUNA GÖRE
  // ✅ FIX: Pan yaparken earthMesh grubu hareket eder, bu yüzden world position kullan
  
  let earthWorldPos = new THREE.Vector3();
  if (earthMesh?.getWorldPosition) {
    earthMesh.getWorldPosition(earthWorldPos);
  } else {
    // Fallback: offset kullan
    earthWorldPos.copy(solarSystemOffset);
  }
  
  const lightDir = sunLight.position.clone()
    .sub(earthWorldPos)  // ✅ Dünya'nın gerçek pozisyonuna göre
    .normalize();

  // ✅ AY için light direction - Ay'ın kendi world pozisyonuna göre
  if (moonMesh?.material?.uniforms?.lightDirection) {
    let moonWorldPos = new THREE.Vector3();
    if (moonMesh.getWorldPosition) {
      moonMesh.getWorldPosition(moonWorldPos);
    } else {
      moonWorldPos.copy(moonLight.position);
    }
    
    const moonLightDir = sunLight.position.clone()
      .sub(moonWorldPos)
      .normalize();
    
    moonMesh.material.uniforms.lightDirection.value.copy(moonLightDir);
  }

  // ✅ DÜNYA için light direction - earthGroup.userData üzerinden
  if (earthMesh?.userData?.earthUniforms?.lightDirection) {
    earthMesh.userData.earthUniforms.lightDirection.value.copy(lightDir);
  }

  // 5. Ay fazı
  const moonIllumination = SunCalc.getMoonIllumination(now);

  if (moonMesh?.material?.uniforms?.moonIllumination) {
    moonMesh.material.uniforms.moonIllumination.value = moonIllumination.fraction;
  }

  // 6. Dünya rotasyonu (earthMesh artık bir group)
  if (earthMesh) {
    const earthRotationSpeed = (Math.PI * 2 / 86400) * deltaTime;
    
    // ✅ earthMesh (group) döner
    earthMesh.rotation.y += earthRotationSpeed;
    earthMesh.rotation.z = THREE.MathUtils.degToRad(-23.4);

    // ✅ BULUT KATMANI için light direction ve parametreler
    if (earthMesh.userData?.cloudUniforms) {
      const cloudUniforms = earthMesh.userData.cloudUniforms;
      
      // Light direction - Dünya ile aynı
      if (cloudUniforms.lightDirection) {
        cloudUniforms.lightDirection.value.copy(lightDir);
      }
      
      // Cloud parameters
      const speed = cloudParams?.speed ?? 0.6;
      const direction = cloudParams?.direction ?? new THREE.Vector2(1.0, 0.05);

      if (cloudUniforms.cloudSpeed) {
        cloudUniforms.cloudSpeed.value = speed;
      }

      if (cloudUniforms.cloudDirection) {
        cloudUniforms.cloudDirection.value = direction;
      }
    }
  }

  // 7. 🚀 UZAY MODU - Güneş her zaman parlıyor
  const isDaytime = sunPos.altitude > -0.3;
  
  sunLight.visible = true;
  moonLight.visible = true;
  if (moonMesh) moonMesh.visible = true;
  lensFlareEffect.visible = true;

  if (lensFlareEffect?.material?.uniforms?.isDaytime) {
    lensFlareEffect.material.uniforms.isDaytime.value = true;
  }

  // 8. IŞIK şiddetleri - Sabit (uzayda değişmez)
  sunLight.intensity = 1.2;
  moonLight.intensity = 0.8;

  // 10. Arkaplan gradyanı (realTimeRatio)
  const daySeconds = now.getHours() * 3600 + now.getMinutes() * 60;
  const dayRatio = daySeconds / 86400;

  if (backgroundMaterial?.uniforms?.realTimeRatio) {
    backgroundMaterial.uniforms.realTimeRatio.value = dayRatio;
  }
}