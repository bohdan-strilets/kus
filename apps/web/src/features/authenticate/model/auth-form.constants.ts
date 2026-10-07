/**
 * First check when a field is left, then on every keystroke: an email isn't flagged as invalid
 * after its first letter, and a fix clears the message at once. Submit is never blocked.
 */
export const AUTH_FORM_MODE = { mode: 'onTouched', reValidateMode: 'onChange' } as const
