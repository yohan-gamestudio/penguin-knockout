/* global io */

export class NetworkManager {
    constructor() {
        this.socket = null;
        this.roomCode = null;
        this.myId = null;
        this.myPenguinIndex = -1;
        this.isHost = false;
        this.players = [];

        this.onRoomCreated = null;
        this.onRoomJoined = null;
        this.onJoinError = null;
        this.onRoomUpdate = null;
        this.onGameStart = null;
        this.onRoundStart = null;
        this.onPlayerShotReady = null;
        this.onAllShots = null;
        this.onGameOver = null;
    }

    connect() {
        this.socket = io();

        this.socket.on('connect', () => {
            this.myId = this.socket.id;
            console.log('Connected to server:', this.myId);
        });

        this.socket.on('room-created', ({ roomCode }) => {
            this.roomCode = roomCode;
            this.isHost = true;
            if (this.onRoomCreated) this.onRoomCreated(roomCode);
        });

        this.socket.on('room-joined', ({ roomCode }) => {
            this.roomCode = roomCode;
            if (this.onRoomJoined) this.onRoomJoined(roomCode);
        });

        this.socket.on('join-error', ({ message }) => {
            if (this.onJoinError) this.onJoinError(message);
        });

        this.socket.on('room-update', (data) => {
            this.players = data.players;
            this.isHost = data.hostId === this.myId;
            const me = data.players.find(p => p.id === this.myId);
            if (me) this.myPenguinIndex = me.penguinIndex;
            if (this.onRoomUpdate) this.onRoomUpdate(data);
        });

        this.socket.on('game-start', (data) => {
            const me = data.players.find(p => p.id === this.myId);
            if (me) this.myPenguinIndex = me.penguinIndex;
            if (this.onGameStart) this.onGameStart(data);
        });

        this.socket.on('round-start', (data) => {
            if (this.onRoundStart) this.onRoundStart(data);
        });

        this.socket.on('player-shot-ready', (data) => {
            if (this.onPlayerShotReady) this.onPlayerShotReady(data);
        });

        this.socket.on('all-shots', (data) => {
            if (this.onAllShots) this.onAllShots(data);
        });

        this.socket.on('game-over', (data) => {
            if (this.onGameOver) this.onGameOver(data);
        });
    }

    createRoom(name) {
        this.socket.emit('create-room', { name });
    }

    joinRoom(name, roomCode) {
        this.socket.emit('join-room', { name, roomCode: roomCode.trim() });
    }

    toggleReady() {
        this.socket.emit('player-ready');
    }

    submitShot(dirX, dirZ, power) {
        this.socket.emit('submit-shot', { dirX, dirZ, power });
    }

    reportRoundResults(eliminatedIndices) {
        if (this.isHost) {
            this.socket.emit('round-results', { eliminatedIndices });
        }
    }

    returnToLobby() {
        this.socket.emit('return-to-lobby');
    }

    isConnected() {
        return this.socket && this.socket.connected;
    }
}
