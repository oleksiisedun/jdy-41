export const terminator = '0D 0A';
export const plus = '2B';
const hexByteRegex = /^[0-9A-Fa-f]{2}$/;

/**
 * Validates that every CLI param is a two-digit hex byte, throwing otherwise.
 * @param {string[]} params
 * @returns {void}
 */
export const validateParams = params => {
  const invalid = params.filter(param => !hexByteRegex.test(param));
  if (invalid.length) throw new Error(`Invalid hex byte(s): ${invalid.join(' ')}`);
};

/**
 * Converts a space-separated hex byte string into a Buffer.
 * @param {string} instructionString
 * @returns {Buffer}
 */
export const getBuffer = instructionString => Buffer.from(instructionString.split(' ').map(n => parseInt(n, 16)));

/**
 * Decodes an accumulated response into a readable string, treating a
 * leading '+' byte as an ASCII payload and anything else as raw hex.
 * @param {string[]} response
 * @returns {string}
 */
export const responseToString = response => response[0] === plus ?
  response.slice(0, -2).map(hex => String.fromCharCode(parseInt(hex, 16))).join('') :
  response.join(' ');

/**
 * Builds the full instruction string (head, optional params, terminator).
 * @param {string} head
 * @param {string[]} params
 * @returns {string}
 */
export const getInstruction = (head, params) => params.length ?
  `${head} ${params.join(' ')} ${terminator}` :
  `${head} ${terminator}`;
