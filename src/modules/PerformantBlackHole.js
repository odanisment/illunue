// PerformantBlackHole.js - Realistic Black Hole with Simplex Noise & Gravitational Lensing
// Features: Event Horizon with Fresnel glow, Accretion Disk with distance-based SCALE animation
// ⭐ Disk 0 çaptan başlayıp orijinal boyutuna büyüyor (yoktan var olma)

import * as THREE from 'three';

export class PerformantBlackHole {
  constructor(scene, position = new THREE.Vector3(0, 0, 0), config = {}) {
    this.scene = scene;
    this.position = position;
    
    // Configuration with defaults
    this.config = {
      blackHoleRadius: config.blackHoleRadius || config.eventHorizonRadius || 15,
      diskInnerRadius: config.diskInnerRadius || null,
      diskOuterRadius: config.diskOuterRadius || config.accretionDiskRadius || 80,
      diskTiltAngle: config.diskTiltAngle || Math.PI / 3.0,
      
      // Disk colors (inner to outer)
      colorHot: config.colorHot || new THREE.Color(0xffffff),
      colorMid1: config.colorMid1 || new THREE.Color(0xff7733),
      colorMid2: config.colorMid2 || new THREE.Color(0xff4477),
      colorMid3: config.colorMid3 || new THREE.Color(0x7744ff),
      colorOuter: config.colorOuter || new THREE.Color(0x4477ff),
      
      // Animation
      noiseScale: config.noiseScale || 2.5,
      flowSpeed: config.flowSpeed || 0.22,
      density: config.density || 1.3,
      brightness: config.brightness || 1.0,
      
      // ⭐ MESAFE AYARLARI - Lensing ile senkronize
      fadeStartDistance: config.fadeStartDistance || 300,  // Daha geç başla
      fadeEndDistance: config.fadeEndDistance || 150,      // Daha geç tamamla
      
      ...config
    };
    
    // Auto-calculate inner radius if not provided
    if (!this.config.diskInnerRadius) {
      this.config.diskInnerRadius = this.config.blackHoleRadius + 2;
    }
    
    // Create group to hold all parts
    this.group = new THREE.Group();
    this.group.position.copy(position);
    
    // Build components
    this.createEventHorizon();
    this.createBlackHoleSphere();
    this.createAccretionDisk();
    
    // ⭐ Başlangıçta disk scale = 0
    if (this.accretionDisk) {
      this.accretionDisk.scale.set(0, 0, 0);
    }
    
    scene.add(this.group);
  }

