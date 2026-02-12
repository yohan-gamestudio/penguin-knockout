import * as THREE from 'three';

export class CameraRig {
    constructor(camera) {
        this.camera = camera;
        this.targetPosition = new THREE.Vector3(0, 22, 18);
        this.targetLookAt = new THREE.Vector3(0, 0, 0);
        this.currentLookAt = new THREE.Vector3(0, 0, 0);

        // Set initial position
        this.camera.position.copy(this.targetPosition);
        this.camera.lookAt(this.targetLookAt);
        this.camera.fov = 45;
        this.camera.updateProjectionMatrix();
    }

    setOverview() {
        this.targetPosition.set(0, 22, 18);
        this.targetLookAt.set(0, 0, 0);
    }

    followAction(penguins) {
        if (!penguins || penguins.length === 0) {
            this.setOverview();
            return;
        }

        // Calculate centroid of all penguins
        // Accepts either mesh objects (with .position) or penguin objects (with .mesh.position)
        const centroid = new THREE.Vector3();
        let count = 0;

        for (const penguin of penguins) {
            const pos = penguin.position || (penguin.mesh && penguin.mesh.position);
            if (pos) {
                centroid.add(pos);
                count++;
            }
        }

        if (count > 0) {
            centroid.divideScalar(count);

            // Position camera to look at centroid from elevated angle
            this.targetLookAt.copy(centroid);

            // Camera offset from centroid
            const offset = new THREE.Vector3(0, 18, 14);
            this.targetPosition.copy(centroid).add(offset);
        } else {
            this.setOverview();
        }
    }

    update(dt) {
        const lerpSpeed = 3.0;
        const alpha = 1.0 - Math.exp(-lerpSpeed * dt);

        // Smooth lerp to target position
        this.camera.position.lerp(this.targetPosition, alpha);

        // Smooth lerp lookAt point
        this.currentLookAt.lerp(this.targetLookAt, alpha);
        this.camera.lookAt(this.currentLookAt);
    }
}
