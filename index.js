import port from './port.mjs';

const terminator = '0D 0A';
const headsOfInstructions = {
  'reset': 'AB E3',
  'read-device-id': 'F2 AD',
  'read-version-number': 'AB CD',
  'read-parameters': 'AA E2',
  'configure-parameters': 'A9 E1',
  'configure-device-id': 'F1 AE',
  'send-address-message': 'B1 CA'
};
const instructions = Object.keys(headsOfInstructions);

const [instruction, ...params] = process.argv.slice(2);
const response = [];

const getBuffer = instruction => Buffer.from(instruction.split(' ').map(n => parseInt(n, 16)));

const responseToString = (response, head = '2B') => response[0] === head ?
  response.slice(0, -2).map(hex => String.fromCharCode(parseInt(hex, 16))).join('') :
  response.join(' ');

const getInstruction = (head, params) => params.length ? 
  `${head} ${params.join(' ')} ${terminator}` : 
  `${head} ${terminator}`;

const writeInstruction = (instruction, params) => {
  port.write(getBuffer(getInstruction(headsOfInstructions[instruction], params)));
  setTimeout(() => {
    if (!response.length) writeInstruction(instruction, params);
  }, 100);
};

port.on('data', data => {
  response.push(data.toString('hex').toUpperCase());
  if (response.join(' ').endsWith(terminator)) {
    console.log(responseToString(response));
    port.close();
  }
});

if (instructions.includes(instruction)) {
  port.open();
  writeInstruction(instruction, params);
} else {
  console.log('An invalid instruction was provided');
  console.log(`Valid instructions: ${instructions.join(', ')}`);
};
