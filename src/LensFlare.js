// LensFlare.js v6.0 - FIXED SCALING (No distance-based scale jumps)
// ✅ Constant scale for consistent appearance
// ✅ Only occlusion affects visibility

import * as THREE from 'three';
import { easing } from 'maath';
import fragmentShader from './shaders/lensFlare.frag.glsl';
import vertexShader from './shaders/lensFlare.vert.glsl';

export let LensFlareParams = {};

export function LensFlareEffect(
  enabled,
  lensPosition,
  opacity,
  colorGain
) {
  LensFlareParams = {
    enabled: enabled ?? true,
    lensPosition: lensPosition ?? new THREE.Vector3(25, 2, -40),
    opacity: opacity ?? 0.5,
    colorGain: colorGain ?? new THREE.Color(95, 12, 10),
    visible: true,
    isDaytime: true,
    baseScale: 1.0,           // ✅ CONSTANT SCALE - No distance scaling!
    minOcclusionFactor: 0.05  // Minimum 5% visibility when fully occluded
  };

  const clock = new THREE.Clock();
  const screenPosition = LensFlareParams.lensPosition;
  const viewport = new THREE.Vector4();
  const oldOpacity = LensFlareParams.opacity;

  let internalOpacity = oldOpacity;
  let flarePosition = new THREE.Vector3();
  
  // Smooth occlusion
  let currentOcclusionFactor = 1.0;
  let targetOcclusionFactor = 1.0;
  
  // Sun angular radius
  const SUN_ANGULAR_RADIUS = 0.04;
  
  // Sample grid size
  const SAMPLE_GRID_SIZE = 7;
  const sampleOffsets = generateGridSamples(SAMPLE_GRID_SIZE);
  
  // Max distance for occlusion detection
  const MAX_OCCLUDER_DISTANCE = 3500;
  
  console.log(`☀️ LensFlare v6.0 initialized`);
  console.log(`   - Sample points: ${sampleOffsets.length}`);
  console.log(`   - Max occluder distance: ${MAX_OCCLUDER_DISTANCE}`);
  console.log(`   - Min occlusion factor: ${LensFlareParams.minOcclusionFactor}`);
  console.log(`   - Scale: CONSTANT (${LensFlareParams.baseScale})`);

  const lensFlareMaterial = new THREE.ShaderMaterial({
    uniforms: {
      iTime: { value: 0 },
      iResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      lensPosition: { value: new THREE.Vector2(0, 0) },
      enabled: { value: LensFlareParams.enabled },
      colorGain: { value: LensFlareParams.colorGain },
      opacity: { value: internalOpacity },
      isDaytime: { value: true },
      distanceScale: { value: 1.0 },
      occlusionFactor: { value: 1.0 },
      flareScale: { value: LensFlareParams.baseScale }
    },
    fragmentShader,
    vertexShader,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    name: 'LensFlareShader'
  });

  const lensFlareContainer = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    lensFlareMaterial
  );
  lensFlareContainer.userData.noOcclusion = true;
  lensFlareContainer.userData.isLensFlare = true;
  lensFlareContainer.frustumCulled = false;

  // Reusable vectors
  const _cameraPos = new THREE.Vector3();
  const _sunPos = new THREE.Vector3();
  const _toSun = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _up = new THREE.Vector3();
  const _samplePos = new THREE.Vector3();
  const _rayDir = new THREE.Vector3();
  const _toOccluder = new THREE.Vector3();
  const _closestPoint = new THREE.Vector3();
  const _objPos = new THREE.Vector3();
  const _objScale = new THREE.Vector3();

  let lastTime = 0;

  lensFlareMaterial.onBeforeRender = function (renderer, scene, camera) {
    if (!LensFlareParams.visible || !LensFlareParams.enabled) {
      lensFlareMaterial.uniforms.opacity.value = 0;
      lensFlareMaterial.uniforms.occlusionFactor.value = 0;
      internalOpacity = 0;
      return;
    }

    const now = performance.now() / 1000;
    const deltaTime = Math.min(now - lastTime, 0.1);
    lastTime = now;
    
    renderer.getCurrentViewport(viewport);
    lensFlareMaterial.uniforms.iResolution.value.set(viewport.z, viewport.w);
    lensFlareMaterial.uniforms.iTime.value = now;

    _sunPos.copy(screenPosition);
    _cameraPos.copy(camera.position);
    
    const sunDistance = _cameraPos.distanceTo(_sunPos);
    
    const projectedPosition = _sunPos.clone().project(camera);
    
    if (projectedPosition.z > 1) {
      targetOcclusionFactor = 0;
      updateOpacity(deltaTime, now);
      return;
    }
    
    flarePosition.set(projectedPosition.x, projectedPosition.y, projectedPosition.z);
    lensFlareContainer.lookAt(camera.position);

    const cameraDir = new THREE.Vector3();
    camera.getWorldDirection(cameraDir);
    _toSun.subVectors(_sunPos, _cameraPos).normalize();
    const dot = cameraDir.dot(_toSun);

    const angularThreshold = 0.3;
    
    if (dot > angularThreshold && LensFlareParams.isDaytime) {
      const angularFade = THREE.MathUtils.smoothstep(dot, angularThreshold, angularThreshold + 0.4);
      
      const visibilityRatio = calculateGeometricOcclusion(scene, camera, sunDistance);
      
      targetOcclusionFactor = angularFade * visibilityRatio;
      
    } else {
      targetOcclusionFactor = 0;
    }
    
    updateOpacity(deltaTime, now);
  };
  
  function updateOpacity(deltaTime, elapsedTime) {
    currentOcclusionFactor = targetOcclusionFactor;
    
    lensFlareMaterial.uniforms.occlusionFactor.value = currentOcclusionFactor;
    
    internalOpacity = oldOpacity * currentOcclusionFactor;
    
    lensFlareMaterial.uniforms.lensPosition.value.set(flarePosition.x, flarePosition.y);
    lensFlareMaterial.uniforms.opacity.value = internalOpacity;
    lensFlareMaterial.uniforms.flareScale.value = LensFlareParams.baseScale;  // ✅ CONSTANT
    lensFlareMaterial.uniforms.isDaytime.value = LensFlareParams.isDaytime;
  }

  function calculateGeometricOcclusion(scene, camera, sunDistance) {
    _toSun.subVectors(_sunPos, _cameraPos).normalize();
    
    const sunWorldRadius = sunDistance * SUN_ANGULAR_RADIUS;
    
    const tempUp = Math.abs(_toSun.y) < 0.9 
      ? new THREE.Vector3(0, 1, 0) 
      : new THREE.Vector3(1, 0, 0);
    
    _right.crossVectors(_toSun, tempUp).normalize();
    _up.crossVectors(_right, _toSun).normalize();
    
    const occluders = collectOccluders(scene, sunDistance);
    
    if (occluders.length === 0) {
      return 1.0;
    }
    
    let visibleSamples = 0;
    const totalSamples = sampleOffsets.length;
    
    for (let i = 0; i < totalSamples; i++) {
      const offset = sampleOffsets[i];
      
      _samplePos.copy(_sunPos)
        .addScaledVector(_right, offset.x * sunWorldRadius)
        .addScaledVector(_up, offset.y * sunWorldRadius);
      
      if (!isPointBlockedAngular(_cameraPos, _samplePos, sunDistance, occluders)) {
        visibleSamples++;
      }
    }
    
    const rawOcclusion = visibleSamples / totalSamples;
    
    const minOcclusion = LensFlareParams.minOcclusionFactor;
    return minOcclusion + (1.0 - minOcclusion) * rawOcclusion;
  }

  function collectOccluders(scene, sunDistance) {
    const occluders = [];
    
    scene.traverse((object) => {
      // ✅ GROUP SUPPORT - Earth gibi nested yapılar
      if (object.isGroup) {
        if (object.userData?.noOcclusion === true) return;
        if (object.userData?.ignoreScan === true) return;
        
        const groupMeshes = [];
        object.traverse((child) => {
          if (child.isMesh && child.visible && child.geometry) {
            if (child.userData?.noOcclusion === true) return;
            if (child.userData?.ignoreScan === true) return;
            groupMeshes.push(child);
          }
        });
        
        if (groupMeshes.length === 0) return;
        
        object.getWorldPosition(_objPos);
        
        let maxRadius = 0;
        groupMeshes.forEach((mesh) => {
          if (!mesh.geometry.boundingSphere) {
            mesh.geometry.computeBoundingSphere();
          }
          const bs = mesh.geometry.boundingSphere;
          if (!bs) return;
          
          mesh.getWorldScale(_objScale);
          const worldRadius = bs.radius * Math.max(_objScale.x, _objScale.y, _objScale.z);
          
          if (worldRadius > maxRadius) {
            maxRadius = worldRadius;
          }
        });
        
        if (maxRadius < 0.5) return;
        
        const distToObj = _cameraPos.distanceTo(_objPos);
        
        if (distToObj > MAX_OCCLUDER_DISTANCE) return;
        if (distToObj > sunDistance * 1.1) return;
        
        const toObj = _objPos.clone().sub(_cameraPos);
        if (toObj.dot(_toSun) < 0) return;
        
        occluders.push({
          position: _objPos.clone(),
          radius: maxRadius,
          distance: distToObj,
          type: 'group',
          name: object.name || 'unnamed-group'
        });
        
        return;
      }
      
      // ✅ Normal mesh kontrolü
      if (!object.isMesh) return;
      if (!object.visible) return;
      if (object.userData?.noOcclusion === true) return;
      if (object.userData?.isLensFlare === true) return;
      if (object.userData?.ignoreScan === true) return;
      if (!object.geometry) return;
      
      // Opacity check
      if (object.material) {
        const opacity = Array.isArray(object.material) 
          ? object.material[0]?.opacity 
          : object.material.opacity;
        
        if (opacity !== undefined && opacity < 0.1) return;
      }
      
      if (object.parent && object.parent.isGroup) return;
      
      if (!object.geometry.boundingSphere) {
        object.geometry.computeBoundingSphere();
      }
      
      const bs = object.geometry.boundingSphere;
      if (!bs) return;
      
      object.getWorldScale(_objScale);
      const worldRadius = bs.radius * Math.max(_objScale.x, _objScale.y, _objScale.z);
      
      if (worldRadius < 0.5) return;
      
      object.getWorldPosition(_objPos);
      
      const distToObj = _cameraPos.distanceTo(_objPos);
      
      if (distToObj > MAX_OCCLUDER_DISTANCE) return;
      if (distToObj > sunDistance * 1.1) return;
      
      const toObj = _objPos.clone().sub(_cameraPos);
      if (toObj.dot(_toSun) < 0) return;
      
      occluders.push({
        position: _objPos.clone(),
        radius: worldRadius,
        distance: distToObj,
        type: 'mesh',
        name: object.name || 'unnamed-mesh'
      });
    });
    
    occluders.sort((a, b) => a.distance - b.distance);
    
    return occluders;
  }

  function isPointBlockedAngular(cameraPos, targetPos, maxDistance, occluders) {
    _rayDir.subVectors(targetPos, cameraPos).normalize();
    const distanceToTarget = cameraPos.distanceTo(targetPos);
    
    for (const occluder of occluders) {
      const distToOccluder = cameraPos.distanceTo(occluder.position);
      
      if (distToOccluder > distanceToTarget) continue;
      
      const dirToOccluder = new THREE.Vector3()
        .subVectors(occluder.position, cameraPos)
        .normalize();
      
      const cosAngle = _rayDir.dot(dirToOccluder);
      const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
      
      const angularRadius = Math.atan2(occluder.radius, distToOccluder);
      
      if (angle < angularRadius) {
        return true;
      }
    }
    
    return false;
  }

  function generateGridSamples(gridSize) {
    const samples = [];
    const halfSize = (gridSize - 1) / 2;
    
    samples.push({ x: 0, y: 0 });
    
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const nx = (x - halfSize) / halfSize;
        const ny = (y - halfSize) / halfSize;
        
        if (nx === 0 && ny === 0) continue;
        
        const distSq = nx * nx + ny * ny;
        if (distSq <= 1.0) {
          samples.push({ x: nx, y: ny });
        }
      }
    }
    
    return samples;
  }

  return lensFlareContainer;
}