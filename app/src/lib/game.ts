// Scenario constants the UI needs before (or without) a session: who the player is, where the court sits,
// whose banners are hostile. Kept in one place so the screens never hard-code entity ids.
import type { PublicState } from '../api/types';

/** settings.player_character */
export const PLAYER_ID = 'zhao_ji';
/** settings.capital_region */
export const CAPITAL = 'bianjing';
/** settings.player_faction */
export const PLAYER_FACTION = 'song';
/** factions shown in the red of open war (金 after the invasion, 方腊 after the rising) */
export const ENEMIES = new Set(['jin', 'fangla']);

export const playerOf = (s?: PublicState | null): string => String((s?.rules?.player_character as string) ?? PLAYER_ID);
export const capitalOf = (s?: PublicState | null): string => String((s?.rules?.capital_region as string) ?? CAPITAL);
export const factionOf = (s?: PublicState | null): string => String((s?.rules?.player_faction as string) ?? PLAYER_FACTION);
