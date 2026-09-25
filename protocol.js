export const terminator = '0D 0A';
export const plus = '2B';
const hexByteRegex = /^[0-9A-Fa-f]{2}$/;

/**
 * Every CLI instruction: its hex command head and, where the manual documents a
 * fixed-length binary reply, that reply's byte count (head + data + terminator).
 * A fixed length is needed because binary data (e.g. a device ID) can itself
 * contain 0D 0A, which would otherwise be mistaken for the terminator.
 * @type {Record<string, { head: string, replyLength?: number }>}
 */
export const instructions = {
  reset: { head: 'AB E3' },
  'read-device-id': { head: 'F2 AD', replyLength: 8 }, // manual §6.7
  'read-version-number': { head: 'AB CD' },
  'read-parameters': { head: 'AA E2', replyLength: 14 }, // manual §6.4
  'configure-parameters': { head: 'A9 E1' },
  'configure-device-id': { head: 'F1 AE' },
  'send-address-message': { head: 'B1 CA' }
};

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
export const responseToString = response =>
  response[0] === plus
    ? response
        .slice(0, -2)
        .map(hex => String.fromCharCode(parseInt(hex, 16)))
        .join('')
    : response.join(' ');

/**
 * Builds the full instruction string (head, optional params, terminator).
 * @param {string} head
 * @param {string[]} params
 * @returns {string}
 */
export const getInstruction = (head, params) =>
  params.length ? `${head} ${params.join(' ')} ${terminator}` : `${head} ${terminator}`;

/**
 * Splits a hex string into uppercase two-digit byte strings, e.g. 'aabb' → ['AA', 'BB'].
 * @param {string} hex
 * @returns {string[]}
 */
export const toHexBytes = hex => hex.toUpperCase().match(/../g) ?? [];

/**
 * Appends a raw serial data chunk (of any size) to the accumulated response bytes.
 * @param {string[]} response
 * @param {Buffer} chunk
 * @returns {string[]}
 */
export const appendChunk = (response, chunk) => [...response, ...toHexBytes(chunk.toString('hex'))];

/**
 * Reports whether the accumulated response is complete: once expectedLength bytes
 * have arrived when the reply length is known, otherwise once it ends with the terminator.
 * @param {string[]} response
 * @param {number} [expectedLength]
 * @returns {boolean}
 */
export const isComplete = (response, expectedLength) =>
  expectedLength ? response.length >= expectedLength : response.join(' ').endsWith(terminator);
