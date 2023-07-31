import { SerialPort } from 'serialport';

const BAUD_RATE = 9600;
const PATH = await getPortPath();

async function getPortPath() {
  const ports = await SerialPort.list();
  const port = ports.find(({ path }) => /tty.*usb/i.test(path));
  if (!port) throw new Error('Serial port not found');

  return port.path;
}

export default new SerialPort({
  path: PATH,
  baudRate: BAUD_RATE,
  autoOpen: false
});
