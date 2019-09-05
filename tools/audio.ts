/**
 * Audio rendering script.
 */

import * as fs from 'fs';
import * as child_process from 'child_process';

import * as chokidar from 'chokidar';
import * as program from 'commander';
import { file, setGracefulCleanup } from 'tmp-promise';

import { evaluateProgram } from '../src/synth/evaluate';
import { disassembleProgram } from '../src/synth/opcode';
import { sampleRate, runProgram } from '../src/synth/engine';
import { encode } from '../src/lib/data.encode';
import { SourceError, SourceText } from '../src/lib/sourcepos';
import { waveData, floatTo16 } from './audio.wave';
import { readStream } from './stream';
import { printError } from './source';
import { parseSExpr } from '../src/lib/sexpr';
import { emitCode } from '../src/synth/node';

setGracefulCleanup();

interface AudioArgs {
  output: string;
  input: string;
  play: false;
  disassemble: boolean;
  verbose: false;
  watch: false;
}

function parseArgs() {
  program.option('--output <file>', 'path to output WAVE file');
  program.option('--play', 'play the audio file');
  program.option('--disassemble', 'show program disassembly');
  program.option('--watch', '');
  program.option('-v --verbose', 'verbose logging');
  program.parse(process.argv);
  const args: AudioArgs = {
    output: '',
    input: '-',
    play: false,
    disassemble: false,
    verbose: false,
    watch: false,
  };
  for (const arg of Object.keys(args)) {
    if (arg != 'input' && arg in program) {
      // @ts-ignore: This is a hack.
      args[arg] = program[arg];
    }
  }
  if (program.args.length) {
    if (program.args.length > 1) {
      console.error(`unexpected argument ${program.args[1]}`);
      program.exit(2);
    }
    args.input = program.args[0];
  }
  return args;
}

let verbose = false;

function log(msg: string) {
  if (verbose) {
    console.log(msg);
  }
}

/** Compile an audio file. */
function compile(
  args: AudioArgs,
  inputName: string,
  inputText: string,
): Uint8Array | null {
  let code: Uint8Array;
  try {
    log('Parsing...');
    const exprs = parseSExpr(inputText);
    log('Evaluating...');
    const node = evaluateProgram(exprs);
    log('Emitting code...');
    code = emitCode(node);
  } catch (e) {
    if (e instanceof SourceError) {
      const text = new SourceText(inputName, inputText);
      printError(text, e);
      return null;
    }
    throw e;
  }

  if (args.disassemble) {
    process.stdout.write('Assembly:\n');
    const disassembly = disassembleProgram(code);
    for (const line of disassembly) {
      process.stdout.write('  ' + line + '\n');
    }
    process.stdout.write('\n');
  }

  process.stdout.write('Code:\n');
  for (let i = 0; i < code.length; i += 16) {
    process.stdout.write(
      '  ' +
        Array.from(code.slice(i, i + 16))
          .map(x => x.toString().padStart(2, ' '))
          .join(' ') +
        '\n',
    );
  }

  process.stdout.write('\n');

  process.stdout.write('Encoded:\n');
  process.stdout.write('  ' + encode(code) + '\n');
  process.stdout.write('\n');

  return code;
}

/** Generate WAVE file data from audio program. */
function makeWave(code: Uint8Array): Buffer {
  const audio = runProgram(code);
  return waveData({
    sampleRate,
    channelCount: 1,
    audio: floatTo16(audio),
  });
}

interface Writer {
  path: string;
  write(data: Buffer): Promise<void>;
}

async function makeWriter(args: AudioArgs): Promise<Writer> {
  if (args.output != '') {
    return {
      path: args.output,
      async write(data) {
        await fs.promises.writeFile(args.output, data);
      },
    };
  }
  let r = await file({ postfix: '.wav' });
  return {
    path: r.path,
    async write(data) {
      const { fd } = r;
      await new Promise((resolve, reject) =>
        fs.ftruncate(fd, 0, err => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }),
      );
      await new Promise((resolve, reject) =>
        fs.write(fd, data, 0, data.length, 0, err => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }),
      );
    },
  };
}

function playAudio(path: string): Promise<void> {
  let prog: string;
  switch (process.platform) {
    case 'darwin':
      prog = 'afplay';
      break;
    case 'linux':
      prog = 'aplay';
      break;
    default:
      throw new Error(
        `cannot play audio on platform ${JSON.stringify(process.platform)}`,
      );
  }
  return new Promise((resolve, reject) => {
    child_process.execFile(prog, [path], (err, stdout, stderr) => {
      process.stderr.write(stdout);
      process.stderr.write(stderr);
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

interface Sink {
  sink(code: Uint8Array): void;
}

async function makeSink(args: AudioArgs): Promise<Sink> {
  if (args.output == '' && !args.play) {
    return {
      sink() {},
    };
  }

  let currentCode: Uint8Array | null = null;
  let codeChanged = false;
  let running = false;
  const writer = await makeWriter(args);

  async function run(): Promise<void> {
    try {
      if (currentCode == null) {
        throw new Error('currentCode == null');
      }
      if (codeChanged) {
        codeChanged = false;
        const data = makeWave(currentCode);
        await writer.write(data);
      }
      await playAudio(writer.path);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
    if (args.watch && args.play) {
      setImmediate(run);
    } else {
      running = false;
    }
  }

  return {
    sink(code: Uint8Array): void {
      currentCode = code;
      codeChanged = true;
      if (!running) {
        running = true;
        setImmediate(run);
      }
    },
  };
}

async function runMain(args: AudioArgs): Promise<boolean> {
  let inputName: string;
  let inputText: string;
  if (args.input == '-') {
    inputName = '<stdin>';
    inputText = await readStream(process.stdin);
  } else {
    inputName = args.input;
    inputText = await fs.promises.readFile(inputName, 'utf8');
  }
  const code = compile(args, inputName, inputText);
  if (code == null) {
    return false;
  }
  if (args.output != '' || args.play) {
    const data = makeWave(code);
    const writer = await makeWriter(args);
    await writer.write(data);
    if (args.play) {
      playAudio(writer.path);
    }
  }
  return true;
}

async function watchMain(args: AudioArgs): Promise<void> {
  const { input } = args;
  if (input == '-') {
    console.error('input required for --watch');
    process.exit(2);
  }
  const sink = await makeSink(args);
  const watcher = chokidar.watch(input);
  let changed = false;
  let loading = false;
  async function load(): Promise<void> {
    changed = false;
    const text = await fs.promises.readFile(input, 'utf8');
    const code = compile(args, input, text);
    if (code != null) {
      sink.sink(code);
    }
    if (changed) {
      setImmediate(load);
    } else {
      loading = false;
    }
  }
  function onChanged(): void {
    changed = true;
    if (!loading) {
      loading = true;
      setImmediate(load);
    }
  }
  watcher.on('change', onChanged);
  watcher.on('ready', onChanged);
  await new Promise(() => {});
}

async function main(): Promise<void> {
  const args = parseArgs();
  verbose = args.verbose;
  let status = 0;

  try {
    if (args.watch) {
      await watchMain(args);
    } else {
      if (!(await runMain(args))) {
        status = 1;
      }
    }
  } catch (e) {
    console.log(e);
    status = 1;
  }

  process.exit(status);
}

main();
