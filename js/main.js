import * as THREE from 'three';
import { PhysicsWorld, PLATFORM_RADIUS } from './physics.js';
import { createPlatform } from './platform.js';
import { createPenguin, PENGUIN_COLORS } from './penguin.js';
import { AimControls } from './controls.js';
import { AIController } from './ai.js';
import { GameState, States } from './gameState.js';
import { CameraRig } from './camera.js';
import { UIManager } from './ui.js';
import { EffectsManager } from './effects.js';
import { NetworkManager } from './network.js';

const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a2e);
scene.fog = new THREE.FogExp2(0x0a0a2e, 0.015);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 22, 18);
camera.lookAt(0, 0, 0);
const cameraRig = new CameraRig(camera);

const ambientLight = new THREE.AmbientLight(0xccddff, 0.5);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0xaabbff, 0x443333, 0.6);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 60;
dirLight.shadow.camera.left = -20;
dirLight.shadow.camera.right = 20;
dirLight.shadow.camera.top = 20;
dirLight.shadow.camera.bottom = -20;
scene.add(dirLight);

createPlatform(scene);
const physics = new PhysicsWorld();
physics.createPlatformBody();

const controls = new AimControls(camera, canvas, scene);
const ai = new AIController();
const gameState = new GameState();
const ui = new UIManager();
const effects = new EffectsManager(scene);
const network = new NetworkManager();

let penguins = [];
let playerName = '';

function createAllPenguins() {
    penguins.forEach(p => {
        scene.remove(p.mesh);
    });
    physics.reset();
    physics.createPlatformBody();
    penguins = [];

    const configs = [
        { color: PENGUIN_COLORS.player, x: 0, z: -6, isPlayer: true, id: 'player' },
        { color: PENGUIN_COLORS.ai1, x: 6, z: 0, isPlayer: false, id: 'ai1' },
        { color: PENGUIN_COLORS.ai2, x: 0, z: 6, isPlayer: false, id: 'ai2' },
        { color: PENGUIN_COLORS.ai3, x: -6, z: 0, isPlayer: false, id: 'ai3' },
    ];

    for (const cfg of configs) {
        const mesh = createPenguin(cfg.color);
        mesh.position.set(cfg.x, 0.6, cfg.z);
        scene.add(mesh);

        const body = physics.createPenguinBody(cfg.x, 0.6, cfg.z);

        penguins.push({
            mesh,
            body,
            alive: true,
            isPlayer: cfg.isPlayer,
            id: cfg.id,
        });
    }

    return penguins;
}

function createMultiplayerPenguins(serverPlayers) {
    penguins.forEach(p => {
        scene.remove(p.mesh);
    });
    physics.reset();
    physics.createPlatformBody();
    penguins = [];

    const COLORS = [PENGUIN_COLORS.player, PENGUIN_COLORS.ai1, PENGUIN_COLORS.ai2, PENGUIN_COLORS.ai3];
    const POSITIONS = [
        { x: 0, z: -6 },
        { x: 6, z: 0 },
        { x: 0, z: 6 },
        { x: -6, z: 0 }
    ];

    for (const sp of serverPlayers) {
        const idx = sp.penguinIndex;
        const mesh = createPenguin(COLORS[idx]);
        mesh.position.set(POSITIONS[idx].x, 0.6, POSITIONS[idx].z);
        scene.add(mesh);

        const body = physics.createPenguinBody(POSITIONS[idx].x, 0.6, POSITIONS[idx].z);

        penguins.push({
            mesh,
            body,
            alive: true,
            isPlayer: sp.id === network.myId,
            penguinIndex: idx,
            playerId: sp.id,
            playerName: sp.name
        });
    }

    return penguins;
}

physics.onCollision((bodyA, bodyB, contactPoint) => {
    effects.spawnCollisionBurst(contactPoint);
});

