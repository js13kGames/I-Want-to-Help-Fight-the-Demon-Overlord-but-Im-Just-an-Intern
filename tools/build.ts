/**
 * Main build script.
 * @module tools/build
 */

import * as minimist from 'minimist';

import { BuildContext, ActionCreator, Builder } from './action';
import { EvalHTML } from './html';
import { RollupJS } from './rollup';
import { CompileTS } from './typescript';
import * as util from './util';
import { CreateZip } from './zip';

/** Competition zip file size limit. */
const sizeTarget = 13 * 1024;

/**
 * Create a function which creates build actions.
 */
function makeActionCreator(): ActionCreator {
  const compileTS = new CompileTS();
  const rollupJS = new RollupJS();
  const evalHTML = new EvalHTML();
  const createZip = new CreateZip();
  return (ctx: BuildContext) => {
    const { jsModules } = compileTS.createActions(ctx);
    const { jsBundle } = rollupJS.createActions(ctx, { jsModules });
    const { html } = evalHTML.createActions(ctx, { script: jsBundle });
    createZip.createActions(ctx, {
      sizeTarget,
      files: new Map([['index.html', html]]),
    });
  };
}

/** Return after the given delay, in milliseconds. */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(() => resolve(), ms));
}

/** Main entry point for build script. */
async function main() {
  const args = (minimist(process.argv.slice(2), {
    boolean: ['watch'],
    unknown(arg: string): boolean {
      console.error(`Unknown argument ${JSON.stringify(arg)}`);
      return process.exit(2); // Return to satisfy type checker.
    },
  }) as unknown) as {
    watch: boolean;
  };

  try {
    process.chdir(util.projectRoot);
    await util.mkdir('build');
    await util.removeAll('build/tmp');
    await util.mkdir('build/tmp');
    const builder = new Builder(makeActionCreator());
    if (args.watch) {
      while (true) {
        console.log('Building...');
        await builder.build();
        await delay(1000);
      }
    } else {
      console.log('Building...');
      await builder.build();
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
