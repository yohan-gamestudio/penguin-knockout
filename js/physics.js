import * as CANNON from 'cannon-es';

const PLATFORM_RADIUS = 12;
const ICE_FRICTION = 0.02;
const ICE_RESTITUTION = 0.1;
const PENGUIN_MASS = 1;
const PENGUIN_DAMPING = 0.25;
const ANGULAR_DAMPING = 0.5;
const LAUNCH_FORCE_MAX = 40;

export { PLATFORM_RADIUS, LAUNCH_FORCE_MAX };

export class PhysicsWorld {
    constructor() {
        this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -30, 0) });
        this.world.broadphase = new CANNON.SAPBroadphase(this.world);
        this.world.allowSleep = true;

        // Materials
        this.iceMaterial = new CANNON.Material('ice');
        this.penguinMaterial = new CANNON.Material('penguin');

        // Contact materials
        const iceVsPenguin = new CANNON.ContactMaterial(this.iceMaterial, this.penguinMaterial, {
            friction: ICE_FRICTION,
            restitution: 0.1
        });
        const penguinVsPenguin = new CANNON.ContactMaterial(this.penguinMaterial, this.penguinMaterial, {
            friction: 0.1,
            restitution: ICE_RESTITUTION
        });
        this.world.addContactMaterial(iceVsPenguin);
        this.world.addContactMaterial(penguinVsPenguin);

        this.penguinBodies = [];
        this.collisionCallbacks = [];
        this.platformBody = null;
    }

    createPlatformBody() {
        // Static cylinder for the ice platform
        const shape = new CANNON.Cylinder(PLATFORM_RADIUS, PLATFORM_RADIUS, 1, 32);
        this.platformBody = new CANNON.Body({
            mass: 0,
            shape: shape,
            position: new CANNON.Vec3(0, -0.5, 0),
            material: this.iceMaterial
        });
        this.world.addBody(this.platformBody);
        return this.platformBody;
    }

    createPenguinBody(x, y, z) {
        const shape = new CANNON.Sphere(0.5);
        const body = new CANNON.Body({
            mass: PENGUIN_MASS,
            shape: shape,
            position: new CANNON.Vec3(x, y, z),
            linearDamping: PENGUIN_DAMPING,
            angularDamping: ANGULAR_DAMPING,
            material: this.penguinMaterial,
            fixedRotation: true
        });
        // Lock Y axis movement while on platform - allows pure XZ sliding
        body.linearFactor.set(1, 0, 1);
        this.world.addBody(body);
        this.penguinBodies.push(body);
        return body;
    }

    onCollision(callback) {
        // Register collision callback for penguin-vs-penguin impacts
        this.world.addEventListener('beginContact', (event) => {
            const a = event.bodyA;
            const b = event.bodyB;

            // Only trigger for penguin-penguin collisions
            if (this.penguinBodies.includes(a) && this.penguinBodies.includes(b)) {
                // Calculate contact point as midpoint between bodies
                const cp = new CANNON.Vec3();
                cp.x = (a.position.x + b.position.x) / 2;
                cp.y = (a.position.y + b.position.y) / 2;
                cp.z = (a.position.z + b.position.z) / 2;

                callback(a, b, { x: cp.x, y: cp.y, z: cp.z });
            }
        });
    }

    launchPenguin(body, directionX, directionZ, powerLevel) {
        // Re-lock Y axis for this round (in case it was unlocked from falling near edge)
        body.linearFactor.set(1, 0, 1);
        body.velocity.set(0, 0, 0);
        const force = (powerLevel / 10) * LAUNCH_FORCE_MAX;
        const impulse = new CANNON.Vec3(directionX * force, 0, directionZ * force);
        body.wakeUp();
        body.applyImpulse(impulse);
    }

    isOnPlatform(body) {
        // Check if penguin is still within platform radius and above fall threshold
        const r = Math.sqrt(body.position.x ** 2 + body.position.z ** 2);
        return r < PLATFORM_RADIUS + 0.5 && body.position.y > -2;
    }

    allSettled() {
        // Check if all penguin bodies have stopped moving (or fallen off)
        return this.penguinBodies.every(body => {
            const v = body.velocity;
            const speed = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
            // Penguin is settled if speed is very low OR it has fallen off
            return speed < 0.08 || body.position.y < -3;
        });
    }

    step(dt) {
        this.world.step(1/60, dt, 3);
        // Release Y-axis lock when penguin goes past platform edge → allow falling
        for (const body of this.penguinBodies) {
            const r = Math.sqrt(body.position.x ** 2 + body.position.z ** 2);
            if (r > PLATFORM_RADIUS - 0.3) {
                // Past the edge - unlock Y to allow gravity/falling
                body.linearFactor.set(1, 1, 1);
            }
        }
    }

    removePenguinBody(body) {
        this.world.removeBody(body);
        const idx = this.penguinBodies.indexOf(body);
        if (idx !== -1) this.penguinBodies.splice(idx, 1);
    }

    reset() {
        // Remove all penguin bodies from the world
        for (const body of [...this.penguinBodies]) {
            this.world.removeBody(body);
        }
        this.penguinBodies = [];
    }
}
