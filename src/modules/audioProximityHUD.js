// src/modules/audioProximityHUD.js
// Audio proximity + stereo HUD (SVG overlay) with non-looping animated bars

import * as THREE from 'three';

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

// Softer stereo crossfade - full ±90° range with smooth transition
function sharpenWeight(w) {
  // Full range: 0.0 to 1.0 = 180° total angle range
  // Each icon covers ±90° from center with smooth fade
  return smoothstep(0.0, 1.0, w);
}

function ensureOverlayRoot() {
  let root = document.getElementById('audio-proximity-hud-root');
  if (root) return root;

  root = document.createElement('div');
  root.id = 'audio-proximity-hud-root';
  root.style.position = 'fixed';
  root.style.left = '0';
  root.style.top = '0';
  root.style.width = '100%';
  root.style.height = '100%';
  root.style.pointerEvents = 'none';
  root.style.zIndex = '9999';
  document.body.appendChild(root);
  return root;
}

function buildIconSVG(side /* 'left' | 'right' */) {
  const wrapper = document.createElement('div');
  wrapper.className = `audio-proximity-icon audio-proximity-icon--${side}`;
  wrapper.style.position = 'fixed';
  wrapper.style.top = '50%';
  wrapper.style.width = '42px';
  wrapper.style.height = '300px';
  wrapper.style.opacity = '0';
  wrapper.style.willChange = 'opacity, transform, left, right';

  if (side === 'right') {
    wrapper.style.right = '18px';
    wrapper.style.transform = 'translateY(-50%) scaleX(-1)';
  } else {
    wrapper.style.left = '18px';
    wrapper.style.transform = 'translateY(-50%)';
  }

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 137.16 982.26');
  svg.setAttribute('width', '42');
  svg.setAttribute('height', '300');

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

  const clipTop = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
  clipTop.setAttribute('id', `clipTop-${side}`);
  const clipTopRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  clipTopRect.setAttribute('x', '0');
  clipTopRect.setAttribute('y', '982.26');
  clipTopRect.setAttribute('width', '137.16');
  clipTopRect.setAttribute('height', '0');
  clipTop.appendChild(clipTopRect);

  const clipBottom = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
  clipBottom.setAttribute('id', `clipBottom-${side}`);
  const clipBottomRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  clipBottomRect.setAttribute('x', '0');
  clipBottomRect.setAttribute('y', '0');
  clipBottomRect.setAttribute('width', '137.16');
  clipBottomRect.setAttribute('height', '0');
  clipBottom.appendChild(clipBottomRect);

  defs.appendChild(clipTop);
  defs.appendChild(clipBottom);
  svg.appendChild(defs);

  // Arcs - WHITE, no opacity
  const topArc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  topArc.setAttribute('d', 'M137.16,982.26c-47.27-95.88-80.26-239.71-88.92-404.49h-6.19c9.24,166.02,44.64,310.35,95.12,404.49Z');
  topArc.setAttribute('fill', '#ffffff');
  topArc.setAttribute('clip-path', `url(#clipTop-${side})`);

  const bottomArc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  bottomArc.setAttribute('d', 'M48.25,404.22C56.93,239.55,89.91,95.83,137.16,0,86.7,94.09,51.32,238.31,42.06,404.22h6.19Z');
  bottomArc.setAttribute('fill', '#ffffff');
  bottomArc.setAttribute('clip-path', `url(#clipBottom-${side})`);

  // Bars - All start with EQUAL height (30px), centered vertically at y=491
  const baseHeight = 30;
  const centerY = 491; // Center of the icon between the arcs
  const bars = [
    { x: 0.00,  y: centerY - baseHeight/2, w: 10, h: baseHeight, rx: 5, ry: 5 },
    { x: 19.58, y: centerY - baseHeight/2, w: 10, h: baseHeight, rx: 5, ry: 5 },
    { x: 40.15, y: centerY - baseHeight/2, w: 10, h: baseHeight, rx: 5, ry: 5 },
    { x: 58.73, y: centerY - baseHeight/2, w: 10, h: baseHeight, rx: 5, ry: 5 },
    { x: 78.31, y: centerY - baseHeight/2, w: 10, h: baseHeight, rx: 5, ry: 5 }
  ];

  const barEls = bars.map((b) => {
    const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    r.setAttribute('x', String(b.x));
    r.setAttribute('y', String(b.y));
    r.setAttribute('width', String(b.w));
    r.setAttribute('height', String(b.h));
    r.setAttribute('rx', String(b.rx));
    r.setAttribute('ry', String(b.ry));
    r.setAttribute('fill', '#ffffff');

    r.style.transformBox = 'fill-box';
    r.style.transformOrigin = '50% 50%';
    r.style.willChange = 'transform';
    r.style.vectorEffect = 'non-scaling-stroke'; // Preserve border radius during scale

    return r;
  });

  svg.appendChild(topArc);
  svg.appendChild(bottomArc);
  barEls.forEach((b) => svg.appendChild(b));

  wrapper.appendChild(svg);

  return {
    wrapper,
    svg,
    clipTopRect,
    clipBottomRect,
    barEls
  };
}

