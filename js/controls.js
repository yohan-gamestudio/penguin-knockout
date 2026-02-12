import * as THREE from 'three';

export class AimControls {
    constructor(camera, canvas, scene) {
        this.camera = camera;
        this.canvas = canvas;
        this.scene = scene;
        this.raycaster = new THREE.Raycaster();
        this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // y=0 plane

        this.isDragging = false;
        this.startScreen = new THREE.Vector2();
        this.currentScreen = new THREE.Vector2();
        this.startWorld = new THREE.Vector3();
        this.currentWorld = new THREE.Vector3();

        this.aimDirection = new THREE.Vector3(0, 0, -1); // normalized XZ direction
        this.hasAim = false;

        this.arrowHelper = null;
        this.playerPenguinPosition = new THREE.Vector3();
        this.enabled = false;

        // Create visual arrow
        this._createArrowVisual();

        // Bind events
        this._boundPointerDown = this._onPointerDown.bind(this);
        this._boundPointerMove = this._onPointerMove.bind(this);
        this._boundPointerUp = this._onPointerUp.bind(this);

        canvas.addEventListener('pointerdown', this._boundPointerDown);
        canvas.addEventListener('pointermove', this._boundPointerMove);
        canvas.addEventListener('pointerup', this._boundPointerUp);
    }

    _createArrowVisual() {
        // Create a thick arrow using ArrowHelper
        const dir = new THREE.Vector3(0, 0, -1);
        const origin = new THREE.Vector3(0, 0.8, 0);
        this.arrowHelper = new THREE.ArrowHelper(dir, origin, 3, 0x00ff44, 0.6, 0.3);
        this.arrowHelper.visible = false;
        this.scene.add(this.arrowHelper);
    }

    setPlayerPosition(pos) {
        this.playerPenguinPosition.copy(pos);
        this.arrowHelper.position.set(pos.x, 0.8, pos.z);
    }

    enable() {
        this.enabled = true;
        this.hasAim = false;
    }

    disable() {
        this.enabled = false;
        this.arrowHelper.visible = false;
        this.isDragging = false;
    }

    _screenToWorld(screenX, screenY) {
        // Convert screen coordinates to world coordinates on the ground plane
        const rect = this.canvas.getBoundingClientRect();
        const x = screenX - rect.left;
        const y = screenY - rect.top;

        const ndc = new THREE.Vector2(
            (x / this.canvas.clientWidth) * 2 - 1,
            -(y / this.canvas.clientHeight) * 2 + 1
        );

        this.raycaster.setFromCamera(ndc, this.camera);
        const target = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(this.groundPlane, target);
        return target || new THREE.Vector3();
    }

    _onPointerDown(e) {
        if (!this.enabled) return;
        this.isDragging = true;
        this.startScreen.set(e.clientX, e.clientY);
        this.startWorld = this._screenToWorld(e.clientX, e.clientY);
    }

    _onPointerMove(e) {
        if (!this.enabled || !this.isDragging) return;
        this.currentScreen.set(e.clientX, e.clientY);
        this.currentWorld = this._screenToWorld(e.clientX, e.clientY);

        // Direction is OPPOSITE of drag (slingshot pull-back mechanic)
        const dragDir = new THREE.Vector3().subVectors(this.startWorld, this.currentWorld);
        dragDir.y = 0;

        if (dragDir.length() > 0.3) {
            this.aimDirection.copy(dragDir).normalize();
            this.hasAim = true;

            // Update arrow visual
            this.arrowHelper.visible = true;
            this.arrowHelper.setDirection(this.aimDirection);

            const arrowLength = Math.min(dragDir.length() * 0.5, 5);
            this.arrowHelper.setLength(arrowLength, arrowLength * 0.2, arrowLength * 0.12);

            // Color based on drag distance (green to red)
            const t = Math.min(dragDir.length() / 10, 1);
            const color = new THREE.Color().setHSL(0.33 * (1 - t), 1, 0.5);
            this.arrowHelper.setColor(color);
        } else {
            this.arrowHelper.visible = false;
            this.hasAim = false;
        }
    }

    _onPointerUp(e) {
        if (!this.enabled) return;
        this.isDragging = false;
        // Keep the arrow visible showing final aim direction
    }

    getAimDirection() {
        // Returns {x, z} normalized direction
        return { x: this.aimDirection.x, z: this.aimDirection.z };
    }

    reset() {
        this.hasAim = false;
        this.isDragging = false;
        this.arrowHelper.visible = false;
    }

    dispose() {
        // Clean up event listeners
        this.canvas.removeEventListener('pointerdown', this._boundPointerDown);
        this.canvas.removeEventListener('pointermove', this._boundPointerMove);
        this.canvas.removeEventListener('pointerup', this._boundPointerUp);

        // Clean up scene objects
        if (this.arrowHelper) {
            this.scene.remove(this.arrowHelper);
            this.arrowHelper.dispose();
        }
    }
}
