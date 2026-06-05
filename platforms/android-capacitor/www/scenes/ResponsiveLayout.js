const readRootPx = name => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return 0;

    const raw = window.getComputedStyle(document.documentElement).getPropertyValue(name);
    const value = Number.parseFloat(raw);
    return Number.isFinite(value) ? value : 0;
};

export function getSafeAreaInsets(extra = 0) {
    const pad = Number.isFinite(extra) ? extra : 0;

    return {
        top: Math.max(0, readRootPx('--safe-area-inset-top')) + pad,
        right: Math.max(0, readRootPx('--safe-area-inset-right')) + pad,
        bottom: Math.max(0, readRootPx('--safe-area-inset-bottom')) + pad,
        left: Math.max(0, readRootPx('--safe-area-inset-left')) + pad
    };
}

export function getViewportSize(scene) {
    const scale = scene?.scale || {};
    const win = typeof window !== 'undefined' ? window : null;
    const vv = win?.visualViewport || null;

    const width = Math.round(scale.width || scale.gameSize?.width || vv?.width || win?.innerWidth || 0);
    const height = Math.round(scale.height || scale.gameSize?.height || vv?.height || win?.innerHeight || 0);

    return { width, height };
}

export function getSafeBounds(scene, extra = 10) {
    const { width, height } = getViewportSize(scene);
    const insets = getSafeAreaInsets(extra);

    const left = insets.left;
    const top = insets.top;
    const right = Math.max(left + 1, width - insets.right);
    const bottom = Math.max(top + 1, height - insets.bottom);

    return {
        left,
        top,
        right,
        bottom,
        width: right - left,
        height: bottom - top,
        centerX: (left + right) / 2,
        centerY: (top + bottom) / 2,
        insets,
        screenWidth: width,
        screenHeight: height
    };
}

export function isShortLandscape(scene, maxHeight = 560) {
    const { width, height } = getViewportSize(scene);
    return width > height && height < maxHeight;
}

export function clampToSafeY(scene, y, extra = 10) {
    const safe = getSafeBounds(scene, extra);
    return Math.max(safe.top, Math.min(safe.bottom, y));
}

export function getSafeBottomY(scene, offset = 0, extra = 10) {
    return getSafeBounds(scene, extra).bottom - offset;
}

export function getSafeTopY(scene, offset = 0, extra = 10) {
    return getSafeBounds(scene, extra).top + offset;
}

export function addResponsiveResizeHandler(scene, handler, options = {}) {
    if (!scene || typeof handler !== 'function') return () => {};

    const debounceMs = options.debounceMs ?? 140;
    const minDelta = options.minDelta ?? 2;
    let timer = null;
    let last = getViewportSize(scene);

    const run = () => {
        const next = getViewportSize(scene);
        if (Math.abs(next.width - last.width) < minDelta && Math.abs(next.height - last.height) < minDelta) return;
        last = next;

        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(() => {
            timer = null;
            if (!scene.scene?.isActive?.()) return;
            handler.call(scene, next);
        }, debounceMs);
    };

    scene.scale?.on?.('resize', run, scene);
    window.addEventListener('resize', run, { passive: true });
    window.addEventListener('orientationchange', run, { passive: true });
    window.addEventListener('chiggasViewportResized', run, { passive: true });
    window.visualViewport?.addEventListener('resize', run, { passive: true });

    const cleanup = () => {
        if (timer) {
            window.clearTimeout(timer);
            timer = null;
        }
        scene.scale?.off?.('resize', run, scene);
        window.removeEventListener('resize', run);
        window.removeEventListener('orientationchange', run);
        window.removeEventListener('chiggasViewportResized', run);
        window.visualViewport?.removeEventListener('resize', run);
    };

    scene.events?.once?.('shutdown', cleanup);
    scene.events?.once?.('destroy', cleanup);

    return cleanup;
}