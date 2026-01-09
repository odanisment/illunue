// modules/astroUtils.js
import * as THREE from 'three';

export function calculateLST(date, longitude) {
  const JD = dateToJulian(date);
  const T = (JD - 2451545.0) / 36525.0;

  let GMST = 280.46061837 + 360.98564736629 * (JD - 2451545.0) +
             0.000387933 * T * T - (T * T * T) / 38710000.0;
  GMST = ((GMST % 360) + 360) % 360;

  let LST = GMST + longitude;
  return ((LST % 360) + 360) % 360; // derece cinsinden
}

function dateToJulian(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

export function raDecToVector3(raHours, decDegrees, radius = 1000) {
  const raRad = (raHours / 24) * 2 * Math.PI;
  const decRad = THREE.MathUtils.degToRad(decDegrees);

  const x = radius * Math.cos(decRad) * Math.cos(raRad);
  const y = radius * Math.sin(decRad);
  const z = radius * Math.cos(decRad) * Math.sin(raRad);

  return new THREE.Vector3(x, y, z);
}
