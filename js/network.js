/* global io */

export class NetworkManager {
    constructor() {
        this.socket = null;
        this.roomCode = null;
        this.myId = null;
        this.myPenguinIndex = -1;
        this.isHost = false;
        this.players = [];
        this.sessionToken = null;

        this.onRoomCreated = null;
        this.onRoomJoined = null;
        this.onJoinError = null;
        this.onRoomUpdate = null;
        this.onRoomList = null;
        this._roomPollInterval = null;
        this.onGameStart = null;
        this.onRoundStart = null;
        this.onTurnStart = null;
        this.onRoundEnd = null;
        this.onPlayerShotReady = null;
        this.onAllShots = null;
        this.onGameOver = null;
        this.onReconnectSuccess = null;
        this.onReconnectFailed = null;
        this.onDisconnected = null;
    }

    connect() {
        this.socket = io();

        this.socket.on('connect', () => {
            this.myId = this.socket.id;
            console.log('Connected to server:', this.myId);

            // Try to reconnect to existing session
            const savedToken = sessionStorage.getItem('penguin-session-token');
            if (savedToken) {
                this.socket.emit('reconnect-attempt', { sessionToken: savedToken });
            }
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            if (this.sessionToken) {
                if (this.onDisconnected) this.onDisconnected();
            }
        });

        this.socket.on('room-created', ({ roomCode, sessionToken }) => {
            this.roomCode = roomCode;
            this.isHost = true;
            this.sessionToken = sessionToken;
            sessionStorage.setItem('penguin-session-token', sessionToken);
            if (this.onRoomCreated) this.onRoomCreated(roomCode);
        });

        this.socket.on('room-joined', ({ roomCode, sessionToken }) => {
            this.roomCode = roomCode;
            this.sessionToken = sessionToken;
            sessionStorage.setItem('penguin-session-token', sessionToken);
            if (this.onRoomJoined) this.onRoomJoined(roomCode);
        });

        this.socket.on('join-error', ({ message }) => {
            if (this.onJoinError) this.onJoinError(message);
        });

        this.socket.on('room-list', (data) => {
            if (this.onRoomList) this.onRoomList(data);
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

        this.socket.on('turn-start', (data) => {
            if (this.onTurnStart) this.onTurnStart(data);
        });

        this.socket.on('round-end', (data) => {
            if (this.onRoundEnd) this.onRoundEnd(data);
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

        this.socket.on('reconnect-success', (data) => {
            this.roomCode = data.roomCode;
            this.myId = this.socket.id;
            this.myPenguinIndex = data.myPenguinIndex;
            this.isHost = data.hostId === this.myId;
            this.players = data.players;
            console.log('Reconnected to room:', data.roomCode);
            if (this.onReconnectSuccess) this.onReconnectSuccess(data);
        });

        this.socket.on('reconnect-failed', () => {
            console.log('Reconnection failed, clearing session');
            this.sessionToken = null;
            sessionStorage.removeItem('penguin-session-token');
            if (this.onReconnectFailed) this.onReconnectFailed();
        });
    }

    createRoom(name, password) {
        this.socket.emit('create-room', { name, password: password || null });
    }

    joinRoom(name, roomCode, password) {
        this.socket.emit('join-room', { name, roomCode: roomCode.trim(), password: password || null });
    }

    requestRoomList() {
        this._fetchRoomList();
    }

    startRoomPolling(intervalMs = 3000) {
        this.stopRoomPolling();
        this._fetchRoomList();
        this._roomPollInterval = setInterval(() => this._fetchRoomList(), intervalMs);
    }

    stopRoomPolling() {
        if (this._roomPollInterval) {
            clearInterval(this._roomPollInterval);
            this._roomPollInterval = null;
        }
    }

    _fetchRoomList() {
        fetch('/api/rooms')
            .then(res => res.json())
            .then(data => {
                if (this.onRoomList) this.onRoomList(data);
            })
            .catch(() => {});
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

    leaveRoom() {
        this.socket.emit('leave-room');
        this.roomCode = null;
        this.isHost = false;
        this.myPenguinIndex = -1;
        this.sessionToken = null;
        sessionStorage.removeItem('penguin-session-token');
    }

    isConnected() {
        return this.socket && this.socket.connected;
    }
}