gameState.onStateChange = (newState, oldState) => {
    switch (newState) {
        case States.ROUND_START:
            ui.showRoundBanner(gameState.round);
            const aliveCount = gameState.getAlivePenguins().length;
            ui.showSliding(gameState.round, aliveCount);
            cameraRig.setOverview();
            controls.disable();
            break;

        case States.AIMING: {
            const alive = gameState.getAlivePenguins();
            ui.showAiming(gameState.round, alive.length);
            if (!gameState.multiplayer) {
                const player = penguins.find(p => p.isPlayer && p.alive);
                if (player) {
                    controls.setPlayerPosition(player.mesh.position);
                    controls.enable();
                }
            }
            cameraRig.setOverview();
            break;
        }

        case States.LAUNCHING: {
            controls.disable();

            const player = penguins.find(p => p.isPlayer && p.alive);
            const aim = controls.getAimDirection();
            const power = ui.getPowerLevel();

            if (player && controls.hasAim) {
                physics.launchPenguin(player.body, aim.x, aim.z, power);
                effects.spawnLaunchTrail(player.mesh.position, aim);
            } else if (player) {
                const dx = -player.mesh.position.x;
                const dz = -player.mesh.position.z;
                const len = Math.sqrt(dx*dx + dz*dz) || 1;
                physics.launchPenguin(player.body, dx/len, dz/len, power);
            }

            const aiPenguins = penguins.filter(p => !p.isPlayer && p.alive);
            const aiShots = ai.computeShots(aiPenguins, penguins, PLATFORM_RADIUS);
            for (const shot of aiShots) {
                physics.launchPenguin(shot.penguin.body, shot.dirX, shot.dirZ, shot.power);
                effects.spawnLaunchTrail(shot.penguin.mesh.position, { x: shot.dirX, z: shot.dirZ });
            }

            ui.showSliding(gameState.round, gameState.getAlivePenguins().length);

            setTimeout(() => {
                gameState.startSliding();
            }, 100);
            break;
        }

        case States.SLIDING: {
            cameraRig.setOverview();
            break;
        }

        case States.GAME_OVER: {
            const playerWon = gameState.isPlayerAlive();
            ui.showGameOver(playerWon, null, gameState.multiplayer);
            controls.disable();
            break;
        }
    }
};

ui.onNameSubmit = (name) => {
    playerName = name;
    ui.showRoomScreen();
};

ui.onCreateRoom = () => {
    network.createRoom(playerName);
};

ui.onJoinRoom = (code) => {
    network.joinRoom(playerName, code);
};

ui.onReady = () => {
    network.toggleReady();
};

ui.onLeaveRoom = () => {
    network.leaveRoom();
    ui.showRoomScreen();
};

ui.onReturnToLobby = () => {
    network.returnToLobby();
};

ui.onStart = () => {
    const allPenguins = createAllPenguins();
    gameState.multiplayer = false;
    gameState.startGame(allPenguins);
};

ui.onLaunch = () => {
    if (gameState.state !== States.AIMING) return;

    if (gameState.multiplayer) {
        const aim = controls.getAimDirection();
        const power = ui.getPowerLevel();

        if (controls.hasAim) {
            network.submitShot(aim.x, aim.z, power);
        } else {
            const myPenguin = penguins.find(p => p.penguinIndex === network.myPenguinIndex);
            if (myPenguin) {
                const dx = -myPenguin.mesh.position.x;
                const dz = -myPenguin.mesh.position.z;
                const len = Math.sqrt(dx*dx + dz*dz) || 1;
                network.submitShot(dx/len, dz/len, power);
            }
        }
        controls.disable();
        ui.showSliding(gameState.round, gameState.getAlivePenguins().length);
    } else {
        gameState.launch();
    }
};

ui.onRestart = () => {
    gameState.reset();
    controls.reset();
    ui.hideAllScreens();
    const allPenguins = createAllPenguins();
    gameState.multiplayer = false;
    gameState.startGame(allPenguins);
};

