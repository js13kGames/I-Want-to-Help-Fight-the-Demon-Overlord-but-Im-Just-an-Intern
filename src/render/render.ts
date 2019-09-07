/**
 * Game renderer.
 */

import { gl, startGL } from '../lib/global';
import { renderLevel, initRenderLevel } from './level';
import { renderModels } from './model';
import { renderUI, initRenderUI } from './ui';

/**
 * Initialize the renderer state. Creates the WebGL context.
 */
export function initRenderer(): void {
  startGL();
  initRenderLevel();
  initRenderUI();
}

/**
 * Render the game.
 */
export function render(): void {
  gl.clearColor(0.5, 0.5, 0.5, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.enable(gl.CULL_FACE);

  gl.enable(gl.DEPTH_TEST);
  renderModels();
  renderLevel();
  gl.disable(gl.DEPTH_TEST);

  renderUI();
}
