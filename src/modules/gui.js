// modules/gui.js
import * as dat from 'lil-gui';
import * as THREE from 'three';

export function setupGUI({
  gridHelper,
  axesHelper,
  sunHelper,
  moonHelper,
  sunLight,
  LensFlareParams,
  timeParams,
  moonMesh,
  moonGlowSprite,
  bloomPass,
  backgroundMaterial,
  starGroup,
  starParams,
  shootingStars,
  cameraData,
  cosmicManager  // 🕳️ Black Hole disk toggle için
}) {
  const gui = new dat.GUI();
  gui.close(); // 🔒 Başlangıçta kapalı

  // 1. Visual Helpers
  const helpersFolder = gui.addFolder('Visual Helpers');
  helpersFolder.add(gridHelper, 'visible').name('Show Grid');
  helpersFolder.add(axesHelper, 'visible').name('Show Axes');
  if (starGroup) {
    helpersFolder.add(starGroup, 'visible').name('Show Static Stars');
  }

  // 2. Light Helpers
  const lightHelperFolder = gui.addFolder('Light Helpers');
  lightHelperFolder.add(sunHelper, 'visible').name('Sun Helper');
  lightHelperFolder.add(moonHelper, 'visible').name('Moon Helper');

  // 3. Time Controls
  const timeFolder = gui.addFolder('Time Control');
  timeFolder.add(timeParams, 'realTime').name('Real Time Mode');
  timeFolder.add(timeParams, 'hour', 0, 23, 1).name('Hour');
  timeFolder.add(timeParams, 'minute', 0, 59, 1).name('Minute');
  timeFolder.add(timeParams, 'second', 0, 59, 1).name('Second');

  // 4. Celestial Bodies
  const celestialFolder = gui.addFolder('Celestial Bodies');
  celestialFolder.add(sunLight, 'intensity', 0, 5).name('Sun Intensity');
  if (LensFlareParams?.enabled?.value !== undefined) {
    const flareFolder = celestialFolder.addFolder('Sun Flare');
    flareFolder.add(LensFlareParams.enabled, 'value').name('Enabled');
    flareFolder.add(LensFlareParams.opacity, 'value', 0, 1).name('Opacity');
  }

  // 5. Moon Effects
  const moonFolder = gui.addFolder('Moon Effects');
  moonFolder.add(moonMesh.scale, 'x', 0.5, 5)
    .name('Scale')
    .onChange(v => moonMesh.scale.set(v, v, v));

  if (moonMesh.material?.uniforms?.glowPower) {
    moonFolder.add(moonMesh.material.uniforms.glowPower, 'value', 0, 2)
      .name('Glow Power');
  }

  moonFolder.add(bloomPass, 'strength', 0, 5).name('Bloom Strength');

  // 6. Global Effects
  const globalFolder = gui.addFolder('Global Effects');
  globalFolder.add(bloomPass, 'radius', 0, 2).name('Bloom Radius');
  globalFolder.add(bloomPass, 'threshold', 0, 1).name('Bloom Threshold');

  // 🕳️ Black Hole - Disk kaldırıldı, sadece lensing efekti var

  // 📍 8. Kamera Koordinat Paneli
  if (cameraData) {
    const cameraFolder = gui.addFolder('📍 Kamera Koordinatları');
    cameraFolder.add(cameraData, 'x').name('X').listen();
    cameraFolder.add(cameraData, 'y').name('Y').listen();
    cameraFolder.add(cameraData, 'z').name('Z').listen();
    cameraFolder.add(cameraData, 'ra').name('RA').listen();
    cameraFolder.add(cameraData, 'dec').name('Dec').listen();
  }

  return gui;
}