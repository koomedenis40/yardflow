/**
 * Bluetooth printer service abstraction for ESC/POS printing.
 * Wraps react-native-bluetooth-classic with graceful fallback.
 *
 * REQUIRES a development build — will not work in Expo Go.
 * Build with: expo run:android  OR  eas build --profile development
 */

export interface BTPrinterDevice {
  address: string;
  name: string;
}

// Lazy-load the native BT module; fails silently in Expo Go / un-linked builds
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let RNBt: Record<string, any> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('react-native-bluetooth-classic') as { default?: unknown };
  RNBt = (mod.default ?? mod) as Record<string, any>;
} catch {
  // Module not linked — Expo Go or pre-prebuild
}

export function isBluetoothAvailable(): boolean {
  return RNBt !== null;
}

export async function isBluetoothEnabled(): Promise<boolean> {
  if (!RNBt) return false;
  try {
    return (await (RNBt['isBluetoothEnabled'] as () => Promise<boolean>)()) === true;
  } catch {
    return false;
  }
}

/** Returns Android-paired (bonded) devices — no active scan needed. */
export async function listPairedDevices(): Promise<BTPrinterDevice[]> {
  if (!RNBt) throw new Error(ERR_NO_MODULE);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const devices = (await (RNBt['getBondedDevices'] as () => Promise<any[]>)()) as any[];
  return devices.map((d) => ({ address: d.address as string, name: (d.name as string) || d.address }));
}

/**
 * Connect to the paired device, write the ESC/POS bytes, then disconnect.
 * Each print is a fresh connection — safe for one-shot receipt printing.
 */
export async function connectAndPrint(address: string, data: Uint8Array): Promise<void> {
  if (!RNBt) throw new Error(ERR_NO_MODULE);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const device = (await (RNBt['connectToDevice'] as (a: string) => Promise<any>)(address)) as any;

  try {
    // ESC/POS bytes are ASCII-safe (<0x80). Convert to string for BT write.
    const printStr = Array.from(data, (b) => String.fromCharCode(b)).join('');
    await (device['write'] as (s: string) => Promise<boolean>)(printStr);
  } finally {
    try {
      await (device['disconnect'] as () => Promise<boolean>)();
    } catch {
      // Ignore disconnect errors
    }
  }
}

const ERR_NO_MODULE =
  'Bluetooth printing is not available in Expo Go. ' +
  'Build a dev client with `expo run:android` or EAS Build.';
