/**
 * AudioManager — Pure Web Audio API procedural sounds.
 * No external dependencies. Works in all browsers immediately.
 */

let _ctx = null;
let _ready = false;

const SETTINGS_KEY = 'chiggas_settings_v1';
const DEFAULT_AUDIO_SETTINGS = {
    masterVolume: 1,
    musicVolume: 1,
    sfxVolume: 1
};

let _sfxOutput = null;

function readAudioSettings() {
    try {
        const raw = window.localStorage.getItem(SETTINGS_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        if (!parsed.__volumeCalibrated92C) {
            ['masterVolume', 'musicVolume', 'sfxVolume'].forEach(key => {
                const value = Number(parsed[key]);
                if (!Number.isFinite(value) || value >= 0.74) parsed[key] = 1;
            });
            parsed.__volumeCalibrated92C = true;
            try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(parsed)); } catch (_) {}
        }
        return { ...DEFAULT_AUDIO_SETTINGS, ...parsed };
    } catch (e) {
        return { ...DEFAULT_AUDIO_SETTINGS };
    }
}

function clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
}

function getSfxVolume() {
    const settings = readAudioSettings();
    return clamp01(settings.masterVolume) * clamp01(settings.sfxVolume);
}

function getMusicVolume() {
    const settings = readAudioSettings();
    // CHIGGAS_PASS_92A_MUSIC_BOOST_GET_BEGIN
    const __chiggasBaseMusicVolume92A = clamp01(settings.masterVolume) * clamp01(settings.musicVolume);
    return Math.min(1, __chiggasBaseMusicVolume92A * 2.45);
    // CHIGGAS_PASS_92A_MUSIC_BOOST_GET_END
}

function getSfxOutput() {
    const ctx = getCtx();
    if (!_sfxOutput) {
        _sfxOutput = ctx.createGain();
        _sfxOutput.connect(ctx.destination);
    }
    _sfxOutput.gain.value = getSfxVolume();
    return _sfxOutput;
}

function refreshSampleVolumes() {
    try {
        _sampleAudio.forEach(audio => {
            if (!audio) return;
            const base = Number(audio.dataset?.baseVolume || 1);
            audio.volume = Math.max(0, Math.min(1, base * getSfxVolume()));
        });
    } catch (e) {}
}

export function refreshAudioVolumes() {
    try {
        if (_sfxOutput) _sfxOutput.gain.value = getSfxVolume();
        // CHIGGAS_PASS_92A_MUSIC_BOOST_REFRESH_BEGIN
        if (_musicGain) _musicGain.gain.value = 0.75 * getMusicVolume();
        // CHIGGAS_PASS_92A_MUSIC_BOOST_REFRESH_END
        refreshSampleVolumes();
        _updateWeatherGain?.();
    } catch (e) {}
}


let _weatherGain = null;
let _weatherNodes = [];

function _updateWeatherGain() {
    if (_weatherGain) _weatherGain.gain.value = 0.18 * getSfxVolume();
}

export function stopWeatherAmbience() {
    try {
        _weatherNodes.forEach(node => {
            try { node.stop?.(); } catch (e) {}
            try { node.disconnect?.(); } catch (e) {}
        });
        _weatherNodes = [];

        if (_weatherGain) {
            try { _weatherGain.disconnect(); } catch (e) {}
            _weatherGain = null;
        }
    } catch (e) {}
}

export function startRainAmbience(volume = 0.8) {
    if (!_ready) return;
    stopWeatherAmbience();

    try {
        const ctx = getCtx();
        _weatherGain = ctx.createGain();
        _weatherGain.gain.value = 0.16 * volume * getSfxVolume();
        _weatherGain.connect(ctx.destination);

        const bufferSize = 2 * ctx.sampleRate;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.45;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        noise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 900;

        noise.connect(filter);
        filter.connect(_weatherGain);
        noise.start();

        _weatherNodes.push(noise, filter);
    } catch (e) {}
}

export function startSnowWindAmbience(volume = 0.8) {
    if (!_ready) return;
    stopWeatherAmbience();

    try {
        const ctx = getCtx();
        _weatherGain = ctx.createGain();
        _weatherGain.gain.value = 0.18 * volume * getSfxVolume();
        _weatherGain.connect(ctx.destination);

        const bufferSize = 3 * ctx.sampleRate;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.28;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        noise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 420;
        filter.Q.value = 0.8;

        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = 0.16;
        lfoGain.gain.value = 180;
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);

        noise.connect(filter);
        filter.connect(_weatherGain);
        noise.start();
        lfo.start();

        _weatherNodes.push(noise, filter, lfo, lfoGain);
    } catch (e) {}
}

