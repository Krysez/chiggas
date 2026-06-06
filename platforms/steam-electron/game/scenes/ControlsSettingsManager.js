const CONTROL_BINDINGS_VERSION = 'controls_settings_pass_3_v1';
const CONTROL_BINDINGS_STORAGE_KEY = 'chiggas_controls_v1';

const DEFAULT_CONTROL_BINDINGS = {
    menu: {
        navigate: { type: 'axis', keyboard: ['ArrowKeys', 'WASD'], gamepad: 'left_stick' },
        confirm: { keyboard: ['Enter', 'Space'], gamepad: 0 },
        back: { keyboard: ['Escape', 'Backspace'], gamepad: 1 },
        scroll_up: { keyboard: ['ArrowUp', 'KeyW'], gamepad: 4 },
        scroll_down: { keyboard: ['ArrowDown', 'KeyS'], gamepad: 5 }
    },
    gameplay: {
        move: { type: 'axis', keyboard: ['WASD', 'ArrowKeys'], gamepad: 'left_stick' },
        aim: { type: 'axis', keyboard: ['Mouse'], gamepad: 'right_stick' },
        recruit: { keyboard: ['Space'], gamepad: 0 },
        eat: { keyboard: ['ShiftLeft', 'ShiftRight'], gamepad: 1 },
        charge: { keyboard: ['KeyC'], gamepad: 2 },
        shoot: { keyboard: ['KeyF'], gamepad: 3 },
        pause: { keyboard: ['Escape'], gamepad: 9 },
        back: { keyboard: ['Backspace'], gamepad: 1 }
    },
    wardrobe: {
        navigate: { type: 'axis', keyboard: ['ArrowKeys', 'WASD'], gamepad: 'left_stick' },
        equip: { keyboard: ['Enter', 'Space'], gamepad: 0 },
        back: { keyboard: ['Escape', 'Backspace'], gamepad: 1 },
        scroll_up: { keyboard: ['ArrowUp', 'KeyW'], gamepad: 4 },
        scroll_down: { keyboard: ['ArrowDown', 'KeyS'], gamepad: 5 },
        legendary_store: { keyboard: ['KeyL'], gamepad: 2 }
    },
    legendaryStore: {
        navigate: { type: 'axis', keyboard: ['ArrowKeys', 'WASD'], gamepad: 'left_stick' },
        purchase: { keyboard: ['Enter', 'Space'], gamepad: 0 },
        restore_purchases: { keyboard: ['KeyR'], gamepad: 2 },
        back: { keyboard: ['Escape', 'Backspace'], gamepad: 1 },
        scroll_up: { keyboard: ['ArrowUp', 'KeyW'], gamepad: 4 },
        scroll_down: { keyboard: ['ArrowDown', 'KeyS'], gamepad: 5 }
    },
    miniGame: {
        navigate: { type: 'axis', keyboard: ['ArrowKeys', 'WASD'], gamepad: 'left_stick' },
        confirm: { keyboard: ['Enter', 'Space'], gamepad: 0 },
        back: { keyboard: ['Escape', 'Backspace'], gamepad: 1 },
        pause: { keyboard: ['Escape'], gamepad: 9 }
    }
};

const GAMEPLAY_CONTROL_ROWS = [
    { actionSet: 'gameplay', action: 'recruit', label: 'Recruit' },
    { actionSet: 'gameplay', action: 'eat', label: 'Munch' },
    { actionSet: 'gameplay', action: 'charge', label: 'Charge' },
    { actionSet: 'gameplay', action: 'shoot', label: 'Shoot' },
    { actionSet: 'gameplay', action: 'pause', label: 'Pause' },
    { actionSet: 'gameplay', action: 'back', label: 'Back' }
];

const GAMEPAD_LABELS = {
    0: '[A]',
    1: '[B]',
    2: '[X]',
    3: '[Y]',
    4: '[LB]',
    5: '[RB]',
    6: '[LT]',
    7: '[RT]',
    8: '[View]',
    9: '[Menu]',
    10: '[L3]',
    11: '[R3]',
    12: '[D-Up]',
    13: '[D-Down]',
    14: '[D-Left]',
    15: '[D-Right]',
    left_stick: '[L]',
    right_stick: '[R]'
};

