import Phaser from 'phaser';
import { CONFIG } from '../config.js';

export default class EnemyCommander extends Phaser.GameObjects.Container {
    constructor(scene, x, y, faction) {
        super(scene, x, y);

        this.scene = scene;
        this.faction = faction;

        const diffMult = scene.difficulty === 0 ? 0.8 : (scene.difficulty === 2 ? 1.3 : 1.0);
        const texture = this._getFactionTexture(faction);

        this.aura = scene.add.graphics();
        this.add(this.aura);

        this.sprite = scene.add.sprite(0, 0, texture);
        this._applyFactionTint();
        this.baseDisplaySize = this._getCommanderBaseSize();
        this.sprite.setDisplaySize(this.baseDisplaySize, this.baseDisplaySize);
        this.add(this.sprite);

        this.commanderBadge = scene.add.text(0, -this.baseDisplaySize * 0.62, this._getCommanderBadge(), {
            fontSize: '26px',
            fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
            color: this._getFactionTextColor(),
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(0.5);
        this.add(this.commanderBadge);

        this.followers = [];
        this.targetPoint = null;
        this.state = 'WANDERING';
        this.sizeMultiplier = 1;
        this.stateTimer = 0;
        this.homeTurfX = x;
        this.homeTurfY = y;
        this.chiggasEaten = 0;

        this._claimTarget = null;
        this._claimCommitUntil = 0;
        this._currentTarget = null;
        this._postCaptureCooldownUntil = 0;
        this._huntTarget = null;
        this._isPromotedCommander = false;

        this._growthTimer = 0;
        this.profile = this._getFactionProfile();

        const stageGrowthInterval = scene.currentStage?.enemyGrowthInterval ?? 10000;
        this.growthInterval = Math.max(2600, (stageGrowthInterval / diffMult) * (this.profile.growthIntervalMult || 1));

        const maxFollowersBase = scene.currentStage?.enemyMaxFollowers ?? 5;
        this.maxFollowers = Math.max(2, Math.round((maxFollowersBase + scene.stageIndex * 0.75) * diffMult * (this.profile.maxFollowersMult || 1)));

        this.baseMoveSpeed = CONFIG.CHIGGA_SPEED * 0.76 * diffMult * (this.profile.moveMult || 1);

        scene.physics.add.existing(this);
        this.body.setCircle(35, -35, -35);
        this.body.setCollideWorldBounds(true);

        scene.add.existing(this);
    }

    _getFactionTexture(faction) {
        if (faction === CONFIG.FACTIONS.BLUE) return 'chigga-blue';
        if (faction === CONFIG.FACTIONS.GREEN) return 'chigga-green';
        if (faction === CONFIG.FACTIONS.PURPLE) return this.scene?.textures?.exists('purple-gang-commander') ? 'purple-gang-commander' : 'chigga-blue';
        if (faction === CONFIG.FACTIONS.ORANGE) return this.scene?.textures?.exists('orange-gang-commander') ? 'orange-gang-commander' : 'chigga-green';
        return 'chigga-green';
    }

    _getFactionColor() {
        if (this.faction === CONFIG.FACTIONS.BLUE) return 0x4488ff;
        if (this.faction === CONFIG.FACTIONS.GREEN) return 0x44ff44;
        if (this.faction === CONFIG.FACTIONS.PURPLE) return 0xcc44ff;
        if (this.faction === CONFIG.FACTIONS.ORANGE) return 0xff9900;
        return 0xffffff;
    }

    _getFactionProfile() {
        if (this.faction === CONFIG.FACTIONS.GREEN) {
            return { name: 'Green Swarm', moveMult: 0.95, aggroMult: 0.9, maxFollowersMult: 1.35, recruitRateMult: 1.65, recruitRange: 390, growthIntervalMult: 0.72, growBurst: 2, expandBonus: 0.16, pressureBonus: -0.08, huntThresholdBonus: 0.10, claimCommitMult: 1.0, damageTakenMult: 1.18, huntDamageMult: 0.9 };
        }
        if (this.faction === CONFIG.FACTIONS.PURPLE) {
            return { name: 'Purple Elite', moveMult: 1.08, aggroMult: 1.28, maxFollowersMult: 0.78, recruitRateMult: 0.78, recruitRange: 320, growthIntervalMult: 1.15, growBurst: 1, expandBonus: -0.04, pressureBonus: 0.18, huntThresholdBonus: -0.08, claimCommitMult: 0.92, damageTakenMult: 0.74, huntDamageMult: 1.35 };
        }
        if (this.faction === CONFIG.FACTIONS.ORANGE) {
            return { name: 'Orange Raiders', moveMult: 1.18, aggroMult: 1.45, maxFollowersMult: 0.95, recruitRateMult: 1.05, recruitRange: 350, growthIntervalMult: 1.08, growBurst: 1, expandBonus: -0.16, pressureBonus: 0.34, huntThresholdBonus: -0.16, claimCommitMult: 0.74, damageTakenMult: 0.90, huntDamageMult: 1.18 };
        }
        return { name: 'Blue Crew', moveMult: 1.0, aggroMult: 1.0, maxFollowersMult: 1.0, recruitRateMult: 1.0, recruitRange: 340, growthIntervalMult: 1.0, growBurst: 1, expandBonus: 0, pressureBonus: 0, huntThresholdBonus: 0, claimCommitMult: 1.0, damageTakenMult: 1.0, huntDamageMult: 1.0 };
    }

    _getFactionTextColor() {
        if (this.faction === CONFIG.FACTIONS.BLUE) return '#66aaff';
        if (this.faction === CONFIG.FACTIONS.GREEN) return '#66ff66';
        if (this.faction === CONFIG.FACTIONS.PURPLE) return '#dd66ff';
        if (this.faction === CONFIG.FACTIONS.ORANGE) return '#ffaa22';
        return '#ffffff';
    }

    _getCommanderBadge() {
        if (this.faction === CONFIG.FACTIONS.BLUE) return '★';
        if (this.faction === CONFIG.FACTIONS.GREEN) return '☣';
        if (this.faction === CONFIG.FACTIONS.PURPLE) return '☠';
        if (this.faction === CONFIG.FACTIONS.ORANGE) return '🔥';
        return '★';
    }

    _getCommanderBaseSize() {
        if (this.faction === CONFIG.FACTIONS.PURPLE || this.faction === CONFIG.FACTIONS.ORANGE) return 112;
        return 84;
    }

    _applyFactionTint() {
        if (!this.sprite) return;
        if (this.faction === CONFIG.FACTIONS.PURPLE && this.sprite.texture?.key !== 'purple-gang-commander') {
            this.sprite.setTint(0xbb33ff);
        } else if (this.faction === CONFIG.FACTIONS.ORANGE && this.sprite.texture?.key !== 'orange-gang-commander') {
            this.sprite.setTint(0xff8800);
        }
    }

    _drawCommanderAura() {
        if (!this.aura) return;
        const color = this._getFactionColor();
        const pulse = 1 + Math.sin((this.scene?.time?.now || 0) * 0.008) * 0.18;
        const radius = (this.baseDisplaySize * 0.52) * pulse;

        this.aura.clear();
        this.aura.fillStyle(color, 0.13);
        this.aura.fillCircle(0, 0, radius);
        this.aura.lineStyle(4, color, 0.75);
        this.aura.strokeCircle(0, 0, radius);
        this.aura.lineStyle(2, 0xffffff, 0.35);
        this.aura.strokeCircle(0, 0, radius * 0.74);
    }

    _holdAtHomeUntilReleased(time) {
        if (!this._isStagedAtHome) return false;

        if (time >= (this._gangReleaseAt || 0)) {
            this._isStagedAtHome = false;
            this.state = 'EXPANDING';
            this.stateTimer = 500;
            return false;
        }

        const holdX = this.homeTurfX ?? this.x;
        const holdY = this.homeTurfY ?? this.y;
        const d = Phaser.Math.Distance.Between(this.x, this.y, holdX, holdY);

        if (d > 34 && this.body) {
            const angle = Phaser.Math.Angle.Between(this.x, this.y, holdX, holdY);
            this.body.setVelocity(
                Math.cos(angle) * this.baseMoveSpeed * 0.65,
                Math.sin(angle) * this.baseMoveSpeed * 0.65
            );
        } else if (this.body) {
            this.body.setVelocity(0, 0);
        }

        const remaining = Math.max(0, Math.ceil(((this._gangReleaseAt || 0) - time) / 1000));
        if (!this._lastReleaseNotice || time - this._lastReleaseNotice > 1000) {
            this._lastReleaseNotice = time;
            this.scene?.showFeedback?.(`${this._getFactionName()} MOVES IN ${remaining}`, this._getFactionColor(), this.x, this.y - 90);
        }

        return true;
    }

    _getFactionName() {
        if (this.faction === CONFIG.FACTIONS.BLUE) return 'BLUE GANG';
        if (this.faction === CONFIG.FACTIONS.GREEN) return 'GREEN GANG';
        if (this.faction === CONFIG.FACTIONS.PURPLE) return 'PURPLE GANG';
        if (this.faction === CONFIG.FACTIONS.ORANGE) return 'ORANGE GANG';
        return 'GANG';
    }

    _getStage() {
        return CONFIG.STAGES[this.scene.stageIndex] ?? CONFIG.STAGES[0];
    }

    update(time, delta) {
        if (!this.active) return;

        if (this._holdAtHomeUntilReleased(time)) {
            this.updateFollowers();
            this._drawCommanderAura();
            if (this.commanderBadge) {
                this.commanderBadge.y = -this.baseDisplaySize * 0.62 + Math.sin(time * 0.006) * 4;
            }
            return;
        }

        this.stateTimer -= delta;
        this._growthTimer += delta;

        this.think(time);
        this.moveToTarget();
        this.updateFollowers();
        this._tryGrow();
        this._drawCommanderAura();
        if (this.commanderBadge) {
            this.commanderBadge.y = -this.baseDisplaySize * 0.62 + Math.sin(time * 0.006) * 4;
        }
    }

    think(time = 0) {
        const stage = this._getStage();
        const difficulty = this.scene.difficulty || 1;
        const profile = this.profile || this._getFactionProfile();
        const aggroRange = (760 + difficulty * 90) * (profile.aggroMult || 1);

        const ownedTurfs = this.scene.territories.filter(t => t.faction === this.faction);
        const closestOwned = this._closestTurfTo(this.x, this.y, ownedTurfs);
        if (closestOwned) {
            this.homeTurfX = closestOwned.x;
            this.homeTurfY = closestOwned.y;
        }

        if (this._continueClaiming(time)) {
            this._tryRecruitNearby(stage, difficulty);
            return;
        }

        const claimableNearby = this._findClaimableTurfNearCommander();
        if (claimableNearby && time >= this._postCaptureCooldownUntil) {
            this._startClaimingTurf(claimableNearby, time);
            this._tryRecruitNearby(stage, difficulty);
            return;
        }

        const distFromHome = Phaser.Math.Distance.Between(this.x, this.y, this.homeTurfX, this.homeTurfY);
        const leashLimit = ownedTurfs.length > 0 ? 2600 : Infinity;

        let closestEnemy = null;
        let minDistToEnemy = Infinity;

        const checkEnemy = (enemy) => {
            if (!enemy || !enemy.active || enemy.isDead) return;
            const d = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
            if (d < minDistToEnemy) {
                minDistToEnemy = d;
                closestEnemy = enemy;
            }
        };

        checkEnemy(this.scene.player);
        // Enemy commanders should not aggro the boss. Roach Czar is part of the hostile ecosystem, not a player-side target.
        this.scene.enemies.forEach(e => {
            if (e !== this && e.faction !== this.faction) checkEnemy(e);
        });

        const guardingRecentCapture = time < this._postCaptureCooldownUntil;

        if (distFromHome > leashLimit) {
            this.state = 'RETURNING';
            this.targetPoint = { x: this.homeTurfX, y: this.homeTurfY };
            this._currentTarget = null;
        } else if (!guardingRecentCapture && closestEnemy && minDistToEnemy < aggroRange && !this._isStandingInClaimableTurf()) {
            this.state = 'ATTACKING';
            this.targetPoint = { x: closestEnemy.x, y: closestEnemy.y };
            this._currentTarget = closestEnemy;
        } else if (this.stateTimer <= 0) {
            this._chooseStrategicTarget(time, ownedTurfs);
        }

        this._tryRecruitNearby(stage, difficulty);
    }

    _tryRecruitNearby(stage, difficulty) {
        const profile = this.profile || this._getFactionProfile();
        const recruitRate = (stage.enemyRecruitRate ?? 0.002) * (1 + difficulty * 0.35) * (profile.recruitRateMult || 1);
        if (Math.random() >= recruitRate) return;

        const maxFollowers = this.maxFollowers;
        const recruitRange = profile.recruitRange || 340;

        this.scene.units.children.iterate(unit => {
            if (!unit || !unit.active || unit.faction !== CONFIG.FACTIONS.NEUTRAL) return;

            const d = Phaser.Math.Distance.Between(this.x, this.y, unit.x, unit.y);
            if (d < recruitRange) {
                if (this.followers.length < maxFollowers) this.recruit(unit);
                else this.eat(unit);
            }
        });
    }

    _continueClaiming(time) {
        if (!this._claimTarget || !this._claimTarget.active) {
            this._claimTarget = null;
            return false;
        }

        if (this._claimTarget.faction === this.faction) {
            const captured = this._claimTarget;
            this.homeTurfX = captured.x;
            this.homeTurfY = captured.y;
            this._claimTarget = null;
            this._currentTarget = null;

            this.state = 'POST_CAPTURE_PATROL';
            this._postCaptureCooldownUntil = time + (this.scene.difficulty === 0 ? 1800 : this.scene.difficulty === 2 ? 700 : 1100);
            this.stateTimer = 450;
            this._assignPostCapturePatrol(captured);
            return true;
        }

        const player = this.scene.player;
        const playerDist = player && player.active
            ? Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y)
            : Infinity;

        if (playerDist < this._claimTarget.radius * 0.95 && time > this._claimCommitUntil) {
            this._claimTarget = null;
            return false;
        }

        this.state = 'CLAIMING_TURF';
        this.targetPoint = { x: this._claimTarget.x, y: this._claimTarget.y };
        this._currentTarget = null;
        this.stateTimer = 2000;
        return true;
    }

    _assignPostCapturePatrol(turf) {
        if (!turf) return;

        const angle = Math.random() * Math.PI * 2;
        const dist = turf.radius * (1.25 + Math.random() * 1.2);

        this.targetPoint = {
            x: Phaser.Math.Clamp(turf.x + Math.cos(angle) * dist, 120, CONFIG.WORLD_SIZE - 120),
            y: Phaser.Math.Clamp(turf.y + Math.sin(angle) * dist, 120, CONFIG.WORLD_SIZE - 120)
        };
    }

    _isStandingInClaimableTurf() {
        return !!this._findClaimableTurfNearCommander();
    }

    _findClaimableTurfNearCommander() {
        let best = null;
        let bestDist = Infinity;

        this.scene.territories.forEach(t => {
            if (!t || t.faction === this.faction) return;

            const d = Phaser.Math.Distance.Between(this.x, this.y, t.x, t.y);
            if (d < t.radius * 0.88 && d < bestDist) {
                best = t;
                bestDist = d;
            }
        });

        return best;
    }

    _startClaimingTurf(turf, time) {
        const profile = this.profile || this._getFactionProfile();
        const claimWindow = Math.max(4200, 9000 * (profile.claimCommitMult || 1));

        this._claimTarget = turf;
        this._claimCommitUntil = time + claimWindow;
        this.state = 'CLAIMING_TURF';
        this.targetPoint = { x: turf.x, y: turf.y };
        this._currentTarget = null;
        this.stateTimer = claimWindow;
    }

    _chooseStrategicTarget(time, ownedTurfs) {
        const difficulty = this.scene.difficulty || 1;
        const r = Math.random();
        this._currentTarget = null;

        const player = this.scene.player;
        const playerThreat = player && player.active
            ? Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y)
            : Infinity;

        if (ownedTurfs.length > 0 && playerThreat < 850 + difficulty * 130) {
            this.state = 'DEFENDING';
            const closest = this._closestTurfTo(player.x, player.y, ownedTurfs) || ownedTurfs[0];
            this.targetPoint = { x: closest.x, y: closest.y };
            this.stateTimer = 2200 + Math.random() * 2600;
            return;
        }

        const neutralTargets = this.scene.territories.filter(t => t.faction === CONFIG.FACTIONS.NEUTRAL);
        const neutralNearest = this._closestTurfTo(this.x, this.y, neutralTargets);

        const profile = this.profile || this._getFactionProfile();
        const expandChance = Phaser.Math.Clamp((difficulty === 0 ? 0.42 : difficulty === 2 ? 0.78 : 0.62) + (profile.expandBonus || 0), 0.08, 0.92);
        if (neutralNearest && r < expandChance) {
            this._startClaimingTurf(neutralNearest, time);
            return;
        }

        const playerTurfs = this.scene.territories.filter(t => t.faction === CONFIG.FACTIONS.PLAYER);
        const pressureChance = Phaser.Math.Clamp((difficulty === 0 ? 0.12 : difficulty === 2 ? 0.42 : 0.26) + (profile.pressureBonus || 0), 0.02, 0.74);
        if (playerTurfs.length > 0 && r < expandChance + pressureChance) {
            const nearestPlayerTurf = this._closestTurfTo(this.x, this.y, playerTurfs);
            if (nearestPlayerTurf) {
                this._startClaimingTurf(nearestPlayerTurf, time);
                return;
            }
        }

        const huntThreshold = Phaser.Math.Clamp((difficulty === 0 ? 0.82 : difficulty === 2 ? 0.55 : 0.68) + (profile.huntThresholdBonus || 0), 0.32, 0.92);
        const shouldHunt = r > huntThreshold;
        if (shouldHunt) {
            const wild = this._findNearbyWild();
            if (wild) {
                this.state = 'HUNTING_WILD';
                this._huntTarget = wild;
                this.targetPoint = { x: wild.x, y: wild.y };
                this._currentTarget = wild;
                this.stateTimer = 3500 + Math.random() * 3500;
                return;
            }
        }

        if (ownedTurfs.length > 0) {
            const patrolTurf = ownedTurfs[Math.floor(Math.random() * ownedTurfs.length)];
            const angle = Math.random() * Math.PI * 2;
            const radius = 350 + Math.random() * (difficulty === 0 ? 550 : difficulty === 2 ? 1150 : 850);

            this.state = 'PATROLLING';
            this.targetPoint = {
                x: Phaser.Math.Clamp(patrolTurf.x + Math.cos(angle) * radius, 120, CONFIG.WORLD_SIZE - 120),
                y: Phaser.Math.Clamp(patrolTurf.y + Math.sin(angle) * radius, 120, CONFIG.WORLD_SIZE - 120)
            };
            this.stateTimer = 2200 + Math.random() * 4200;
            return;
        }

        const angle = Math.random() * Math.PI * 2;
        const radius = 450 + Math.random() * 950;
        this.state = 'PATROLLING';
        this.targetPoint = {
            x: Phaser.Math.Clamp(this.homeTurfX + Math.cos(angle) * radius, 120, CONFIG.WORLD_SIZE - 120),
            y: Phaser.Math.Clamp(this.homeTurfY + Math.sin(angle) * radius, 120, CONFIG.WORLD_SIZE - 120)
        };
        this.stateTimer = 3000 + Math.random() * 4500;
    }

