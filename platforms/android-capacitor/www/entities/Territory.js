import Phaser from 'phaser';
import { CONFIG } from '../config.js';

export default class Territory extends Phaser.GameObjects.Container {
    constructor(scene, x, y) {
        super(scene, x, y);

        this.scene = scene;
        this.faction = CONFIG.FACTIONS.NEUTRAL;
        this.captureProgress = 0;
        this.capturingFaction = null;
        this.spawnTimer = 0;
        this.radius = 200;

        this._enemyBrainTimer = 0;
        this._lastEnemyRoleShuffle = 0;
        this._pulseTimer = 0;
        this._counterAttackTimer = 0;
        this._lastCounterFlash = 0;

        this.base = scene.add.sprite(0, 0, 'follicle');
        this.base.setDisplaySize(120, 120);
        this.add(this.base);

        // Physical collision for the visible turf object only.
        // The large capture circle remains walkable, but the follicle image itself now blocks movement.
        this.blocker = scene.add.zone(x, y, 112, 112);
        scene.physics.add.existing(this.blocker, true);
        if (this.blocker.body?.setCircle) {
            this.blocker.body.setCircle(48, 8, 8);
        }
        if (scene.follicles) {
            scene.follicles.add(this.blocker);
        }

        this.circle = scene.add.graphics();
        this.updateCircle(0xcccccc);
        this.add(this.circle);

        this.progressBar = scene.add.graphics();
        this.add(this.progressBar);

        this.spawnBar = scene.add.graphics();
        this.add(this.spawnBar);

        scene.add.existing(this);
    }

    updateCircle(color) {
        this.circle.clear();
        this.circle.lineStyle(4, color, 0.5);
        this.circle.strokeCircle(0, 0, this.radius);
        this.circle.fillStyle(color, 0.1);
        this.circle.fillCircle(0, 0, this.radius);
    }

    update(time, delta) {
        this.updateCapture(delta);
        this.updateSpawning(delta);
        this.updateEnemyTurfAI(time, delta);
        this._updateEnemyTurfCounterAttack(time, delta);
    }

    updateCapture(delta) {
        if (!this.scene || !this.scene.player) return;

        const presence = this._getFactionPresence();
        let factionInRange = presence.faction;

        const protectedAgainstPresence = this._isProtectedAgainst(factionInRange);
        if (protectedAgainstPresence) {
            this.captureProgress = Math.max(0, this.captureProgress - delta * 1.0);
            this.circle.setAlpha(0.85);
            this.updateCircle(this.getFactionColor());
            this.drawProgress();
            return;
        }

        if (presence.contested) {
            this.captureProgress = Math.max(0, this.captureProgress - delta * 0.75);
            this.drawProgress();
            return;
        }

        const isProtected = false;

        if (factionInRange && factionInRange !== this.faction && !isProtected) {
            if (this.capturingFaction !== factionInRange) {
                this.capturingFaction = factionInRange;
                this.captureProgress = 0;
            }

            const speedMult = this._getCaptureSpeedMultiplier(factionInRange, presence.count);
            this.captureProgress += delta * speedMult;

            const captureTime = this._getCaptureTimeForFaction(factionInRange);
            if (this.captureProgress >= captureTime) {
                this.setFaction(factionInRange);
                this.captureProgress = 0;
                this.capturingFaction = null;
            }
        } else {
            this.captureProgress = Math.max(0, this.captureProgress - delta * 0.5);
        }

        if (isProtected) {
            this.circle.setAlpha(0.8);
            if (Math.random() < 0.1) {
                this.circle.lineStyle(6, 0xffffff, 1);
                this.circle.strokeCircle(0, 0, this.radius);
            } else {
                this.updateCircle(this.getFactionColor());
            }
        } else {
            this.circle.setAlpha(0.5);
        }

        this.drawProgress();
    }

