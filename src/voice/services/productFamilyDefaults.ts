/**
 * Defaults for ordinary modular switch families.
 * These are search defaults only; they never alter the source catalogue records.
 * Special products are deliberately excluded or use a reduced profile.
 */
export interface SwitchDefaults {
  colour: string;
  amp: string;
  module: string;
  switchType?: string;
  indicator: boolean;
}

export const STANDARD_MODULAR_SWITCH_DEFAULTS: Readonly<SwitchDefaults> = Object.freeze({
  colour: 'WHITE',
  amp: '10',
  module: '1M',
  switchType: 'ONE WAY',
  indicator: false,
});

/** Bell Push is a switch accessory, but must never inherit ONE WAY. */
export const BELL_PUSH_DEFAULTS: Readonly<SwitchDefaults> = Object.freeze({
  colour: 'WHITE',
  amp: '10',
  module: '1M',
  indicator: false,
});

const SPECIAL_PRODUCT_PATTERNS = [
  /\bDP\b/i,
  /MOTOR\s+STARTER/i,
  /MOTION\s+SENSOR/i,
  /WAVE\s+SWITCH/i,
  /F\s*[- ]?TOUCH/i,
  /CALL\s+BELL/i,
  /ELECTRONIC\s+BUZZER/i,
  /BLANK\s+PLATE/i,
  /SOCKET/i,
  /DIMMER|REGULATOR/i,
];

export function getSwitchDefaults(productText: string): Readonly<SwitchDefaults> | null {
  const text = String(productText || '').toUpperCase();
  if (!/\bSWITCH\b/i.test(text)) return null;
  if (/\bBELL\s+PUSH\b/i.test(text)) return BELL_PUSH_DEFAULTS;
  if (SPECIAL_PRODUCT_PATTERNS.some((pattern) => pattern.test(text))) return null;
  return STANDARD_MODULAR_SWITCH_DEFAULTS;
}
