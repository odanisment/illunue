import * as THREE from 'three';

const API_KEY = 'e7a83dca2ef00da6e83e59187f7aad5e';
const MAX_NEWS = 30;
const UPDATE_INTERVAL = 60000;

export class NewsPlanetManager {
  constructor(scene, camera, solarSystemOffset = new THREE.Vector3(0, 0, 0)) {
    this.scene = scene;
    this.camera = camera;
    this.solarSystemOffset = solarSystemOffset; // ⭐ YENİ - Güneş sistemi offset
    this.planets = [];
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.tooltip = this._createTooltip();
    this.clock = new THREE.Clock();
    
    // Fade animasyon parametreleri
    this.fadeDuration = 1.5; // 1.5 saniye fade süresi

    window.addEventListener('mousemove', (e) => this._onMouseMove(e));
    window.addEventListener('click', () => this._onClick());

    this._fetchNews();
    setInterval(() => this._fetchNews(), UPDATE_INTERVAL);
  }

  async _fetchNews() {
    try {
      const response = await fetch(`https://gnews.io/api/v4/top-headlines?lang=en&max=${MAX_NEWS}&token=${API_KEY}`);
      const data = await response.json();

      if (!data.articles) return;

      this._clearPlanets();
      this._createPlanets(data.articles);
    } catch (err) {
      console.error("❌ News fetch failed:", err);
    }
  }

  _createPlanets(articles) {
    const distanceRange = 3000;
    const minDistance = 500;

    for (let article of articles) {
      const geometry = new THREE.SphereGeometry(10 + Math.random() * 5, 32, 32);
      
      // ✅ CRITICAL: Bounding sphere hesapla (LensFlare occlusion için)
      geometry.computeBoundingSphere();
      
      const color = new THREE.Color().setHSL(0.33, 1, 0.4 + Math.random() * 0.2); // Yeşil tonlar
      const material = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color.clone().multiplyScalar(0.3),
        roughness: 0.5,
        metalness: 0.2,
        transparent: true,
        opacity: 0 // 0'dan başla (görünmez)
      });

      const planet = new THREE.Mesh(geometry, material);
      
      // ✅ CRITICAL: Mesh'e isim ver (debug için)
      const articleIndex = articles.indexOf(article);
      planet.name = `NewsPlanet-${articleIndex}`;

      // ⭐ Konumlandır - SOLAR SYSTEM OFFSET etrafında
      let pos;
      let tries = 0;
      do {
        pos = new THREE.Vector3(
          THREE.MathUtils.randFloatSpread(distanceRange) + this.solarSystemOffset.x,
          THREE.MathUtils.randFloatSpread(distanceRange) + this.solarSystemOffset.y,
          THREE.MathUtils.randFloatSpread(distanceRange) + this.solarSystemOffset.z
        );
        tries++;
      } while (this.planets.some(p => p.mesh.position.distanceTo(pos) < minDistance) && tries < 50);

      planet.position.copy(pos);

      planet.userData = {
        url: article.url,
        title: article.title,
        description: article.description || 'No summary available',
        fadeState: 'in',        // 'in' | 'visible' | 'out'
        fadeProgress: 0,        // 0-1 arası
        targetOpacity: 1,       // Hedef opacity
        isNewsPlanet: true      // ✅ Flag for identification
      };

      this.scene.add(planet);
      this.planets.push({ mesh: planet });
    }
    
    console.log(`📰 ${articles.length} news planets created around offset: (${this.solarSystemOffset.x}, ${this.solarSystemOffset.y}, ${this.solarSystemOffset.z})`);
  }

  _clearPlanets() {
    // Mevcut gezegenleri fade out olarak işaretle
    for (const { mesh } of this.planets) {
      if (mesh.userData.fadeState !== 'out') {
        mesh.userData.fadeState = 'out';
        mesh.userData.fadeProgress = 0;
      }
    }
  }

  _createTooltip() {
    const el = document.createElement('div');
    el.style.position = 'absolute';
    el.style.background = 'rgba(0, 100, 0, 0.85)';
    el.style.color = '#fff';
    el.style.padding = '8px';
    el.style.borderRadius = '6px';
    el.style.pointerEvents = 'none';
    el.style.display = 'none';
    el.style.maxWidth = '300px';
    el.style.fontFamily = 'Arial';
    el.style.fontSize = '12px';
    document.body.appendChild(el);
    return el;
  }

  _onMouseMove(event) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.planets.map(p => p.mesh));

    if (intersects.length > 0) {
      const obj = intersects[0].object;
      const { title, description } = obj.userData;

      this.tooltip.style.display = 'block';
      this.tooltip.style.left = `${event.clientX + 15}px`;
      this.tooltip.style.top = `${event.clientY + 15}px`;
      this.tooltip.innerHTML = `<strong>${title}</strong><br>${description}`;
      this.hovered = obj;
    } else {
      this.tooltip.style.display = 'none';
      this.hovered = null;
    }
  }

  _onClick() {
    if (this.hovered) {
      window.open(this.hovered.userData.url, '_blank');
    }
  }

  update(deltaTime = 0.016) {
    // Fade animasyonlarını güncelle
    for (let i = this.planets.length - 1; i >= 0; i--) {
      const { mesh } = this.planets[i];
      const userData = mesh.userData;

      // Fade In animasyonu
      if (userData.fadeState === 'in') {
        userData.fadeProgress += deltaTime / this.fadeDuration;
        
        if (userData.fadeProgress >= 1) {
          userData.fadeProgress = 1;
          userData.fadeState = 'visible';
        }

        // Smooth ease-in-out
        const eased = this._easeInOutCubic(userData.fadeProgress);
        mesh.material.opacity = eased * userData.targetOpacity;
      }

      // Fade Out animasyonu
      else if (userData.fadeState === 'out') {
        userData.fadeProgress += deltaTime / this.fadeDuration;
        
        if (userData.fadeProgress >= 1) {
          // Tamamen kayboldu, sahneden kaldır
          this.scene.remove(mesh);
          this.planets.splice(i, 1);
          continue;
        }

        // Smooth ease-in-out
        const eased = this._easeInOutCubic(userData.fadeProgress);
        mesh.material.opacity = (1 - eased) * userData.targetOpacity;
      }
    }
  }

  // Smooth easing fonksiyonu
  _easeInOutCubic(t) {
    return t < 0.5 
      ? 4 * t * t * t 
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
}