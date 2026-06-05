import { getControlPrompt, runControlsDebugSuite, exposeControlsDebug } from './ControlsSettingsManager.js';
const STEAM_INPUT_PROMPT_VERSION = 'steam_input_prompt_manager_pass_2_v1';

const ACTION_SETS = {
    menu: {
        name: 'Menu',
        fallback: {
            navigate: { glyph: '[L]', label: 'Navigate' },
            confirm: { glyph: '[A]', label: 'Confirm' },
            back: { glyph: '[B]', label: 'Back' },
            scroll_up: { glyph: '[LB]', label: 'Scroll Up' },
            scroll_down: { glyph: '[RB]', label: 'Scroll Down' }
        }
    },
    gameplay: {
        name: 'Gameplay',
        fallback: {
            move: { glyph: '[L]', label: 'Move' },
            aim: { glyph: '[R]', label: 'Aim' },
            recruit: { glyph: '[A]', label: 'Recruit' },
            eat: { glyph: '[X]', label: 'Eat' },
            charge: { glyph: '[Y]', label: 'Charge' },
            shoot: { glyph: '[RT]', label: 'Shoot' },
            pause: { glyph: '[Menu]', label: 'Pause' },
            back: { glyph: '[B]', label: 'Back' }
        }
    },
    wardrobe: {
        name: 'Wardrobe',
        fallback: {
            navigate: { glyph: '[L]', label: 'Navigate' },
            equip: { glyph: '[A]', label: 'Equip' },
            back: { glyph: '[B]', label: 'Back' },
            scroll_up: { glyph: '[LB]', label: 'Scroll Up' },
            scroll_down: { glyph: '[RB]', label: 'Scroll Down' },
            legendary_store: { glyph: '[Y]', label: 'Legendary Store' }
        }
    },
    legendaryStore: {
        name: 'LegendaryStore',
        fallback: {
            navigate: { glyph: '[L]', label: 'Navigate' },
            purchase: { glyph: '[A]', label: 'Purchase' },
            restore_purchases: { glyph: '[X]', label: 'Restore' },
            back: { glyph: '[B]', label: 'Back' },
            scroll_up: { glyph: '[LB]', label: 'Scroll Up' },
            scroll_down: { glyph: '[RB]', label: 'Scroll Down' }
        }
    },
    miniGame: {
        name: 'MiniGame',
        fallback: {
            navigate: { glyph: '[L]', label: 'Move' },
            confirm: { glyph: '[A]', label: 'Confirm' },
            back: { glyph: '[B]', label: 'Back' },
            pause: { glyph: '[Menu]', label: 'Pause' }
        }
    }
};

const NATIVE_BRIDGE_NAMES = [
    'ChiggasSteamInput',
    'ChiggasNativeSteamInput',
    'SteamInputBridge',
    'SteamInput'
];

let activeActionSet = 'menu';
let promptManagerInitialized = false;
let lastDebugResult = null;

function getWindowSafe() {
    return typeof window !== 'undefined' ? window : null;
}

function getNativeSteamInputBridge() {
    const win = getWindowSafe();
    if (!win) return null;

    for (const name of NATIVE_BRIDGE_NAMES) {
        const bridge = win[name];
        if (bridge && typeof bridge === 'object') {
            return { name, bridge };
        }
    }

    return null;
}

function normalizeActionSet(actionSet) {
    if (!actionSet) return activeActionSet;
    if (ACTION_SETS[actionSet]) return actionSet;

    const lower = String(actionSet).toLowerCase();
    const match = Object.keys(ACTION_SETS).find(key => key.toLowerCase() === lower);
    return match || activeActionSet;
}

function normalizeAction(actionName) {
    return String(actionName || '').trim();
}

function getFallbackPrompt(actionName, options = {}) {
    const setKey = normalizeActionSet(options.actionSet || activeActionSet);
    const set = ACTION_SETS[setKey] || ACTION_SETS.menu;
    const action = normalizeAction(actionName);
    const fallback = set.fallback[action] || ACTION_SETS.gameplay.fallback[action] || ACTION_SETS.menu.fallback[action] || {
        glyph: '[?]',
        label: options.label || action || 'Action'
    };

    const label = options.label || fallback.label || action || 'Action';
    const controlPrompt = getControlPrompt(setKey, action, label, options.inputType || 'gamepad');
    const glyph = controlPrompt.glyph || fallback.glyph || '[?]';

    return {
        ok: true,
        source: 'fallback',
        actionSet: setKey,
        action,
        label,
        glyph,
        glyphText: glyph,
        promptText: controlPrompt.promptText || `${glyph} ${label}`,
        nativeBridge: null,
        controllerType: 'fallback_controller'
    };
}