    _getFactionPresence() {
        const counts = new Map();

        const addPresence = (faction, weight = 1) => {
            if (!faction || faction === CONFIG.FACTIONS.NEUTRAL) return;
            counts.set(faction, (counts.get(faction) || 0) + weight);
        };

        const player = this.scene.player;
        if (player && player.active) {
            const d = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
            if (d < this.radius) addPresence(CONFIG.FACTIONS.PLAYER, 3);

            player.followers?.forEach(f => {
                if (!f || !f.active || f.isDead) return;
                const fd = Phaser.Math.Distance.Between(this.x, this.y, f.x, f.y);
                if (fd < this.radius) addPresence(CONFIG.FACTIONS.PLAYER, 1);
            });
        }

        this.scene.enemies?.forEach(enemy => {
            if (!enemy || !enemy.active) return;
            const d = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
            if (d < this.radius) addPresence(enemy.faction, 3);

            enemy.followers?.forEach(f => {
                if (!f || !f.active || f.isDead) return;
                const fd = Phaser.Math.Distance.Between(this.x, this.y, f.x, f.y);
                if (fd < this.radius) addPresence(enemy.faction, 1);
            });
        });

        if (this.scene.units) {
            this.scene.units.children.each(u => {
                if (!u || !u.active || u.isDead) return;
                if (u.faction !== CONFIG.FACTIONS.PLAYER && !this._isEnemyFactionValue(u.faction)) return;
                const d = Phaser.Math.Distance.Between(this.x, this.y, u.x, u.y);
                if (d < this.radius) addPresence(u.faction, 1);
            });
        }

        let bestFaction = null;
        let bestCount = 0;
        let tied = false;

        counts.forEach((count, faction) => {
            if (count > bestCount) {
                bestCount = count;
                bestFaction = faction;
                tied = false;
            } else if (count === bestCount && count > 0) {
                tied = true;
            }
        });

        return {
            faction: tied ? null : bestFaction,
            count: bestCount,
            contested: tied && counts.size > 1
        };
    }

    _isProtectedAgainst(factionInRange) {
        if (!factionInRange) return false;
        if (this.faction === CONFIG.FACTIONS.NEUTRAL) return false;
        if (factionInRange === this.faction) return false;

        // A claimed turf cannot be taken while the owner still has defenders inside it.
        // The attacker must clear the defending soldiers/units before capture progress can begin.
        return this._getDefenderCountInside(this.faction) > 0;
    }

    _hasHostilePresenceInside(ownerFaction) {
        if (!ownerFaction || ownerFaction === CONFIG.FACTIONS.NEUTRAL) return false;

        const isHostile = (faction) => {
            return faction && faction !== CONFIG.FACTIONS.NEUTRAL && faction !== ownerFaction;
        };

        const inTurf = (obj) => {
            return obj && obj.active && !obj.isDead &&
                Phaser.Math.Distance.Between(this.x, this.y, obj.x, obj.y) < this.radius;
        };

        if (ownerFaction !== CONFIG.FACTIONS.PLAYER && this.scene.player && inTurf(this.scene.player)) {
            return true;
        }

        let hostileFound = false;

        this.scene.player?.followers?.forEach(f => {
            if (!hostileFound && isHostile(CONFIG.FACTIONS.PLAYER) && inTurf(f)) hostileFound = true;
        });

        this.scene.enemies?.forEach(enemy => {
            if (hostileFound || !enemy || !enemy.active) return;
            if (isHostile(enemy.faction) && inTurf(enemy)) {
                hostileFound = true;
                return;
            }

            enemy.followers?.forEach(f => {
                if (!hostileFound && isHostile(enemy.faction) && inTurf(f)) hostileFound = true;
            });
        });

        this.scene.units?.children?.entries?.forEach(u => {
            if (!hostileFound && u && isHostile(u.faction) && inTurf(u)) hostileFound = true;
        });

        return hostileFound;
    }

