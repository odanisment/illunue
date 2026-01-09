// modules/AudioVisualizer.js - ENHANCED
// Audition-style Spectral Frequency Display with HIDDEN COORDINATES

import * as THREE from 'three';

export class AudioVisualizer {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.hoveredPlanet = null;
    
    this.spectrogramCanvas = null;
    this.spectrogramCtx = null;
    this.analyser = null;
    this.dataArray = null;
    this.visible = false;
    
    // 🎨 Spectrogram history buffer (for time axis)
    this.spectrogramHistory = [];
    this.maxHistoryLength = 512; // Width in pixels
    
    // 📊 Frequency range configuration
    this.minFreq = 20;    // Hz
    this.maxFreq = 20000; // Hz
    this.freqBins = 256;  // Height resolution
    
    // 🔢 Hidden message system
    this.hiddenMessages = new Map(); // planetId -> coordinate string
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
  }

  onMouseMove(event) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    const audioPlanets = [];
    this.scene.traverse((object) => {
      if (object.isMesh && object.userData.isAudioPlanet && object.userData.discovered) {
        audioPlanets.push(object);
      }
    });

    const intersects = this.raycaster.intersectObjects(audioPlanets);

    if (intersects.length > 0) {
      const planet = intersects[0].object;
      
      if (this.hoveredPlanet !== planet) {
        this.hoveredPlanet = planet;
        this.createSpectrogram(planet);
      }
    } else {
      if (this.hoveredPlanet) {
        this.hoveredPlanet = null;
        this.hideSpectrogram();
      }
    }
  }

  // 🔢 SET HIDDEN MESSAGE FOR A PLANET
  setHiddenMessage(planetId, coordinates) {
    // coordinates = "5000,0,5000" format
    this.hiddenMessages.set(planetId, coordinates);
    console.log(`🔐 Hidden coordinates set for planet ${planetId}: ${coordinates}`);
  }

  createSpectrogram(planet) {
    console.log('🎨 Creating detailed spectrogram for planet:', planet.uuid);
    
    if (!this.spectrogramCanvas) {
      // 🎨 MAIN CANVAS - Spectrogram
      const canvas = document.createElement('canvas');
      canvas.width = this.maxHistoryLength;
      canvas.height = this.freqBins;
      
      // 🎨 CONTAINER - Glassmorphic dark theme
      const container = document.createElement('div');
      container.id = 'spectrogram-container';
      container.style.cssText = `
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: 340px;
        background: linear-gradient(180deg, rgba(0, 0, 0, 0.95) 0%, rgba(10, 15, 25, 0.98) 100%);
        backdrop-filter: blur(20px);
        border-top: 1px solid rgba(100, 150, 255, 0.3);
        box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.8), 0 -2px 20px rgba(0, 100, 255, 0.2);
        z-index: 9998;
        opacity: 0;
        transition: opacity 0.4s ease;
        display: flex;
        flex-direction: column;
        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      `;
      
      // 🎯 TOP BAR - Planet info + controls
      const topBar = document.createElement('div');
      topBar.style.cssText = `
        height: 50px;
        padding: 0 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: linear-gradient(90deg, rgba(0, 100, 255, 0.1) 0%, transparent 100%);
        border-bottom: 1px solid rgba(100, 150, 255, 0.2);
      `;
      
      // Left side - Planet name
      const planetInfo = document.createElement('div');
      const planetNames = ['', 'TLETL (Fire)', 'ĀTL (Water)', 'TLALLI (Earth)', 'EHECATL (Wind)', 'TONATIUH (Sun)'];
      const planetId = planet.userData?.audioPlanetId || 0;
      planetInfo.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 8px; height: 8px; border-radius: 50%; background: #00ff88; box-shadow: 0 0 12px #00ff88; animation: pulse 2s ease-in-out infinite;"></div>
          <span style="color: rgba(255, 255, 255, 0.9); font-size: 14px; font-weight: 600; letter-spacing: 1px;">${planetNames[planetId] || 'AUDIO PLANET'}</span>
        </div>
      `;
      
      // Right side - FFT info
      const fftInfo = document.createElement('div');
      fftInfo.style.cssText = `
        display: flex;
        gap: 24px;
        color: rgba(255, 255, 255, 0.5);
        font-size: 11px;
        letter-spacing: 0.5px;
      `;
      fftInfo.innerHTML = `
        <span>FFT: <strong style="color: rgba(255, 255, 255, 0.8);">8192</strong></span>
        <span>RANGE: <strong style="color: rgba(255, 255, 255, 0.8);">20Hz - 20kHz</strong></span>
        <span>MODE: <strong style="color: #00ff88;">SPECTRAL ANALYSIS</strong></span>
      `;
      
      topBar.appendChild(planetInfo);
      topBar.appendChild(fftInfo);
      
      // 🎨 CANVAS WRAPPER - With scale labels
      const canvasWrapper = document.createElement('div');
      canvasWrapper.style.cssText = `
        flex: 1;
        position: relative;
        display: flex;
        padding: 12px;
        gap: 8px;
      `;
      
      // Y-axis labels (Frequency)
      const yAxisLabels = document.createElement('div');
      yAxisLabels.id = 'y-axis-labels';
      yAxisLabels.style.cssText = `
        width: 60px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 8px 0;
        color: rgba(255, 255, 255, 0.4);
        font-size: 10px;
        text-align: right;
        padding-right: 8px;
      `;
      
      const freqLabels = ['20kHz', '15kHz', '10kHz', '5kHz', '2kHz', '1kHz', '500Hz', '100Hz', '20Hz'];
      freqLabels.forEach(label => {
        const span = document.createElement('span');
        span.textContent = label;
        span.style.cssText = 'line-height: 1; font-weight: 500;';
        yAxisLabels.appendChild(span);
      });
      
      // Canvas container with border
      const canvasContainer = document.createElement('div');
      canvasContainer.style.cssText = `
        flex: 1;
        position: relative;
        border: 1px solid rgba(100, 150, 255, 0.2);
        border-radius: 4px;
        overflow: hidden;
        background: #000000;
        box-shadow: inset 0 0 20px rgba(0, 100, 255, 0.1);
      `;
      
      canvas.style.cssText = `
        width: 100%;
        height: 100%;
        image-rendering: pixelated;
        display: block;
      `;
      
      canvasContainer.appendChild(canvas);
      canvasWrapper.appendChild(yAxisLabels);
      canvasWrapper.appendChild(canvasContainer);
      
      // 📊 BOTTOM BAR - Time axis + waveform preview
      const bottomBar = document.createElement('div');
      bottomBar.style.cssText = `
        height: 30px;
        padding: 0 72px 0 72px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: rgba(0, 0, 0, 0.5);
        border-top: 1px solid rgba(100, 150, 255, 0.15);
        color: rgba(255, 255, 255, 0.4);
        font-size: 10px;
      `;
      bottomBar.innerHTML = `
        <span>← PAST</span>
        <span style="color: rgba(255, 255, 255, 0.6);">TIME AXIS</span>
        <span>NOW →</span>
      `;
      
      // Assemble container
      container.appendChild(topBar);
      container.appendChild(canvasWrapper);
      container.appendChild(bottomBar);
      document.body.appendChild(container);
      
      // Add pulse animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.8); }
        }
      `;
      document.head.appendChild(style);

      this.spectrogramCanvas = canvas;
      this.spectrogramCtx = canvas.getContext('2d', { 
        willReadFrequently: true,
        alpha: false 
      });
      
      this.spectrogramHistory = [];

      console.log('✅ Luxury UI created');

      setTimeout(() => {
        container.style.opacity = '1';
        console.log('✅ UI faded in');
      }, 10);
    }

    const audioSource = this.findAudioSource(planet);
    if (audioSource) {
      console.log('🎵 Audio source found, setting up analyser...');
      this.setupAnalyser(audioSource);
      this.visible = true;
      console.log('✅ Visualizer visible flag set to true');
    } else {
      console.error('❌ No audio source found for this planet');
    }
  }

  findAudioSource(planet) {
    let audioSource = null;
    
    console.log('🔍 Searching for audio source in planet:', planet.uuid);
    
    if (planet.parent) {
      planet.parent.traverse((child) => {
        if (child.type === 'Audio' || child.type === 'PositionalAudio') {
          audioSource = child;
          console.log('✅ Found Audio/PositionalAudio!', audioSource);
        }
      });
    }

    return audioSource;
  }

  setupAnalyser(audioSource) {
    if (!audioSource) {
      console.error('❌ No audio source provided to setupAnalyser');
      return;
    }

    const audioContext = audioSource.context;
    console.log('🎵 Setting up analyser...');
    
    if (!this.analyser) {
      this.analyser = audioContext.createAnalyser();
      this.analyser.fftSize = 8192; // High resolution for hidden messages
      this.analyser.smoothingTimeConstant = 0.3; // Less smoothing for detail
      
      console.log('  - Analyser created, FFT size:', this.analyser.fftSize);
      
      try {
        const source = audioSource.getOutput();
        source.connect(this.analyser);
        console.log('✅ Analyser connected successfully');
      } catch (error) {
        console.error('❌ Analyser connection error:', error);
        return;
      }
      
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);
      
      console.log(`✅ Analyser setup complete: FFT=${this.analyser.fftSize}, Buffer=${bufferLength}`);
    }
  }

  hideSpectrogram() {
    const container = document.getElementById('spectrogram-container');
    
    if (container) {
      container.style.opacity = '0';
      
      setTimeout(() => {
        if (!this.hoveredPlanet && container.parentNode) {
          container.remove();
          this.spectrogramCanvas = null;
          this.spectrogramCtx = null;
          this.spectrogramHistory = [];
        }
      }, 400);
    }
    
    this.analyser = null;
    this.dataArray = null;
    this.visible = false;
  }

  // 🎨 Draw frequency grid lines (subtle)
  drawStaticUI() {
    const ctx = this.spectrogramCtx;
    const width = this.spectrogramCanvas.width;
    const height = this.spectrogramCanvas.height;
    
    // Very subtle frequency grid lines
    ctx.strokeStyle = 'rgba(100, 150, 255, 0.08)';
    ctx.lineWidth = 1;
    
    const freqSteps = [100, 500, 1000, 2000, 5000, 10000, 15000, 20000];
    
    freqSteps.forEach(freq => {
      const y = this.freqToY(freq);
      
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    });
  }

  // Convert frequency to Y position
  freqToY(freq) {
    const height = this.spectrogramCanvas.height;
    // Log scale for better frequency distribution
    const minLog = Math.log10(this.minFreq);
    const maxLog = Math.log10(this.maxFreq);
    const freqLog = Math.log10(freq);
    
    const normalized = (freqLog - minLog) / (maxLog - minLog);
    return height - (normalized * height); // Flip Y (low freq at bottom)
  }

  // Convert bin index to frequency
  binToFreq(bin, sampleRate) {
    return (bin * sampleRate) / (this.analyser.fftSize);
  }

  // 🎨 Audition-style color mapping (dB to RGB)
  getSpectrogramColor(value) {
    // value: 0-255 from analyser
    const normalized = value / 255;
    
    // Audition color scheme: Black -> Blue -> Cyan -> Green -> Yellow -> Red -> White
    if (normalized < 0.2) {
      // Black to Blue
      const t = normalized / 0.2;
      return { r: 0, g: 0, b: Math.floor(t * 128) };
    } else if (normalized < 0.4) {
      // Blue to Cyan
      const t = (normalized - 0.2) / 0.2;
      return { r: 0, g: Math.floor(t * 255), b: 128 + Math.floor(t * 127) };
    } else if (normalized < 0.6) {
      // Cyan to Green
      const t = (normalized - 0.4) / 0.2;
      return { r: 0, g: 255, b: Math.floor((1 - t) * 255) };
    } else if (normalized < 0.8) {
      // Green to Yellow
      const t = (normalized - 0.6) / 0.2;
      return { r: Math.floor(t * 255), g: 255, b: 0 };
    } else {
      // Yellow to Red to White
      const t = (normalized - 0.8) / 0.2;
      return { 
        r: 255, 
        g: Math.floor((1 - t * 0.5) * 255), 
        b: Math.floor(t * 255) 
      };
    }
  }

  // 🔢 Embed hidden message in spectrogram (cyberpunk style)
  embedHiddenMessage(imageData, planetId) {
    const message = this.hiddenMessages.get(planetId);
    if (!message) return;
    
    const ctx = this.spectrogramCtx;
    const width = this.spectrogramCanvas.width;
    const height = this.spectrogramCanvas.height;
    
    // Position in high-mid frequency area (more visible)
    const textY = Math.floor(height * 0.25);
    const textX = Math.floor(width * 0.35);
    
    ctx.save();
    
    // Glowing background box
    ctx.fillStyle = 'rgba(0, 255, 136, 0.15)';
    ctx.fillRect(textX - 10, textY - 20, 200, 30);
    
    // Border
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(textX - 10, textY - 20, 200, 30);
    
    // Text with glow
    ctx.font = 'bold 14px Consolas, monospace';
    ctx.fillStyle = '#00ff88';
    ctx.shadowColor = '#00ff88';
    ctx.shadowBlur = 8;
    ctx.fillText(`→ ${message}`, textX, textY);
    
    // Second layer for extra glow
    ctx.shadowBlur = 16;
    ctx.fillText(`→ ${message}`, textX, textY);
    
    ctx.restore();
    
    console.log(`🔐 Hidden message embedded: ${message}`);
  }

  update() {
    if (!this.visible || !this.hoveredPlanet || !this.analyser || !this.spectrogramCtx) return;

    const ctx = this.spectrogramCtx;
    const canvas = this.spectrogramCanvas;
    const width = canvas.width;
    const height = canvas.height;

    // Get frequency data
    this.analyser.getByteFrequencyData(this.dataArray);

    // 🎨 SPECTROGRAM UPDATE - Audition style (scrolling time axis)
    
    // 1. Shift existing image left by 1 pixel
    const imageData = ctx.getImageData(1, 0, width - 1, height);
    ctx.putImageData(imageData, 0, 0);
    
    // 2. Draw new frequency column at the right edge
    const sampleRate = this.analyser.context.sampleRate;
    
    for (let y = 0; y < height; y++) {
      // Map Y position to frequency bin (log scale)
      const freq = this.yToFreq(y);
      const bin = Math.floor((freq * this.analyser.fftSize) / sampleRate);
      
      if (bin >= 0 && bin < this.dataArray.length) {
        const value = this.dataArray[bin];
        const color = this.getSpectrogramColor(value);
        
        ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
        ctx.fillRect(width - 1, y, 1, 1);
      }
    }
    
    // 3. 🔢 Embed hidden message (if exists)
    const planetId = this.hoveredPlanet.userData?.audioPlanetId;
    if (planetId && this.hiddenMessages.has(planetId)) {
      this.embedHiddenMessage(imageData, planetId);
    }
    
    // 4. Redraw frequency grid
    this.drawStaticUI();
  }

  // Convert Y position to frequency (inverse of freqToY)
  yToFreq(y) {
    const height = this.spectrogramCanvas.height;
    const normalized = (height - y) / height;
    
    const minLog = Math.log10(this.minFreq);
    const maxLog = Math.log10(this.maxFreq);
    
    return Math.pow(10, minLog + normalized * (maxLog - minLog));
  }

  dispose() {
    this.hideSpectrogram();
    window.removeEventListener('mousemove', this.onMouseMove);
  }
}