function getNativePrompt(actionName, options = {}) {
    const native = getNativeSteamInputBridge();
    if (!native) return null;

    const actionSet = normalizeActionSet(options.actionSet || activeActionSet);
    const action = normalizeAction(actionName);

    try {
        if (typeof native.bridge.getPromptForAction === 'function') {
            const result = native.bridge.getPromptForAction(JSON.stringify({ actionSet, action, label: options.label || '' }));
            const parsed = typeof result === 'string' ? JSON.parse(result) : result;
            if (parsed && (parsed.glyph || parsed.glyphText || parsed.imagePath || parsed.promptText)) {
                return normalizeNativePrompt(parsed, native.name, actionSet, action, options.label);
            }
        }

        if (typeof native.bridge.getGlyphForAction === 'function') {
            const result = native.bridge.getGlyphForAction(actionSet, action);
            const parsed = typeof result === 'string' && result.trim().startsWith('{') ? JSON.parse(result) : { glyph: result };
            if (parsed && (parsed.glyph || parsed.glyphText || parsed.imagePath)) {
                return normalizeNativePrompt(parsed, native.name, actionSet, action, options.label);
            }
        }
    } catch (error) {
        return {
            ok: false,
            source: 'native_error',
            actionSet,
            action,
            error: error?.message || String(error),
            nativeBridge: native.name
        };
    }

    return null;
}

function normalizeNativePrompt(payload, nativeBridgeName, actionSet, action, fallbackLabel) {
    const fallback = getFallbackPrompt(action, { actionSet, label: fallbackLabel });
    const glyph = payload.glyph || payload.glyphText || payload.displayName || fallback.glyph;
    const label = payload.label || fallbackLabel || fallback.label;
    const promptText = payload.promptText || `${glyph} ${label}`;

    return {
        ok: true,
        source: 'native',
        actionSet,
        action,
        label,
        glyph,
        glyphText: glyph,
        imagePath: payload.imagePath || payload.glyphPath || '',
        promptText,
        nativeBridge: nativeBridgeName,
        controllerType: payload.controllerType || 'steam_input_controller'
    };
}

function getPrompt(actionName, options = {}) {
    const nativePrompt = getNativePrompt(actionName, options);
    if (nativePrompt && nativePrompt.ok) return nativePrompt;

    const fallbackPrompt = getFallbackPrompt(actionName, options);
    if (nativePrompt && !nativePrompt.ok) {
        fallbackPrompt.nativeError = nativePrompt.error;
        fallbackPrompt.nativeBridge = nativePrompt.nativeBridge;
    }
    return fallbackPrompt;
}

function getPromptLabel(actionName, label = '', options = {}) {
    return getPrompt(actionName, { ...options, label }).promptText;
}

function setActionSet(actionSet) {
    const normalized = normalizeActionSet(actionSet);
    activeActionSet = normalized;

    const native = getNativeSteamInputBridge();
    if (native && typeof native.bridge.setActionSet === 'function') {
        try {
            native.bridge.setActionSet(normalized);
        } catch (error) {
            // Keep fallback state active even if the future native bridge rejects the request.
        }
    }

    return getRuntimeInfo();
}

function getRuntimeInfo() {
    const native = getNativeSteamInputBridge();
    const actionSetKeys = Object.keys(ACTION_SETS);
    const actionCount = actionSetKeys.reduce((sum, key) => sum + Object.keys(ACTION_SETS[key].fallback).length, 0);

    return {
        version: STEAM_INPUT_PROMPT_VERSION,
        initialized: promptManagerInitialized,
        activeActionSet,
        availableActionSets: actionSetKeys,
        actionCount,
        nativeBridgeDetected: !!native,
        nativeBridgeName: native?.name || null,
        usingFallbackPrompts: !native,
        supportedNativeBridgeNames: NATIVE_BRIDGE_NAMES.slice()
    };
}

function getActionSetsMap() {
    return JSON.parse(JSON.stringify(ACTION_SETS));
}