    _closestTurfTo(x, y, turfs) {
        let nearest = null;
        let minDist = Infinity;

        turfs.forEach(t => {
            const d = Phaser.Math.Distance.Between(x, y, t.x, t.y);
            if (d < minDist) {
                minDist = d;
                nearest = t;
            }
        });

        return nearest;
    }

    _findNearbyWild(origin = this) {
        let best = null;
        let bestDist = Infinity;
        const searchRadius = 1300 + (this.scene.stageIndex || 0) * 140;

        this.scene.units.children.entries.forEach(candidate => {
            if (!candidate || !candidate.active || candidate.isDead) return;
            if (candidate.faction !== CONFIG.FACTIONS.WILD && candidate.faction !== CONFIG.FACTIONS.NEUTRAL) return;

            const d = Phaser.Math.Distance.Between(origin.x, origin.y, candidate.x, candidate.y);
            if (d < searchRadius && d < bestDist) {
                best = candidate;
                bestDist = d;
            }
        });

        return best;
    }

    _tryGrow() {
        const profile = this.profile || this._getFactionProfile();
        const interval = this.growthInterval || 6000;
        const maxFollowers = this.maxFollowers;

        if (this._growthTimer < interval) return;
        this._growthTimer = 0;

        if (this.followers.length >= maxFollowers) return;

        const myTurfs = this.scene.territories.filter(t => t.faction === this.faction);
        if (myTurfs.length === 0) return;

        const burst = Math.max(1, profile.growBurst || 1);
        const spawnCount = Math.min(burst, maxFollowers - this.followers.length);

        for (let i = 0; i < spawnCount; i++) {
            const myTurf = myTurfs[Math.floor(Math.random() * myTurfs.length)];
            const spawnX = myTurf.x + (Math.random() - 0.5) * 155;
            const spawnY = myTurf.y + (Math.random() - 0.5) * 155;
            const newUnit = this.scene.spawnChigga(spawnX, spawnY, CONFIG.FACTIONS.NEUTRAL);

            this.scene.time.delayedCall(100 + i * 90, () => {
                if (newUnit && newUnit.active && this.active) this.recruit(newUnit);
            });
        }
    }

