export class UIManager {
    constructor() {
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

        this.powerSlider.addEventListener('input', () => {
            this.powerLabel.textContent = `강도: ${this.powerSlider.value}`;
        });

        this.onStart = null;
        this.onLaunch = null;
        this.onRestart = null;

        this.startBtn.addEventListener('click', () => { if (this.onStart) this.onStart(); });
        this.launchBtn.addEventListener('click', () => { if (this.onLaunch) this.onLaunch(); });
        this.restartBtn.addEventListener('click', () => { if (this.onRestart) this.onRestart(); });
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

    showAiming(round, aliveCount) {
        this.menuScreen.classList.add('hidden');
        this.hudElement.classList.remove('hidden');
        this.bottomControls.classList.remove('hidden');
        this.gameoverScreen.classList.add('hidden');
        this.roundDisplay.textContent = `라운드 ${round}`;
        this.aliveDisplay.textContent = `🐧 x${aliveCount}`;
        this.aimHint.textContent = '드래그로 방향을 정하세요';
    }

    showSliding(round, aliveCount) {
        this.bottomControls.classList.add('hidden');
        this.roundDisplay.textContent = `라운드 ${round}`;
        this.aliveDisplay.textContent = `🐧 x${aliveCount}`;
    }

    showRoundBanner(round) {
        this.roundBanner.textContent = `라운드 ${round}`;
        this.roundBanner.classList.add('show');
        setTimeout(() => {
            this.roundBanner.classList.remove('show');
        }, 1200);
    }

    showGameOver(playerWon) {
        this.bottomControls.classList.add('hidden');
        this.gameoverScreen.classList.remove('hidden');
        if (playerWon) {
            this.gameoverTitle.textContent = '🏆 승리!';
            this.gameoverSubtitle.textContent = '모든 상대 펭귄을 밀어냈습니다!';
        } else {
            this.gameoverTitle.textContent = '💀 패배...';
            this.gameoverSubtitle.textContent = '빙판에서 밀려났습니다!';
        }
    }

    updateAimHint(hasAim) {
        if (hasAim) {
            this.aimHint.textContent = '방향 설정 완료! 강도를 정하고 발사!';
        } else {
            this.aimHint.textContent = '드래그로 방향을 정하세요';
        }
    }
}
