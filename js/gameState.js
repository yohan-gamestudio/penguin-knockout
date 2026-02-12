export const States = {
    MENU: 'MENU',
    ROUND_START: 'ROUND_START',
    AIMING: 'AIMING',
    LAUNCHING: 'LAUNCHING',
    SLIDING: 'SLIDING',
    CHECK_ELIMINATIONS: 'CHECK_ELIMINATIONS',
    GAME_OVER: 'GAME_OVER'
};

export class GameState {
    constructor() {
        this.state = States.MENU;
        this.round = 0;
        this.penguins = [];
        this.slidingTimer = 0;
        this.slidingTimeout = 6;
        this.roundStartTimer = 0;
        this.roundStartDuration = 1.5;
        this.gameOverDelay = 0;
        this.gameOverDelayDuration = 2.0;
        this.gameOverPending = false;
        this.onStateChange = null;
        this.multiplayer = false;
    }

    transition(newState) {
        const old = this.state;
        this.state = newState;
        if (this.onStateChange) this.onStateChange(newState, old);
    }

    startGame(penguins) {
        this.penguins = penguins;
        this.round = 0;
        this.startNewRound();
    }

    startNewRound() {
        this.round++;
        this.roundStartTimer = 0;
        this.transition(States.ROUND_START);
    }

    update(dt, physics, network = null) {
        switch (this.state) {
            case States.ROUND_START:
                this.roundStartTimer += dt;
                if (this.roundStartTimer >= this.roundStartDuration) {
                    this.transition(States.AIMING);
                }
                break;

            case States.SLIDING:
                this.slidingTimer += dt;
                if (this.gameOverPending) {
                    this.gameOverDelay += dt;
                    if (this.gameOverDelay >= this.gameOverDelayDuration) {
                        this.gameOverPending = false;
                        this.transition(States.GAME_OVER);
                    }
                } else if (physics.allSettled() || this.slidingTimer >= this.slidingTimeout) {
                    this.transition(States.CHECK_ELIMINATIONS);
                }
                break;

            case States.CHECK_ELIMINATIONS:
                this.checkEliminations(physics, network);
                break;
        }
    }

    launch() {
        this.slidingTimer = 0;
        this.transition(States.LAUNCHING);
    }

    startSliding() {
        this.slidingTimer = 0;
        this.transition(States.SLIDING);
    }

    checkEliminations(physics, network = null) {
        const eliminated = [];
        for (const p of this.penguins) {
            if (!p.alive) continue;
            if (!physics.isOnPlatform(p.body)) {
                p.alive = false;
                if (this.multiplayer && p.penguinIndex !== undefined) {
                    eliminated.push(p.penguinIndex);
                }
            }
        }

        if (this.multiplayer && network) {
            if (network.isHost) {
                network.reportRoundResults(eliminated);
            }
            this.state = States.SLIDING;
        } else {
            const alive = this.penguins.filter(p => p.alive);
            if (alive.length <= 1) {
                this.gameOverPending = true;
                this.gameOverDelay = 0;
                this.transition(States.SLIDING);
            } else {
                this.startNewRound();
            }
        }
    }

    getAlivePenguins() {
        return this.penguins.filter(p => p.alive);
    }

    isPlayerAlive() {
        const player = this.penguins.find(p => p.isPlayer);
        return player ? player.alive : false;
    }

    getWinner() {
        const alive = this.getAlivePenguins();
        if (alive.length === 1) return alive[0];
        if (alive.length === 0) return null;
        return null;
    }

    reset() {
        this.state = States.MENU;
        this.round = 0;
        this.penguins = [];
        this.gameOverPending = false;
        this.gameOverDelay = 0;
    }
}