export function playVolumeTick(volume = 0.65) {
    if (!_ready) return;

    try {
        const ctx = getCtx();
        const t = now();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(640, t);
        osc.frequency.exponentialRampToValueAtTime(980, t + 0.045);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.exponentialRampToValueAtTime(0.22 * volume, t + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

        osc.connect(gain);
        gain.connect(getSfxOutput());

        osc.start(t);
        osc.stop(t + 0.14);
    } catch (e) {}
}

function getCtx() {
    if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
    return _ctx;
}

export async function initAudio() {
    if (_ready) return;
    try {
        const ctx = getCtx();
        if (ctx.state === 'suspended') await ctx.resume();
        _ready = true;
    } catch (e) { /* silently ignore */ }
}

function now() { return getCtx().currentTime; }

const _sampleAudio = new Map();

function playSample(path, volume = 1) {
    if (!_ready || volume <= 0 || getSfxVolume() <= 0) return;

    try {
        let audio = _sampleAudio.get(path);

        if (!audio) {
            audio = new Audio(path);
            audio.preload = 'auto';
            _sampleAudio.set(path, audio);
        }

        audio.pause();
        audio.currentTime = 0;
        audio.dataset.baseVolume = String(volume);
        audio.volume = Math.max(0, Math.min(1, volume * getSfxVolume()));
        const playPromise = audio.play();

        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {});
        }
    } catch (e) {
        // Ignore audio errors so gameplay never crashes from sound playback.
    }
}

export function playChargeCry(volume = 1) {
    playSample('assets/audio/charge_cry.mp3', volume);
}


export function playMunch(volume = 1) {
    playSample('assets/audio/cartoon-munch.mp3', volume);
}


export function playGunshot(volume = 1, weaponType = 'pistol') {
    if (!_ready) return;

    // Prefer the loaded sample for a recognizable gunshot, but layer a tiny
    // procedural click so rapid rifle shots still feel punchy on mobile.
    playSample('assets/audio/gunshot.mp3', weaponType === 'rifle' ? Math.min(0.75, volume) : volume);

    try {
        const ctx = getCtx();
        const t = now();
        const click = ctx.createOscillator();
        const clickGain = ctx.createGain();
        click.type = 'square';
        click.frequency.setValueAtTime(weaponType === 'rifle' ? 180 : 130, t);
        click.frequency.exponentialRampToValueAtTime(55, t + 0.035);
        clickGain.gain.setValueAtTime(0.001, t);
        clickGain.gain.exponentialRampToValueAtTime((weaponType === 'rifle' ? 0.09 : 0.16) * volume, t + 0.004);
        clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
        click.connect(clickGain);
        clickGain.connect(getSfxOutput());
        click.start(t);
        click.stop(t + 0.08);
    } catch (e) {}
}

export function playSpeedGush(volume = 1) {
    if (!_ready) return;

    try {
        const ctx = getCtx();
        const t = now();
        const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * 0.34));
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            const fade = 1 - (i / bufferSize);
            data[i] = (Math.random() * 2 - 1) * fade;
        }

        const wind = ctx.createBufferSource();
        wind.buffer = noiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(360, t);
        filter.frequency.exponentialRampToValueAtTime(1320, t + 0.22);
        filter.Q.value = 0.7;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.exponentialRampToValueAtTime(0.26 * volume, t + 0.035);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.34);

        wind.connect(filter);
        filter.connect(gain);
        gain.connect(getSfxOutput());
        wind.start(t);
        wind.stop(t + 0.36);
    } catch (e) {}
}

// ─── Puss burst — wet layered pop when a turf is captured ─────────────────
export function playTurfCapture() {
    if (!_ready) return;
    try {
        const ctx = getCtx();
        const t = now();

        // Layer 1: deep thud
        const thudOsc = ctx.createOscillator();
        const thudGain = ctx.createGain();
        thudOsc.type = 'sine';
        thudOsc.frequency.setValueAtTime(90, t);
        thudOsc.frequency.exponentialRampToValueAtTime(30, t + 0.18);
        thudGain.gain.setValueAtTime(0.6, t);
        thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        thudOsc.connect(thudGain);
        thudGain.connect(getSfxOutput());
        thudOsc.start(t);
        thudOsc.stop(t + 0.25);

        // Layer 2: mid wet burst (filtered noise)
        const bufSize = ctx.sampleRate * 0.12;
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
        const noise = ctx.createBufferSource();
        noise.buffer = buf;
        const bpf = ctx.createBiquadFilter();
        bpf.type = 'bandpass';
        bpf.frequency.value = 900;
        bpf.Q.value = 5;
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.4, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        noise.connect(bpf);
        bpf.connect(noiseGain);
        noiseGain.connect(getSfxOutput());
        noise.start(t);
        noise.stop(t + 0.13);

        // Layer 3: high pop
        const popOsc = ctx.createOscillator();
        const popGain = ctx.createGain();
        popOsc.type = 'sine';
        popOsc.frequency.setValueAtTime(600, t + 0.02);
        popOsc.frequency.exponentialRampToValueAtTime(200, t + 0.08);
        popGain.gain.setValueAtTime(0.35, t + 0.02);
        popGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        popOsc.connect(popGain);
        popGain.connect(getSfxOutput());
        popOsc.start(t + 0.02);
        popOsc.stop(t + 0.12);
    } catch (e) { /* ignore audio errors */ }
}