const KEYBOARD_LABELS = {
    Space: 'Space',
    Enter: 'Enter',
    Escape: 'Esc',
    Backspace: 'Backspace',
    ShiftLeft: 'Left Shift',
    ShiftRight: 'Right Shift',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    KeyW: 'W',
    KeyA: 'A',
    KeyS: 'S',
    KeyD: 'D',
    KeyC: 'C',
    KeyF: 'F',
    KeyL: 'L',
    KeyR: 'R',
    WASD: 'WASD',
    ArrowKeys: 'Arrows',
    Mouse: 'Mouse'
};

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function getWindowSafe() {
    return typeof window !== 'undefined' ? window : null;
}

function normalizeBindings(raw = {}) {
    const next = clone(DEFAULT_CONTROL_BINDINGS);

    Object.keys(next).forEach(setKey => {
        Object.keys(next[setKey]).forEach(action => {
            const saved = raw?.[setKey]?.[action];
            if (!saved) return;

            if (Array.isArray(saved.keyboard) && saved.keyboard.length > 0) {
                next[setKey][action].keyboard = saved.keyboard.filter(Boolean);
            }

            if (saved.gamepad !== undefined && saved.gamepad !== null && saved.gamepad !== '') {
                const parsed = Number(saved.gamepad);
                next[setKey][action].gamepad = Number.isFinite(parsed) ? parsed : saved.gamepad;
            }
        });
    });

    return next;
}

