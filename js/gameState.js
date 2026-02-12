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
        this.onStateChange = null;
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

    update(dt, physics) {
        switch (this.state) {
            case States.ROUND_START:
                this.roundStartTimer += dt;
                if (this.roundStartTimer >= this.roundStartDuration) {
                    this.transition(States.AIMING);
                }
                break;

            case States.SLIDING:
                this.slidingTimer += dt;
                if (physics.allSettled() || this.slidingTimer >= this.slidingTimeout) {
                    this.transition(States.CHECK_ELIMINATIONS);
                }
                break;

            case States.CHECK_ELIMINATIONS:
                this.checkEliminations(physics);
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

    checkEliminations(physics) {
        for (const p of this.penguins) {
            if (!p.alive) continue;
            if (!physics.isOnPlatform(p.body)) {
                p.alive = false;
            }
        }

        const alive = this.penguins.filter(p => p.alive);
        if (alive.length <= 1) {
            this.transition(States.GAME_OVER);
        } else {
            this.startNewRound();
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
    }
}
