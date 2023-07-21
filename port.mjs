import { SerialPort } from 'serialport';

const BAUD_RATE = 9600;

// Manual port path
// const PATH = '/dev/ttyUSB0';

// Automatic port path
const { path: PATH } = (await SerialPort.list()).find(({ path }) => /tty.*usb/i.test(path));

export default new SerialPort({
  path: PATH,
  baudRate: BAUD_RATE,
  autoOpen: false
});