    _getDefenderCountInside(ownerFaction) {
        if (!ownerFaction || ownerFaction === CONFIG.FACTIONS.NEUTRAL) return 0;

        let count = 0;

        const inTurf = (obj) => {
            return obj && obj.active && !obj.isDead &&
                Phaser.Math.Distance.Between(this.x, this.y, obj.x, obj.y) < this.radius;
        };

        if (ownerFaction === CONFIG.FACTIONS.PLAYER) {
            // Count player army members from player.followers and all player-faction units.
            // This includes idle soldiers spawned by a player-owned turf.
            const seen = new Set();

            this.scene.player?.followers?.forEach(f => {
                if (inTurf(f)) {
                    seen.add(f);
                    count++;
                }
            });

            this.scene.units?.children?.entries?.forEach(u => {
                if (seen.has(u)) return;
                if (u && u.faction === CONFIG.FACTIONS.PLAYER && inTurf(u)) {
                    count++;
                }
            });

            return count;
        }

        this.scene.enemies?.forEach(enemy => {
            if (!enemy || !enemy.active || enemy.faction !== ownerFaction) return;

            if (inTurf(enemy)) count += 2;

            enemy.followers?.forEach(f => {
                if (inTurf(f)) count++;
            });
        });

        if (this.scene.units) {
            this.scene.units.children.entries.forEach(u => {
                if (u && u.faction === ownerFaction && inTurf(u)) count++;
            });
        }

        return count;
    }

    _getCaptureSpeedMultiplier(faction, count = 1) {
        const helperBonus = Math.min(1.6, Math.max(0, count - 1) * 0.18);

        if (faction === CONFIG.FACTIONS.PLAYER) {
            return 1 + helperBonus;
        }

        if (this._isEnemyFactionValue(faction)) {
            const diffBonus = this.scene.difficulty === 2 ? 0.45 : (this.scene.difficulty === 0 ? 0.10 : 0.25);
            return 1.25 + diffBonus + helperBonus;
        }

        return 1;
    }

    _getCaptureTimeForFaction(faction) {
        const base = CONFIG.TERRITORY_CAPTURE_TIME;
        if (faction === CONFIG.FACTIONS.PLAYER) return base;

        if (this._isEnemyFactionValue(faction)) {
            const diffMult = this.scene.difficulty === 2 ? 0.72 : (this.scene.difficulty === 0 ? 0.90 : 0.82);
            return Math.max(2200, base * diffMult);
        }

        return base;
    }

    getFactionColor() {
        return this._getColorForFaction(this.faction);
    }

    _getColorForFaction(faction) {
        return faction === CONFIG.FACTIONS.PLAYER ? 0xff3333 :
               faction === CONFIG.FACTIONS.BLUE ? 0x3333ff :
               faction === CONFIG.FACTIONS.GREEN ? 0x33ff33 :
               faction === CONFIG.FACTIONS.PURPLE ? 0xbb33ff :
               faction === CONFIG.FACTIONS.ORANGE ? 0xff8800 : 0xcccccc;
    }

    _isEnemyFactionValue(faction) {
        return faction === CONFIG.FACTIONS.BLUE ||
               faction === CONFIG.FACTIONS.GREEN ||
               faction === CONFIG.FACTIONS.PURPLE ||
               faction === CONFIG.FACTIONS.ORANGE;
    }

    drawProgress() {
        this.progressBar.clear();
        if (this.captureProgress > 0) {
            const color = this._getColorForFaction(this.capturingFaction);
            this.progressBar.lineStyle(6, color, 1);
            const captureTime = this._getCaptureTimeForFaction(this.capturingFaction);
            const angle = (this.captureProgress / captureTime) * Math.PI * 2;
            this.progressBar.beginPath();
            this.progressBar.arc(0, 0, 70, -Math.PI / 2, -Math.PI / 2 + angle, false);
            this.progressBar.strokePath();
        }

        this.spawnBar.clear();
        if (this.faction !== CONFIG.FACTIONS.NEUTRAL) {
            const interval = this._getSpawnInterval();
            const progress = Phaser.Math.Clamp(this.spawnTimer / interval, 0, 1);
            this.spawnBar.fillStyle(0x000000, 0.5);
            this.spawnBar.fillRect(-50, 60, 100, 10);
            this.spawnBar.fillStyle(this.getFactionColor(), 1);
            this.spawnBar.fillRect(-50, 60, 100 * progress, 10);
        }
    }

    setFaction(faction) {
        this.faction = faction;
        const color = this.getFactionColor();
        this.updateCircle(color);
        this.base.setTint(color);
        this.scene.tweens.add({ targets: this.base, scale: 1.5, duration: 200, yoyo: true });
        this.spawnTimer = 0;
        this._enemyBrainTimer = 0;
        if (this.scene.onTurfCaptured) {
            this.scene.onTurfCaptured(this, faction);
        }
    }

