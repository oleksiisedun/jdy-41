import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateParams,
  getBuffer,
  responseToString,
  getInstruction,
  toHexBytes,
  appendChunk,
  isComplete
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