function loadControlBindings() {
    try {
        const win = getWindowSafe();
        const raw = win?.localStorage?.getItem(CONTROL_BINDINGS_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return normalizeBindings(parsed.bindings || parsed);
    } catch (error) {
        return clone(DEFAULT_CONTROL_BINDINGS);
    }
}

function saveControlBindings(bindings) {
    try {
        const win = getWindowSafe();
        const normalized = normalizeBindings(bindings);
        win?.localStorage?.setItem(CONTROL_BINDINGS_STORAGE_KEY, JSON.stringify({
            version: CONTROL_BINDINGS_VERSION,
            savedAt: new Date().toISOString(),
            bindings: normalized
        }));
        exposeControlsDebug();
        return normalized;
    } catch (error) {
        return normalizeBindings(bindings);
    }
}

function resetControlBindings() {
    const defaults = clone(DEFAULT_CONTROL_BINDINGS);
    saveControlBindings(defaults);
    return defaults;
}

function getControlBinding(actionSet, action) {
    const bindings = loadControlBindings();
    return bindings?.[actionSet]?.[action] || DEFAULT_CONTROL_BINDINGS?.[actionSet]?.[action] || null;
}

function getKeyboardCodes(actionSet, action) {
    const binding = getControlBinding(actionSet, action);
    return Array.isArray(binding?.keyboard) ? binding.keyboard.slice() : [];
}

function getPrimaryKeyboardCode(actionSet, action) {
    return getKeyboardCodes(actionSet, action).find(code => code && !['WASD', 'ArrowKeys', 'Mouse'].includes(code)) || '';
}

function getGamepadButton(actionSet, action) {
    const binding = getControlBinding(actionSet, action);
    return binding?.gamepad;
}

function isGamepadActionButton(actionSet, action, buttonIndex) {
    const expected = getGamepadButton(actionSet, action);
    if (typeof expected !== 'number') return false;
    return Number(buttonIndex) === expected;
}

function isGamepadActionPressed(pad, actionSet, action) {
    const expected = getGamepadButton(actionSet, action);
    if (typeof expected !== 'number') return false;
    return !!pad?.buttons?.[expected]?.pressed;
}

function keyboardCodeToLabel(code) {
    if (!code) return '?';
    if (KEYBOARD_LABELS[code]) return KEYBOARD_LABELS[code];
    if (/^Key[A-Z]$/.test(code)) return code.replace('Key', '');
    if (/^Digit[0-9]$/.test(code)) return code.replace('Digit', '');
    if (/^Numpad/.test(code)) return code.replace('Numpad', 'Num ');
    return String(code).replace('Arrow', '').replace('Left', ' Left').replace('Right', ' Right').trim();
}

function gamepadButtonToLabel(button) {
    if (button === undefined || button === null || button === '') return '[?]';
    if (GAMEPAD_LABELS[button] !== undefined) return GAMEPAD_LABELS[button];
    return `[B${button}]`;
}

function getControlPrompt(actionSet, action, label = '', inputType = 'gamepad') {
    const binding = getControlBinding(actionSet, action);
    const actionLabel = label || action || 'Action';

    if (!binding) {
        return { glyph: '[?]', label: actionLabel, promptText: `[?] ${actionLabel}` };
    }

    if (inputType === 'keyboard') {
        const primary = getPrimaryKeyboardCode(actionSet, action) || binding.keyboard?.[0];
        const glyph = `[${keyboardCodeToLabel(primary)}]`;
        return { glyph, label: actionLabel, promptText: `${glyph} ${actionLabel}` };
    }

    const glyph = gamepadButtonToLabel(binding.gamepad);
    return { glyph, label: actionLabel, promptText: `${glyph} ${actionLabel}` };
}

function setKeyboardBinding(actionSet, action, code) {
    if (!code) return loadControlBindings();
    const bindings = loadControlBindings();
    if (!bindings[actionSet]) bindings[actionSet] = {};
    if (!bindings[actionSet][action]) bindings[actionSet][action] = {};
    bindings[actionSet][action].keyboard = [code];
    return saveControlBindings(bindings);
}

function setGamepadBinding(actionSet, action, buttonIndex) {
    const parsed = Number(buttonIndex);
    if (!Number.isFinite(parsed)) return loadControlBindings();
    const bindings = loadControlBindings();
    if (!bindings[actionSet]) bindings[actionSet] = {};
    if (!bindings[actionSet][action]) bindings[actionSet][action] = {};
    bindings[actionSet][action].gamepad = parsed;
    return saveControlBindings(bindings);
}

function runControlsDebugSuite() {
    const bindings = loadControlBindings();
    const missing = [];

    GAMEPLAY_CONTROL_ROWS.forEach(row => {
        const binding = bindings?.[row.actionSet]?.[row.action];
        if (!binding?.keyboard?.length) missing.push(`${row.actionSet}.${row.action}.keyboard`);
        if (binding?.gamepad === undefined || binding?.gamepad === null || binding?.gamepad === '') missing.push(`${row.actionSet}.${row.action}.gamepad`);
    });

    return {
        ok: missing.length === 0,
        status: missing.length === 0 ? 'controls_settings_validated' : 'controls_settings_incomplete',
        version: CONTROL_BINDINGS_VERSION,
        rows: GAMEPLAY_CONTROL_ROWS.map(row => ({
            ...row,
            keyboard: getKeyboardCodes(row.actionSet, row.action).map(keyboardCodeToLabel).join(' / '),
            gamepad: gamepadButtonToLabel(getGamepadButton(row.actionSet, row.action))
        })),
        missing,
        checkedAt: new Date().toISOString()
    };
}

function exposeControlsDebug() {
    const win = getWindowSafe();
    if (!win) return;
    win.ChiggasControlsSettings = {
        version: CONTROL_BINDINGS_VERSION,
        load: loadControlBindings,
        save: saveControlBindings,
        reset: resetControlBindings,
        getBinding: getControlBinding,
        getControlPrompt,
        setKeyboardBinding,
        setGamepadBinding,
        runDebugSuite: runControlsDebugSuite
    };
}

exposeControlsDebug();

export {
    CONTROL_BINDINGS_VERSION,
    DEFAULT_CONTROL_BINDINGS,
    GAMEPLAY_CONTROL_ROWS,
    loadControlBindings,
    saveControlBindings,
    resetControlBindings,
    getControlBinding,
    getKeyboardCodes,
    getPrimaryKeyboardCode,
    getGamepadButton,
    isGamepadActionButton,
    isGamepadActionPressed,
    keyboardCodeToLabel,
    gamepadButtonToLabel,
    getControlPrompt,
    setKeyboardBinding,
    setGamepadBinding,
    runControlsDebugSuite,
    exposeControlsDebug
};