    _isEnemyFaction() {
        return this._isEnemyFactionValue(this.faction);
    }

    _getDifficultyMultiplier() {
        if (this.scene.difficulty === 0) return 0.85;
        if (this.scene.difficulty === 2) return 1.35;
        return 1.0;
    }

    _getSpawnInterval() {
        const base = CONFIG.SPAWN_INTERVAL;
        // Player turfs now spawn at half speed to prevent huge armies from snowballing too quickly.
        if (this.faction === CONFIG.FACTIONS.PLAYER) return base * 2;

        if (this._isEnemyFaction()) {
            const diff = this._getDifficultyMultiplier();
            const stageBoost = 1 + (this.scene.stageIndex || 0) * 0.055;
            const speedMultiplier = diff * stageBoost;
            return Math.max(2200, base / (1.25 * speedMultiplier));
        }

        return base;
    }

    _getLocalCapacity() {
        const playerStr = Math.floor(this.scene.player?.strength || 1);
        const playerCapacity = Math.min(CONFIG.MAX_TURF_CAPACITY, CONFIG.BASE_TURF_CAPACITY + Math.max(0, playerStr - 1));

        if (this.faction === CONFIG.FACTIONS.PLAYER) {
            return playerCapacity;
        }

        if (this._isEnemyFaction()) {
            const diffBonus = this.scene.difficulty === 2 ? 4 : (this.scene.difficulty === 0 ? 1 : 2);
            const stageBonus = Math.max(1, Math.floor((this.scene.stageIndex || 0) * 1.5));
            return Math.min(CONFIG.MAX_TURF_CAPACITY + 8, CONFIG.BASE_TURF_CAPACITY + diffBonus + stageBonus);
        }

        return playerCapacity;
    }

    updateSpawning(delta) {
        if (this.faction === CONFIG.FACTIONS.NEUTRAL) return;

        const currentCapacity = this._getLocalCapacity();
        const localRadius = this._isEnemyFaction() ? this.radius * 2.1 : this.radius * 1.5;

        const localUnits = this.scene.units.children.entries.filter(u => {
            return u && u.active && u.faction === this.faction && Phaser.Math.Distance.Between(this.x, this.y, u.x, u.y) < localRadius;
        });

        if (localUnits.length < currentCapacity) {
            this.spawnTimer += delta;
            const interval = this._getSpawnInterval();
            if (this.spawnTimer >= interval) {
                this.spawnTimer = 0;
                const newChigga = this.scene.spawnChigga(this.x + (Math.random() - 0.5) * 130, this.y + (Math.random() - 0.5) * 130, this.faction);
                if (newChigga) {
                    newChigga.homeTurf = this;
                    newChigga._enemyRole = this._isEnemyFaction() ? this._chooseEnemyRole(localUnits.length) : 'defend';
                    newChigga._roleUntil = this.scene.time.now + 6000 + Math.random() * 7000;
                    newChigga.body?.setImmovable(false);
                }
            }
        }
    }

    _chooseEnemyRole(localCount = 0) {
        const r = Math.random();
        const difficulty = this.scene.difficulty || 1;

        if (localCount < 2 + difficulty) return 'defend';

        if (difficulty === 2) {
            if (r < 0.34) return 'hunt';
            if (r < 0.68) return 'patrol';
            return 'defend';
        }

        if (difficulty === 0) {
            if (r < 0.16) return 'hunt';
            if (r < 0.38) return 'patrol';
            return 'defend';
        }

        if (r < 0.25) return 'hunt';
        if (r < 0.55) return 'patrol';
        return 'defend';
    }

    updateEnemyTurfAI(time, delta) {
        if (!this._isEnemyFaction() || !this.scene || !this.scene.units) return;

        this._enemyBrainTimer += delta;
        const brainInterval = this.scene.difficulty === 2 ? 1200 : (this.scene.difficulty === 0 ? 2300 : 1700);
        if (this._enemyBrainTimer < brainInterval) return;
        this._enemyBrainTimer = 0;

        const localUnits = this.scene.units.children.entries.filter(u => {
            return u && u.active && !u.isDead && u.faction === this.faction &&
                Phaser.Math.Distance.Between(this.x, this.y, u.x, u.y) < this.radius * 3.4;
        });

        if (localUnits.length === 0) return;

        localUnits.forEach((unit, index) => {
            if (!unit || !unit.active || unit._raidTarget) return;
            if (!unit.homeTurf) unit.homeTurf = this;

            if (!unit._enemyRole || !unit._roleUntil || time > unit._roleUntil) {
                unit._enemyRole = this._chooseEnemyRole(localUnits.length);
                unit._roleUntil = time + 4500 + Math.random() * 8500;
                this._assignRoleTarget(unit, index);
            }

            this._runEnemyRole(unit, time, index, localUnits.length);
        });
    }

