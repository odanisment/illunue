// GravitationalLensing.js
// Post-processing shader for black hole light bending effect
// ⭐ Disk ile TAM SENKRONİZE - radius 0'dan büyüyor (yoktan var olma)

import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export const GravitationalLensingShader = {
  uniforms: {
    "tDiffuse": { value: null },
    "blackHoleScreenPos": { value: new THREE.Vector2(0.5, 0.5) },
    "lensingStrength": { value: 0.12 },
    "lensingRadius": { value: 0.3 },
    "aspectRatio": { value: 1.0 },
    "chromaticAberration": { value: 0.005 }
  },
  
  vertexShader: /* glsl */`
    varying vec2 vUv;
    
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform vec2 blackHoleScreenPos;
    uniform float lensingStrength;
    uniform float lensingRadius;
    uniform float aspectRatio;
    uniform float chromaticAberration;
    
    varying vec2 vUv;
    
    void main() {
      vec2 screenPos = vUv;
      vec2 toCenter = screenPos - blackHoleScreenPos;
      toCenter.x *= aspectRatio;
      float dist = length(toCenter);
      
      // ⭐ Radius 0 ise efekt yok
      if (lensingRadius < 0.001) {
        gl_FragColor = texture2D(tDiffuse, vUv);
        return;
      }
      
      // Gravitational distortion - 1/r² falloff
      float distortionAmount = lensingStrength / (dist * dist + 0.003);
      distortionAmount = clamp(distortionAmount, 0.0, 0.7);
      
      // Smooth falloff at edges
      float falloff = smoothstep(lensingRadius, lensingRadius * 0.3, dist);
      distortionAmount *= falloff;
      
      // Calculate offset
      vec2 offset = normalize(toCenter) * distortionAmount;
      offset.x /= aspectRatio;
      
      // Chromatic aberration - R/G/B slightly different offsets
      vec2 distortedUvR = screenPos - offset * (1.0 + chromaticAberration);
      vec2 distortedUvG = screenPos - offset;
      vec2 distortedUvB = screenPos - offset * (1.0 - chromaticAberration);
      
      // Sample each color channel separately
      float r = texture2D(tDiffuse, distortedUvR).r;
      float g = texture2D(tDiffuse, distortedUvG).g;
      float b = texture2D(tDiffuse, distortedUvB).b;
      
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `
};

// Helper class to manage lensing effect
export class GravitationalLensing {
  constructor(composer, camera) {
    this.camera = camera;
    this.pass = new ShaderPass(GravitationalLensingShader);
    this.blackHoles = []; // Track multiple black holes
    this.screenPosVec3 = new THREE.Vector3();
    
    // ⭐ MESAFE AYARLARI - PerformantBlackHole ile BİREBİR AYNI
    this.fadeStartDistance = 300;  // Disk ile aynı
    this.fadeEndDistance = 150;    // Disk ile aynı
    
    // ⭐ TAM BOYUT DEĞERLERİ
    this.maxStrength = 0.12;
    this.maxRadius = 0.3;
    
    // Add to composer
    composer.addPass(this.pass);
    
    // Set initial aspect ratio
    this.updateAspectRatio();
  }
  
  // Register a black hole to track
  addBlackHole(blackHoleGroup) {
    this.blackHoles.push(blackHoleGroup);
  }
  
  // Remove a black hole
  removeBlackHole(blackHoleGroup) {
    const index = this.blackHoles.indexOf(blackHoleGroup);
    if (index > -1) {
      this.blackHoles.splice(index, 1);
    }
  }
  
  // Update aspect ratio on resize
  updateAspectRatio() {
    this.pass.uniforms.aspectRatio.value = window.innerWidth / window.innerHeight;
  }
  
  // Update lensing effect - call in animation loop
  update() {
    if (this.blackHoles.length === 0) {
      // No black holes - disable effect
      this.pass.uniforms.lensingStrength.value = 0;
      this.pass.uniforms.lensingRadius.value = 0;
      return;
    }
    
    // Find the closest/most visible black hole
    let closestBlackHole = null;
    let closestDistance = Infinity;
    
    for (const bh of this.blackHoles) {
      if (!bh.visible) continue;
      
      const distance = this.camera.position.distanceTo(bh.position);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestBlackHole = bh;
      }
    }
    
    if (!closestBlackHole) {
      this.pass.uniforms.lensingStrength.value = 0;
      this.pass.uniforms.lensingRadius.value = 0;
      return;
    }
    
    // Project black hole position to screen space
    this.screenPosVec3.copy(closestBlackHole.position).project(this.camera);
    
    // Check if behind camera
    if (this.screenPosVec3.z > 1) {
      this.pass.uniforms.lensingStrength.value = 0;
      this.pass.uniforms.lensingRadius.value = 0;
      return;
    }
    
    // Convert to UV coordinates (0-1)
    const screenX = (this.screenPosVec3.x + 1) / 2;
    const screenY = (this.screenPosVec3.y + 1) / 2;
    
    this.pass.uniforms.blackHoleScreenPos.value.set(screenX, screenY);
    
    // ⭐ MESAFEYE GÖRE FACTOR - Disk ile BİREBİR AYNI FORMÜL
    const fadeStart = this.fadeStartDistance;
    const fadeEnd = this.fadeEndDistance;
    
    let distanceFactor = 0;
    if (closestDistance <= fadeEnd) {
      distanceFactor = 1.0;
    } else if (closestDistance < fadeStart) {
      distanceFactor = 1.0 - (closestDistance - fadeEnd) / (fadeStart - fadeEnd);
    }
    
    // ⭐ AYNI EASING (easeOutCubic) - Disk ile tam senkron
    distanceFactor = 1 - Math.pow(1 - distanceFactor, 3);
    
    // ⭐ EKRAN MERKEZİ FAKTÖRÜ - Ortada olunca daha güçlü lensing
    const distFromCenter = Math.sqrt(
      this.screenPosVec3.x * this.screenPosVec3.x + 
      this.screenPosVec3.y * this.screenPosVec3.y
    );
    // Smooth falloff: merkez = 1.0, kenar (1.0+) = 0
    let centerFactor = 1.0 - Math.min(distFromCenter / 1.0, 1.0);
    centerFactor = Math.pow(centerFactor, 0.3); // Çok yumuşak geçiş
    
    // Final factor = mesafe × merkez
    const factor = distanceFactor * centerFactor;
    
    // ⭐ HEM STRENGTH HEM RADIUS 0'DAN BÜYÜYOR
    // Disk scale ile aynı anda, aynı hızda
    this.pass.uniforms.lensingStrength.value = this.maxStrength * factor;
    this.pass.uniforms.lensingRadius.value = this.maxRadius * factor;
  }
  
  // Set lensing parameters
  setStrength(strength) {
    this.maxStrength = strength;
  }
  
  setRadius(radius) {
    this.maxRadius = radius;
  }
  
  setChromaticAberration(amount) {
    this.pass.uniforms.chromaticAberration.value = amount;
  }
  
  // ⭐ Mesafe ayarlarını güncelle (disk ile senkron tutmak için)
  setFadeDistances(start, end) {
    this.fadeStartDistance = start;
    this.fadeEndDistance = end;
  }
  
  dispose() {
    this.blackHoles = [];
  }
}