/**
 * Deterministically generates a visually distinct hex color from a seed string.
 * Uses the string's character codes to derive a hue in HSL color space,
 * ensuring high saturation and mid-range lightness for grid visibility.
 */
export function generateColorFromSeed(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0; // Convert to 32-bit int
  }

  const hue = Math.abs(hash) % 360;
  return hslToHex(hue, 75, 52);
}

function hslToHex(h: number, s: number, l: number): string {
  const _s = s / 100;
  const _l = l / 100;

  const a = _s * Math.min(_l, 1 - _l);
  const f = (n: number): string => {
    const k = (n + h / 30) % 12;
    const color = _l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };

  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Generates a tileId string from x, y coordinates.
 */
export function buildTileId(x: number, y: number): string {
  return `${x}_${y}`;
}

/**
 * Parses a tileId back into x, y coordinates.
 * Throws if the format is invalid.
 */
export function parseTileId(tileId: string): { x: number; y: number } {
  const [xStr, yStr] = tileId.split('_');
  const x = parseInt(xStr, 10);
  const y = parseInt(yStr, 10);

  if (isNaN(x) || isNaN(y)) {
    throw new Error(`Invalid tileId format: "${tileId}"`);
  }

  return { x, y };
}
