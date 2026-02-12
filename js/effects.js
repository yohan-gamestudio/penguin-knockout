import * as THREE from 'three';

class Particle {
    constructor(position, velocity, color, life) {
        this.position = position.clone();
        this.velocity = velocity.clone();
        this.color = color;
        this.life = life;
        this.maxLife = life;
        this.size = 0.1;
    }

    update(dt) {
        this.position.add(this.velocity.clone().multiplyScalar(dt));
        this.velocity.y -= 9.8 * dt; // Gravity
        this.life -= dt;
    }

    isDead() {
        return this.life <= 0;
    }

    getAlpha() {
        return this.life / this.maxLife;
    }
}

export class EffectsManager {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.particleSystem = null;
        this.maxParticles = 1000;

        this.initParticleSystem();
    }

    initParticleSystem() {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.maxParticles * 3);
        const colors = new Float32Array(this.maxParticles * 3);
        const alphas = new Float32Array(this.maxParticles);

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

        const material = new THREE.PointsMaterial({
            size: 0.15,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.particleSystem = new THREE.Points(geometry, material);
        this.scene.add(this.particleSystem);
    }

    _toVec3(obj) {
        if (obj instanceof THREE.Vector3) return obj;
        return new THREE.Vector3(obj.x || 0, obj.y || 0, obj.z || 0);
    }

    spawnCollisionBurst(position) {
        const pos = this._toVec3(position);
        const count = 20;
        const colors = [
            new THREE.Color(0xffffff),
            new THREE.Color(0xaaddff),
            new THREE.Color(0x88ccff)
        ];

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 4;
            const velocity = new THREE.Vector3(
                Math.cos(angle) * speed,
                Math.random() * 3 + 1,
                Math.sin(angle) * speed
            );

            const color = colors[Math.floor(Math.random() * colors.length)];
            const particle = new Particle(pos, velocity, color, 0.5 + Math.random() * 0.5);
            this.particles.push(particle);
        }
    }

    spawnFallSplash(position) {
        const pos = this._toVec3(position);
        const count = 30;
        const color = new THREE.Color(0x3388ff);

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 3 + Math.random() * 5;
            const velocity = new THREE.Vector3(
                Math.cos(angle) * speed,
                Math.random() * 8 + 4,
                Math.sin(angle) * speed
            );

            const particle = new Particle(pos, velocity, color, 1.0 + Math.random() * 0.5);
            this.particles.push(particle);
        }
    }

    spawnLaunchTrail(position, direction) {
        const pos = this._toVec3(position);
        const dir = this._toVec3(direction);
        const count = 8;
        const color = new THREE.Color(0x88ddff);

        for (let i = 0; i < count; i++) {
            const offset = new THREE.Vector3(
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.5,
                (Math.random() - 0.5) * 0.5
            );

            const velocity = dir.clone().multiplyScalar(2 + Math.random() * 2).add(offset);

            const particle = new Particle(pos, velocity, color, 0.3 + Math.random() * 0.3);
            this.particles.push(particle);
        }
    }

    update(dt) {
        // Update all particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt);

            if (this.particles[i].isDead()) {
                this.particles.splice(i, 1);
            }
        }

        // Update particle system buffer
        const positions = this.particleSystem.geometry.attributes.position.array;
        const colors = this.particleSystem.geometry.attributes.color.array;
        const alphas = this.particleSystem.geometry.attributes.alpha.array;

        let index = 0;
        for (const particle of this.particles) {
            if (index >= this.maxParticles) break;

            positions[index * 3] = particle.position.x;
            positions[index * 3 + 1] = particle.position.y;
            positions[index * 3 + 2] = particle.position.z;

            colors[index * 3] = particle.color.r;
            colors[index * 3 + 1] = particle.color.g;
            colors[index * 3 + 2] = particle.color.b;

            alphas[index] = particle.getAlpha();

            index++;
        }

        // Clear unused particles
        for (let i = index; i < this.maxParticles; i++) {
            positions[i * 3 + 1] = -1000; // Move far away
            alphas[i] = 0;
        }

        this.particleSystem.geometry.attributes.position.needsUpdate = true;
        this.particleSystem.geometry.attributes.color.needsUpdate = true;
        this.particleSystem.geometry.attributes.alpha.needsUpdate = true;
    }
}
