export const States = {
    MENU: 'MENU',
    ROUND_INTRO: 'ROUND_INTRO',
    TURN_START: 'TURN_START',
    AIMING: 'AIMING',
    LAUNCHING: 'LAUNCHING',
    SLIDING: 'SLIDING',
    CHECK_ELIMINATIONS: 'CHECK_ELIMINATIONS',
    ROUND_END: 'ROUND_END',
    GAME_OVER: 'GAME_OVER'
};

export class GameState {
    constructor() {
        this.state = States.MENU;
        this.round = 0;
        this.turn = 0;
        this.maxRounds = 10;
        this.penguins = [];
        this.scores = {};
        this.roundWinner = null;

        // Timers
        this.slidingTimer = 0;
        this.slidingTimeout = 6;
        this.roundIntroTimer = 0;
        this.roundIntroDuration = 1.5;
        this.turnStartTimer = 0;
        this.turnStartDuration = 0.8;
        this.roundEndTimer = 0;
        this.roundEndDuration = 3.0;
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

    startGame(penguins, maxRounds = 3) {
        this.penguins = penguins;
        this.round = 0;
        this.turn = 0;
        this.maxRounds = maxRounds;
        this.scores = {};
        this.roundWinner = null;
        for (const p of penguins) {
            const id = p.id || p.playerId || String(p.penguinIndex);
            this.scores[id] = 0;
        }
        this.startNewRound();
    }

    startNewRound() {
        this.round++;
        this.turn = 0;
        this.roundIntroTimer = 0;
        this.roundWinner = null;
        // Respawn all penguins
        for (const p of this.penguins) {
            p.alive = true;
            if (p.mesh) p.mesh.visible = true;
        }
        this.transition(States.ROUND_INTRO);
    }

    startNewTurn() {
        this.turn++;
        this.turnStartTimer = 0;
        this.transition(States.TURN_START);
    }

    update(dt, physics, network = null) {
        switch (this.state) {
            case States.ROUND_INTRO:
                this.roundIntroTimer += dt;
                if (this.roundIntroTimer >= this.roundIntroDuration) {
                    this.startNewTurn();
                }
                break;

            case States.TURN_START:
                this.turnStartTimer += dt;
                if (this.turnStartTimer >= this.turnStartDuration) {
                    this.transition(States.AIMING);
                }
                break;

            case States.SLIDING:
                this.slidingTimer += dt;
                if (this.gameOverPending) {
                    this.gameOverDelay += dt;
                    if (this.gameOverDelay >= this.gameOverDelayDuration) {
                        this.gameOverPending = false;
                        this.transition(States.ROUND_END);
                    }
                } else if (physics.allSettled() || this.slidingTimer >= this.slidingTimeout) {
                    this.transition(States.CHECK_ELIMINATIONS);
                }
                break;

            case States.CHECK_ELIMINATIONS:
                this.checkEliminations(physics, network);
                break;

            case States.ROUND_END:
                this.roundEndTimer += dt;
                if (this.roundEndTimer >= this.roundEndDuration) {
                    if (this.round >= this.maxRounds) {
                        this.transition(States.GAME_OVER);
                    } else {
                        this.startNewRound();
                    }
                }
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
                // Round over - record winner
                if (alive.length === 1) {
                    this.roundWinner = alive[0];
                    const id = alive[0].id || alive[0].playerId || String(alive[0].penguinIndex);
                    this.scores[id] = (this.scores[id] || 0) + 1;
                }
                this.gameOverPending = true;
                this.gameOverDelay = 0;
                this.roundEndTimer = 0;
                this.transition(States.SLIDING);
            } else {
                this.startNewTurn();
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

    getOverallWinner() {
        let maxScore = -1;
        let winnerId = null;
        for (const [id, score] of Object.entries(this.scores)) {
            if (score > maxScore) {
                maxScore = score;
                winnerId = id;
            }
        }
        return { id: winnerId, score: maxScore };
    }

    reset() {
        this.state = States.MENU;
        this.round = 0;
        this.turn = 0;
        this.maxRounds = 10;
        this.penguins = [];
        this.scores = {};
        this.roundWinner = null;
        this.gameOverPending = false;
        this.gameOverDelay = 0;
        this.roundEndTimer = 0;
    }
}
