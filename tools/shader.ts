/**
 * Generate shader loading code.
 */

import * as fs from 'fs';

import { BuildAction, BuildContext } from './action';
import { BuildArgs, Config } from './config';
import { loadShaders } from './shader.syntax';
import { readPrograms, programSources } from './shader.programs';
import { emitLoader, emitReleaseData } from './shader.emit';
import { prettifyTypeScript } from './util';

const shaderDirPath = 'shader';
const programSpecPath = 'shader/programs.json';
const uniformSpecPath = 'build/uniforms.json';
const shaderDefsPath = 'src/render/shaders.ts';
const shaderDataPath = 'build/shaders.js';

async function generateLoader(config: Config): Promise<void> {
  const programs = await readPrograms(programSpecPath);
  const sources = programSources(programs);
  const code = await loadShaders(shaderDirPath, sources);
  const out = prettifyTypeScript(emitLoader(programs, code));
  let out1 = fs.promises.writeFile(shaderDefsPath, out, 'utf8');
  if (config == Config.Release) {
    const { shaders, uniforms } = emitReleaseData(programs, code);
    const out2 = fs.promises.writeFile(shaderDataPath, shaders, 'utf8');
    const out3 = fs.promises.writeFile(uniformSpecPath, uniforms, 'utf8');
    await out2;
    await out3;
  }
  await out1;
}

/**
 * Build step which packs the GLSL shaders into JavaScript code.
 */
class PackShaders implements BuildAction {
  private readonly params: PackShadersParameters;
  private readonly config: Config;
  constructor(config: Config, params: PackShadersParameters) {
    this.config = config;
    this.params = params;
  }
  get name(): string {
    return 'PackShaders';
  }
  get inputs(): readonly string[] {
    return [programSpecPath, ...this.params.inputs];
  }
  get outputs(): readonly string[] {
    const outputs = [shaderDefsPath];
    if (this.config == Config.Release) {
      outputs.push(shaderDataPath, uniformSpecPath);
    }
    return outputs;
  }

  /** Pack the shaders and emit loading stubs. */
  async execute(config: BuildArgs): Promise<boolean> {
    await generateLoader(config.config);
    return true;
  }
}

/** Parameters for the PackShaders build step. */
export interface PackShadersParameters {
  /** A list of all input modules. */
  inputs: readonly string[];
}

/** Emit build actions to pack shaders. */
export function packShaders(
  ctx: BuildContext,
  params: PackShadersParameters,
): void {
  ctx.addAction(new PackShaders(ctx.config.config, params));
}

async function main(): Promise<void> {
  try {
    await generateLoader(Config.Release);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

if (require.main == module) {
  main();
}
