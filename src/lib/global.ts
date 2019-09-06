import { isDebug } from '../debug/debug';

/**
 * Common global variables.
 * @module src/global
 */

/** All data bundled with the release builds of the game. */
export const data: string[] = isDebug
  ? []
  : JSON.parse((document.getElementById('d') as HTMLScriptElement).text);

/** Game canvas element. */
export const canvas = document.getElementById('g') as HTMLCanvasElement;
/** WebGL rendering context. */
export const gl = canvas.getContext('webgl', {
  'alpha': false,
  'antialias': false,
})!;

if (!gl) {
  throw new Error('Could not create WebGL context');
}
