import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateParams,
  getBuffer,
  responseToString,
  getInstruction,
  toHexBytes,
  appendChunk,
  isComplete,
  instructions
} from '../protocol.js';

describe('validateParams', () => {
  test('accepts two-digit hex bytes', () => {
    assert.doesNotThrow(() => validateParams(['00', 'AB', 'ff']));
  });

  test('rejects non-hex or wrong-length params, listing all of them', () => {
    assert.throws(() => validateParams(['00', 'ZZ', 'A']), /Invalid hex byte\(s\): ZZ A/);
  });

  test('accepts an empty param list', () => {
    assert.doesNotThrow(() => validateParams([]));
  });
});

describe('getBuffer', () => {
  test('converts a space-separated hex string into a Buffer', () => {
    assert.deepEqual(getBuffer('AB CD 0D 0A'), Buffer.from([0xab, 0xcd, 0x0d, 0x0a]));
  });
});

describe('getInstruction', () => {
  test('appends the terminator with params', () => {
    assert.equal(getInstruction('A9 E1', ['04', '00']), 'A9 E1 04 00 0D 0A');
  });

  test('appends the terminator with no params', () => {
    assert.equal(getInstruction('AB E3', []), 'AB E3 0D 0A');
  });
});

describe('responseToString', () => {
  test('decodes a "+"-prefixed response as ASCII, dropping only the terminator', () => {
    // '+' 'O' 'K' <CR> <LF>
    assert.equal(responseToString(['2B', '4F', '4B', '0D', '0A']), '+OK');
  });

  test('renders a non-"+" response as raw hex bytes, terminator included', () => {
    assert.equal(responseToString(['04', '00', '09', 'A0', '0D', '0A']), '04 00 09 A0 0D 0A');
  });
});

describe('toHexBytes', () => {
  test('splits into uppercase two-digit bytes', () => {
    assert.deepEqual(toHexBytes('aabb0d'), ['AA', 'BB', '0D']);
  });

  test('returns an empty array for an empty string', () => {
    assert.deepEqual(toHexBytes(''), []);
  });
});

describe('appendChunk + isComplete', () => {
  test('accumulates a multi-byte chunk and detects the terminator', () => {
    const response = appendChunk([], Buffer.from([0x04, 0x00, 0x0d, 0x0a]));
    assert.deepEqual(response, ['04', '00', '0D', '0A']);
    assert.equal(isComplete(response), true);
  });

  test('is incomplete until a terminator split across chunks fully arrives', () => {
    const partial = appendChunk([], Buffer.from([0x2b, 0x4f, 0x0d]));
    assert.equal(isComplete(partial), false);
    assert.equal(isComplete(appendChunk(partial, Buffer.from([0x0a]))), true);
  });

  test('treats an empty response as incomplete', () => {
    assert.equal(isComplete([]), false);
  });
});

/**
 * Feeds a reply one byte per data event, like a slow serial link, and returns
 * the response at the moment the data handler would consider it complete.
 * @param {string} instruction
 * @param {number[]} bytes
 * @returns {string[]}
 */
const receiveBytewise = (instruction, bytes) => {
  let response = /** @type {string[]} */ ([]);
  for (const byte of bytes) {
    response = appendChunk(response, Buffer.from([byte]));
    if (isComplete(response, instructions[instruction].replyLength)) break;
  }
  return response;
};

describe('isComplete with a fixed reply length', () => {
  test('does not stop at a 0D 0A inside a read-device-id reply', () => {
    // Device ID 110D0A44
    const reply = [0xf2, 0xad, 0x11, 0x0d, 0x0a, 0x44, 0x0d, 0x0a];
    assert.equal(responseToString(receiveBytewise('read-device-id', reply)), 'F2 AD 11 0D 0A 44 0D 0A');
  });

  test('does not stop at a 0D 0A inside a read-parameters reply', () => {
    // Wireless ID 660D0A55
    const reply = [0xaa, 0xe2, 0x04, 0x00, 0x09, 0xa0, 0x66, 0x0d, 0x0a, 0x55, 0x00, 0x05, 0x0d, 0x0a];
    assert.equal(
      responseToString(receiveBytewise('read-parameters', reply)),
      'AA E2 04 00 09 A0 66 0D 0A 55 00 05 0D 0A'
    );
  });

  test('is incomplete until the expected length arrives', () => {
    assert.equal(isComplete(['F2', 'AD', '0D', '0A'], 8), false);
    assert.equal(isComplete(['F2', 'AD', '11', '22', '33', '44', '0D', '0A'], 8), true);
  });
});