function findAudioPlanets(scene) {
  const list = [];
  scene.traverse((obj) => {
    if (obj && obj.isMesh && obj.userData && obj.userData.isAudioPlanet === true) {
      list.push(obj);
    }
  });
  return list;
}

export function createAudioProximityHUD({
  scene,
  camera,
  maxDistance = 500,
  fullOpacityDistance = 100, // UPDATED: 100 birimde %100 opacity
  refreshIntervalSec = 1.0
} = {}) {
  if (!scene || !camera) {
    throw new Error('createAudioProximityHUD requires { scene, camera }.');
  }

  const root = ensureOverlayRoot();

  const left = buildIconSVG('left');
  const right = buildIconSVG('right');

  root.appendChild(left.wrapper);
  root.appendChild(right.wrapper);

  const tmpWorld = new THREE.Vector3();
  const camRight = new THREE.Vector3();
  const camUp = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const toPlanet = new THREE.Vector3();

  let planets = [];
  let refreshTimer = 0;

  // Non-looping bar animation state (random walk)
  const barState = {
    left: left.barEls.map(() => ({
      current: 0.5,
      target: 0.5,
      timer: 0,
      speed: 0.8 + Math.random() * 0.6, // Each bar has different speed
      personality: 0.6 + Math.random() * 0.8 // Height variation personality
    })),
    right: right.barEls.map(() => ({
      current: 0.5,
      target: 0.5,
      timer: 0,
      speed: 0.8 + Math.random() * 0.6,
      personality: 0.6 + Math.random() * 0.8
    }))
  };

  function refreshPlanets() {
    planets = findAudioPlanets(scene);
  }
  refreshPlanets();

  function getNearestPlanet() {
    if (!planets.length) return null;

    camPos.copy(camera.position);
    let best = null;
    let bestDist = Infinity;

    for (const p of planets) {
      p.getWorldPosition(tmpWorld);
      const d = camPos.distanceTo(tmpWorld);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    return best ? { obj: best, dist: bestDist } : null;
  }

  function setArcsProgress(icon, progress, verticalWeight) {
    const fullH = 982.26;

    // Split progress between top and bottom arcs based on vertical angle
    // verticalWeight: -1 (below) to +1 (above)
    const topWeight = clamp01((verticalWeight + 1) * 0.5); // 0 when below, 1 when above
    const bottomWeight = 1.0 - topWeight; // 1 when below, 0 when above

    // Top arc reveal (bottom -> top) - stronger when object is above
    const hTop = fullH * progress * topWeight;
    const yTop = fullH - hTop;
    icon.clipTopRect.setAttribute('y', String(yTop));
    icon.clipTopRect.setAttribute('height', String(hTop));

    // Bottom arc reveal (top -> bottom) - stronger when object is below
    const hBottom = fullH * progress * bottomWeight;
    icon.clipBottomRect.setAttribute('y', '0');
    icon.clipBottomRect.setAttribute('height', String(hBottom));
  }

  function stepBarRandomWalk(sideKey, dt, proximity) {
    const bars = barState[sideKey];

    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i];
      bar.timer -= dt;

      // Generate new random target when timer expires
      if (bar.timer <= 0) {
        // Random hold time between movements
        bar.timer = 0.12 + Math.random() * 0.28;

        // High variation ranges - each bar can go from almost nothing to very tall
        const ranges = [
          { min: 0.02, max: 1.0 }, // Bar 0: extreme variation
          { min: 0.02, max: 1.0 }, // Bar 1: extreme variation
          { min: 0.02, max: 1.0 }, // Bar 2: extreme variation
          { min: 0.02, max: 1.0 }, // Bar 3: extreme variation
          { min: 0.02, max: 1.0 }  // Bar 4: extreme variation
        ];

        const range = ranges[i];
        bar.target = range.min + Math.random() * (range.max - range.min);
        bar.target *= Math.max(0.05, proximity); // Allow very low minimums when far
      }

      // Smooth interpolation to target (exponential ease)
      const responsiveness = 12.0 * bar.speed;
      bar.current += (bar.target - bar.current) * (1 - Math.exp(-responsiveness * dt));
    }
  }

  function setBars(icon, baseProgress, amplitude, sideWeight, sideKey) {
    const bars = barState[sideKey];
    
    // Don't multiply amplitude by sideWeight - keep consistent max height
    // sideWeight only affects visibility, not bar height
    const effectiveAmplitude = amplitude * 0.7; // Consistent scaling

    icon.barEls.forEach((bar, i) => {
      const state = bars[i];

      // Calculate scale based on current animation state
      const heightFactor = state.current * state.personality;
      const scaleY = 1.0 + (effectiveAmplitude * heightFactor * 4.0); // Adjusted for 150px max

      // Range: 10px minimum (0.33x) to 150px maximum (5.0x)
      const clamped = Math.min(5.0, Math.max(0.33, scaleY));
      bar.style.transform = `scaleY(${clamped.toFixed(3)})`;
    });
  }

  function setIconVisibility(icon, progress, sideWeight, distance) {
    let opacity;
    
    // Smooth transition zone: 150-100 units
    // Below 100: Always 100%
    // 100-150: Smooth blend from directional to full
    // Above 150: Directional fade
    
    if (distance <= fullOpacityDistance) {
      // At or below 100 units: Full opacity
      opacity = 1.0;
    } else if (distance <= 150) {
      // Transition zone (100-150 units): Smoothly blend to 100%
      const transitionProgress = (150 - distance) / 50; // 0 at 150, 1 at 100
      const directionalOpacity = clamp01(progress) * clamp01(sideWeight);
      opacity = THREE.MathUtils.lerp(directionalOpacity, 1.0, transitionProgress);
    } else {
      // Beyond 150 units: Progressive directional fade
      opacity = clamp01(progress) * clamp01(sideWeight);
    }

    icon.wrapper.style.opacity = String(opacity);

    const px = (1.0 - progress) * 10.0;
    if (icon.wrapper.classList.contains('audio-proximity-icon--right')) {
      icon.wrapper.style.right = `${18 + px}px`;
    } else {
      icon.wrapper.style.left = `${18 + px}px`;
    }
  }

  function update(deltaTime) {
    if (!deltaTime) deltaTime = 0;

    refreshTimer += deltaTime;
    if (refreshTimer >= refreshIntervalSec) {
      refreshTimer = 0;
      refreshPlanets();
    }

    const nearest = getNearestPlanet();
    if (!nearest) {
      setIconVisibility(left, 0, 0, Infinity);
      setIconVisibility(right, 0, 0, Infinity);
      setArcsProgress(left, 0, 0);
      setArcsProgress(right, 0, 0);
      setBars(left, 0, 0, 0, 'left');
      setBars(right, 0, 0, 0, 'right');
      return;
    }

    const dist = nearest.dist;
    const proximity = clamp01(1.0 - dist / maxDistance);
    const progress = smoothstep(0.0, 1.0, proximity);

    // Enhanced stereo calculation with horizontal and vertical panning
    camPos.copy(camera.position);
    nearest.obj.getWorldPosition(tmpWorld);
    toPlanet.copy(tmpWorld).sub(camPos).normalize();

    // Horizontal pan (left/right)
    camRight.set(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
    const panHorizontal = THREE.MathUtils.clamp(toPlanet.dot(camRight), -1, 1);
    
    // Vertical pan (up/down)
    camUp.set(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
    const panVertical = THREE.MathUtils.clamp(toPlanet.dot(camUp), -1, 1);
    
    // Apply smooth stereo shaping for horizontal
    const wRight = sharpenWeight(clamp01((panHorizontal + 1) * 0.5));
    const wLeft = sharpenWeight(clamp01((1 - panHorizontal) * 0.5));
    
    // Blend between equal (close) and directional (far) stereo with smoother curve
    const equalBlend = smoothstep(0, fullOpacityDistance, fullOpacityDistance - dist);
    const leftWeight = THREE.MathUtils.lerp(wLeft, 1.0, equalBlend);
    const rightWeight = THREE.MathUtils.lerp(wRight, 1.0, equalBlend);
    
    // Normalize weights
    const sum = Math.max(0.0001, leftWeight + rightWeight);
    const finalLeftWeight = leftWeight / sum;
    const finalRightWeight = rightWeight / sum;

    const amplitude = 1.0 * progress;

    // Update random-walk animation
    stepBarRandomWalk('left', deltaTime, proximity);
    stepBarRandomWalk('right', deltaTime, proximity);

    // Set arcs with vertical pan information
    setArcsProgress(left, progress, panVertical);
    setArcsProgress(right, progress, panVertical);

    setBars(left, progress, amplitude, finalLeftWeight, 'left');
    setBars(right, progress, amplitude, finalRightWeight, 'right');

    setIconVisibility(left, progress, finalLeftWeight, dist);
    setIconVisibility(right, progress, finalRightWeight, dist);
  }

  function destroy() {
    if (left.wrapper.parentNode) left.wrapper.parentNode.removeChild(left.wrapper);
    if (right.wrapper.parentNode) right.wrapper.parentNode.removeChild(right.wrapper);
  }

  return { update, destroy };
}