// ─── Recruit chime — ascending two-note blip ──────────────────────────────
export function playRecruit() {
    if (!_ready) return;
    try {
        const ctx = getCtx();
        const t = now();
        [523, 659].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            const start = t + i * 0.08;
            gain.gain.setValueAtTime(0.25, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);
            osc.connect(gain);
            gain.connect(getSfxOutput());
            osc.start(start);
            osc.stop(start + 0.14);
        });
    } catch (e) {}
}

// ─── Stage advance — ascending 3-note sting ──────────────────────────────
export function playStageAdvance() {
    if (!_ready) return;
    try {
        const ctx = getCtx();
        const t = now();
        [261, 329, [392, 523]].forEach((freq, i) => {
            const freqs = Array.isArray(freq) ? freq : [freq];
            freqs.forEach(f => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'square';
                osc.frequency.value = f;
                const start = t + i * 0.18;
                gain.gain.setValueAtTime(0.18, start);
                gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
                osc.connect(gain);
                gain.connect(getSfxOutput());
                osc.start(start);
                osc.stop(start + 0.4);
            });
        });
    } catch (e) {}
}

// ─── Ambient music loop — hip-hop beat ──────────────────────────────────
let _musicNodes = null;
let _musicGain = null;

export function startAmbientMusic(intensity = 0.5, stageIndex = 0) {
    if (!_ready) return;
    stopAmbientMusic();
    try {
        const ctx = getCtx();
        _musicGain = ctx.createGain();
        _musicGain.gain.value = 0;
        // CHIGGAS_PASS_92A_MUSIC_BOOST_START_BEGIN
        _musicGain.gain.linearRampToValueAtTime(0.75 * getMusicVolume(), ctx.currentTime + 2);
        // CHIGGAS_PASS_92A_MUSIC_BOOST_START_END
        _musicGain.connect(ctx.destination);

        // Different hip-hop patterns per stage
        const patterns = [
            // Stage 1: Basic boom-bap
            ['kick', 'hihat', 'snare', 'hihat', 'kick', 'kick', 'snare', 'hihat'],
            // Stage 2: Trap-ish, more hats
            ['kick', 'hihat', 'hihat', 'snare', 'hihat', 'kick', 'snare', 'hihat', 'hihat'],
            // Stage 3: Syncopated
            ['kick', 'snare', 'hihat', 'kick', 'hihat', 'snare', 'kick', 'hihat'],
            // Stage 4: Heavy kick
            ['kick', 'kick', 'snare', 'kick', 'kick', 'hihat', 'snare', 'hihat'],
            // Stage 5: Fast chaotic
            ['kick', 'hihat', 'kick', 'snare', 'hihat', 'kick', 'snare', 'hihat', 'kick', 'hihat']
        ];
        const pattern = patterns[stageIndex % patterns.length];
        const bpms = [90, 110, 95, 85, 120];
        const bpm = bpms[stageIndex % bpms.length];
        const beatLength = 60 / bpm; 
        
        let step = 0;

        const beatInterval = setInterval(() => {
            if (!_musicGain) return;
            try {
                const t = ctx.currentTime;
                const note = pattern[step % pattern.length];
                
                if (note === 'kick') {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(150, t);
                    osc.frequency.exponentialRampToValueAtTime(30, t + 0.15);
                    gain.gain.setValueAtTime(0.8, t);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
                    osc.connect(gain);
                    gain.connect(_musicGain);
                    osc.start(t);
                    osc.stop(t + 0.35);
                } else if (note === 'snare') {
                    const bufSize = ctx.sampleRate * 0.2;
                    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
                    const data = buf.getChannelData(0);
                    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
                    const noise = ctx.createBufferSource();
                    noise.buffer = buf;
                    const filter = ctx.createBiquadFilter();
                    filter.type = 'highpass';
                    filter.frequency.value = 1000;
                    const gain = ctx.createGain();
                    gain.gain.setValueAtTime(0.6, t);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
                    noise.connect(filter);
                    filter.connect(gain);
                    gain.connect(_musicGain);
                    noise.start(t);
                    noise.stop(t + 0.2);
                    
                    // Snare tone
                    const osc = ctx.createOscillator();
                    const oscGain = ctx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(250, t);
                    oscGain.gain.setValueAtTime(0.3, t);
                    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
                    osc.connect(oscGain);
                    oscGain.connect(_musicGain);
                    osc.start(t);
                    osc.stop(t + 0.1);
                } else if (note === 'hihat') {
                    const bufSize = ctx.sampleRate * 0.05;
                    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
                    const data = buf.getChannelData(0);
                    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
                    const noise = ctx.createBufferSource();
                    noise.buffer = buf;
                    const filter = ctx.createBiquadFilter();
                    filter.type = 'highpass';
                    filter.frequency.value = 7000;
                    const gain = ctx.createGain();
                    gain.gain.setValueAtTime(0.15, t);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
                    noise.connect(filter);
                    filter.connect(gain);
                    gain.connect(_musicGain);
                    noise.start(t);
                    noise.stop(t + 0.05);
                }
                
                step++;
            } catch (e) {}
        }, beatLength * 1000 / 2); // 8th notes

        // Dark bass drone, tone changes per stage
        const bassOsc = ctx.createOscillator();
        const bassTypes = ['sawtooth', 'square', 'triangle', 'sawtooth', 'square'];
        bassOsc.type = bassTypes[stageIndex % bassTypes.length];
        const bassFreqs = [41.2, 43.65, 36.71, 32.7, 49.0]; // E1, F1, D1, C1, G1
        bassOsc.frequency.value = bassFreqs[stageIndex % bassFreqs.length]; 
        const bassFilter = ctx.createBiquadFilter();
        bassFilter.type = 'lowpass';
        bassFilter.frequency.value = 150 + stageIndex * 30;
        const bassGain = ctx.createGain();
        bassGain.gain.value = 0.2;
        bassOsc.connect(bassFilter);
        bassFilter.connect(bassGain);
        bassGain.connect(_musicGain);
        bassOsc.start();

        _musicNodes = { bassOsc, beatInterval };
    } catch (e) {}
}

