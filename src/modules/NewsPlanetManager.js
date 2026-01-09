import * as THREE from 'three';

// 🚀 Cloudflare Worker API
const NEWS_API_URL = 'https://illunue-news-api.osman-danisment.workers.dev';
const MAX_NEWS = 50;  // 40'tan 50'ye çıktı (daha fazla çeşit)
const UPDATE_INTERVAL = 60000;

// 🎨 12 KATEGORİ RENK KODLARI (Genişletilmiş)
const CATEGORY_COLORS = {
  gaming: 0xff1744,        // 🎮 Kırmızı - Oyun konsolu
  esports: 0xffd700,       // 🏆 Altın - Şampiyonluk
  crypto: 0xf7931a,        // ₿ Bitcoin turuncu
  web3: 0x8b00ff,          // 🌐 Mor - Metaverse
  ai: 0x7c4dff,            // 🤖 Açık mor - Futuristik AI
  fintech: 0x00e676,       // 💰 Yeşil - Para
  space: 0x4a90e2,         // 🚀 Mavi - Uzay
  tech: 0x00bcd4,          // ⚡ Cyan - Teknoloji
  mobile: 0xff9800,        // 📱 Turuncu - Mobil cihazlar
  entertainment: 0xff6090, // 🎬 Pembe - Film/dizi
  music: 0xe91e63,         // 🎵 Koyu pembe - Müzik
  coding: 0x4caf50         // 💻 Yeşil - Kod/GitHub
};

export class NewsPlanetManager {
  constructor(scene, camera, solarSystemOffset = new THREE.Vector3(0, 0, 0)) {
    this.scene = scene;
    this.camera = camera;
    this.solarSystemOffset = solarSystemOffset;
    this.planets = [];
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.tooltip = this._createTooltip();
    this.clock = new THREE.Clock();
    
    // Fade animasyon parametreleri
    this.fadeDuration = 1.5;

    window.addEventListener('mousemove', (e) => this._onMouseMove(e));
    window.addEventListener('click', () => this._onClick());

    this._fetchNews();
    setInterval(() => this._fetchNews(), UPDATE_INTERVAL);
  }

  async _fetchNews() {
    try {
      console.log('📡 Fetching news from Worker API...');
      
      const response = await fetch(NEWS_API_URL);
      const data = await response.json();

      if (!data.articles || data.articles.length === 0) {
        console.warn('⚠️ No articles received from API');
        return;
      }

      console.log(`✅ Received ${data.articles.length} articles`);
      console.log('📊 Categories:', data.categories);

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
      // 🎨 Kategori rengini al
      const categoryColor = CATEGORY_COLORS[article.category] || CATEGORY_COLORS.tech;
      
      const geometry = new THREE.SphereGeometry(10 + Math.random() * 5, 32, 32);
      geometry.computeBoundingSphere();
      
      const color = new THREE.Color(categoryColor);
      const material = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color.clone().multiplyScalar(0.4),
        roughness: 0.4,
        metalness: 0.3,
        transparent: true,
        opacity: 0
      });

      const planet = new THREE.Mesh(geometry, material);
      
      const articleIndex = articles.indexOf(article);
      planet.name = `NewsPlanet-${article.category}-${articleIndex}`;

      // Konumlandır
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
        category: article.category,
        fadeState: 'in',
        fadeProgress: 0,
        targetOpacity: 1,
        isNewsPlanet: true
      };

      this.scene.add(planet);
      this.planets.push({ mesh: planet });
    }
    
    console.log(`📰 ${articles.length} news planets created`);
    
    // Kategori dağılımını göster
    const categoryCount = {};
    this.planets.forEach(p => {
      const cat = p.mesh.userData.category;
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });
    console.log('📊 Planet distribution:', categoryCount);
  }

  _clearPlanets() {
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
    el.style.background = 'rgba(0, 0, 0, 0.9)';
    el.style.color = '#fff';
    el.style.padding = '12px 16px';
    el.style.borderRadius = '8px';
    el.style.pointerEvents = 'none';
    el.style.display = 'none';
    el.style.maxWidth = '400px';
    el.style.fontFamily = "'Inter', 'Arial', sans-serif";
    el.style.fontSize = '14px';
    el.style.lineHeight = '1.5';
    el.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.4)';
    el.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    el.style.zIndex = '9999';
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
      const { title, description, category } = obj.userData;

      // 🎨 12 Kategori emoji'si
      const categoryEmojis = {
        gaming: '🎮',
        esports: '🏆',
        crypto: '₿',
        web3: '🌐',
        ai: '🤖',
        fintech: '💰',
        space: '🚀',
        tech: '⚡',
        mobile: '📱',
        entertainment: '🎬',
        music: '🎵',
        coding: '💻'
      };
      
      const emoji = categoryEmojis[category] || '📰';

      this.tooltip.style.display = 'block';
      this.tooltip.style.left = `${event.clientX + 15}px`;
      this.tooltip.style.top = `${event.clientY + 15}px`;
      this.tooltip.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <span style="font-size: 20px;">${emoji}</span>
          <span style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px;">${category}</span>
        </div>
        <strong style="font-size: 15px; display: block; margin-bottom: 6px;">${title}</strong>
        <div style="font-size: 13px; color: #ccc;">${description}</div>
      `;
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
    for (let i = this.planets.length - 1; i >= 0; i--) {
      const { mesh } = this.planets[i];
      const userData = mesh.userData;

      // Fade In
      if (userData.fadeState === 'in') {
        userData.fadeProgress += deltaTime / this.fadeDuration;
        
        if (userData.fadeProgress >= 1) {
          userData.fadeProgress = 1;
          userData.fadeState = 'visible';
        }

        const eased = this._easeInOutCubic(userData.fadeProgress);
        mesh.material.opacity = eased * userData.targetOpacity;
      }

      // Fade Out
      else if (userData.fadeState === 'out') {
        userData.fadeProgress += deltaTime / this.fadeDuration;
        
        if (userData.fadeProgress >= 1) {
          this.scene.remove(mesh);
          this.planets.splice(i, 1);
          continue;
        }

        const eased = this._easeInOutCubic(userData.fadeProgress);
        mesh.material.opacity = (1 - eased) * userData.targetOpacity;
      }
    }
  }

  _easeInOutCubic(t) {
    return t < 0.5 
      ? 4 * t * t * t 
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
}