import port from './port.mjs';

const terminator = '0D 0A';
const plus = '2B';
const maxAttempts = 20;
const responseTimeoutMs = 5000;
const hexByteRegex = /^[0-9A-Fa-f]{2}$/;
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
const [instruction, ...params] = process.argv.slice(2);
const response = [];
let settled = false;
let responseTimeoutId;

/**
 * Converts a space-separated hex byte string into a Buffer.
 * @param {string} instructionString
 * @returns {Buffer}
 */
const getBuffer = instructionString => Buffer.from(instructionString.split(' ').map(n => parseInt(n, 16)));

/**
 * Decodes an accumulated response into a readable string, treating a
 * leading '+' byte as an ASCII payload and anything else as raw hex.
 * @param {string[]} response
 * @returns {string}
 */
const responseToString = response => response[0] === plus ?
  response.slice(0, -2).map(hex => String.fromCharCode(parseInt(hex, 16))).join('') :
  response.join(' ');

/**
 * Builds the full instruction string (head, optional params, terminator).
 * @param {string} head
 * @param {string[]} params
 * @returns {string}
 */
const getInstruction = (head, params) => params.length ?
  `${head} ${params.join(' ')} ${terminator}` :
  `${head} ${terminator}`;

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

/**
 * Validates that every CLI param is a two-digit hex byte, throwing otherwise.
 * @param {string[]} params
 * @returns {void}
 */
const validateParams = params => {
  const invalid = params.filter(param => !hexByteRegex.test(param));
  if (invalid.length) throw new Error(`Invalid hex byte(s): ${invalid.join(' ')}`);
};

port.on('error', error => finish(`Serial port error: ${error.message}`, 1));

port.on('data', data => {
  const hex = data.toString('hex').toUpperCase();
  for (let i = 0; i < hex.length; i += 2) response.push(hex.slice(i, i + 2));
  if (response.join(' ').endsWith(terminator)) finish(responseToString(response));
});

if (!instructions.includes(instruction)) throw new Error(`Instruction not found: ${instructions.join(' ')}`);
validateParams(params);

port.open();
responseTimeoutId = setTimeout(() => {
  finish(`No complete response after ${responseTimeoutMs}ms. Check the device connection.`, 1);
}, responseTimeoutMs);
writeInstruction(instruction, params);
