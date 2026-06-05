function createSteamInputPromptHelpers(WRAPPER_VERSION, getActiveActionSet) {
  const FALLBACK_ACTIONS = {
        menu: {
          navigate: { glyph: '[L]', label: 'Navigate' },
          confirm: { glyph: '[A]', label: 'Confirm' },
          back: { glyph: '[B]', label: 'Back' },
          scroll_up: { glyph: '[D-Up]', label: 'Scroll Up' },
          scroll_down: { glyph: '[D-Down]', label: 'Scroll Down' },
          pause: { glyph: '[Menu]', label: 'Pause' }
        },
        gameplay: {
          move: { glyph: '[L]', label: 'Move' },
          aim: { glyph: '[R]', label: 'Aim' },
          recruit: { glyph: '[A]', label: 'Recruit' },
          eat: { glyph: '[X]', label: 'Eat' },
          charge: { glyph: '[Y]', label: 'Charge' },
          shoot: { glyph: '[RT]', label: 'Shoot' },
          pause: { glyph: '[Menu]', label: 'Pause' },
          back: { glyph: '[B]', label: 'Back' }
        },
        wardrobe: {
          navigate: { glyph: '[L]', label: 'Navigate' },
          equip: { glyph: '[A]', label: 'Equip' },
          back: { glyph: '[B]', label: 'Back' },
          scroll_up: { glyph: '[D-Up]', label: 'Scroll Up' },
          scroll_down: { glyph: '[D-Down]', label: 'Scroll Down' }
        },
        legendaryStore: {
          navigate: { glyph: '[L]', label: 'Navigate' },
          purchase: { glyph: '[A]', label: 'Test Buy' },
          restore_purchases: { glyph: '[Y]', label: 'Restore' },
          back: { glyph: '[B]', label: 'Back' },
          scroll_up: { glyph: '[D-Up]', label: 'Scroll Up' },
          scroll_down: { glyph: '[D-Down]', label: 'Scroll Down' }
        },
        miniGame: {
          navigate: { glyph: '[L]', label: 'Move' },
          confirm: { glyph: '[A]', label: 'Confirm' },
          back: { glyph: '[B]', label: 'Back' },
          pause: { glyph: '[Menu]', label: 'Pause' }
        }
      };
      
      let activeActionSet = 'menu';
      let lastNativeActionState = null;
      let nativeActionPollStarted = false;
      let nativeActionPollTimer = null;
      
      function parsePayload(payload) {
        if (!payload) return {};
        if (typeof payload === 'object') return payload;
        if (typeof payload === 'string') {
          try {
            return JSON.parse(payload);
          } catch (_error) {
            return { action: payload };
          }
        }
        return {};
      }
      
      function normalizeActionSet(actionSet, fallback = activeActionSet || 'menu') {
        if (!actionSet) return fallback;
        const raw = String(actionSet).trim();
        if (FALLBACK_ACTIONS[raw]) return raw;
        const lower = raw.toLowerCase();
        return Object.keys(FALLBACK_ACTIONS).find(key => key.toLowerCase() === lower) || fallback;
      }
      
      function createFallbackPrompt(actionSet, action, label = '') {
        const normalizedSet = normalizeActionSet(actionSet);
        const normalizedAction = String(action || '').trim();
        const set = FALLBACK_ACTIONS[normalizedSet] || FALLBACK_ACTIONS.menu;
        const fallback = set[normalizedAction] || FALLBACK_ACTIONS.gameplay[normalizedAction] || FALLBACK_ACTIONS.menu[normalizedAction] || {
          glyph: '[?]',
          label: label || normalizedAction || 'Action'
        };
        const promptLabel = label || fallback.label || normalizedAction || 'Action';
        const glyph = fallback.glyph || '[?]';
      
        return {
          ok: true,
          source: 'steam_desktop_placeholder_fallback',
          pass: WRAPPER_VERSION,
          steamworksIntegrated: false,
          actionSet: normalizedSet,
          action: normalizedAction,
          label: promptLabel,
          glyph,
          glyphText: glyph,
          promptText: `${glyph} ${promptLabel}`,
          imagePath: '',
          controllerType: 'fallback_controller'
        };
      }
      
      function syncGetPromptForAction(payload) {
        const parsed = parsePayload(payload);
        return createFallbackPrompt(parsed.actionSet || activeActionSet, parsed.action || parsed.actionName, parsed.label || '');
      }
      
      function syncGetGlyphForAction(actionSetOrPayload, actionName = '') {
        const parsed = typeof actionSetOrPayload === 'object' || (typeof actionSetOrPayload === 'string' && actionSetOrPayload.trim().startsWith('{'))
          ? parsePayload(actionSetOrPayload)
          : { actionSet: actionSetOrPayload, action: actionName };
        return createFallbackPrompt(parsed.actionSet || activeActionSet, parsed.action || parsed.actionName, parsed.label || '');
      }
  

  return {
    normalizeActionSet,
    syncGetPromptForAction,
    syncGetGlyphForAction
  };
}

module.exports = {
  createSteamInputPromptHelpers
};