  createEventHorizon() {
    const geometry = new THREE.SphereGeometry(
      this.config.blackHoleRadius * 1.05, 
      128, 
      64
    );
    
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uCameraPosition: { value: new THREE.Vector3() },
        uAlpha: { value: 0.0 }
      },
      vertexShader: /* glsl */`
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform float uTime;
        uniform vec3 uCameraPosition;
        uniform float uAlpha;
        
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        void main() {
          if (uAlpha < 0.01) discard;
          
          vec3 viewDirection = normalize(uCameraPosition - vPosition);
          float fresnel = 1.0 - abs(dot(vNormal, viewDirection));
          fresnel = pow(fresnel, 2.5);
          
          vec3 glowColor = vec3(1.0, 0.4, 0.1);
          float pulse = sin(uTime * 2.5) * 0.15 + 0.85;
          
          gl_FragColor = vec4(glowColor * fresnel * pulse, fresnel * 0.4 * uAlpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false
    });
    
    this.eventHorizon = new THREE.Mesh(geometry, material);
    this.group.add(this.eventHorizon);
  }

  createBlackHoleSphere() {
    const geometry = new THREE.SphereGeometry(
      this.config.blackHoleRadius, 
      128, 
      64
    );
    
    const material = new THREE.MeshBasicMaterial({ 
      color: 0x000000,
      transparent: true,
      opacity: 1.0
    });
    
    this.blackHoleMesh = new THREE.Mesh(geometry, material);
    this.blackHoleMesh.renderOrder = 0;
    this.group.add(this.blackHoleMesh);
  }

  createAccretionDisk() {
    const innerR = this.config.diskInnerRadius;
    const outerR = this.config.diskOuterRadius;
    
    const geometry = new THREE.RingGeometry(innerR, outerR, 256, 128);
    
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uColorHot: { value: this.config.colorHot },
        uColorMid1: { value: this.config.colorMid1 },
        uColorMid2: { value: this.config.colorMid2 },
        uColorMid3: { value: this.config.colorMid3 },
        uColorOuter: { value: this.config.colorOuter },
        uNoiseScale: { value: this.config.noiseScale },
        uFlowSpeed: { value: this.config.flowSpeed },
        uDensity: { value: this.config.density },
        uBrightness: { value: this.config.brightness },
        uInnerRadius: { value: innerR },
        uOuterRadius: { value: outerR }
      },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        varying float vRadius;
        varying float vAngle;
        
        void main() {
          vUv = uv;
          vRadius = length(position.xy);
          vAngle = atan(position.y, position.x);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform float uTime;
        uniform vec3 uColorHot;
        uniform vec3 uColorMid1;
        uniform vec3 uColorMid2;
        uniform vec3 uColorMid3;
        uniform vec3 uColorOuter;
        uniform float uNoiseScale;
        uniform float uFlowSpeed;
        uniform float uDensity;
        uniform float uBrightness;
        uniform float uInnerRadius;
        uniform float uOuterRadius;

        varying vec2 vUv;
        varying float vRadius;
        varying float vAngle;

        // Simplex noise functions
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
        
        float snoise(vec3 v) {
          const vec2 C = vec2(1.0/6.0, 1.0/3.0);
          const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
          
          vec3 i = floor(v + dot(v, C.yyy));
          vec3 x0 = v - i + dot(i, C.xxx);
          
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min(g.xyz, l.zxy);
          vec3 i2 = max(g.xyz, l.zxy);
          
          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;
          
          i = mod289(i);
          vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
            
          float n_ = 0.142857142857;
          vec3 ns = n_ * D.wyz - D.xzx;
          
          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_);
          
          vec4 x = x_ * ns.x + ns.yyyy;
          vec4 y = y_ * ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);
          
          vec4 b0 = vec4(x.xy, y.xy);
          vec4 b1 = vec4(x.zw, y.zw);
          
          vec4 s0 = floor(b0) * 2.0 + 1.0;
          vec4 s1 = floor(b1) * 2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
          
          vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
          
          vec3 p0 = vec3(a0.xy, h.x);
          vec3 p1 = vec3(a0.zw, h.y);
          vec3 p2 = vec3(a1.xy, h.z);
          vec3 p3 = vec3(a1.zw, h.w);
          
          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
          p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
          
          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }

        void main() {
          float normalizedRadius = smoothstep(uInnerRadius, uOuterRadius, vRadius);
          
          // Spiral flow pattern
          float spiral = vAngle * 3.0 - (1.0 / (normalizedRadius + 0.1)) * 2.0;
          vec2 noiseUv = vec2(
            vUv.x + uTime * uFlowSpeed * (2.0 / (vRadius * 0.3 + 1.0)) + sin(spiral) * 0.1,
            vUv.y * 0.8 + cos(spiral) * 0.1
          );
          
          // Multi-octave noise
          float noiseVal1 = snoise(vec3(noiseUv * uNoiseScale, uTime * 0.15));
          float noiseVal2 = snoise(vec3(noiseUv * uNoiseScale * 3.0 + 0.8, uTime * 0.22));
          float noiseVal3 = snoise(vec3(noiseUv * uNoiseScale * 6.0 + 1.5, uTime * 0.3));
          
          float noiseVal = (noiseVal1 * 0.45 + noiseVal2 * 0.35 + noiseVal3 * 0.2);
          noiseVal = (noiseVal + 1.0) * 0.5;
          
          // Color gradient (outer to inner)
          vec3 color = uColorOuter;
          color = mix(color, uColorMid3, smoothstep(0.0, 0.25, normalizedRadius));
          color = mix(color, uColorMid2, smoothstep(0.2, 0.55, normalizedRadius));
          color = mix(color, uColorMid1, smoothstep(0.5, 0.75, normalizedRadius));
          color = mix(color, uColorHot, smoothstep(0.7, 0.95, normalizedRadius));
          
          // Apply noise to color
          color *= (0.5 + noiseVal * 1.0);
          
          // Brightness calculation
          float brightness = pow(1.0 - normalizedRadius, 1.0) * 3.5 + 0.5;
          brightness *= (0.3 + noiseVal * 2.2);
          brightness *= uBrightness;
          
          // Pulse animation
          float pulse = sin(uTime * 1.8 + normalizedRadius * 12.0 + vAngle * 2.0) * 0.15 + 0.85;
          brightness *= pulse;
          
          // Alpha with edge falloff
          float alpha = uDensity * (0.2 + noiseVal * 0.9);
          alpha *= smoothstep(0.0, 0.15, normalizedRadius);
          alpha *= (1.0 - smoothstep(0.85, 1.0, normalizedRadius));
          alpha = clamp(alpha, 0.0, 1.0);

          gl_FragColor = vec4(color * brightness, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    
    this.accretionDisk = new THREE.Mesh(geometry, material);
    this.accretionDisk.rotation.x = this.config.diskTiltAngle;
    this.accretionDisk.renderOrder = 1;
    this.group.add(this.accretionDisk);
  }

  update(deltaTime, camera) {
    const time = performance.now() * 0.001;
    
    // ⭐ MESAFEYE GÖRE SCALE HESAPLA (0 → 1)
    const distance = this.group.position.distanceTo(camera.position);
    const fadeStart = this.config.fadeStartDistance;
    const fadeEnd = this.config.fadeEndDistance;
    
    let distanceFactor = 0;
    if (distance <= fadeEnd) {
      distanceFactor = 1.0;
    } else if (distance < fadeStart) {
      distanceFactor = 1.0 - (distance - fadeEnd) / (fadeStart - fadeEnd);
    }
    
    // Smooth easing (ease-out for more natural growth)
    distanceFactor = 1 - Math.pow(1 - distanceFactor, 3); // easeOutCubic
    
    // ⭐ EKRAN MERKEZİ FAKTÖRÜ - Ortada olunca daha belirgin
    const screenPos = this.group.position.clone().project(camera);
    
    // Kamera arkasındaysa gösterme
    let centerFactor = 1.0;
    if (screenPos.z > 1) {
      centerFactor = 0;
    } else {
      // Ekran merkezine uzaklık (0 = tam ortada, 1+ = kenarlarda)
      const distFromCenter = Math.sqrt(screenPos.x * screenPos.x + screenPos.y * screenPos.y);
      // Smooth falloff: merkez = 1.0, kenar (1.0+) = 0
      centerFactor = 1.0 - Math.min(distFromCenter / 1.0, 1.0);
      centerFactor = Math.pow(centerFactor, 0.3); // Çok yumuşak geçiş
    }
    
    // Final scale = mesafe × merkez
    const scaleFactor = distanceFactor * centerFactor;
    
    // Update event horizon
    if (this.eventHorizon) {
      this.eventHorizon.material.uniforms.uTime.value = time;
      this.eventHorizon.material.uniforms.uCameraPosition.value.copy(camera.position);
      this.eventHorizon.material.uniforms.uAlpha.value = scaleFactor;
    }
    
    // Update black hole sphere visibility
    if (this.blackHoleMesh) {
      this.blackHoleMesh.material.opacity = scaleFactor;
    }
    
    // ⭐ DISK SCALE ANİMASYONU (0 → 1)
    if (this.accretionDisk) {
      this.accretionDisk.material.uniforms.uTime.value = time;
      this.accretionDisk.scale.set(scaleFactor, scaleFactor, scaleFactor);
      this.accretionDisk.rotation.z += deltaTime * 0.05;
    }
  }

  // ⭐ Dışarıdan erişim için scale factor getter
  getScaleFactor(camera) {
    const distance = this.group.position.distanceTo(camera.position);
    const fadeStart = this.config.fadeStartDistance;
    const fadeEnd = this.config.fadeEndDistance;
    
    let distanceFactor = 0;
    if (distance <= fadeEnd) {
      distanceFactor = 1.0;
    } else if (distance < fadeStart) {
      distanceFactor = 1.0 - (distance - fadeEnd) / (fadeStart - fadeEnd);
    }
    distanceFactor = 1 - Math.pow(1 - distanceFactor, 3);
    
    // Ekran merkezi faktörü
    const screenPos = this.group.position.clone().project(camera);
    let centerFactor = 1.0;
    if (screenPos.z > 1) {
      centerFactor = 0;
    } else {
      const distFromCenter = Math.sqrt(screenPos.x * screenPos.x + screenPos.y * screenPos.y);
      centerFactor = 1.0 - Math.min(distFromCenter / 1.0, 1.0);
      centerFactor = Math.pow(centerFactor, 0.3);
    }
    
    return distanceFactor * centerFactor;
  }

  updateLOD(cameraPosition) {
    const distance = this.group.position.distanceTo(cameraPosition);
    
    if (distance > 5000) {
      this.group.visible = false;
    } else {
      this.group.visible = true;
    }
  }

  dispose() {
    if (this.eventHorizon) {
      this.eventHorizon.geometry.dispose();
      this.eventHorizon.material.dispose();
    }
    
    if (this.blackHoleMesh) {
      this.blackHoleMesh.geometry.dispose();
      this.blackHoleMesh.material.dispose();
    }
    
    if (this.accretionDisk) {
      this.accretionDisk.geometry.dispose();
      this.accretionDisk.material.dispose();
    }
    
    this.scene.remove(this.group);
  }
}

// Preset configurations
export const BlackHolePresets = {
  standard: {
    blackHoleRadius: 15,
    diskOuterRadius: 80,
    diskTiltAngle: Math.PI / 3.0,
    colorHot: new THREE.Color(0xffffff),
    colorMid1: new THREE.Color(0xff7733),
    colorMid2: new THREE.Color(0xff4477),
    colorMid3: new THREE.Color(0x7744ff),
    colorOuter: new THREE.Color(0x4477ff),
    fadeStartDistance: 300,
    fadeEndDistance: 150
  },
  
  small: {
    blackHoleRadius: 8,
    diskOuterRadius: 40,
    diskTiltAngle: Math.PI / 4.0,
    fadeStartDistance: 200,
    fadeEndDistance: 100
  },
  
  medium: {
    blackHoleRadius: 15,
    diskOuterRadius: 60,
    diskTiltAngle: Math.PI / 3.0,
    fadeStartDistance: 300,
    fadeEndDistance: 150
  },
  
  supermassive: {
    blackHoleRadius: 30,
    diskOuterRadius: 150,
    diskTiltAngle: Math.PI / 2.5,
    flowSpeed: 0.15,
    fadeStartDistance: 500,
    fadeEndDistance: 250
  },
  
  blue: {
    blackHoleRadius: 15,
    diskOuterRadius: 80,
    colorHot: new THREE.Color(0xaaffff),
    colorMid1: new THREE.Color(0x44aaff),
    colorMid2: new THREE.Color(0x4477ff),
    colorMid3: new THREE.Color(0x4444ff),
    colorOuter: new THREE.Color(0x2222aa),
    fadeStartDistance: 300,
    fadeEndDistance: 150
  },
  
  inferno: {
    blackHoleRadius: 15,
    diskOuterRadius: 80,
    colorHot: new THREE.Color(0xffffff),
    colorMid1: new THREE.Color(0xffaa33),
    colorMid2: new THREE.Color(0xff5500),
    colorMid3: new THREE.Color(0xff2200),
    colorOuter: new THREE.Color(0x880000),
    fadeStartDistance: 300,
    fadeEndDistance: 150
  }
};