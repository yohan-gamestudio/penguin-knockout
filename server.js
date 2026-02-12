const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('.'));

const rooms = new Map();

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
        playerList.push({ id, name: p.name, ready: p.ready, alive: p.alive, penguinIndex: p.penguinIndex });
    });

    io.to(roomCode).emit('room-update', {
        roomCode,
        players: playerList,
        state: room.state,
        round: room.round,
        hostId: room.hostId
    });
}

function startNewRound(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;

    room.round++;
    room.state = 'round_aiming';

    room.players.forEach(p => { p.shot = null; });

    io.to(roomCode).emit('round-start', { round: room.round });
}

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    let currentRoom = null;

    socket.on('create-room', ({ name }) => {
        const code = generateRoomCode();
        const room = {
            players: new Map(),
            state: 'lobby',
            round: 0,
            hostId: socket.id
        };
        room.players.set(socket.id, { name, ready: false, shot: null, alive: true, penguinIndex: 0 });
        rooms.set(code, room);
        currentRoom = code;
        socket.join(code);
        socket.emit('room-created', { roomCode: code });
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

        const penguinIndex = room.players.size;
        room.players.set(socket.id, { name, ready: false, shot: null, alive: true, penguinIndex });
        currentRoom = roomCode;
        socket.join(roomCode);
        socket.emit('room-joined', { roomCode });
        broadcastRoomUpdate(roomCode);
        console.log(`${name} joined room ${roomCode}`);
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

        if (room.players.size >= 2) {
            let allReady = true;
            room.players.forEach(p => { if (!p.ready) allReady = false; });

            if (allReady) {
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

                io.to(currentRoom).emit('game-start', { players: playerList });

                setTimeout(() => {
                    startNewRound(currentRoom);
                }, 500);
            }
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
            if (p.alive && !p.shot) allSubmitted = false;
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
            io.to(currentRoom).emit('game-over', { winner });
        } else {
            startNewRound(currentRoom);
        }
    });

    socket.on('return-to-lobby', () => {
        if (!currentRoom) return;
        const room = rooms.get(currentRoom);
        if (!room) return;

        room.state = 'lobby';
        room.round = 0;
        room.players.forEach(p => {
            p.ready = false;
            p.shot = null;
            p.alive = true;
        });

        broadcastRoomUpdate(currentRoom);
    });

    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        if (!currentRoom) return;

        const room = rooms.get(currentRoom);
        if (!room) return;

        room.players.delete(socket.id);

        if (room.players.size === 0) {
            rooms.delete(currentRoom);
            console.log(`Room ${currentRoom} deleted (empty)`);
        } else {
            if (room.hostId === socket.id) {
                room.hostId = room.players.keys().next().value;
            }
            broadcastRoomUpdate(currentRoom);

            if (room.state !== 'lobby' && room.players.size < 2) {
                room.state = 'gameover';
                let winner = null;
                room.players.forEach((p, id) => {
                    if (p.alive) winner = { id, name: p.name, penguinIndex: p.penguinIndex };
                });
                io.to(currentRoom).emit('game-over', { winner });
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🐧 Penguin Knockout server running on http://localhost:${PORT}`);
});
