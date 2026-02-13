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

// Score tracking
let scores = {};
let playerNames = {};
let playerColors = {};

const SPAWN_POSITIONS = [
    { x: 0, z: -6 },
    { x: 6, z: 0 },
    { x: 0, z: 6 },
    { x: -6, z: 0 }
];

const SCARF_COLORS = ['#ff3333', '#3388ff', '#33cc33', '#ffcc00'];

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

    for (const sp of serverPlayers) {
        const idx = sp.penguinIndex;
        const mesh = createPenguin(COLORS[idx]);
        mesh.position.set(SPAWN_POSITIONS[idx].x, 0.6, SPAWN_POSITIONS[idx].z);
        scene.add(mesh);

        const body = physics.createPenguinBody(SPAWN_POSITIONS[idx].x, 0.6, SPAWN_POSITIONS[idx].z);

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

function respawnAllPenguins() {
    for (const p of penguins) {
        const idx = p.penguinIndex !== undefined ? p.penguinIndex : penguins.indexOf(p);
        const pos = SPAWN_POSITIONS[idx] || SPAWN_POSITIONS[0];

        p.alive = true;
        p.mesh.visible = true;

        // Reset physics body
        p.body.position.set(pos.x, 0.6, pos.z);
        p.body.velocity.set(0, 0, 0);
        p.body.angularVelocity.set(0, 0, 0);
        p.body.linearFactor.set(1, 0, 1);
        p.body.wakeUp();

        // Sync mesh
        p.mesh.position.set(pos.x, 0.6, pos.z);
        p.mesh.quaternion.set(0, 0, 0, 1);
    }
}

physics.onCollision((bodyA, bodyB, contactPoint) => {
    effects.spawnCollisionBurst(contactPoint);
});

gameState.onStateChange = (newState, oldState) => {
    switch (newState) {
        case States.ROUND_INTRO: {
            respawnAllPenguins();
            const maxR = gameState.multiplayer ? gameState.maxRounds : gameState.maxRounds;
            ui.showRoundBanner(gameState.round, maxR);
            ui.updateScoreBoard(scores, playerNames, playerColors);
            const aliveCount = gameState.getAlivePenguins().length;
            ui.showSliding(gameState.round, gameState.turn, aliveCount, maxR);
            ui.scoreBoard.classList.remove('hidden');
            ui.hudElement.classList.remove('hidden');
            cameraRig.setOverview();
            controls.disable();
            controls.hideArrow();
            break;
        }

        case States.TURN_START: {
            ui.showTurnBanner(gameState.turn);
            cameraRig.setOverview();
            controls.disable();
            controls.hideArrow();
            break;
        }

        case States.AIMING: {
            const alive = gameState.getAlivePenguins();
            const maxR = gameState.maxRounds;
            ui.showAiming(gameState.round, gameState.turn, alive.length, maxR);
            ui.updateScoreBoard(scores, playerNames, playerColors);
            controls.setPower(ui.getPowerLevel());
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

            ui.showSliding(gameState.round, gameState.turn, gameState.getAlivePenguins().length, gameState.maxRounds);

            setTimeout(() => {
                gameState.startSliding();
            }, 100);
            break;
        }

        case States.SLIDING: {
            cameraRig.setOverview();
            break;
        }

        case States.ROUND_END: {
            const winner = gameState.roundWinner;
            const winnerName = winner
                ? (winner.playerName || winner.id || '???')
                : null;
            // Update local scores from gameState (single-player)
            if (!gameState.multiplayer) {
                scores = { ...gameState.scores };
            }
            const isFinalRound = gameState.round >= gameState.maxRounds;
            ui.showRoundEnd(winnerName, gameState.round, scores, playerNames, isFinalRound);
            controls.disable();
            break;
        }

        case States.GAME_OVER: {
            if (!gameState.multiplayer) {
                scores = { ...gameState.scores };
            }
            const overall = gameState.getOverallWinner();
            const overallWinnerObj = overall.id
                ? { name: playerNames[overall.id] || overall.id, score: overall.score }
                : null;
            ui.showGameOver(overallWinnerObj, scores, playerNames, gameState.multiplayer);
            controls.disable();
            break;
        }
    }
};

ui.onNameSubmit = (name) => {
    playerName = name;
    ui.showRoomScreen();
    network.requestRoomList();
};

ui.onCreateRoom = (password) => {
    network.createRoom(playerName, password);
};

ui.onJoinRoom = (code, password) => {
    network.joinRoom(playerName, code, password);
};

ui.onJoinRoomFromList = (code, password) => {
    network.joinRoom(playerName, code, password);
};

ui.onReady = () => {
    network.toggleReady();
};

ui.onLeaveRoom = () => {
    network.leaveRoom();
    ui.showRoomScreen();
    network.requestRoomList();
};

ui.onReturnToLobby = () => {
    network.returnToLobby();
};

ui.onStart = () => {
    const allPenguins = createAllPenguins();
    gameState.multiplayer = false;

    // Initialize scores for single-player
    scores = {};
    playerNames = {};
    playerColors = {};
    const colorKeys = ['player', 'ai1', 'ai2', 'ai3'];
    for (let i = 0; i < allPenguins.length; i++) {
        const p = allPenguins[i];
        const id = p.id;
        scores[id] = 0;
        playerNames[id] = p.isPlayer ? '나' : `AI ${i}`;
        playerColors[id] = SCARF_COLORS[i];
    }

    gameState.startGame(allPenguins, 3);
};

ui.onPowerChange = (power) => {
    controls.setPower(power);
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
        ui.showSliding(gameState.round, gameState.turn, gameState.getAlivePenguins().length, gameState.maxRounds);
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

    // Re-initialize scores
    scores = {};
    playerNames = {};
    playerColors = {};
    const colorKeys = ['player', 'ai1', 'ai2', 'ai3'];
    for (let i = 0; i < allPenguins.length; i++) {
        const p = allPenguins[i];
        const id = p.id;
        scores[id] = 0;
        playerNames[id] = p.isPlayer ? '나' : `AI ${i}`;
        playerColors[id] = SCARF_COLORS[i];
    }

    gameState.startGame(allPenguins, 3);
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

    // Update arrow position to follow player penguin
    const myPenguin = penguins.find(p => p.isPlayer && p.alive);
    if (myPenguin) {
        controls.setPlayerPosition(myPenguin.mesh.position);
    }

    gameState.update(dt, physics, network);

    cameraRig.update(dt);

    effects.update(dt);

    if (gameState.state === States.AIMING) {
        ui.updateAimHint(controls.hasAim);
    }

    if (gameState.state === States.AIMING || gameState.state === States.ROUND_INTRO || gameState.state === States.TURN_START) {
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

network.onRoomList = (rooms) => {
    ui.updateRoomList(rooms);
};

network.onRoomCreated = (code) => {
    ui.showLobby(code);
};

network.onRoomJoined = (code) => {
    ui.showLobby(code);
};

network.onJoinError = (msg) => {
    ui.showRoomError(msg);
    ui.hidePasswordModal();
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

network.onGameStart = ({ players, maxRounds }) => {
    gameState.multiplayer = true;
    const multiplayerPenguins = createMultiplayerPenguins(players);
    gameState.penguins = multiplayerPenguins;
    gameState.round = 0;
    gameState.turn = 0;
    gameState.maxRounds = maxRounds || 3;
    gameState.state = States.MENU;

    // Initialize scores and name maps
    scores = {};
    playerNames = {};
    playerColors = {};
    for (const p of players) {
        scores[p.id] = 0;
        playerNames[p.id] = p.name;
        playerColors[p.id] = SCARF_COLORS[p.penguinIndex] || '#fff';
    }
};

network.onRoundStart = ({ round, scores: serverScores }) => {
    gameState.round = round;
    gameState.turn = 0;
    // Update scores from server
    if (serverScores) {
        for (const [id, score] of Object.entries(serverScores)) {
            scores[id] = score;
        }
    }
    // Respawn all penguins
    respawnAllPenguins();
    for (const p of penguins) {
        p.alive = true;
    }
    gameState.penguins = penguins;

    ui.showRoundBanner(round, gameState.maxRounds);
    ui.updateScoreBoard(scores, playerNames, playerColors);
    ui.hudElement.classList.remove('hidden');
    ui.scoreBoard.classList.remove('hidden');
    const aliveCount = gameState.getAlivePenguins().length;
    ui.showSliding(round, 0, aliveCount, gameState.maxRounds);
    cameraRig.setOverview();
};

network.onTurnStart = ({ round, turn }) => {
    gameState.round = round;
    gameState.turn = turn;
    controls.hideArrow();
    gameState.transition(States.AIMING);
    const myPenguin = penguins.find(p => p.penguinIndex === network.myPenguinIndex);
    if (myPenguin && myPenguin.alive) {
        controls.setPlayerPosition(myPenguin.mesh.position);
        controls.enable();
    }
    ui.showAiming(round, turn, gameState.getAlivePenguins().length, gameState.maxRounds);
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
    ui.showSliding(gameState.round, gameState.turn, gameState.getAlivePenguins().length, gameState.maxRounds);
};

network.onRoundEnd = ({ roundWinner, round, scores: serverScores }) => {
    // Update local scores
    if (serverScores) {
        for (const [id, score] of Object.entries(serverScores)) {
            scores[id] = score;
        }
    }
    const winnerName = roundWinner ? roundWinner.name : null;
    const isFinalRound = round >= gameState.maxRounds;
    ui.showRoundEnd(winnerName, round, scores, playerNames, isFinalRound);
    gameState.state = States.ROUND_END;
    controls.disable();
};

network.onGameOver = ({ winner, scores: finalScores }) => {
    if (finalScores) {
        for (const [id, score] of Object.entries(finalScores)) {
            scores[id] = score;
        }
    }
    ui.showGameOver(winner, scores, playerNames, true);
    gameState.state = States.GAME_OVER;
    controls.disable();
};

network.onDisconnected = () => {
    ui.showReconnectBanner();
};

network.onReconnectSuccess = (data) => {
    ui.hideReconnectBanner();
    playerName = data.myName || '';

    if (data.state === 'lobby') {
        gameState.reset();
        controls.disable();
        penguins.forEach(p => scene.remove(p.mesh));
        penguins = [];
        physics.reset();
        physics.createPlatformBody();
        ui.showLobby(data.roomCode);
        ui.updateLobbyPlayers(data.players);
    } else if (data.state === 'gameover') {
        const goData = data.lastEvent && data.lastEvent.type === 'game-over' ? data.lastEvent.data : {};
        const winner = goData.winner || null;
        if (goData.scores) {
            for (const [id, score] of Object.entries(goData.scores)) {
                scores[id] = score;
            }
        }
        // Rebuild playerNames from data.players
        for (const p of data.players) {
            playerNames[p.id] = p.name;
            playerColors[p.id] = SCARF_COLORS[p.penguinIndex] || '#fff';
        }
        ui.showGameOver(winner, scores, playerNames, true);
        controls.disable();
    } else {
        // Game in progress - restore state from server
        if (penguins.length === 0 || !gameState.multiplayer) {
            gameState.multiplayer = true;
            createMultiplayerPenguins(data.players);
            gameState.penguins = penguins;
        }
        gameState.round = data.round;
        gameState.turn = data.turn || 0;
        gameState.maxRounds = data.maxRounds || 3;

        // Restore scores
        if (data.scores) {
            for (const [id, score] of Object.entries(data.scores)) {
                scores[id] = score;
            }
        }
        // Rebuild playerNames
        for (const p of data.players) {
            playerNames[p.id] = p.name;
            playerColors[p.id] = SCARF_COLORS[p.penguinIndex] || '#fff';
        }

        // Sync alive status from server (authoritative)
        for (const sp of data.players) {
            const penguin = penguins.find(p => p.penguinIndex === sp.penguinIndex);
            if (penguin) {
                penguin.alive = sp.alive;
                if (!sp.alive) penguin.mesh.visible = false;
            }
        }
        gameState.penguins = penguins;

        // Replay the last critical event to restore correct phase
        if (data.lastEvent) {
            switch (data.lastEvent.type) {
                case 'turn-start': {
                    const evtData = data.lastEvent.data;
                    gameState.round = evtData.round;
                    gameState.turn = evtData.turn;
                    controls.hideArrow();
                    gameState.transition(States.AIMING);
                    const myP = penguins.find(p => p.penguinIndex === network.myPenguinIndex);
                    if (myP && myP.alive) {
                        controls.setPlayerPosition(myP.mesh.position);
                        controls.enable();
                    }
                    ui.showAiming(gameState.round, gameState.turn, gameState.getAlivePenguins().length, gameState.maxRounds);
                    break;
                }
                case 'round-start': {
                    const evtData = data.lastEvent.data;
                    gameState.round = evtData.round;
                    if (evtData.scores) {
                        for (const [id, score] of Object.entries(evtData.scores)) {
                            scores[id] = score;
                        }
                    }
                    ui.showRoundBanner(gameState.round, gameState.maxRounds);
                    ui.updateScoreBoard(scores, playerNames, playerColors);
                    ui.hudElement.classList.remove('hidden');
                    ui.scoreBoard.classList.remove('hidden');
                    cameraRig.setOverview();
                    break;
                }
                case 'all-shots': {
                    controls.disable();
                    for (const shot of data.lastEvent.data.shots) {
                        const penguin = penguins.find(p => p.penguinIndex === shot.penguinIndex);
                        if (penguin && penguin.alive) {
                            physics.launchPenguin(penguin.body, shot.dirX, shot.dirZ, shot.power);
                        }
                    }
                    gameState.startSliding();
                    ui.showSliding(gameState.round, gameState.turn, gameState.getAlivePenguins().length, gameState.maxRounds);
                    break;
                }
                case 'round-end': {
                    const evtData = data.lastEvent.data;
                    if (evtData.scores) {
                        for (const [id, score] of Object.entries(evtData.scores)) {
                            scores[id] = score;
                        }
                    }
                    const winnerName = evtData.roundWinner ? evtData.roundWinner.name : null;
                    const isFinal = evtData.round >= gameState.maxRounds;
                    ui.showRoundEnd(winnerName, evtData.round, scores, playerNames, isFinal);
                    gameState.state = States.ROUND_END;
                    controls.disable();
                    break;
                }
                case 'game-over': {
                    const goEvt = data.lastEvent.data;
                    if (goEvt.scores) {
                        for (const [id, score] of Object.entries(goEvt.scores)) {
                            scores[id] = score;
                        }
                    }
                    ui.showGameOver(goEvt.winner, scores, playerNames, true);
                    controls.disable();
                    break;
                }
            }
        }
    }
};

network.onReconnectFailed = () => {
    ui.hideReconnectBanner();
    ui.showNameScreen();
};


network.connect();

ui.showNameScreen();
gameLoop();