function createPrompt(scene, actionName, label, x, y, options = {}) {
    if (!scene || !scene.add) return null;

    const prompt = getPrompt(actionName, { actionSet: options.actionSet, label });
    const fontSize = options.fontSize || 16;
    const depth = options.depth || 4200;
    const color = options.color || '#ffffff';
    const bgColor = options.backgroundColor || 0x000000;
    const bgAlpha = options.backgroundAlpha ?? 0.56;

    const container = scene.add.container(x, y).setDepth(depth).setScrollFactor(options.scrollFactor ?? 0);
    const text = scene.add.text(0, 0, prompt.promptText, {
        fontSize: `${fontSize}px`,
        fontFamily: 'Arial Black, Impact, Dhurjati, sans-serif',
        color,
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center'
    }).setOrigin(0.5);

    const padX = options.paddingX || 12;
    const padY = options.paddingY || 6;
    const bg = scene.add.graphics();
    bg.fillStyle(bgColor, bgAlpha);
    bg.fillRoundedRect(-text.width / 2 - padX, -text.height / 2 - padY, text.width + padX * 2, text.height + padY * 2, 10);
    bg.lineStyle(2, 0xffffff, 0.28);
    bg.strokeRoundedRect(-text.width / 2 - padX, -text.height / 2 - padY, text.width + padX * 2, text.height + padY * 2, 10);

    container.add([bg, text]);
    container._steamPrompt = { actionName, label, options, text, bg, padX, padY };
    return container;
}

function updatePrompt(container, actionName = null, label = null, options = {}) {
    if (!container || !container._steamPrompt) return null;

    const data = container._steamPrompt;
    data.actionName = actionName || data.actionName;
    data.label = label || data.label;
    data.options = { ...data.options, ...options };

    const prompt = getPrompt(data.actionName, { actionSet: data.options.actionSet, label: data.label });
    data.text.setText(prompt.promptText);

    data.bg.clear();
    data.bg.fillStyle(data.options.backgroundColor || 0x000000, data.options.backgroundAlpha ?? 0.56);
    data.bg.fillRoundedRect(-data.text.width / 2 - data.padX, -data.text.height / 2 - data.padY, data.text.width + data.padX * 2, data.text.height + data.padY * 2, 10);
    data.bg.lineStyle(2, 0xffffff, 0.28);
    data.bg.strokeRoundedRect(-data.text.width / 2 - data.padX, -data.text.height / 2 - data.padY, data.text.width + data.padX * 2, data.text.height + data.padY * 2, 10);

    return prompt;
}

function runDebugSuite() {
    const required = [
        ['menu', 'navigate'], ['menu', 'confirm'], ['menu', 'back'],
        ['gameplay', 'move'], ['gameplay', 'recruit'], ['gameplay', 'eat'], ['gameplay', 'charge'], ['gameplay', 'shoot'],
        ['wardrobe', 'equip'], ['legendaryStore', 'purchase'], ['legendaryStore', 'restore_purchases'],
        ['miniGame', 'confirm']
    ];

    const prompts = [];
    const missing = [];

    required.forEach(([setKey, action]) => {
        const prompt = getPrompt(action, { actionSet: setKey });
        prompts.push(prompt);
        if (!prompt || !prompt.glyphText || prompt.glyphText === '[?]') {
            missing.push(`${setKey}.${action}`);
        }
    });

    const runtime = getRuntimeInfo();
    const controls = runControlsDebugSuite();
    const ok = missing.length === 0 && controls.ok;

    lastDebugResult = {
        ok,
        status: ok ? 'steam_input_prompt_fallback_validated' : 'steam_input_prompt_fallback_incomplete',
        runtime,
        controls,
        requiredPromptCount: required.length,
        missing: missing.concat(controls.missing || []),
        samplePrompts: prompts.slice(0, 12).map(p => ({ actionSet: p.actionSet, action: p.action, promptText: p.promptText, source: p.source })),
        checkedAt: new Date().toISOString()
    };

    return lastDebugResult;
}

function getLastDebugResult() {
    return lastDebugResult;
}

function initSteamInputPromptManager() {
    exposeControlsDebug();
    if (promptManagerInitialized) return getRuntimeInfo();
    promptManagerInitialized = true;

    const win = getWindowSafe();
    if (win) {
        win.ChiggasSteamInputPrompts = {
            version: STEAM_INPUT_PROMPT_VERSION,
            init: initSteamInputPromptManager,
            getRuntimeInfo,
            getActionSetsMap,
            setActionSet,
            getPrompt,
            getPromptLabel,
            runDebugSuite,
            getLastDebugResult
        };

        win.ChiggasSteamInputDebug = {
            runSuite: runDebugSuite,
            getRuntimeInfo,
            getActionSetsMap,
            getPrompt,
            getLastDebugResult
        };
    }

    return getRuntimeInfo();
}

export {
    initSteamInputPromptManager,
    getRuntimeInfo as getSteamInputPromptRuntimeInfo,
    getActionSetsMap as getSteamInputActionSetsMap,
    setActionSet as setSteamInputActionSet,
    getPrompt as getSteamInputPrompt,
    getPromptLabel as getSteamInputPromptLabel,
    createPrompt as createSteamInputPrompt,
    updatePrompt as updateSteamInputPrompt,
    runDebugSuite as runSteamInputPromptDebugSuite,
    getLastDebugResult as getLastSteamInputPromptDebugResult
};