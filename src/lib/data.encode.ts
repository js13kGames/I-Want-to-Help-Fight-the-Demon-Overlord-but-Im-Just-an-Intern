/**
 * Compact binary data encoding system.
 *
 * The system encodes numeric arrays containing values from 0-91. It uses
 * printable ASCII characters, but no spaces.
 */

import { AssertionError } from '../debug/debug';

/** Maximum value in the data stream. */
export const dataMax = 91;

// Character 39 <'> and 92 <\> are excluded.

/**
 * Decode a data string to a byte array.
 */
export function decode(s: string): Uint8Array {
  return new Uint8Array(s.length).map(
    (_, i) =>
      s.charCodeAt(i) -
      33 -
      (((s.charCodeAt(i) > 39) as unknown) as number) -
      (((s.charCodeAt(i) > 92) as unknown) as number),
  );
}

/**
 * Encode a byte array as a data string.
 */
export function encode(a: Uint8Array): string {
  const max = Math.max(...a);
  if (max > dataMax) {
    throw new AssertionError(`data value out of range: ${max}`);
  }
  return String.fromCharCode(
    ...a.map(
      x =>
        x +
        33 +
        (((x > 5) as unknown) as number) +
        (((x > 57) as unknown) as number),
    ),
  );
}