    moveToTarget() {
        if (!this.targetPoint || !this.body) return;

        if (this.state === 'HUNTING_WILD' && this._huntTarget && this._huntTarget.active && !this._huntTarget.isDead) {
            this.targetPoint = { x: this._huntTarget.x, y: this._huntTarget.y };
            this._currentTarget = this._huntTarget;

            const attackDist = Phaser.Math.Distance.Between(this.x, this.y, this._huntTarget.x, this._huntTarget.y);
            if (attackDist < 80) {
                this.body.setVelocity(0, 0);
                const profile = this.profile || this._getFactionProfile();
                this._huntTarget.takeDamage?.((18 + this.chiggasEaten * 2) * (profile.huntDamageMult || 1), this);

                if (this._huntTarget.isDead || !this._huntTarget.active) {
                    this.chiggasEaten += 1;
                    this.sizeMultiplier = Math.min(3.4, this.sizeMultiplier + 0.025);
                    this.sprite.setDisplaySize(
                        this.baseDisplaySize * this.sizeMultiplier,
                        this.baseDisplaySize * this.sizeMultiplier
                    );
                    this.stateTimer = 0;
                }
                return;
            }
        }

        const speed = this.state === 'CLAIMING_TURF'
            ? this.baseMoveSpeed * 1.05
            : this.state === 'PATROLLING' || this.state === 'POST_CAPTURE_PATROL'
                ? this.baseMoveSpeed * 0.92
                : this.baseMoveSpeed;

        const angle = Phaser.Math.Angle.Between(this.x, this.y, this.targetPoint.x, this.targetPoint.y);
        const dist = Phaser.Math.Distance.Between(this.x, this.y, this.targetPoint.x, this.targetPoint.y);

        if (dist > 40) {
            this.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
        } else {
            this.body.setVelocity(0, 0);

            if (this.state === 'CLAIMING_TURF' && this._claimTarget) {
                this.targetPoint = { x: this._claimTarget.x, y: this._claimTarget.y };
            } else if (this.state === 'POST_CAPTURE_PATROL') {
                this.stateTimer = 0;
            }
        }
    }

