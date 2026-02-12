import * as THREE from 'three';

export class AimControls {
    constructor(camera, canvas, scene) {
        this.camera = camera;
        this.canvas = canvas;
        this.scene = scene;
        this.raycaster = new THREE.Raycaster();
        this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // y=0 plane

        this.aimDirection = new THREE.Vector3(0, 0, -1);
        this.hasAim = false;

        this.arrowHelper = null;
        this.playerPenguinPosition = new THREE.Vector3();
        this.enabled = false;
        this.powerLevel = 5;

        this._createArrowVisual();

        this._boundPointerDown = this._onPointerDown.bind(this);
        canvas.addEventListener('pointerdown', this._boundPointerDown);
    }

    _createArrowVisual() {
        const dir = new THREE.Vector3(0, 0, -1);
        const origin = new THREE.Vector3(0, 0.8, 0);
        this.arrowHelper = new THREE.ArrowHelper(dir, origin, 3, 0x111111, 0.8, 0.5);
        this.arrowHelper.visible = false;
        // Make the arrow thicker
        this.arrowHelper.line.material.linewidth = 3;
        this.scene.add(this.arrowHelper);
    }

    setPlayerPosition(pos) {
        this.playerPenguinPosition.copy(pos);
        this.arrowHelper.position.set(pos.x, 0.8, pos.z);
    }

    setPower(power) {
        this.powerLevel = power;
        if (this.hasAim) {
            this._updateArrow();
        }
    }

    enable() {
        this.enabled = true;
        this.hasAim = false;
    }

    disable() {
        this.enabled = false;
        // 화살표는 숨기지 않음 - 발사 후에도 유지
    }

    hideArrow() {
        this.arrowHelper.visible = false;
    }

    _screenToWorld(screenX, screenY) {
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

        const clickWorld = this._screenToWorld(e.clientX, e.clientY);
        const dir = new THREE.Vector3().subVectors(clickWorld, this.playerPenguinPosition);
        dir.y = 0;

        if (dir.length() > 0.3) {
            this.aimDirection.copy(dir).normalize();
            this.hasAim = true;
            this._updateArrow();
        }
    }

    _updateArrow() {
        // 화살표 길이: 파워에 비례 (1~10 → 1.5~6)
        const length = 1.5 + (this.powerLevel / 10) * 4.5;
        const headLength = Math.max(0.5, length * 0.2);
        const headWidth = 0.5;

        this.arrowHelper.visible = true;
        this.arrowHelper.setDirection(this.aimDirection);
        this.arrowHelper.setLength(length, headLength, headWidth);
        this.arrowHelper.setColor(0x111111);
    }

    getAimDirection() {
        return { x: this.aimDirection.x, z: this.aimDirection.z };
    }

    reset() {
        this.hasAim = false;
        this.arrowHelper.visible = false;
    }

    dispose() {
        this.canvas.removeEventListener('pointerdown', this._boundPointerDown);

        if (this.arrowHelper) {
            this.scene.remove(this.arrowHelper);
            this.arrowHelper.dispose();
        }
    }
}
