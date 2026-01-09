// solarSystemConfig.js
// Güneş sisteminin (Dünya, Güneş, Ay, Haber Gezegenleri, AudioPlanet) merkez pozisyonu
import * as THREE from 'three';

// ✅ GÜNCELLEME: Dünya kameraya daha yakın olsun (occlusion için)
// Önceki: (5000, 0, 5000) - Çok uzak, angular size çok küçük
// Yeni: (500, 0, 500) - Daha yakın, Ay gibi occlusion yapabilir
export const SOLAR_SYSTEM_OFFSET = new THREE.Vector3(500, 0, 500);

// Kamera başlangıç pozisyonu (optimal izometrik - Big Bang için mükemmel)
export const CAMERA_START_POSITION = new THREE.Vector3(400, 400, 400);

// Güneş sisteminin tüm bileşenlerini bu ofset ile konumlandır
export function applySolarOffset(position) {
  return position.clone().add(SOLAR_SYSTEM_OFFSET);
}

// Bir pozisyonun güneş sistemi içindeki lokal pozisyonunu al
export function toLocalSolarPosition(worldPosition) {
  return worldPosition.clone().sub(SOLAR_SYSTEM_OFFSET);
}