export function stopAmbientMusic() {
    if (!_musicNodes) return;
    try {
        const ctx = getCtx();
        if (_musicGain) {
            _musicGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
        }
        clearInterval(_musicNodes.beatInterval);
        const nodes = _musicNodes;
        const gain = _musicGain;
        setTimeout(() => {
            try { nodes.bassOsc.stop(); } catch (e) {}
            try { if (gain) gain.disconnect(); } catch (e) {}
        }, 600);
    } catch (e) {}
    _musicNodes = null;
    _musicGain = null;
}

// ─── Attack Hit — short slap/punch ─────────────────────────────────────────
export function playHit(volume = 1) {
    if (!_ready || volume <= 0) return;
    try {
        const ctx = getCtx();
        const t = now();
        
        // Noise burst
        const bufSize = ctx.sampleRate * 0.05;
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
        const noise = ctx.createBufferSource();
        noise.buffer = buf;
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1200;
        filter.Q.value = 1;
        
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.5 * volume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(getSfxOutput());
        noise.start(t);
        noise.stop(t + 0.06);

        // Low thump
        const osc = ctx.createOscillator();
        const thumpGain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(120, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.05);
        thumpGain.gain.setValueAtTime(0.7 * volume, t);
        thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        osc.connect(thumpGain);
        thumpGain.connect(getSfxOutput());
        osc.start(t);
        osc.stop(t + 0.07);

    } catch (e) {}
}

// ─── Bite Sound — high-pitched quick snap ─────────────────────────────────
export function playBite(volume = 1) {
    if (!_ready || volume <= 0) return;
    try {
        const ctx = getCtx();
        const t = now();
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(1200, t);
        osc.frequency.exponentialRampToValueAtTime(400, t + 0.04);
        
        gain.gain.setValueAtTime(0.15 * volume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        
        // Add a tiny bit of high-pass filter for crispness
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 1500;
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(getSfxOutput());
        osc.start(t);
        osc.stop(t + 0.05);
    } catch (e) {}
}

// ─── Death — descending groan ─────────────────────────────────────────────
export function playDeath() {
    if (!_ready) return;
    try {
        const ctx = getCtx();
        const t = now();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.8);
        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
        osc.connect(gain);
        gain.connect(getSfxOutput());
        osc.start(t);
        osc.stop(t + 1.0);
    } catch (e) {}
}