function syncMeshes() {
    for (const p of penguins) {
        if (!p.alive) {
            p.mesh.visible = false;
            continue;
        }
        p.mesh.position.set(p.body.position.x, p.body.position.y, p.body.position.z);
        p.mesh.quaternion.set(p.body.quaternion.x, p.body.quaternion.y, p.body.quaternion.z, p.body.quaternion.w);

        if (p.body.position.y < -2 && p.mesh.visible) {
            effects.spawnFallSplash({ x: p.body.position.x, y: 0, z: p.body.position.z });
        }
        if (p.body.position.y < -10) {
            p.mesh.visible = false;
        }
    }
}

const clock = new THREE.Clock();

function gameLoop() {
    const dt = clock.getDelta();

    if (gameState.state === States.SLIDING || gameState.state === States.LAUNCHING) {
        physics.step(dt);
    }

    syncMeshes();

    gameState.update(dt, physics, network);

    cameraRig.update(dt);

    effects.update(dt);

    if (gameState.state === States.AIMING) {
        ui.updateAimHint(controls.hasAim);
    }

    if (gameState.state === States.AIMING || gameState.state === States.ROUND_START) {
        const t = clock.elapsedTime;
        for (const p of penguins) {
            if (p.alive && p.mesh.userData.wobble) {
                p.mesh.userData.wobble(t + p.mesh.position.x);
            }
        }
    }

    renderer.render(scene, camera);
    requestAnimationFrame(gameLoop);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    cameraRig.updateFovForAspect();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

network.onRoomCreated = (code) => {
    ui.showLobby(code);
};

network.onRoomJoined = (code) => {
    ui.showLobby(code);
};

network.onJoinError = (msg) => {
    ui.showRoomError(msg);
};

network.onRoomUpdate = (data) => {
    if (data.state === 'lobby') {
        gameState.reset();
        controls.disable();
        penguins.forEach(p => scene.remove(p.mesh));
        penguins = [];
        physics.reset();
        physics.createPlatformBody();
        ui.showLobby(data.roomCode);
    }
    ui.updateLobbyPlayers(data.players);
};

network.onGameStart = ({ players }) => {
    gameState.multiplayer = true;
    const multiplayerPenguins = createMultiplayerPenguins(players);
    gameState.penguins = multiplayerPenguins;
    gameState.round = 0;
    gameState.state = States.MENU;
};

network.onRoundStart = ({ round }) => {
    gameState.round = round;
    gameState.transition(States.AIMING);
    const myPenguin = penguins.find(p => p.penguinIndex === network.myPenguinIndex);
    if (myPenguin && myPenguin.alive) {
        controls.setPlayerPosition(myPenguin.mesh.position);
        controls.enable();
    }
    ui.showAiming(round, gameState.getAlivePenguins().length);
};

network.onAllShots = ({ shots }) => {
    controls.disable();
    for (const shot of shots) {
        const penguin = penguins.find(p => p.penguinIndex === shot.penguinIndex);
        if (penguin && penguin.alive) {
            physics.launchPenguin(penguin.body, shot.dirX, shot.dirZ, shot.power);
            effects.spawnLaunchTrail(penguin.mesh.position, { x: shot.dirX, z: shot.dirZ });
        }
    }
    gameState.startSliding();
    ui.showSliding(gameState.round, gameState.getAlivePenguins().length);
};

network.onGameOver = ({ winner }) => {
    const iWon = winner && winner.id === network.myId;
    ui.showGameOver(iWon, winner ? winner.name : null, true);
    controls.disable();
};

network.onDisconnected = () => {
    ui.showReconnectBanner();
};

network.onReconnectSuccess = (data) => {
    ui.hideReconnectBanner();

    if (data.state === 'lobby') {
        ui.showLobby(data.roomCode);
        ui.updateLobbyPlayers(data.players);
    } else if (data.state === 'gameover') {
        const me = data.players.find(p => p.id === network.myId);
        const iWon = me ? me.alive : false;
        ui.showGameOver(iWon, null, true);
    } else {
        // Playing state (aiming/sliding) - show lobby as safe fallback
        ui.showLobby(data.roomCode);
        ui.updateLobbyPlayers(data.players);
    }
};

network.onReconnectFailed = () => {
    ui.hideReconnectBanner();
    ui.showNameScreen();
};

network.connect();

ui.showNameScreen();
gameLoop();
