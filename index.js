import { parseArgs } from 'node:util';
import { resolveConfigureParams, configureHelpText, configureOptions } from './friendly-params.js';
import {
  instructions,
  validateParams,
  getBuffer,
  responseToString,
  getInstruction,
  appendChunk,
  isComplete
} from './protocol.js';

const maxAttempts = 20;
const retryDelayMs = 100;
const responseTimeoutMs = 5000;
const instructionNames = Object.keys(instructions);

/**
 * Prints an expected (user or device) error without a stack trace and exits with code 1.
 * @param {unknown} error
 * @returns {never}
 */
function exitWithError(error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

/**
 * Parses the CLI args into the instruction to send and its validated hex params,
 * translating the friendly `configure` flags into `configure-parameters`. Throws on invalid input.
 * @param {string[]} args
 * @returns {{ instruction: string, params: string[] }}
 */
const parseCli = ([instruction, ...args]) => {
  if (instruction === 'configure') {
    const {
      values: { help, ...flags }
    } = parseArgs({ args, options: configureOptions });
    if (help) {
      console.log(configureHelpText());
      process.exit(0);
    }
    return { instruction: 'configure-parameters', params: resolveConfigureParams(flags) };
  }
  if (!instructionNames.includes(instruction)) throw new Error(`Instruction not found: ${instructionNames.join(' ')}`);
  validateParams(args);
  return { instruction, params: args };
};

/** @type {{ instruction: string, params: string[] }} */
let cli;
try {
  cli = parseCli(process.argv.slice(2));
} catch (error) {
  exitWithError(error);
}
const { instruction, params } = cli;

const port = await import('./port.js').then(module => module.default, exitWithError);

/** @type {string[]} */
let response = [];
let settled = false;

/**
 * Ends the CLI run exactly once: clears the response deadline, prints the
 * result (via console.log on success, console.error on failure), sets the
 * process exit code, and closes the port.
 * @param {string} [message]
 * @param {number} [exitCode]
 * @returns {void}
 */
const finish = (message, exitCode = 0) => {
  if (settled) return;
  settled = true;
  clearTimeout(responseTimeoutId);
  if (message) (exitCode ? console.error : console.log)(message);
  process.exitCode = exitCode;
  port.close();
};

/**
 * Writes an instruction to the port, resending it (up to maxAttempts times)
 * if no response byte has arrived within retryDelayMs. This works around the
 * module ignoring the first instruction it receives after power-on.
 * @param {string} instruction
 * @param {string[]} params
 * @param {number} [attempt]
 * @returns {void}
 */
const writeInstruction = (instruction, params, attempt = 1) => {
  port.write(getBuffer(getInstruction(instructions[instruction].head, params)));
  setTimeout(() => {
    if (settled || response.length) return;
    if (attempt >= maxAttempts) {
      finish(`No response after ${maxAttempts} attempts. Check the device connection.`, 1);
      return;
    }
    writeInstruction(instruction, params, attempt + 1);
  }, retryDelayMs);
};

port.on('error', (/** @type {Error} */ error) => finish(`Serial port error: ${error.message}`, 1));

port.on('data', (/** @type {Buffer} */ data) => {
  response = appendChunk(response, data);
  if (isComplete(response, instructions[instruction].replyLength)) finish(responseToString(response));
});

port.open();
const responseTimeoutId = setTimeout(() => {
  finish(`No complete response after ${responseTimeoutMs}ms. Check the device connection.`, 1);
}, responseTimeoutMs);
writeInstruction(instruction, params);
