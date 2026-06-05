const RUNTIME_VERSION = 'steam_desktop_wrapper_pass_6d';
const events = [];

function record(event, detail = {}) {
    const entry = { event, detail, createdAt: new Date().toISOString() };
    events.push(entry);
    if (events.length > 40) events.shift();
    return entry;
}

function safeNumber(value) {
    const n = Number(value || 0);
    return Number(n.toFixed(4));
}

export function getBrowserGamepads() {
    try {
        if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return [];
        return Array.from(navigator.getGamepads() || []).filter(pad => pad && pad.connected !== false);
    } catch (_error) {
        return [];
    }
}

export function getPrimaryBrowserGamepad() {
    const pads = getBrowserGamepads();
    return pads[0] || null;
}

export function summarizeGamepad(pad, fallbackIndex = 0) {
    if (!pad) return null;
    return {
        index: pad.index ?? fallbackIndex,
        id: pad.id || `Gamepad ${fallbackIndex}`,
        connected: pad.connected !== false,
        mapping: pad.mapping || '',
        axes: Array.from(pad.axes || []).map(safeNumber),
        pressedButtons: Array.from(pad.buttons || [])
            .map((button, index) => ({ index, pressed: !!button?.pressed, value: safeNumber(button?.value) }))
            .filter(button => button.pressed || button.value > 0.05),
        buttonCount: pad.buttons?.length || 0,
        axisCount: pad.axes?.length || 0
    };
}

export function getBrowserGamepadStatus() {
    const hasNavigatorGamepads = typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function';
    const pads = getBrowserGamepads();
    return {
        ok: true,
        version: RUNTIME_VERSION,
        hasNavigatorGamepads,
        browserControllerCount: pads.length,
        controllerCount: pads.length,
        controllers: pads.map(summarizeGamepad),
        recentEvents: events.slice(-12),
        status: !hasNavigatorGamepads
            ? 'browser_gamepad_api_unavailable'
            : (pads.length > 0 ? 'browser_gamepad_detected' : 'browser_gamepad_api_available_no_controllers')
    };
}


export function runBrowserGamepadActivationTest(durationMs = 6000) {
    const duration = Math.max(1000, Math.min(15000, Number(durationMs) || 6000));
    const startedAt = Date.now();
    const samples = [];

    return new Promise(resolve => {
        const timer = setInterval(() => {
            const status = getBrowserGamepadStatus();
            samples.push({
                elapsedMs: Date.now() - startedAt,
                browserControllerCount: status.browserControllerCount,
                controllers: status.controllers
            });

            if (status.browserControllerCount > 0 || Date.now() - startedAt >= duration) {
                clearInterval(timer);
                resolve({
                    ok: true,
                    version: RUNTIME_VERSION,
                    status: status.browserControllerCount > 0 ? 'controller_detected_during_activation_test' : 'no_controller_detected_during_activation_test',
                    finalStatus: status,
                    samples
                });
            }
        }, 250);
    });
}


export function startBrowserGamepadConsoleWatch(durationMs = 8000) {
    const duration = Math.max(1000, Math.min(30000, Number(durationMs) || 8000));
    const startedAt = Date.now();
    const samples = [];

    console.log('[Chiggas Runtime Gamepad Watch] started. Focus the game window, press controller buttons, and move both sticks.');

    return new Promise(resolve => {
        const timer = setInterval(() => {
            const status = getBrowserGamepadStatus();
            const sample = {
                elapsedMs: Date.now() - startedAt,
                browserControllerCount: status.browserControllerCount,
                controllers: status.controllers
            };
            samples.push(sample);
            console.log('[Chiggas Runtime Gamepad Watch]', sample);

            if (Date.now() - startedAt >= duration) {
                clearInterval(timer);
                const finalStatus = getBrowserGamepadStatus();
                const result = {
                    ok: true,
                    version: RUNTIME_VERSION,
                    status: finalStatus.browserControllerCount > 0 ? 'browser_controller_detected' : 'no_browser_controller_detected',
                    finalStatus,
                    samples
                };
                console.log('[Chiggas Runtime Gamepad Watch] complete', result);
                resolve(result);
            }
        }, 500);
    });
}

export function exposeGamepadRuntimeDebug() {
    if (typeof window === 'undefined') return;

    if (!window.__chiggasGamepadRuntimeEventsBound) {
        window.addEventListener('gamepadconnected', event => {
            record('gamepadconnected', summarizeGamepad(event.gamepad));
        });
        window.addEventListener('gamepaddisconnected', event => {
            record('gamepaddisconnected', summarizeGamepad(event.gamepad));
        });
        window.__chiggasGamepadRuntimeEventsBound = true;
    }

    window.ChiggasGamepadRuntime = {
        version: RUNTIME_VERSION,
        getStatus: getBrowserGamepadStatus,
        getBrowserGamepadStatus,
        getBrowserControllerCount: () => getBrowserGamepadStatus().browserControllerCount,
        getFirstGamepadSummary: () => summarizeGamepad(getPrimaryBrowserGamepad()),
        getPressedButtons: () => summarizeGamepad(getPrimaryBrowserGamepad())?.pressedButtons || [],
        runActivationTest: runBrowserGamepadActivationTest,
        watch: startBrowserGamepadConsoleWatch,
        startConsoleWatch: startBrowserGamepadConsoleWatch,
        note: 'Use window.ChiggasGamepadRuntime.getStatus() for immediate status or .watch(8000) for console samples.'
    };

    record('runtime_debug_exposed', { href: window.location?.href || '' });
}
