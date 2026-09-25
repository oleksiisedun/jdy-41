import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfigureParams, configureHelpText } from '../friendly-params.js';

const validFlags = {
  baud: '9600',
  channel: '5',
  power: '0db',
  mode: 'transparent',
  id: 'AABBCCDD',
  response: 'no'
};

describe('resolveConfigureParams', () => {
  test('resolves friendly flags into the hex byte array', () => {
    assert.deepEqual(
      resolveConfigureParams(validFlags),
      ['04', '05', '04', 'A0', 'AA', 'BB', 'CC', 'DD', '00', '00']
    );
  });

  test('is case-insensitive for value flags', () => {
    assert.deepEqual(
      resolveConfigureParams({ ...validFlags, mode: 'TRANSPARENT', response: 'NO' }),
      resolveConfigureParams(validFlags)
    );
  });

  test('throws listing all missing required flags', () => {
    assert.throws(
      () => resolveConfigureParams({ baud: '9600' }),
      /Missing required flag\(s\): --channel, --power, --mode, --id, --response/
    );
  });

  test('rejects a channel outside 0-127', () => {
    assert.throws(() => resolveConfigureParams({ ...validFlags, channel: '128' }), /Invalid channel/);
  });

  test('encodes channel boundaries as zero-padded uppercase hex', () => {
    const cases = [['0', '00'], ['10', '0A'], ['127', '7F']];
    for (const [channel, hex] of cases) {
      assert.equal(resolveConfigureParams({ ...validFlags, channel })[1], hex);
    }
  });

  test('rejects a non-integer channel', () => {
    assert.throws(() => resolveConfigureParams({ ...validFlags, channel: 'five' }), /Invalid channel/);
  });

  test('rejects an unknown baud rate, listing valid values', () => {
    assert.throws(() => resolveConfigureParams({ ...validFlags, baud: '57600' }), /Valid values: 1200, 2400/);
  });

  test('rejects a wireless ID that is not 8 hex digits', () => {
    assert.throws(() => resolveConfigureParams({ ...validFlags, id: 'AABBCC' }), /Invalid wireless ID/);
  });

  test('rejects a response value other than yes/no', () => {
    assert.throws(() => resolveConfigureParams({ ...validFlags, response: 'maybe' }), /Invalid response/);
  });
});

describe('configureHelpText', () => {
  test('lists every flag', () => {
    const text = configureHelpText();
    for (const flag of ['--baud', '--channel', '--power', '--mode', '--id', '--response']) {
      assert.match(text, new RegExp(flag.replace('-', '\\-')));
    }
  });
});
