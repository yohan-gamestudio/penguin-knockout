import * as THREE from 'three';

export function createPlatform(scene) {
    // Create ice crack normal map
    const crackCanvas = document.createElement('canvas');
    crackCanvas.width = 512;
    crackCanvas.height = 512;
    const ctx = crackCanvas.getContext('2d');

    // Base color (light blue-white for ice)
    ctx.fillStyle = '#ddeeff';
    ctx.fillRect(0, 0, 512, 512);

    // Draw random ice cracks
    ctx.strokeStyle = '#aaccdd';
    ctx.lineWidth = 2;
    for (let i = 0; i < 30; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * 512, Math.random() * 512);
        for (let j = 0; j < 3; j++) {
            ctx.lineTo(Math.random() * 512, Math.random() * 512);
        }
        ctx.stroke();
    }

    // Add finer cracks
    ctx.strokeStyle = '#cce6ff';
    ctx.lineWidth = 1;
    for (let i = 0; i < 50; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * 512, Math.random() * 512);
        ctx.lineTo(Math.random() * 512, Math.random() * 512);
        ctx.stroke();
    }

    const crackTexture = new THREE.CanvasTexture(crackCanvas);
    crackTexture.wrapS = THREE.RepeatWrapping;
    crackTexture.wrapT = THREE.RepeatWrapping;

    // Main platform (circular ice)
    const platformGeometry = new THREE.CylinderGeometry(12, 12, 1, 64);
    const platformMaterial = new THREE.MeshStandardMaterial({
        color: 0xaaddff,
        roughness: 0.1,
        metalness: 0.2,
        transparent: true,
        opacity: 0.85,
        normalMap: crackTexture,
        normalScale: new THREE.Vector2(0.3, 0.3)
    });

    const platform = new THREE.Mesh(platformGeometry, platformMaterial);
    platform.position.y = -0.5; // Top surface at y=0
    platform.receiveShadow = true;
    platform.castShadow = true;
    scene.add(platform);

    // Edge warning ring (danger zone indicator)
    const ringGeometry = new THREE.RingGeometry(10, 12, 64);
    const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0xff6633,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.15
    });

    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01; // Slightly above platform surface
    scene.add(ring);

    // Water/void below
    const waterGeometry = new THREE.PlaneGeometry(100, 100);
    const waterMaterial = new THREE.MeshStandardMaterial({
        color: 0x001133,
        metalness: 0.8,
        roughness: 0.2
    });

    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -8;
    water.receiveShadow = true;
    scene.add(water);

    return { platform, ring };
}
