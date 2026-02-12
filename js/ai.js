export class AIController {
    constructor() {}

    computeShots(aiPenguins, allPenguins, platformRadius) {
        // Returns array of { penguin, dirX, dirZ, power } for each AI penguin
        // Each AI aims at the closest OTHER alive penguin with some randomness

        const shots = [];
        for (const ai of aiPenguins) {
            if (!ai.alive) continue;

            // Find all alive opponents (excluding self)
            const opponents = allPenguins.filter(p => p !== ai && p.alive);
            if (opponents.length === 0) continue;

            // Sort opponents by distance
            opponents.sort((a, b) => {
                const distA = this._dist(ai, a);
                const distB = this._dist(ai, b);
                return distA - distB;
            });

            // Target selection: 70% closest, 30% random opponent
            const targetIdx = Math.random() < 0.7 ? 0 : Math.floor(Math.random() * opponents.length);
            const target = opponents[targetIdx];

            // Calculate direction toward target
            const dx = target.mesh.position.x - ai.mesh.position.x;
            const dz = target.mesh.position.z - ai.mesh.position.z;
            const len = Math.sqrt(dx * dx + dz * dz);

            if (len < 0.01) {
                // Target is too close, pick random direction
                const angle = Math.random() * Math.PI * 2;
                let dirX = Math.cos(angle);
                let dirZ = Math.sin(angle);
                const power = Math.floor(Math.random() * 5) + 4; // 4-8
                shots.push({ penguin: ai, dirX, dirZ, power });
                continue;
            }

            let dirX = dx / len;
            let dirZ = dz / len;

            // Add randomness: +-15 degrees spread
            const spreadAngle = (Math.random() - 0.5) * 0.52; // ~30 degrees total spread
            const cos = Math.cos(spreadAngle);
            const sin = Math.sin(spreadAngle);
            const newDirX = dirX * cos - dirZ * sin;
            const newDirZ = dirX * sin + dirZ * cos;
            dirX = newDirX;
            dirZ = newDirZ;

            // Normalize after rotation
            const normLen = Math.sqrt(dirX * dirX + dirZ * dirZ);
            dirX /= normLen;
            dirZ /= normLen;

            // Power selection: typically 4-8, with distance-based adjustment
            let power = Math.floor(Math.random() * 5) + 4; // Base: 4-8

            // Increase power for distant targets
            if (len > 8) {
                power = Math.min(10, power + 2);
            } else if (len > 5) {
                power = Math.min(10, power + 1);
            }

            // Decrease power for very close targets
            if (len < 2) {
                power = Math.max(3, power - 2);
            }

            shots.push({ penguin: ai, dirX, dirZ, power });
        }
        return shots;
    }

    _dist(a, b) {
        const dx = a.mesh.position.x - b.mesh.position.x;
        const dz = a.mesh.position.z - b.mesh.position.z;
        return Math.sqrt(dx * dx + dz * dz);
    }
}
