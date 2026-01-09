// modules/PhysicalStarField.js - POINTS VERSION with REALISTIC COLORS
// Points = 1 vertex per star, GPU sprite rendering
import * as THREE from 'three';

export class PhysicalStarField {
  constructor() {
    this.group = new THREE.Group();

    const config = {
      count: 1000,
      minRadius: 200,
      maxRadius: 1000,
      sizeRange: [5.0, 20.0],
    };

    // 🌟 Gerçekçi yıldız renkleri - DOYGUN VERSİYON
    const starColors = [
      { color: new THREE.Color(0x00aeef), weight: 0.02, name: 'O - Mavi' },        // Doygun mavi
      { color: new THREE.Color(0x00ffef), weight: 0.05, name: 'B - Mavi-Beyaz' },  // Canlı mavi-beyaz
      { color: new THREE.Color(0xaaccff), weight: 0.08, name: 'A - Beyaz-Mavi' },  // Soğuk beyaz
      { color: new THREE.Color(0xffffff), weight: 0.15, name: 'F - Saf Beyaz' },   // Saf beyaz
      { color: new THREE.Color(0xffee99), weight: 0.20, name: 'G - Sarı (Güneş)' },// Canlı sarı
      { color: new THREE.Color(0xff7744), weight: 0.25, name: 'K - Turuncu' },     // Doygun turuncu
      { color: new THREE.Color(0xff3744), weight: 0.25, name: 'M - Kırmızı' }      // Canlı kırmızı-turuncu
    ];

    // Ağırlıklı rastgele renk seçimi için kümülatif dağılım
    const cumulativeWeights = [];
    let sum = 0;
    for (const star of starColors) {
      sum += star.weight;
      cumulativeWeights.push(sum);
    }

    function getRandomStarColor() {
      const r = Math.random();
      for (let i = 0; i < cumulativeWeights.length; i++) {
        if (r <= cumulativeWeights[i]) {
          return starColors[i].color;
        }
      }
      return starColors[starColors.length - 1].color;
    }

    // 🌟 Points için pozisyon, boyut ve RENK dizileri
    const positions = new Float32Array(config.count * 3);
    const sizes = new Float32Array(config.count);
    const colors = new Float32Array(config.count * 3);

    for (let i = 0; i < config.count; i++) {
      const r = THREE.MathUtils.lerp(config.minRadius, config.maxRadius, Math.random());
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);

      // Küresel dağılım
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      // Rastgele boyut
      sizes[i] = THREE.MathUtils.lerp(config.sizeRange[0], config.sizeRange[1], Math.random());

      // 🎨 Rastgele renk (ağırlıklı dağılım)
      const starColor = getRandomStarColor();
      colors[i * 3] = starColor.r;
      colors[i * 3 + 1] = starColor.g;
      colors[i * 3 + 2] = starColor.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // 🎨 Point shader - renk desteği eklendi
    const material = new THREE.ShaderMaterial({
      uniforms: {
        pixelRatio: { value: window.devicePixelRatio }
      },
      vertexShader: /* glsl */`
        attribute float size;
        attribute vec3 color;
        uniform float pixelRatio;
        
        varying vec3 vColor;
        varying float vSize;
        
        void main() {
          vColor = color;
          vSize = size;
          
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          
          // Mesafeye göre boyut ayarla (perspektif)
          gl_PointSize = size * pixelRatio * (300.0 / -mvPosition.z);
          gl_PointSize = clamp(gl_PointSize, 1.0, 20.0);
          
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */`
        varying vec3 vColor;
        varying float vSize;
        
        void main() {
          vec2 center = gl_PointCoord - 0.5;
          float dist = length(center) * 2.0;
          
          // 🌟 GÜÇLÜ FAKE GLOW - 3 katmanlı
          
          // 1. Parlak çekirdek (core)
          float core = 1.0 - smoothstep(0.0, 0.3, dist);
          
          // 2. İç glow
          float innerGlow = 1.0 - smoothstep(0.0, 0.6, dist);
          innerGlow = pow(innerGlow, 2.0) * 0.8;
          
          // 3. Dış glow (yumuşak hale)
          float outerGlow = 1.0 - smoothstep(0.0, 1.0, dist);
          outerGlow = pow(outerGlow, 3.0) * 0.4;
          
          // Toplam parlaklık
          float brightness = core + innerGlow + outerGlow;
          
          // Alpha - dış glow için daha geniş
          float alpha = 1.0 - smoothstep(0.3, 1.0, dist);
          alpha = max(alpha, outerGlow * 0.5);
          
          if (alpha < 0.01) discard;
          
          // Çekirdek beyaza yaklaşsın (sıcak yıldız efekti)
          vec3 coreColor = mix(vColor, vec3(1.0), core * 0.5);
          
          gl_FragColor = vec4(coreColor * brightness, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const points = new THREE.Points(geometry, material);
    this.group.add(points);
    this.points = points;
    this.material = material;
  }

  update(rotationSpeed = 0.0001, deltaTime = 0.016) {
    this.group.rotation.y += rotationSpeed;
  }
}