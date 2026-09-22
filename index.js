import { parseArgs } from 'node:util';
import { resolveConfigureParams, configureHelpText } from './friendly-params.js';
import { terminator, validateParams, getBuffer, responseToString, getInstruction } from './protocol.js';

const maxAttempts = 20;
const responseTimeoutMs = 5000;
const heads = {
  'reset': 'AB E3',
  'read-device-id': 'F2 AD',
  'read-version-number': 'AB CD',
  'read-parameters': 'AA E2',
  'configure-parameters': 'A9 E1',
  'configure-device-id': 'F1 AE',
  'send-address-message': 'B1 CA'
};

const instructions = Object.keys(heads);
const [rawInstruction, ...rawArgs] = process.argv.slice(2);
let instruction = rawInstruction;
let params = rawArgs;

if (instruction === 'configure') {
  const { values } = parseArgs({
    args: rawArgs,
    options: {
      baud: { type: 'string' },
      channel: { type: 'string' },
      power: { type: 'string' },
      mode: { type: 'string' },
      id: { type: 'string' },
      response: { type: 'string' },
      help: { type: 'boolean' }
    }
  });
  if (values.help) {
    console.log(configureHelpText());
    process.exit(0);
  }
  try {
    params = resolveConfigureParams(values);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  instruction = 'configure-parameters';
}

if (!instructions.includes(instruction)) throw new Error(`Instruction not found: ${instructions.join(' ')}`);
validateParams(params);

const { default: port } = await import('./port.mjs');

const response = [];
let settled = false;
let responseTimeoutId;

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
 * if no response byte has arrived within 100ms. This works around the
 * module ignoring the first instruction it receives after power-on.
 * @param {string} instruction
 * @param {string[]} params
 * @param {number} [attempt]
 * @returns {void}
 */
const writeInstruction = (instruction, params, attempt = 1) => {
  port.write(getBuffer(getInstruction(heads[instruction], params)));
  setTimeout(() => {
    if (settled || response.length) return;
    if (attempt >= maxAttempts) {
      finish(`No response after ${maxAttempts} attempts. Check the device connection.`, 1);
      return;
    }
    writeInstruction(instruction, params, attempt + 1);
  }, 100);
};

port.on('error', error => finish(`Serial port error: ${error.message}`, 1));

port.on('data', data => {
  const hex = data.toString('hex').toUpperCase();
  for (let i = 0; i < hex.length; i += 2) response.push(hex.slice(i, i + 2));
  if (response.join(' ').endsWith(terminator)) finish(responseToString(response));
});

port.open();
responseTimeoutId = setTimeout(() => {
  finish(`No complete response after ${responseTimeoutMs}ms. Check the device connection.`, 1);
}, responseTimeoutMs);
writeInstruction(instruction, params);
