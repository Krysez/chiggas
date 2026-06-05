function installFirstStoreVisitClickMapPreload() {
  // CHIGGAS_STEAM_DESKTOP_WRAPPER_PASS_44_FIRST_STORE_VISIT_CLICK_MAPPER_PRELOAD_START
    (function installChiggasPass44FirstStoreVisitClickMapper() {
      try {
        if (globalThis.__CHIGGAS_PASS_44_FIRST_STORE_VISIT_CLICK_MAPPER_INSTALLED__) return;
        globalThis.__CHIGGAS_PASS_44_FIRST_STORE_VISIT_CLICK_MAPPER_INSTALLED__ = true;
    
        const electron = require('electron');
        const ipcRenderer = electron && electron.ipcRenderer;
        const traceChannel = 'chiggas-first-store-visit-click-map-pass-44-trace';
        const installedAt = Date.now();
        let interactionIndex = 0;
        let lastPointerSignature = '';
        let lastPointerAt = 0;
    
        function safeString(value, limit) {
          try {
            const text = value == null ? '' : String(value);
            return text.slice(0, limit || 160);
          } catch (_) { return ''; }
        }
        function describeElement(el) {
          try {
            if (!el) return null;
            return {
              tagName: safeString(el.tagName || el.nodeName, 40),
              id: safeString(el.id, 80),
              className: safeString(el.className && typeof el.className === 'string' ? el.className : '', 160),
              ariaLabel: safeString(el.getAttribute && el.getAttribute('aria-label'), 120),
              role: safeString(el.getAttribute && el.getAttribute('role'), 80),
              text: safeString(el.innerText || el.textContent || '', 120)
            };
          } catch (_) { return null; }
        }
        function getCanvas() {
          try { return document && document.querySelector && document.querySelector('canvas'); } catch (_) { return null; }
        }
        function getCanvasData(event) {
          const canvas = getCanvas();
          if (!canvas) return { canvasRect: null, canvasX: null, canvasY: null, canvasXPct: null, canvasYPct: null };
          const rect = canvas.getBoundingClientRect();
          const clientX = typeof event.clientX === 'number' ? event.clientX : null;
          const clientY = typeof event.clientY === 'number' ? event.clientY : null;
          const canvasX = clientX === null ? null : clientX - rect.left;
          const canvasY = clientY === null ? null : clientY - rect.top;
          return {
            canvasRect: {
              left: Math.round(rect.left),
              top: Math.round(rect.top),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              right: Math.round(rect.right),
              bottom: Math.round(rect.bottom)
            },
            canvasX: canvasX === null ? null : Math.round(canvasX),
            canvasY: canvasY === null ? null : Math.round(canvasY),
            canvasXPct: canvasX === null || !rect.width ? null : Number((canvasX / rect.width).toFixed(4)),
            canvasYPct: canvasY === null || !rect.height ? null : Number((canvasY / rect.height).toFixed(4))
          };
        }
        async function writeTrace(payload) {
          if (!ipcRenderer || typeof ipcRenderer.invoke !== 'function') return null;
          try { return await ipcRenderer.invoke(traceChannel, payload); } catch (_) { return null; }
        }
        function shouldIgnoreDuplicate(event, inputType) {
          const now = Date.now();
          const x = typeof event.clientX === 'number' ? Math.round(event.clientX) : '';
          const y = typeof event.clientY === 'number' ? Math.round(event.clientY) : '';
          const sig = inputType + ':' + x + ':' + y;
          if ((inputType === 'mousedown' || inputType === 'click') && lastPointerAt && now - lastPointerAt < 80 && lastPointerSignature.indexOf('pointerdown:' + x + ':' + y) === 0) return false;
          if (sig === lastPointerSignature && now - lastPointerAt < 60) return true;
          if (inputType === 'pointerdown') {
            lastPointerSignature = sig;
            lastPointerAt = now;
          }
          return false;
        }
        async function recordInteraction(event, inputType, phase) {
          try {
            const canvas = getCanvas();
            if (!canvas) return;
            if (shouldIgnoreDuplicate(event, inputType)) return;
            interactionIndex += 1;
            const canvasData = getCanvasData(event);
            const payload = Object.assign({
              event: 'store_visit_user_interaction',
              interactionIndex,
              inputType,
              phase,
              button: event && event.button !== undefined ? event.button : null,
              key: safeString(event && event.key, 40),
              clientX: event && typeof event.clientX === 'number' ? Math.round(event.clientX) : null,
              clientY: event && typeof event.clientY === 'number' ? Math.round(event.clientY) : null,
              viewport: { width: window.innerWidth || null, height: window.innerHeight || null, devicePixelRatio: window.devicePixelRatio || null },
              target: describeElement(event && event.target),
              activeElement: describeElement(document && document.activeElement),
              url: safeString(window.location && window.location.href, 260),
              title: safeString(document && document.title, 160),
              elapsedMs: Date.now() - installedAt,
              note: 'Pass 44 records interaction coordinates only. It does not unlock FIRST_STORE_VISIT.'
            }, canvasData);
            await writeTrace(payload);
          } catch (_) {}
        }
        function installListeners() {
          writeTrace({
            event: 'store_visit_click_mapper_installed',
            interactionIndex: 0,
            inputType: null,
            phase: 'install',
            url: safeString(window.location && window.location.href, 260),
            title: safeString(document && document.title, 160),
            viewport: { width: window.innerWidth || null, height: window.innerHeight || null, devicePixelRatio: window.devicePixelRatio || null },
            note: 'Open the Legendary Store once, then close the game and run the Pass 44 trace check.'
          });
          window.addEventListener('pointerdown', (event) => recordInteraction(event, 'pointerdown', 'down'), true);
          window.addEventListener('pointerup', (event) => recordInteraction(event, 'pointerup', 'up'), true);
          window.addEventListener('click', (event) => recordInteraction(event, 'click', 'click'), true);
          window.addEventListener('keydown', (event) => {
            const key = safeString(event && event.key, 40).toLowerCase();
            if (key === 'enter' || key === ' ' || key === 'spacebar') recordInteraction(event, 'keydown', 'confirm');
          }, true);
        }
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installListeners, { once: true });
        else setTimeout(installListeners, 0);
      } catch (error) {
        try {
          const electron = require('electron');
          const ipcRenderer = electron && electron.ipcRenderer;
          if (ipcRenderer && typeof ipcRenderer.invoke === 'function') {
            ipcRenderer.invoke('chiggas-first-store-visit-click-map-pass-44-trace', {
              event: 'store_visit_click_mapper_install_failed',
              interactionIndex: 0,
              error: String(error && error.message ? error.message : error),
              attemptedUnlock: false,
              storeShouldShow: 'TEST BUY'
            });
          }
        } catch (_) {}
      }
    })();
    // CHIGGAS_STEAM_DESKTOP_WRAPPER_PASS_44_FIRST_STORE_VISIT_CLICK_MAPPER_PRELOAD_END
}

module.exports = {
  installFirstStoreVisitClickMapPreload
};
