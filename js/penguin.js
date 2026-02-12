import * as THREE from 'three';

export const PENGUIN_COLORS = {
    player: 0xff3333,
    ai1: 0x3388ff,
    ai2: 0x33cc33,
    ai3: 0xffcc00
};

export function createPenguin(scarfColor) {
    const penguin = new THREE.Group();

    // Body (main sphere, stretched vertically)
    const bodyGeometry = new THREE.SphereGeometry(0.5, 16, 12);
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a1a2e,
        roughness: 0.6,
        metalness: 0.1
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.scale.set(1, 1.4, 0.9);
    body.castShadow = true;
    penguin.add(body);

    // White belly (front half of sphere)
    const bellyGeometry = new THREE.SphereGeometry(0.42, 16, 12, 0, Math.PI);
    const bellyMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.7
    });
    const belly = new THREE.Mesh(bellyGeometry, bellyMaterial);
    belly.rotation.y = Math.PI / 2; // Face front
    belly.position.z = 0.15;
    belly.castShadow = true;
    penguin.add(belly);

    // Head
    const headGeometry = new THREE.SphereGeometry(0.32, 16, 12);
    const headMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a1a2e,
        roughness: 0.6,
        metalness: 0.1
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 0.85;
    head.castShadow = true;
    penguin.add(head);

    // Eyes (left and right)
    const eyeGeometry = new THREE.SphereGeometry(0.08, 8, 8);
    const eyeMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.3
    });

    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.12, 0.9, 0.25);
    penguin.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.12, 0.9, 0.25);
    penguin.add(rightEye);

    // Pupils
    const pupilGeometry = new THREE.SphereGeometry(0.04, 6, 6);
    const pupilMaterial = new THREE.MeshStandardMaterial({
        color: 0x000000
    });

    const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
    leftPupil.position.set(-0.12, 0.9, 0.32);
    penguin.add(leftPupil);

    const rightPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
    rightPupil.position.set(0.12, 0.9, 0.32);
    penguin.add(rightPupil);

    // Beak (cone pointing forward)
    const beakGeometry = new THREE.ConeGeometry(0.08, 0.2, 4);
    const beakMaterial = new THREE.MeshStandardMaterial({
        color: 0xff8800,
        roughness: 0.5
    });
    const beak = new THREE.Mesh(beakGeometry, beakMaterial);
    beak.position.set(0, 0.8, 0.35);
    beak.rotation.x = Math.PI / 2;
    beak.castShadow = true;
    penguin.add(beak);

    // Feet (left and right)
    const footGeometry = new THREE.BoxGeometry(0.15, 0.05, 0.25);
    const footMaterial = new THREE.MeshStandardMaterial({
        color: 0xff8800,
        roughness: 0.6
    });

    const leftFoot = new THREE.Mesh(footGeometry, footMaterial);
    leftFoot.position.set(-0.25, -0.7, 0.1);
    leftFoot.castShadow = true;
    penguin.add(leftFoot);

    const rightFoot = new THREE.Mesh(footGeometry, footMaterial);
    rightFoot.position.set(0.25, -0.7, 0.1);
    rightFoot.castShadow = true;
    penguin.add(rightFoot);

    // Wings (flattened boxes on sides)
    const wingGeometry = new THREE.BoxGeometry(0.15, 0.6, 0.3);
    const wingMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a1a2e,
        roughness: 0.6,
        metalness: 0.1
    });

    const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    leftWing.position.set(-0.5, 0.1, 0);
    leftWing.rotation.z = 0.3;
    leftWing.castShadow = true;
    penguin.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    rightWing.position.set(0.5, 0.1, 0);
    rightWing.rotation.z = -0.3;
    rightWing.castShadow = true;
    penguin.add(rightWing);

    // Colored scarf (torus around neck)
    const scarfGeometry = new THREE.TorusGeometry(0.3, 0.06, 8, 16);
    const scarfMaterial = new THREE.MeshStandardMaterial({
        color: scarfColor,
        roughness: 0.8
    });
    const scarf = new THREE.Mesh(scarfGeometry, scarfMaterial);
    scarf.position.y = 0.6;
    scarf.rotation.x = Math.PI / 2;
    scarf.castShadow = true;
    penguin.add(scarf);

    // Idle wobble animation
    penguin.userData.wobble = function(t) {
        penguin.rotation.z = Math.sin(t * 2) * 0.05;
    };

    return penguin;
}
