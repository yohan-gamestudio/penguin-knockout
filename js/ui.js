const PENGUIN_SCARF_COLORS = ['#ff3333', '#3388ff', '#33cc33', '#ffcc00'];

export class UIManager {
    constructor() {
        // Existing elements
        this.menuScreen = document.getElementById('menu-screen');
        this.hudElement = document.getElementById('hud');
        this.bottomControls = document.getElementById('bottom-controls');
        this.roundDisplay = document.getElementById('round-display');
        this.aliveDisplay = document.getElementById('alive-display');
        this.powerSlider = document.getElementById('power-slider');
        this.powerLabel = document.getElementById('power-label');
        this.launchBtn = document.getElementById('launch-btn');
        this.roundBanner = document.getElementById('round-banner');
        this.gameoverScreen = document.getElementById('gameover-screen');
        this.gameoverTitle = document.getElementById('gameover-title');
        this.gameoverSubtitle = document.getElementById('gameover-subtitle');
        this.startBtn = document.getElementById('start-btn');
        this.restartBtn = document.getElementById('restart-btn');
        this.aimHint = document.getElementById('aim-hint');

        // Multiplayer elements
        this.nameScreen = document.getElementById('name-screen');
        this.nameInput = document.getElementById('name-input');
        this.nameSubmitBtn = document.getElementById('name-submit-btn');
        this.roomScreen = document.getElementById('room-screen');
        this.createRoomBtn = document.getElementById('create-room-btn');
        this.createPasswordInput = document.getElementById('create-password-input');
        this.roomCodeInput = document.getElementById('room-code-input');
        this.joinPasswordInput = document.getElementById('join-password-input');
        this.joinRoomBtn = document.getElementById('join-room-btn');
        this.roomBackBtn = document.getElementById('room-back-btn');
        this.roomError = document.getElementById('room-error');
        this.roomListEl = document.getElementById('room-list');

        // Password modal elements
        this.passwordModal = document.getElementById('password-modal');
        this.modalPasswordInput = document.getElementById('modal-password-input');
        this.modalPasswordSubmit = document.getElementById('modal-password-submit');
        this.modalPasswordCancel = document.getElementById('modal-password-cancel');
        this._pendingJoinCode = null;
        this.lobbyScreen = document.getElementById('lobby-screen');
        this.lobbyRoomCode = document.getElementById('lobby-room-code');
        this.lobbyPlayerList = document.getElementById('lobby-player-list');
        this.readyBtn = document.getElementById('ready-btn');
        this.leaveRoomBtn = document.getElementById('leave-room-btn');
        this.returnLobbyBtn = document.getElementById('return-lobby-btn');
        this.reconnectBanner = document.getElementById('reconnect-banner');
        this.rankingList = document.getElementById('ranking-list');

        this.onPowerChange = null;
        this.powerSlider.addEventListener('input', () => {
            this.powerLabel.textContent = `강도: ${this.powerSlider.value}`;
            if (this.onPowerChange) this.onPowerChange(parseInt(this.powerSlider.value));
        });

        // Existing callbacks
        this.onStart = null;
        this.onLaunch = null;
        this.onRestart = null;

        // Multiplayer callbacks
        this.onNameSubmit = null;
        this.onCreateRoom = null;
        this.onJoinRoom = null;
        this.onReady = null;
        this.onLeaveRoom = null;
        this.onReturnToLobby = null;
        this.onJoinRoomFromList = null;

        // Event listeners
        this.startBtn.addEventListener('click', () => { if (this.onStart) this.onStart(); });
        this.launchBtn.addEventListener('click', () => { if (this.onLaunch) this.onLaunch(); });
        this.restartBtn.addEventListener('click', () => { if (this.onRestart) this.onRestart(); });

        this.nameSubmitBtn.addEventListener('click', () => {
            const name = this.nameInput.value.trim();
            if (name && this.onNameSubmit) this.onNameSubmit(name);
        });

        this.nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const name = this.nameInput.value.trim();
                if (name && this.onNameSubmit) this.onNameSubmit(name);
            }
        });

        this.createRoomBtn.addEventListener('click', () => {
            const password = this.createPasswordInput.value.trim();
            if (this.onCreateRoom) this.onCreateRoom(password || null);
        });

        this.joinRoomBtn.addEventListener('click', () => {
            const code = this.roomCodeInput.value.trim();
            const password = this.joinPasswordInput.value.trim();
            if (code && this.onJoinRoom) this.onJoinRoom(code, password || null);
        });

        this.roomCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const code = this.roomCodeInput.value.trim();
                const password = this.joinPasswordInput.value.trim();
                if (code && this.onJoinRoom) this.onJoinRoom(code, password || null);
            }
        });

        this.modalPasswordSubmit.addEventListener('click', () => {
            const password = this.modalPasswordInput.value.trim();
            if (this._pendingJoinCode && this.onJoinRoom) {
                this.onJoinRoom(this._pendingJoinCode, password || null);
            }
            this.hidePasswordModal();
        });

        this.modalPasswordCancel.addEventListener('click', () => {
            this.hidePasswordModal();
        });

        this.modalPasswordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const password = this.modalPasswordInput.value.trim();
                if (this._pendingJoinCode && this.onJoinRoom) {
                    this.onJoinRoom(this._pendingJoinCode, password || null);
                }
                this.hidePasswordModal();
            }
        });

        this.roomBackBtn.addEventListener('click', () => {
            this.showNameScreen();
        });

        this.readyBtn.addEventListener('click', () => {
            if (this.onReady) this.onReady();
        });

        this.leaveRoomBtn.addEventListener('click', () => {
            if (this.onLeaveRoom) this.onLeaveRoom();
        });

        this.returnLobbyBtn.addEventListener('click', () => {
            if (this.onReturnToLobby) this.onReturnToLobby();
        });

        this.lobbyRoomCode.addEventListener('click', () => {
            const code = this.lobbyRoomCode.textContent;
            navigator.clipboard.writeText(code).then(() => {
                const original = this.lobbyRoomCode.textContent;
                this.lobbyRoomCode.textContent = '복사됨!';
                setTimeout(() => {
                    this.lobbyRoomCode.textContent = original;
                }, 1000);
            });
        });
    }

    getPowerLevel() {
        return parseInt(this.powerSlider.value);
    }

    showMenu() {
        this.menuScreen.classList.remove('hidden');
        this.hudElement.classList.add('hidden');
        this.bottomControls.classList.add('hidden');
        this.gameoverScreen.classList.add('hidden');
    }

    showAiming(round, aliveCount, isMultiplayer = false) {
        this.hideAllScreens();
        this.hudElement.classList.remove('hidden');
        this.bottomControls.classList.remove('hidden');
        this.roundDisplay.textContent = isMultiplayer ? `라운드 ${round}/10` : `라운드 ${round}`;
        this.aliveDisplay.textContent = `🐧 x${aliveCount}`;
        this.aimHint.textContent = '드래그하여 방향을 정하세요';
    }

    showSliding(round, aliveCount, isMultiplayer = false) {
        this.bottomControls.classList.add('hidden');
        this.roundDisplay.textContent = isMultiplayer ? `라운드 ${round}/10` : `라운드 ${round}`;
        this.aliveDisplay.textContent = `🐧 x${aliveCount}`;
    }

    showRoundBanner(round) {
        this.roundBanner.textContent = `라운드 ${round}`;
        this.roundBanner.classList.add('show');
        setTimeout(() => {
            this.roundBanner.classList.remove('show');
        }, 1200);
    }

    showGameOver(playerWon, winnerName = null, isMultiplayer = false, rankings = null, maxRounds = false) {
        this.hideAllScreens();
        this.gameoverScreen.classList.remove('hidden');
        if (maxRounds) {
            this.gameoverTitle.textContent = '⏰ 10라운드 종료!';
            this.gameoverSubtitle.textContent = '최대 라운드에 도달했습니다';
        } else if (playerWon) {
            this.gameoverTitle.textContent = '🏆 승리!';
            this.gameoverSubtitle.textContent = '모든 상대 펭귄을 밀어냈습니다!';
        } else {
            this.gameoverTitle.textContent = winnerName
                ? `🏆 ${winnerName} 승리!`
                : '게임 종료';
            this.gameoverSubtitle.textContent = '';
        }

        // Show rankings
        if (rankings && rankings.length > 0 && this.rankingList) {
            this.rankingList.innerHTML = '';
            const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];
            rankings.forEach((player, index) => {
                const item = document.createElement('div');
                item.className = 'ranking-item';
                const label = medals[index] || `${index + 1}`;
                item.textContent = `${label} ${player.name}`;
                this.rankingList.appendChild(item);
            });
            this.rankingList.classList.remove('hidden');
        } else if (this.rankingList) {
            this.rankingList.classList.add('hidden');
        }

        // 멀티플레이: 로비 버튼만, 싱글플레이: 다시하기 버튼만
        if (isMultiplayer) {
            this.restartBtn.classList.add('hidden');
            this.returnLobbyBtn.classList.remove('hidden');
        } else {
            this.restartBtn.classList.remove('hidden');
            this.returnLobbyBtn.classList.add('hidden');
        }
    }

    updateAimHint(hasAim) {
        if (hasAim) {
            this.aimHint.textContent = '방향 설정 완료! 강도를 정하고 발사!';
        } else {
            this.aimHint.textContent = '드래그하여 방향을 정하세요';
        }
    }

    hideAllScreens() {
        this.nameScreen.classList.add('hidden');
        this.roomScreen.classList.add('hidden');
        this.lobbyScreen.classList.add('hidden');
        this.menuScreen.classList.add('hidden');
        this.gameoverScreen.classList.add('hidden');
        this.hudElement.classList.add('hidden');
        this.bottomControls.classList.add('hidden');
        this.passwordModal.classList.add('hidden');
    }

    showNameScreen() {
        this.hideAllScreens();
        this.nameScreen.classList.remove('hidden');
        this.nameInput.value = '';
        this.nameInput.focus();
    }

    showRoomScreen() {
        this.hideAllScreens();
        this.roomScreen.classList.remove('hidden');
        this.roomCodeInput.value = '';
        this.joinPasswordInput.value = '';
        this.createPasswordInput.value = '';
        this.roomError.textContent = '';
    }

    showLobby(roomCode) {
        this.hideAllScreens();
        this.lobbyScreen.classList.remove('hidden');
        this.lobbyRoomCode.textContent = roomCode;
        this.readyBtn.classList.remove('ready');
        this.readyBtn.textContent = '준비';
    }

    updateLobbyPlayers(players) {
        this.lobbyPlayerList.innerHTML = '';

        players.forEach((player, index) => {
            const card = document.createElement('div');
            card.className = 'lobby-player-card';
            card.style.borderLeftColor = PENGUIN_SCARF_COLORS[index % PENGUIN_SCARF_COLORS.length];

            const colorDot = document.createElement('div');
            colorDot.className = 'player-color-dot';
            colorDot.style.backgroundColor = PENGUIN_SCARF_COLORS[index % PENGUIN_SCARF_COLORS.length];

            const name = document.createElement('div');
            name.className = 'player-name';
            name.textContent = player.name;

            const badge = document.createElement('div');
            if (player.disconnected) {
                badge.className = 'player-ready-badge waiting';
                badge.style.background = 'rgba(255,160,0,0.6)';
                badge.style.color = 'white';
                badge.textContent = '재연결 중';
                card.style.opacity = '0.5';
            } else {
                badge.className = `player-ready-badge ${player.ready ? 'ready' : 'waiting'}`;
                badge.textContent = player.ready ? '준비완료' : '대기중';
            }

            card.appendChild(colorDot);
            card.appendChild(name);
            card.appendChild(badge);

            this.lobbyPlayerList.appendChild(card);
        });
    }

    setReadyState(isReady) {
        if (isReady) {
            this.readyBtn.classList.add('ready');
            this.readyBtn.textContent = '준비 취소';
        } else {
            this.readyBtn.classList.remove('ready');
            this.readyBtn.textContent = '준비';
        }
    }

    showRoomError(message) {
        this.roomError.textContent = message;
    }

    showReconnectBanner() {
        this.reconnectBanner.classList.remove('hidden');
    }

    hideReconnectBanner() {
        this.reconnectBanner.classList.add('hidden');
    }

    updateRoomList(rooms) {
        this.roomListEl.innerHTML = '';
        for (const room of rooms) {
            const card = document.createElement('div');
            card.className = 'room-card' + (room.state !== 'lobby' ? ' in-game' : '');

            const code = document.createElement('div');
            code.className = 'room-card-code';
            code.textContent = room.roomCode;

            const info = document.createElement('div');
            info.className = 'room-card-info';
            const host = document.createElement('div');
            host.className = 'room-card-host';
            host.textContent = room.hostName;
            const players = document.createElement('div');
            players.className = 'room-card-players';
            players.textContent = `${room.playerCount}/${room.maxPlayers}명`;
            info.appendChild(host);
            info.appendChild(players);

            const right = document.createElement('div');
            right.className = 'room-card-right';
            if (room.hasPassword) {
                const lock = document.createElement('span');
                lock.className = 'room-lock-icon';
                lock.textContent = '\u{1F512}';
                right.appendChild(lock);
            }
            const badge = document.createElement('span');
            badge.className = 'room-status-badge ' + (room.state === 'lobby' ? 'lobby' : 'playing');
            badge.textContent = room.state === 'lobby' ? '대기중' : '게임중';
            right.appendChild(badge);

            card.appendChild(code);
            card.appendChild(info);
            card.appendChild(right);

            if (room.state === 'lobby') {
                card.addEventListener('click', () => {
                    if (room.hasPassword) {
                        this.showPasswordModal(room.roomCode);
                    } else if (this.onJoinRoomFromList) {
                        this.onJoinRoomFromList(room.roomCode, null);
                    }
                });
            }

            this.roomListEl.appendChild(card);
        }
    }

    showPasswordModal(roomCode) {
        this._pendingJoinCode = roomCode;
        this.modalPasswordInput.value = '';
        this.passwordModal.classList.remove('hidden');
        this.modalPasswordInput.focus();
    }

    hidePasswordModal() {
        this.passwordModal.classList.add('hidden');
        this._pendingJoinCode = null;
    }
}