    _assignRoleTarget(unit, index = 0) {
        if (!unit || !unit.active) return;

        if (unit._enemyRole === 'patrol') {
            const angle = Math.random() * Math.PI * 2;
            const dist = this.radius * (1.6 + Math.random() * 2.4);
            unit._patrolX = Phaser.Math.Clamp(this.x + Math.cos(angle) * dist, 90, CONFIG.WORLD_SIZE - 90);
            unit._patrolY = Phaser.Math.Clamp(this.y + Math.sin(angle) * dist, 90, CONFIG.WORLD_SIZE - 90);
        }

        if (unit._enemyRole === 'hunt') {
            unit._huntTarget = this._findNearbyWild(unit) || null;
        }
    }

    _runEnemyRole(unit, time, index, total) {
        if (!unit || !unit.body || !unit.active) return;

        const playerThreat = this._getNearestPlayerIntruder(unit, this.radius * 2.0);

        if (playerThreat) {
            unit.target = playerThreat;
            if (unit.updateAttack) unit.updateAttack();
            return;
        }

        if (unit._enemyRole === 'hunt') {
            if (!unit._huntTarget || !unit._huntTarget.active || unit._huntTarget.isDead || unit._huntTarget.faction !== CONFIG.FACTIONS.WILD) {
                unit._huntTarget = this._findNearbyWild(unit);
            }

            if (unit._huntTarget && unit._huntTarget.active) {
                unit.target = unit._huntTarget;
                if (unit.updateAttack) unit.updateAttack();
                return;
            }

            unit._enemyRole = 'patrol';
            unit._roleUntil = time + 3500 + Math.random() * 4000;
            this._assignRoleTarget(unit, index);
        }

        if (unit._enemyRole === 'patrol') {
            if (unit._patrolX === undefined || unit._patrolY === undefined) {
                this._assignRoleTarget(unit, index);
            }

            const dx = unit._patrolX - unit.x;
            const dy = unit._patrolY - unit.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 35) {
                const speed = 110 + (this.scene.difficulty || 1) * 28;
                unit.stopFloat?.();
                unit.body.setImmovable(false);
                unit.body.setVelocity((dx / dist) * speed, (dy / dist) * speed);
                return;
            }

            unit._enemyRole = 'defend';
            unit._roleUntil = time + 3500 + Math.random() * 5000;
        }

