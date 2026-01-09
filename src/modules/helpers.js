// modules/helpers.js
import * as THREE from 'three';

export function addSceneHelpers(scene) {
  const helpers = {
    grid: true,
    axes: true,
    sunHelperVisible: true,
    moonHelperVisible: true
  };

  // Grid
  const gridHelper = new THREE.GridHelper(100, 100);
  gridHelper.visible = helpers.grid;
  gridHelper.userData.noOcclusion = true;
  gridHelper.material.color.set(0xffffff); // saf beyaz (önce 0xfffff yanlış yazılmıştı!)
  gridHelper.material.opacity = 0.5;
  gridHelper.material.transparent = true;
  scene.add(gridHelper);

  // Axes (renkler daha canlı hale getirildi)
  const axesHelper = new THREE.AxesHelper(50);
  axesHelper.setColors(
    new THREE.Color(0xff4444), // daha parlak kırmızı (X)
    new THREE.Color(0x44ff44), // açık yeşil (Y)
    new THREE.Color(0x4488ff)  // parlak mavi (Z)
  );
  axesHelper.visible = helpers.axes;
  axesHelper.userData.noOcclusion = true;
  scene.add(axesHelper);

  return { helpers, gridHelper, axesHelper };
}

export function addSunAndMoonLights(scene) {
  const sunLight = new THREE.DirectionalLight(0xFFF4E6, 1.2);
  const moonLight = new THREE.DirectionalLight(0x9EBDFF, 0.4);
  moonLight.color.set(0x9EBDFF);
  sunLight.visible = false;
  moonLight.visible = false;
  scene.add(sunLight, moonLight);

  // Yardımcılar (renkler güncellendi)
  const sunHelper = new THREE.DirectionalLightHelper(sunLight, 5, 0xffdd00);   // altın sarısı
  const moonHelper = new THREE.DirectionalLightHelper(moonLight, 5, 0x66aaff); // açık mavi

  sunHelper.userData.noOcclusion = true;
  moonHelper.userData.noOcclusion = true;

  scene.add(sunHelper);
  scene.add(moonHelper);

  return {
    sunLight,
    moonLight,
    sunHelper,
    moonHelper
  };
}
