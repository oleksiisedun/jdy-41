import { SerialPort } from 'serialport';

const baudRate = 9600;

/**
 * Finds the path of the first connected serial port whose path matches regex.
 * @param {RegExp} [regex]
 * @returns {Promise<string>}
 */
async function getPortPath(regex = /tty.*usb/i) {
  const ports = await SerialPort.list();
  const port = ports.find(({ path }) => regex.test(path));
  if (!port) throw new Error('Serial port not found');

  return port.path;
}

const path = await getPortPath().catch(error => {
  console.error(error.message);
  process.exit(1);
});

export default new SerialPort({ baudRate, path, autoOpen: false });
