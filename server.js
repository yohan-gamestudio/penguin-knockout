const express = require('express');
const http = require('http');
const crypto = require('crypto');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('.'));

const rooms = new Map();
const sessions = new Map(); // sessionToken -> { socketId, roomCode, playerName }
const RECONNECT_GRACE_MS = 30000;

function generateRoomCode() {
    let code;
    do {
        code = String(Math.floor(1000 + Math.random() * 9000));
    } while (rooms.has(code));
    return code;
}

function broadcastRoomUpdate(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;

    const playerList = [];
    room.players.forEach((p, id) => {
        playerList.push({
            id, name: p.name, ready: p.ready, alive: p.alive,
            penguinIndex: p.penguinIndex, disconnected: !!p.disconnected
        });
    });

    io.to(roomCode).emit('room-update', {
        roomCode,
        players: playerList,
        state: room.state,
        round: room.round,
        hostId: room.hostId
    });
}

function removePlayerFromRoom(socketId, roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;

    const player = room.players.get(socketId);
    if (player && player.sessionToken) {
        sessions.delete(player.sessionToken);
    }

    room.players.delete(socketId);

    if (room.players.size === 0) {
        rooms.delete(roomCode);
        console.log(`Room ${roomCode} deleted (empty)`);
    } else {
        if (room.hostId === socketId) {
            // Reassign host to first connected player
            for (const [id, p] of room.players) {
                if (!p.disconnected) {
                    room.hostId = id;
                    break;
                }
            }
        }
        broadcastRoomUpdate(roomCode);

        // Check active (non-disconnected) player count for game state
        let activeCount = 0;
        room.players.forEach(p => { if (!p.disconnected) activeCount++; });

        if (room.state !== 'lobby' && activeCount < 2) {
            room.state = 'gameover';
            let winner = null;
            room.players.forEach((p, id) => {
                if (p.alive && !p.disconnected) winner = { id, name: p.name, penguinIndex: p.penguinIndex };
            });
            room.lastEvent = { type: 'game-over', data: { winner } };
            io.to(roomCode).emit('game-over', { winner });
        }
    }
}

