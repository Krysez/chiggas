export const DEMO_APP_ID = 4788490;
export const DEMO_SESSION_KEY = 'chiggas_demo_score_attack_active_v1';

export const DEMO_SCORE_ATTACK = {
    label: 'STEAM FEST DEMO',
    title: 'SCORE ATTACK DEMO',
    stageIndex: 0,
    difficulty: 1,
    durationSeconds: 480,
    bossWarningAtSeconds: 360,
    miniGameId: 'parasite_maze',
    storePageUrl: `https://store.steampowered.com/app/${DEMO_APP_ID}/`
};

function getWindow() {
    return typeof window !== 'undefined' ? window : null;
}

function readSearchFlag() {
    const win = getWindow();
    try {
        const params = new URLSearchParams(win?.location?.search || '');
        return params.get('demo') === '1' || params.get('chiggasDemo') === '1';
    } catch (_) {
        return false;
    }
}

export function isDemoRuntime() {
    const win = getWindow();
    try {
        return !!(
            win?.ChiggasDemoRuntime?.enabled ||
            win?.__CHIGGAS_DEMO_MODE__ ||
            readSearchFlag()
        );
    } catch (_) {
        return false;
    }
}

export function setDemoSessionActive(active = true) {
    const win = getWindow();
    if (!win?.sessionStorage) return false;
    try {
        if (active) win.sessionStorage.setItem(DEMO_SESSION_KEY, '1');
        else win.sessionStorage.removeItem(DEMO_SESSION_KEY);
        win.__CHIGGAS_DEMO_MODE__ = !!active || isDemoRuntime();
        return true;
    } catch (_) {
        return false;
    }
}

export function clearDemoSession() {
    return setDemoSessionActive(false);
}

export function isDemoSessionActive() {
    const win = getWindow();
    try {
        return isDemoRuntime() || win?.sessionStorage?.getItem(DEMO_SESSION_KEY) === '1';
    } catch (_) {
        return isDemoRuntime();
    }
}

export function isDemoGameData(data = {}) {
    return !!data.demoMode || isDemoRuntime();
}

export function createScoreAttackGameData(controlMode = 'gamepad') {
    setDemoSessionActive(true);
    return {
        stageIndex: DEMO_SCORE_ATTACK.stageIndex,
        score: 0,
        difficulty: DEMO_SCORE_ATTACK.difficulty,
        controlMode,
        demoMode: true,
        runStats: {
            kills: 0,
            recruits: 0,
            eaten: 0,
            turfsClaimed: 0,
            bossesDefeated: 0,
            startedAt: Date.now(),
            demoMode: true
        }
    };
}

export async function openFullGameStorePage(reason = 'demo_wishlist') {
    const win = getWindow();
    const payload = {
        appId: DEMO_APP_ID,
        allowStorePageOpen: true,
        source: 'demo_mode',
        reason
    };

    try {
        const result = await win?.ChiggasSteamPurchases?.openSteamStorePage?.(payload);
        if (result?.ok) return result;
    } catch (_) {}

    try {
        const opened = win?.open?.(DEMO_SCORE_ATTACK.storePageUrl, '_blank', 'noopener,noreferrer');
        return { ok: !!opened, status: opened ? 'browser_store_opened' : 'browser_store_open_failed' };
    } catch (error) {
        return { ok: false, status: 'store_open_failed', error: error?.message || String(error) };
    }
}

export function installDemoAchievementSuppression() {
    const win = getWindow();
    if (!win || win.__chiggasDemoAchievementSuppressionInstalled) return false;
    win.__chiggasDemoAchievementSuppressionInstalled = true;

    win.addEventListener('chiggas-steam-achievement-unlock-request', event => {
        if (!isDemoSessionActive()) return;
        try {
            win.__chiggasLastDemoAchievementSuppressed = {
                at: new Date().toISOString(),
                achievement: event?.detail?.achievement || null,
                source: event?.detail?.source || event?.detail?.metadata?.source || null
            };
        } catch (_) {}
        event.preventDefault?.();
        event.stopImmediatePropagation?.();
    }, true);

    return true;
}