        const slotAngle = (index / Math.max(1, total)) * Math.PI * 2 + Math.sin(time * 0.0007 + index) * 0.35;
        const defendRadius = this.radius * (0.45 + (index % 4) * 0.12);
        const tx = this.x + Math.cos(slotAngle) * defendRadius;
        const ty = this.y + Math.sin(slotAngle) * defendRadius;
        const dx = tx - unit.x;
        const dy = ty - unit.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 30) {
            const speed = 95;
            unit.stopFloat?.();
            unit.body.setImmovable(false);
            unit.body.setVelocity((dx / dist) * speed, (dy / dist) * speed);
        } else {
            unit.body.setVelocity(0, 0);
            unit.body.setImmovable(true);
        }
    }

    _getPlayerIntruders(searchRadius = this.radius * 1.35) {
        const intruders = [];
        const player = this.scene?.player;
        if (!player || !player.active) return intruders;

        const playerDist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        if (playerDist < searchRadius) {
            intruders.push({
                obj: player,
                dist: playerDist,
                priority: 2
            });
        }

        player.followers?.forEach(f => {
            if (!f || !f.active || f.isDead) return;
            const d = Phaser.Math.Distance.Between(this.x, this.y, f.x, f.y);
            if (d < searchRadius) {
                intruders.push({
                    obj: f,
                    dist: d,
                    priority: 1
                });
            }
        });

        intruders.sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            return a.dist - b.dist;
        });

        return intruders.map(i => i.obj);
    }

    _getNearestPlayerIntruder(fromObj = this, searchRadius = this.radius * 2.0) {
        const intruders = this._getPlayerIntruders(searchRadius);
        let best = null;
        let bestDist = Infinity;

        intruders.forEach(target => {
            if (!target || !target.active) return;
            const d = Phaser.Math.Distance.Between(fromObj.x, fromObj.y, target.x, target.y);
            if (d < bestDist) {
                best = target;
                bestDist = d;
            }
        });

        return best;
    }

    _getLocalEnemyDefenders(searchRadius = this.radius * 1.45) {
        if (!this._isEnemyFaction() || !this.scene?.units) return [];

        return this.scene.units.children.entries.filter(u => {
            return u && u.active && !u.isDead && u.faction === this.faction &&
                Phaser.Math.Distance.Between(this.x, this.y, u.x, u.y) < searchRadius;
        });
    }

    _getCounterAttackDamage(defenderCount = 1) {
        const difficultyMult = this.scene.difficulty === 2 ? 1.45 : (this.scene.difficulty === 0 ? 0.75 : 1.0);
        const stageMult = 1 + (this.scene.stageIndex || 0) * 0.16;
        const defenderMult = 1 + Math.min(0.8, Math.max(0, defenderCount - 1) * 0.12);

        return Math.max(3, Math.round(5 * difficultyMult * stageMult * defenderMult));
    }

    _updateEnemyTurfCounterAttack(time, delta) {
        if (!this._isEnemyFaction() || !this.scene || !this.scene.player) return;

        const intruders = this._getPlayerIntruders(this.radius * 1.28);
        if (intruders.length === 0) {
            this._counterAttackTimer = 0;
            return;
        }

        const defenders = this._getLocalEnemyDefenders(this.radius * 1.55);
        if (defenders.length === 0) return;

        // Make local defenders actively dogpile the invading army instead of waiting passively.
        defenders.slice(0, 7).forEach(defender => {
            if (!defender || !defender.active || !defender.body) return;
            const target = this._getNearestPlayerIntruder(defender, this.radius * 1.75);
            if (!target) return;

            defender.body.setImmovable(false);
            defender.target = target;
            if (defender.updateAttack) defender.updateAttack();
        });

        const interval = this.scene.difficulty === 2 ? 620 : (this.scene.difficulty === 0 ? 1050 : 820);
        this._counterAttackTimer += delta;
        if (this._counterAttackTimer < interval) return;
        this._counterAttackTimer = 0;

        const preferredTargets = intruders.filter(t => t !== this.scene.player && t.active && !t.isDead);
        const targetPool = preferredTargets.length > 0 ? preferredTargets : intruders;
        const target = targetPool[Math.floor(Math.random() * targetPool.length)];
        if (!target || !target.active) return;

        const damage = this._getCounterAttackDamage(defenders.length);

        if (target.takeDamage) {
            target.takeDamage(damage, defenders[0]);
        }

        if (this.scene.createImpactEffect) {
            this.scene.createImpactEffect(target.x, target.y, this.getFactionColor(), 'punch', damage, target === this.scene.player);
        }

        if (time - this._lastCounterFlash > 1200) {
            this._lastCounterFlash = time;
            this.circle.setAlpha(1);
            if (this.scene.showFeedback && Math.random() < 0.35) {
                this.scene.showFeedback('TURF DEFENDED!', this.getFactionColor(), this.x, this.y - 105);
            }
        }
    }

    _findNearbyWild(unit) {
        let best = null;
        let bestDist = Infinity;
        const searchRadius = 1300 + (this.scene.stageIndex || 0) * 120;

        this.scene.units.children.entries.forEach(candidate => {
            if (!candidate || !candidate.active || candidate.isDead) return;
            if (candidate.faction !== CONFIG.FACTIONS.WILD) return;
            const d = Phaser.Math.Distance.Between(unit.x, unit.y, candidate.x, candidate.y);
            if (d < searchRadius && d < bestDist) {
                best = candidate;
                bestDist = d;
            }
        });

        return best;
    }
}