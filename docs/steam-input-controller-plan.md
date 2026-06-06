# Steam Input Controller Plan

## Current Fix

The in-game Controls / Hotkeys rebind modal now uses one active capture at a time, cleans up keyboard and gamepad listeners, and treats Escape as cancel instead of rebinding an action to Escape.

This stabilizes the local input configuration screen, especially when Steam's keyboard-template layout sends keyboard events from controller buttons.

## Recommended Steam Direction

Do not rely on a pure keyboard-template official layout for final gameplay controller support.

Valve's Steam Input docs describe actions as named gameplay events, action sets as context-specific groups, and action manifests as the source for official configurations. That matches this game better than a keyboard template because the same physical button can mean different things by context:

- Menu action set: `back` can be controller B.
- Gameplay action set: `munch` can also be controller B.
- Store action set: `purchase`, `restore_purchases`, and `back` can have store-specific labels.

With a keyboard template, controller B becomes `Escape` everywhere, so gameplay cannot reliably distinguish menu Back from gameplay Munch.

## Next Implementation Phase

1. Keep the existing `integrations\steam\input\game_actions_4788490.vdf` action definitions.
2. Add or verify an official controller configuration generated from that action manifest in Steam Input dev mode.
3. Add a Steam runtime bridge that exposes digital action states such as `munch`, `recruit`, `charge`, `shoot`, `confirm`, `back`, and `pause`.
4. Route gameplay and menu input through action names first, then fall back to keyboard/gamepad events.
5. Activate the correct action set when scenes change: `menu`, `gameplay`, `legendary_store`, `wardrobe`, and minigame sets.

References:

- Steamworks Steam Input concepts: `https://partner.steamgames.com/doc/features/steam_controller/concepts`
- Steamworks action manifest files: `https://partner.steamgames.com/doc/features/steam_controller/action_manifest_file`
