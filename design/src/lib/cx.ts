// Тимчасова заміна cn() — при перенесенні в apps/web заміни імпорти на cn з shared/lib.
export const cx = (...parts: Array<string | false | null | undefined>): string => parts.filter(Boolean).join(' ');

// useId повертає «:r1:», а двокрапки ламають url(#…) у частині браузерів.
export const toSvgId = (prefix: string, reactId: string): string => prefix + reactId.replace(/:/g, '');
