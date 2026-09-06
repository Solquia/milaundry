/**
 * The only file that talks to a radio.
 *
 * `react-native-ble-plx` is a native module, so it exists in a development
 * build and not in Expo Go or on the web. Everything here is behind a lazy
 * require and a support check so the rest of the app, and every test, can
 * import the printer feature without dragging the module in. When the module
 * is missing the transport reports `isSupported() === false` and the settings
 * card explains rather than crashes.
 *
 * Thermal printers are simple peripherals: connect, find the one writable
 * characteristic, push bytes in MTU-sized slices, disconnect. Nothing comes
 * back, so there is nothing to subscribe to.
 */

import { PermissionsAndroid, Platform } from 'react-native';

import { bytesToBase64, chunkBytes } from '../domain/escpos';
import { pickWriteCharacteristic, type ScannedDevice } from '../domain/printer';

type BleModule = typeof import('react-native-ble-plx');
type BleManager = InstanceType<BleModule['BleManager']>;

/** Safe on any BLE stack: the default ATT MTU is 23, less a 3-byte header. */
const SAFE_CHUNK = 20;
/** What Android printers tend to accept when asked; iOS negotiates on its own. */
const WANTED_MTU = 185;
const CONNECT_TIMEOUT_MS = 10_000;
/** A short breath between writes keeps cheap printers from dropping packets. */
const WRITE_GAP_MS = 12;

let bleModule: BleModule | null | undefined;
let manager: BleManager | null = null;

function loadModule(): BleModule | null {
  if (bleModule !== undefined) return bleModule;
  if (Platform.OS === 'web') {
    bleModule = null;
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    bleModule = require('react-native-ble-plx') as BleModule;
  } catch {
    bleModule = null;
  }
  return bleModule;
}

function getManager(): BleManager | null {
  if (manager) return manager;
  const mod = loadModule();
  if (!mod) return null;
  try {
    manager = new mod.BleManager();
  } catch {
    manager = null;
  }
  return manager;
}

export function isSupported(): boolean {
  return getManager() !== null;
}

/** Android 12+ asks for scan and connect; older Android needs location for a scan. */
async function ensurePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const level = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
  const wanted =
    level >= 31
      ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const results = await PermissionsAndroid.requestMultiple(wanted);
  return wanted.every((permission) => results[permission] === PermissionsAndroid.RESULTS.GRANTED);
}

async function ensurePoweredOn(ble: BleManager): Promise<void> {
  const state = await ble.state();
  if (state === 'PoweredOn') return;
  if (state === 'PoweredOff') throw new Error('Bluetooth is turned off. Turn it on and try again.');
  if (state === 'Unauthorized') throw new Error('MiLaundry is not allowed to use Bluetooth. Allow it in Settings.');
  if (state === 'Unsupported') throw new Error('This phone has no Bluetooth Low Energy.');
  // Unknown/Resetting: give the stack a moment to settle.
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      sub.remove();
      reject(new Error('Bluetooth is not ready. Try again in a moment.'));
    }, 3000);
    const sub = ble.onStateChange((next) => {
      if (next === 'PoweredOn') {
        clearTimeout(timer);
        sub.remove();
        resolve();
      }
    }, true);
  });
}

export interface ScanHandle {
  stop: () => void;
}

/**
 * Streams every advertisement seen; the hook ranks and dedupes them. The
 * returned handle stops the scan, and the caller must call it: a BLE scan
 * left running drains the battery and blocks connecting on some phones.
 */
export async function startScan(
  onDevice: (device: ScannedDevice) => void,
  onError: (message: string) => void
): Promise<ScanHandle> {
  const ble = getManager();
  if (!ble) throw new Error('Printing needs a development build.');
  if (!(await ensurePermissions())) throw new Error('Bluetooth permission was not granted.');
  await ensurePoweredOn(ble);

  ble.startDeviceScan(null, { allowDuplicates: true }, (error, device) => {
    if (error) {
      onError(error.message);
      return;
    }
    if (!device) return;
    onDevice({ id: device.id, name: device.name ?? device.localName ?? null, rssi: device.rssi ?? null });
  });
  return { stop: () => ble.stopDeviceScan() };
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Connects, discovers, writes the whole job, and disconnects. A receipt is a
 * few hundred bytes; holding the link open between prints buys nothing and
 * stops the printer pairing with a second phone.
 */
export async function printBytes(deviceId: string, bytes: number[]): Promise<void> {
  const ble = getManager();
  if (!ble) throw new Error('Printing needs a development build.');
  if (!(await ensurePermissions())) throw new Error('Bluetooth permission was not granted.');
  await ensurePoweredOn(ble);

  let device = await ble.connectToDevice(deviceId, { timeout: CONNECT_TIMEOUT_MS });
  try {
    device = await device.discoverAllServicesAndCharacteristics();
    let chunk = SAFE_CHUNK;
    if (Platform.OS === 'android') {
      try {
        const withMtu = await device.requestMTU(WANTED_MTU);
        chunk = Math.max(SAFE_CHUNK, (withMtu.mtu ?? 23) - 3);
      } catch {
        // The printer refused a bigger MTU; the safe size still works.
      }
    }

    const services = await device.services();
    const characteristics = (
      await Promise.all(services.map((service) => service.characteristics()))
    ).flat();
    const target = pickWriteCharacteristic(characteristics);
    if (!target) throw new Error('This device does not accept print data. Is it a receipt printer?');

    for (const slice of chunkBytes(bytes, chunk)) {
      const value = bytesToBase64(slice);
      if (target.isWritableWithoutResponse) {
        await device.writeCharacteristicWithoutResponseForService(target.serviceUUID, target.uuid, value);
      } else {
        await device.writeCharacteristicWithResponseForService(target.serviceUUID, target.uuid, value);
      }
      await wait(WRITE_GAP_MS);
    }
    // Let the last packet land before the link drops under it.
    await wait(200);
  } finally {
    try {
      await device.cancelConnection();
    } catch {
      // Already gone; nothing to release.
    }
  }
}
