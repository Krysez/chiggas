const SESSION_REPORTED_EVENTS = new Set();

function safeClone(value) {
    try {
        return JSON.parse(JSON.stringify(value ?? {}));
    } catch {
        return {};
    }
}

function getBridge() {
    if (typeof window === 'undefined') return null;
    return window.ChiggasSteamAchievements || null;
}

export function getSteamAchievementEventReporterStatus() {
    const bridge = getBridge();
    return {
        ok: true,
        pass: 'steam_desktop_wrapper_pass_23',
        bridgeAvailable: !!bridge,
        recordEventAvailable: typeof bridge?.recordAchievementEvent === 'function' || typeof bridge?.recordEvent === 'function',
        achievementsArmed: !!bridge?.achievementsArmed,
        reportedThisSession: Array.from(SESSION_REPORTED_EVENTS)
    };
}

export function reportSteamAchievementEvent(eventName, detail = {}, options = {}) {
    const event = String(eventName || '').trim();
    if (!event) return Promise.resolve({ ok: false, status: 'missing_event' });

    const sessionKey = options.oncePerSession === false
        ? `${event}:${Date.now()}:${Math.random()}`
        : event;

    if (options.oncePerSession !== false && SESSION_REPORTED_EVENTS.has(sessionKey)) {
        return Promise.resolve({ ok: true, status: 'already_reported_this_session', event });
    }

    SESSION_REPORTED_EVENTS.add(sessionKey);

    const bridge = getBridge();
    if (!bridge) {
        return Promise.resolve({ ok: false, status: 'steam_achievement_bridge_unavailable', event });
    }

    const payload = {
        event,
        eventName: event,
        source: 'rosebud_game_event',
        pass: 'steam_desktop_wrapper_pass_23',
        detail: safeClone(detail),
        createdAt: new Date().toISOString()
    };

    const record = bridge.recordAchievementEvent || bridge.recordEvent || bridge.reportAchievementEvent;
    if (typeof record !== 'function') {
        return Promise.resolve({ ok: false, status: 'steam_achievement_record_function_unavailable', event, payload });
    }

    try {
        return Promise.resolve(record(payload)).catch(error => ({
            ok: false,
            status: 'steam_achievement_event_report_failed',
            event,
            error: error?.message || String(error)
        }));
    } catch (error) {
        return Promise.resolve({
            ok: false,
            status: 'steam_achievement_event_report_failed',
            event,
            error: error?.message || String(error)
        });
    }
}

export function exposeSteamAchievementEventReporterDebug() {
    if (typeof window === 'undefined') return;
    window.ChiggasSteamAchievementEventReporter = {
        version: 'steam_desktop_wrapper_pass_23',
        getStatus: getSteamAchievementEventReporterStatus,
        reportEvent: reportSteamAchievementEvent,
        reportAchievementEvent: reportSteamAchievementEvent
    };
}