function startNewRound(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;

    room.round++;
    room.state = 'round_aiming';

    room.players.forEach(p => { p.shot = null; });

    room.lastEvent = { type: 'round-start', data: { round: room.round } };
    io.to(roomCode).emit('round-start', { round: room.round });
}

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    let currentRoom = null;

    socket.on('create-room', ({ name }) => {
        const code = generateRoomCode();
        const token = crypto.randomUUID();
        const room = {
            players: new Map(),
            state: 'lobby',
            round: 0,
            hostId: socket.id,
            lastEvent: null
        };
        room.players.set(socket.id, {
            name, ready: false, shot: null, alive: true,
            penguinIndex: 0, sessionToken: token, disconnected: false
        });
        rooms.set(code, room);
        sessions.set(token, { socketId: socket.id, roomCode: code, playerName: name });
        currentRoom = code;
        socket.join(code);
        socket.emit('room-created', { roomCode: code, sessionToken: token });
        broadcastRoomUpdate(code);
        console.log(`Room ${code} created by ${name}`);
    });

    socket.on('join-room', ({ name, roomCode }) => {
        const room = rooms.get(roomCode);
        if (!room) {
            socket.emit('join-error', { message: '방을 찾을 수 없습니다.' });
            return;
        }
        if (room.state !== 'lobby') {
            socket.emit('join-error', { message: '이미 게임이 진행 중입니다.' });
            return;
        }
        if (room.players.size >= 4) {
            socket.emit('join-error', { message: '방이 가득 찼습니다. (최대 4명)' });
            return;
        }

        const token = crypto.randomUUID();
        const penguinIndex = room.players.size;
        room.players.set(socket.id, {
            name, ready: false, shot: null, alive: true,
            penguinIndex, sessionToken: token, disconnected: false
        });
        sessions.set(token, { socketId: socket.id, roomCode: roomCode, playerName: name });
        currentRoom = roomCode;
        socket.join(roomCode);
        socket.emit('room-joined', { roomCode, sessionToken: token });
        broadcastRoomUpdate(roomCode);
        console.log(`${name} joined room ${roomCode}`);
    });

    socket.on('reconnect-attempt', ({ sessionToken }) => {
        const session = sessions.get(sessionToken);
        if (!session) {
            socket.emit('reconnect-failed');
            return;
        }

        const room = rooms.get(session.roomCode);
        if (!room) {
            sessions.delete(sessionToken);
            socket.emit('reconnect-failed');
            return;
        }

        const oldSocketId = session.socketId;
        const player = room.players.get(oldSocketId);
        if (!player) {
            sessions.delete(sessionToken);
            socket.emit('reconnect-failed');
            return;
        }

        // Cancel grace period timer
        if (player.disconnectTimer) {
            clearTimeout(player.disconnectTimer);
            player.disconnectTimer = null;
        }

        // Remap player to new socket ID
        room.players.delete(oldSocketId);
        player.disconnected = false;
        room.players.set(socket.id, player);

        // Update session
        session.socketId = socket.id;

        // Update host if needed
        if (room.hostId === oldSocketId) {
            room.hostId = socket.id;
        }

        currentRoom = session.roomCode;
        socket.join(session.roomCode);

        // Build player list for client
        const playerList = [];
        room.players.forEach((p, id) => {
            playerList.push({
                id, name: p.name, ready: p.ready, alive: p.alive,
                penguinIndex: p.penguinIndex, disconnected: !!p.disconnected
            });
        });

        socket.emit('reconnect-success', {
            roomCode: session.roomCode,
            state: room.state,
            round: room.round,
            players: playerList,
            hostId: room.hostId,
            myPenguinIndex: player.penguinIndex,
            myName: player.name,
            lastEvent: room.lastEvent
        });

        broadcastRoomUpdate(session.roomCode);
        console.log(`Player ${session.playerName} reconnected to room ${session.roomCode}`);
    });

    socket.on('player-ready', () => {
        if (!currentRoom) return;
        const room = rooms.get(currentRoom);
        if (!room) return;

        const player = room.players.get(socket.id);
        if (player) {
            player.ready = !player.ready;
        }

        broadcastRoomUpdate(currentRoom);

        // Count only connected players for ready check
        let connectedCount = 0;
        let allReady = true;
        room.players.forEach(p => {
            if (!p.disconnected) {
                connectedCount++;
                if (!p.ready) allReady = false;
            }
        });

        if (connectedCount >= 2 && allReady) {
            room.state = 'playing';
            room.round = 0;

            let idx = 0;
            room.players.forEach(p => {
                p.penguinIndex = idx++;
                p.alive = true;
                p.ready = false;
                p.shot = null;
            });

            const playerList = [];
            room.players.forEach((p, id) => {
                playerList.push({ id, name: p.name, penguinIndex: p.penguinIndex, alive: true });
            });

            room.lastEvent = { type: 'game-start', data: { players: playerList } };
            io.to(currentRoom).emit('game-start', { players: playerList });

            setTimeout(() => {
                startNewRound(currentRoom);
            }, 500);
        }
    });

    socket.on('submit-shot', ({ dirX, dirZ, power }) => {
        if (!currentRoom) return;
        const room = rooms.get(currentRoom);
        if (!room || room.state !== 'round_aiming') return;

        const player = room.players.get(socket.id);
        if (!player || !player.alive) return;

        player.shot = { dirX, dirZ, power };

        io.to(currentRoom).emit('player-shot-ready', { playerId: socket.id });

        let allSubmitted = true;
        room.players.forEach(p => {
            // Skip disconnected players in allSubmitted check
            if (p.alive && !p.shot && !p.disconnected) allSubmitted = false;
        });

        if (allSubmitted) {
            room.state = 'round_sliding';
            const shots = [];
            room.players.forEach((p, id) => {
                if (p.alive && p.shot) {
                    shots.push({
                        playerId: id,
                        penguinIndex: p.penguinIndex,
                        dirX: p.shot.dirX,
                        dirZ: p.shot.dirZ,
                        power: p.shot.power
                    });
                }
            });

            room.lastEvent = { type: 'all-shots', data: { shots } };
            io.to(currentRoom).emit('all-shots', { shots });
        }
    });

    socket.on('round-results', ({ eliminatedIndices }) => {
        if (!currentRoom) return;
        const room = rooms.get(currentRoom);
        if (!room) return;

        if (socket.id !== room.hostId) return;

        room.players.forEach(p => {
            if (eliminatedIndices.includes(p.penguinIndex)) {
                p.alive = false;
            }
        });

        let aliveCount = 0;
        room.players.forEach(p => { if (p.alive) aliveCount++; });

        if (aliveCount <= 1) {
            room.state = 'gameover';
            let winner = null;
            room.players.forEach((p, id) => {
                if (p.alive) winner = { id, name: p.name, penguinIndex: p.penguinIndex };
            });
            room.lastEvent = { type: 'game-over', data: { winner } };
            io.to(currentRoom).emit('game-over', { winner });
        } else {
            startNewRound(currentRoom);
        }
    });

    socket.on('leave-room', () => {
        if (!currentRoom) return;
        const room = rooms.get(currentRoom);
        if (!room) return;

        // Intentional leave: clear session immediately
        const player = room.players.get(socket.id);
        if (player && player.sessionToken) {
            sessions.delete(player.sessionToken);
        }

        socket.leave(currentRoom);
        room.players.delete(socket.id);

        if (room.players.size === 0) {
            rooms.delete(currentRoom);
            console.log(`Room ${currentRoom} deleted (empty)`);
        } else {
            if (room.hostId === socket.id) {
                room.hostId = room.players.keys().next().value;
            }
            broadcastRoomUpdate(currentRoom);
        }

        currentRoom = null;
        console.log(`Player ${socket.id} left room`);
    });

    socket.on('return-to-lobby', () => {
        if (!currentRoom) return;
        const room = rooms.get(currentRoom);
        if (!room) return;

        room.state = 'lobby';
        room.round = 0;
        room.lastEvent = null;

        // Purge disconnected players before returning to lobby
        const toRemove = [];
        room.players.forEach((p, id) => {
            if (p.disconnected) {
                if (p.disconnectTimer) clearTimeout(p.disconnectTimer);
                if (p.sessionToken) sessions.delete(p.sessionToken);
                toRemove.push(id);
            } else {
                p.ready = false;
                p.shot = null;
                p.alive = true;
            }
        });
        toRemove.forEach(id => room.players.delete(id));

        broadcastRoomUpdate(currentRoom);
    });

    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        if (!currentRoom) return;

        const room = rooms.get(currentRoom);
        if (!room) return;

        const player = room.players.get(socket.id);
        if (!player) return;

        // If player has a session token, use grace period instead of immediate removal
        if (player.sessionToken) {
            player.disconnected = true;
            const savedRoom = currentRoom;
            const savedSocketId = socket.id;

            // Reassign host temporarily if needed
            if (room.hostId === socket.id) {
                for (const [id, p] of room.players) {
                    if (!p.disconnected && id !== socket.id) {
                        room.hostId = id;
                        break;
                    }
                }
            }

            broadcastRoomUpdate(currentRoom);
            console.log(`Player ${player.name} disconnected, grace period started (${RECONNECT_GRACE_MS / 1000}s)`);

            // Start grace period timer
            player.disconnectTimer = setTimeout(() => {
                console.log(`Grace period expired for ${player.name}`);
                removePlayerFromRoom(savedSocketId, savedRoom);
            }, RECONNECT_GRACE_MS);
        } else {
            // No session token: immediate removal (legacy behavior)
            removePlayerFromRoom(socket.id, currentRoom);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🐧 Penguin Knockout server running on http://localhost:${PORT}`);
});
