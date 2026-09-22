import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateParams, getBuffer, responseToString, getInstruction } from '../protocol.js';

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
    assert.deepEqual(getBuffer('AB CD 0D 0A'), Buffer.from([0xAB, 0xCD, 0x0D, 0x0A]));
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
