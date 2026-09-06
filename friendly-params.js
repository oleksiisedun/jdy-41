export const baudRates = {
  '1200': '01',
  '2400': '02',
  '4800': '03',
  '9600': '04',
  '19200': '05',
  '38400': '06'
};

export const powerLevels = {
  '-25db': '01',
  '-15db': '02',
  '-5db': '03',
  '0db': '04',
  '3db': '05',
  '6db': '06',
  '9db': '07',
  '10db': '08',
  '12db': '09'
};

export const modes = {
  'transparent': 'A0',
  'remote-tx-led': 'C0',
  'remote-tx': 'C1',
  'remote-rx-sync': 'C2',
  'remote-rx-reverse': 'C3',
  'remote-rx-pulse': 'C4',
  'learning-rx-sync': 'C5',
  'learning-rx-reverse-pulse': 'C6',
  'learning-rx-pulse': 'C7'
};

const wirelessIdRegex = /^[0-9A-Fa-f]{8}$/;
const requiredFlags = ['baud', 'channel', 'power', 'mode', 'id', 'response'];

/**
 * Looks up a friendly value in a map, throwing a descriptive error listing valid choices if absent.
 * @param {string} label
 * @param {Record<string, string>} map
 * @param {string} [value]
 * @returns {string}
 */
const lookup = (label, map, value) => {
  const hex = map[value?.toLowerCase()];
  if (!hex) throw new Error(`Invalid ${label} "${value}". Valid values: ${Object.keys(map).join(', ')}`);
  return hex;
};

/**
 * Converts friendly `configure` flags into the hex parameter bytes expected by the
 * configure-parameters instruction (baud, channel, power, mode, 4x wireless ID, response, backup).
 * @param {{ baud?: string, channel?: string, power?: string, mode?: string, id?: string, response?: string }} flags
 * @returns {string[]}
 */
export function resolveConfigureParams(flags) {
  const missing = requiredFlags.filter(key => !flags[key]);
  if (missing.length) throw new Error(`Missing required flag(s): ${missing.map(f => `--${f}`).join(', ')}. Run with --help for usage.`);

  const { baud, channel, power, mode, id, response } = flags;
  const baudHex = lookup('baud', baudRates, baud);
  const channelNumber = Number(channel);
  if (!Number.isInteger(channelNumber) || channelNumber < 0 || channelNumber > 127) {
    throw new Error(`Invalid channel "${channel}". Must be an integer 0-127.`);
  }
  const channelHex = channelNumber.toString(16).padStart(2, '0').toUpperCase();
  const powerHex = lookup('power', powerLevels, power);
  const modeHex = lookup('mode', modes, mode);
  if (!wirelessIdRegex.test(id)) throw new Error(`Invalid wireless ID "${id}". Must be 8 hex digits, e.g. AABBCCDD.`);
  const idBytes = id.toUpperCase().match(/../g);
  const responseValue = response?.toLowerCase();
  if (!['yes', 'no'].includes(responseValue)) throw new Error(`Invalid response "${response}". Must be "yes" or "no".`);
  const responseHex = responseValue === 'yes' ? '01' : '00';

  return [baudHex, channelHex, powerHex, modeHex, ...idBytes, responseHex, '00'];
}

/**
 * Returns the --help text for the `configure` command, listing all accepted flag values.
 * @returns {string}
 */
export function configureHelpText() {
  return [
    'Usage: npm start configure [options]',
    '',
    `  --baud <${Object.keys(baudRates).join('|')}>`,
    '  --channel <0-127>',
    `  --power <${Object.keys(powerLevels).join('|')}>`,
    `  --mode <${Object.keys(modes).join('|')}>`,
    '  --id <8 hex digits, e.g. AABBCCDD>',
    '  --response <yes|no>',
    '',
    'Example:',
    '  npm start configure --baud 9600 --channel 5 --power 0db \\',
    '    --mode transparent --id AABBCCDD --response no'
  ].join('\n');
}
