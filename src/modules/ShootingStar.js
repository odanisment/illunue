// ShootingStar.js
import * as THREE from 'three';
import { starShader } from './StarShader.js';

export class ShootingStar {
  constructor(scene, camera, starParams) {
    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        starShader.uniforms,
        {
          uTime: { value: 0 },
          uSpeed: { value: starParams.speedBoost || 1.0 },
          uColor1: { value: new THREE.Color(starParams.coreColor) },
          uColor2: { value: new THREE.Color(starParams.tailColor) },
          uTailLength: { value: starParams.tailLength },
          uBloomIntensity: { value: starParams.bloomIntensity }
        }
      ]),
      vertexShader: starShader.vertexShader,
      fragmentShader: starShader.fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
    });

    const geometry = new THREE.CylinderGeometry(0.1, 0.5, 5.0, 8);
    geometry.rotateX(Math.PI);
    geometry.rotateY(Math.PI);

    this.mesh = new THREE.Mesh(geometry, this.material);
    // 🎯 Kamera etrafında yönlendirilmiş, sinematik konumlandırma
    const minDistance = 100;
    const maxDistance = 300;
    const distance = THREE.MathUtils.randFloat(minDistance, maxDistance);

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);

    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(forward, up).normalize();
    up.crossVectors(right, forward).normalize(); // düzelt

    const angle = THREE.MathUtils.degToRad(THREE.MathUtils.randFloat(15, 75));
    const azimuth = THREE.MathUtils.randFloatSpread(Math.PI);

    const direction = new THREE.Vector3()
      .addScaledVector(right, Math.cos(azimuth) * Math.sin(angle))
      .addScaledVector(up, Math.sin(azimuth) * Math.sin(angle))
      .addScaledVector(forward, Math.cos(angle))
      .normalize();

    this.mesh.position.copy(camera.position).add(direction.multiplyScalar(distance));

    // 🎯 Rasgele yön ve hız
    const velocityAngle = THREE.MathUtils.randFloatSpread(360);
    const speed = starParams.baseSpeed;

    this.velocity = new THREE.Vector3(
      Math.cos(velocityAngle) * speed * 0.5,
      -speed * 0.8,
      Math.sin(velocityAngle) * speed * 0.5
    );

    this.mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      this.velocity.clone().normalize()
    );

    this.lifespan = 1.2;
    this.age = 0;
    this.starParams = starParams;
    this.startTime = Date.now();

    scene.add(this.mesh);
  }

  update(deltaTime) {
    this.age += deltaTime;

    this.material.uniforms.uTime.value = (Date.now() - this.startTime) * 0.001;
    this.material.uniforms.uTailLength.value = this.starParams.tailLength;
    this.material.uniforms.uBloomIntensity.value = this.starParams.bloomIntensity;
    this.material.uniforms.uColor1.value.set(this.starParams.coreColor);
    this.material.uniforms.uColor2.value.set(this.starParams.tailColor);

    this.mesh.position.add(this.velocity.clone().multiplyScalar(deltaTime));
    this.mesh.updateMatrixWorld();

    if (this.age >= this.lifespan) {
      this.mesh.parent?.remove(this.mesh);
      return false;
    }

    return true;
  }
}