    updateFollowers() {
        const cx = this.x;
        const cy = this.y + 90;
        const orbitRadius = 55 + this.followers.length * 8;
        const total = Math.max(1, this.followers.length);
        const shouldAttack = this.state === 'ATTACKING' || this.state === 'HUNTING_WILD';
        const target = this._currentTarget;

        this.followers = this.followers.filter(f => f && f.active && !f.isDead);

        this.followers.forEach((follower, index) => {
            if (!follower || !follower.active) return;
            if (follower._raidTarget) return;

            if (shouldAttack) follower.target = target;

            if (follower.target && follower.target.faction === 'BOSS') {
                follower.target = null;
            }

            if (follower.target && follower.target.active) {
                follower.updateAttack();
                return;
            } else {
                follower.target = null;
            }

            const slotAngle = (index / total) * Math.PI * 2;
            const slotX = cx + Math.cos(slotAngle) * orbitRadius;
            const slotY = cy + Math.sin(slotAngle) * orbitRadius;
            const dx = slotX - follower.x;
            const dy = slotY - follower.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 25) {
                const spd = Math.min(530, dist * 4.2);
                follower.body.setVelocity((dx / dist) * spd, (dy / dist) * spd);
            } else {
                follower.body.setVelocity(0, 0);
            }
        });
    }

    recruit(unit) {
        if (unit.isDead || !unit.active) return;

        unit.stopFloat?.();
        unit.setFaction(this.faction);
        unit.isRecruited = true;
        unit.body.setImmovable(false);
        unit.target = null;
        unit.homeTurf = unit.homeTurf || this.scene.territories.find(t => t.faction === this.faction) || null;

        if (!this.followers.includes(unit)) this.followers.push(unit);
    }

    eat(unit) {
        if (unit.isDead || !unit.active) return;

        this.sizeMultiplier = Math.min(3.4, this.sizeMultiplier + 0.045);
        this.chiggasEaten++;
        this.sprite.setDisplaySize(
            this.baseDisplaySize * this.sizeMultiplier,
            this.baseDisplaySize * this.sizeMultiplier
        );

        unit.stopFloat?.();
        unit.destroy();
    }

    _findReplacementCommanderCandidate() {
        let best = null;
        let bestScore = -Infinity;

        const evaluate = (unit, baseScore = 0) => {
            if (!unit || !unit.active || unit.isDead) return;
            if (unit.faction !== this.faction) return;

            const d = Phaser.Math.Distance.Between(this.x, this.y, unit.x, unit.y);
            const healthScore = (unit.health || 1) / Math.max(1, unit.maxHealth || unit.health || 1);
            const roleScore = unit._enemyRole === 'defend' ? 8 : unit._enemyRole === 'patrol' ? 5 : 3;
            const score = baseScore + healthScore * 20 + roleScore - d * 0.01;

            if (score > bestScore) {
                bestScore = score;
                best = unit;
            }
        };

        this.followers.forEach(unit => evaluate(unit, 25));

        this.scene.units?.children?.entries?.forEach(unit => {
            const d = unit && unit.active ? Phaser.Math.Distance.Between(this.x, this.y, unit.x, unit.y) : Infinity;
            if (d < 1200) evaluate(unit, 8);
        });

        return best;
    }

    _promoteReplacementCommander() {
        if (!this.scene || !this.scene.enemies) return null;

        const candidate = this._findReplacementCommanderCandidate();
        const ownedTurfs = this.scene.territories.filter(t => t.faction === this.faction);

        let spawnX = this.x;
        let spawnY = this.y;

        if (candidate && candidate.active) {
            spawnX = candidate.x;
            spawnY = candidate.y;
            candidate.stopFloat?.();
            candidate.destroy();
        } else {
            // No living same-faction unit is available to promote.
            // Do NOT spawn a replacement commander here.
            // Enemy turfs must continue using their normal spawn timer.
            return null;
        }

        const replacement = new EnemyCommander(this.scene, spawnX, spawnY, this.faction);
        replacement._isPromotedCommander = true;
        replacement.sizeMultiplier = Math.max(0.75, Math.min(1.75, this.sizeMultiplier * 0.82));
        replacement.chiggasEaten = Math.max(0, Math.floor((this.chiggasEaten || 0) * 0.5));
        replacement.sprite.setDisplaySize(
            replacement.baseDisplaySize * replacement.sizeMultiplier,
            replacement.baseDisplaySize * replacement.sizeMultiplier
        );

        const closestOwned = this._closestTurfTo(spawnX, spawnY, ownedTurfs);
        if (closestOwned) {
            replacement.homeTurfX = closestOwned.x;
            replacement.homeTurfY = closestOwned.y;
            replacement.state = 'DEFENDING';
            replacement.targetPoint = { x: closestOwned.x, y: closestOwned.y };
            replacement.stateTimer = 1600 + Math.random() * 2200;
        }

        const transfer = this.followers
            .filter(f => f && f.active && !f.isDead && f.faction === this.faction)
            .slice(0, Math.max(0, replacement.maxFollowers - 1));

        transfer.forEach(f => {
            if (!replacement.followers.includes(f)) {
                f.target = null;
                f.body?.setImmovable(false);
                replacement.followers.push(f);
            }
        });

        this.scene.enemies = this.scene.enemies.filter(e => e && e.active && e !== this);
        this.scene.enemies.push(replacement);

        if (this.scene.showFeedback) {
            this.scene.showFeedback('NEW COMMANDER!', 0x66ccff, replacement.x, replacement.y - 90);
        }

        return replacement;
    }


    _scheduleReplacementCommander(delayMs = 10000) {
        const scene = this.scene;
        const faction = this.faction;
        const deathX = this.x;
        const deathY = this.y;
        const inheritedSize = this.sizeMultiplier;
        const inheritedEaten = this.chiggasEaten || 0;

        if (!scene || !scene.time) return;

        const ownedTurfsAtDeath = (scene.territories || []).filter(t => t && t.faction === faction);
        const fallbackTurf = this._closestTurfTo(deathX, deathY, ownedTurfsAtDeath);

        scene.time.delayedCall(delayMs, () => {
            if (!scene || scene.isEnding || scene.isDead || !scene.enemies) return;

            const existingCommander = scene.enemies.some(e => {
                return e && e.active && e.faction === faction && e !== this;
            });
            if (existingCommander) return;

            let candidate = null;
            let bestDist = Infinity;

            scene.units?.children?.entries?.forEach(unit => {
                if (!unit || !unit.active || unit.isDead || unit.faction !== faction) return;
                const d = Phaser.Math.Distance.Between(deathX, deathY, unit.x, unit.y);
                if (d < bestDist) {
                    bestDist = d;
                    candidate = unit;
                }
            });

            let spawnX = deathX;
            let spawnY = deathY;

            if (candidate && candidate.active) {
                spawnX = candidate.x;
                spawnY = candidate.y;
                candidate.stopFloat?.();
                candidate.destroy();
            } else if (fallbackTurf && fallbackTurf.faction === faction) {
                spawnX = fallbackTurf.x;
                spawnY = fallbackTurf.y;
            } else {
                const ownedTurfsNow = (scene.territories || []).filter(t => t && t.faction === faction);
                const turf = ownedTurfsNow.length > 0 ? ownedTurfsNow[Math.floor(Math.random() * ownedTurfsNow.length)] : null;
                if (!turf) return;
                spawnX = turf.x;
                spawnY = turf.y;
            }

            const replacement = new EnemyCommander(scene, spawnX, spawnY, faction);
            replacement._isPromotedCommander = true;
            replacement.sizeMultiplier = Math.max(0.75, Math.min(1.75, inheritedSize * 0.82));
            replacement.chiggasEaten = Math.max(0, Math.floor(inheritedEaten * 0.5));
            replacement.sprite.setDisplaySize(
                replacement.baseDisplaySize * replacement.sizeMultiplier,
                replacement.baseDisplaySize * replacement.sizeMultiplier
            );

            const ownedTurfsNow = (scene.territories || []).filter(t => t && t.faction === faction);
            const home = replacement._closestTurfTo(spawnX, spawnY, ownedTurfsNow);
            if (home) {
                replacement.homeTurfX = home.x;
                replacement.homeTurfY = home.y;
                replacement.state = 'DEFENDING';
                replacement.targetPoint = { x: home.x, y: home.y };
                replacement.stateTimer = 1800 + Math.random() * 1800;
            }

            scene.enemies = scene.enemies.filter(e => e && e.active);
            scene.enemies.push(replacement);

            if (scene.showFeedback) {
                scene.showFeedback('COMMANDER RETURNS!', replacement._getFactionColor?.() || 0xffffff, replacement.x, replacement.y - 95);
            }
        });
    }

    takeDamage(amount, attacker) {
        if (!this.active || !this.scene) return;

        const profile = this.profile || this._getFactionProfile();
        this.sizeMultiplier -= (amount * (profile.damageTakenMult || 1)) / 920;

        if (this.sizeMultiplier < 0.3) {
            if (this.scene?.player) {
                this.scene.player.enemiesDefeated++;

                if (attacker && attacker.faction === CONFIG.FACTIONS.PLAYER) {
                    const reward = Math.max(0.35, Math.min(2.5, 0.4 + this.chiggasEaten * 0.35));
                    this.scene.player.gainStr(reward);
                    this.scene.addScore(500, this.x, this.y);
                }
            }

            if (this.scene?.createImpactEffect) this.scene.createImpactEffect(this.x, this.y, 0xff0000, 'punch', amount, false);

            this._scheduleReplacementCommander(10000);

            this.scene.enemies = this.scene.enemies.filter(e => e !== this);
            this.destroy();
            return;
        }

        this.sprite.setDisplaySize(this.baseDisplaySize * this.sizeMultiplier, this.baseDisplaySize * this.sizeMultiplier);
        const r = 35 * this.sizeMultiplier;
        this.body.setCircle(r, -r, -r);
    }
}