// ─── Mini-game music/SFX helpers ─────────────────────────────────────────
export function startMiniGameMusic(type = 'memory') {
    // Reuse procedural ambient music with lower intensity so mini-games feel active
    // without overpowering gameplay SFX.
    const stageFlavor = type === 'maze' ? 3 : 1;
    startAmbientMusic(type === 'maze' ? 0.56 : 0.44, stageFlavor);
}

function playToneSequence(notes = [], volume = 1) {
    if (!_ready) return;
    try {
        const ctx = getCtx();
        const base = now();

        notes.forEach((note, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = note.type || 'triangle';
            osc.frequency.setValueAtTime(note.freq, base + (note.offset || i * 0.06));

            if (note.to) {
                osc.frequency.exponentialRampToValueAtTime(note.to, base + (note.offset || i * 0.06) + (note.dur || 0.12));
            }

            const start = base + (note.offset || i * 0.06);
            const dur = note.dur || 0.12;
            gain.gain.setValueAtTime(0.001, start);
            gain.gain.exponentialRampToValueAtTime((note.gain ?? 0.22) * volume, start + 0.012);
            gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

            osc.connect(gain);
            gain.connect(getSfxOutput());
            osc.start(start);
            osc.stop(start + dur + 0.03);
        });
    } catch (e) {}
}

export function playCardFlip(volume = 0.8) {
    playToneSequence([
        { freq: 420, to: 760, dur: 0.08, gain: 0.16, type: 'triangle' }
    ], volume);
}

export function playCardMatch(volume = 0.85) {
    playToneSequence([
        { freq: 523, dur: 0.10, gain: 0.18 },
        { freq: 659, offset: 0.08, dur: 0.12, gain: 0.20 },
        { freq: 784, offset: 0.16, dur: 0.16, gain: 0.22 }
    ], volume);
}

export function playCardWrong(volume = 0.75) {
    playToneSequence([
        { freq: 260, to: 140, dur: 0.18, gain: 0.20, type: 'sawtooth' }
    ], volume);
}

export function playMiniGameWin(volume = 0.9) {
    playToneSequence([
        { freq: 392, dur: 0.12, gain: 0.16 },
        { freq: 523, offset: 0.10, dur: 0.14, gain: 0.18 },
        { freq: 659, offset: 0.20, dur: 0.16, gain: 0.20 },
        { freq: 1046, offset: 0.34, dur: 0.32, gain: 0.22, type: 'square' }
    ], volume);
}

export function playMazePellet(volume = 0.55) {
    playToneSequence([
        { freq: 720, to: 940, dur: 0.045, gain: 0.10, type: 'square' }
    ], volume);
}

export function playMazePower(volume = 0.9) {
    playToneSequence([
        { freq: 330, to: 660, dur: 0.22, gain: 0.24, type: 'sawtooth' },
        { freq: 880, offset: 0.09, dur: 0.18, gain: 0.18, type: 'triangle' }
    ], volume);
}

export function playMazeEnemyEat(volume = 0.95) {
    playToneSequence([
        { freq: 980, to: 220, dur: 0.20, gain: 0.24, type: 'square' },
        { freq: 1300, offset: 0.04, to: 500, dur: 0.13, gain: 0.16, type: 'triangle' }
    ], volume);
}

export function playMazeDeath(volume = 0.9) {
    playToneSequence([
        { freq: 260, to: 80, dur: 0.35, gain: 0.28, type: 'sawtooth' }
    ], volume);
}
// CHIGGAS_GAMEPLAY_STABILITY_PASS_92B_FIXED_AUDIO_BEGIN
// Pass 92B fixed: stage music gain calibration.
const CHIGGAS_PASS_92B_STAGE_MUSIC_GAIN = 0.75;
const CHIGGAS_PASS_92B_STAGE_MUSIC_MULTIPLIER = 3.25;
// CHIGGAS_GAMEPLAY_STABILITY_PASS_92B_FIXED_AUDIO_END

// CHIGGAS_GAMEPLAY_STABILITY_PASS_92C_AUDIO_BEGIN
// Pass 92C: Volume calibration and consistent stage music startup.
const CHIGGAS_PASS_92C_STAGE_MUSIC_GAIN = 0.75;
const CHIGGAS_PASS_92C_STAGE_MUSIC_MULTIPLIER = 3.25;
// CHIGGAS_GAMEPLAY_STABILITY_PASS_92C_AUDIO_END
