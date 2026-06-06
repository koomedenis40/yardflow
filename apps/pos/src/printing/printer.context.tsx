import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildReceiptBytes } from './escpos';
import { connectAndPrint, listPairedDevices, isBluetoothAvailable, type BTPrinterDevice } from './printer.service';
import type { ReceiptData } from './receipt.types';

const DEVICE_KEY = 'yf.printer.device';

export type PrintStatus = 'idle' | 'connecting' | 'printing' | 'success' | 'error';

interface PrinterContextValue {
  savedDevice: BTPrinterDevice | null;
  pairedDevices: BTPrinterDevice[];
  isScanning: boolean;
  printStatus: PrintStatus;
  printError: string | null;
  btAvailable: boolean;
  scanPairedDevices(): Promise<void>;
  selectDevice(device: BTPrinterDevice): Promise<void>;
  clearDevice(): Promise<void>;
  printReceipt(receipt: ReceiptData): Promise<void>;
  resetPrintStatus(): void;
}

const PrinterContext = createContext<PrinterContextValue | null>(null);

export function PrinterProvider({ children }: { children: ReactNode }) {
  const [savedDevice, setSavedDevice] = useState<BTPrinterDevice | null>(null);
  const [pairedDevices, setPairedDevices] = useState<BTPrinterDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [printStatus, setPrintStatus] = useState<PrintStatus>('idle');
  const [printError, setPrintError] = useState<string | null>(null);

  // Load persisted device on mount
  useEffect(() => {
    void AsyncStorage.getItem(DEVICE_KEY).then((raw) => {
      if (raw) {
        try {
          const d = JSON.parse(raw) as BTPrinterDevice;
          setSavedDevice(d);
        } catch {
          // corrupt entry — ignore
        }
      }
    });
  }, []);

  const scanPairedDevices = useCallback(async () => {
    setIsScanning(true);
    try {
      const devices = await listPairedDevices();
      setPairedDevices(devices);
    } catch (err) {
      setPairedDevices([]);
    } finally {
      setIsScanning(false);
    }
  }, []);

  const selectDevice = useCallback(async (device: BTPrinterDevice) => {
    setSavedDevice(device);
    await AsyncStorage.setItem(DEVICE_KEY, JSON.stringify(device));
  }, []);

  const clearDevice = useCallback(async () => {
    setSavedDevice(null);
    await AsyncStorage.removeItem(DEVICE_KEY);
  }, []);

  const printReceipt = useCallback(async (receipt: ReceiptData) => {
    if (!savedDevice) {
      setPrintStatus('error');
      setPrintError('No printer selected. Go to More → Printer to set one up.');
      return;
    }

    setPrintStatus('connecting');
    setPrintError(null);

    try {
      const bytes = buildReceiptBytes(receipt);
      setPrintStatus('printing');
      await connectAndPrint(savedDevice.address, bytes);
      setPrintStatus('success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Print failed';
      setPrintStatus('error');
      setPrintError(msg);
    }
  }, [savedDevice]);

  const resetPrintStatus = useCallback(() => {
    setPrintStatus('idle');
    setPrintError(null);
  }, []);

  const value = useMemo<PrinterContextValue>(
    () => ({
      savedDevice,
      pairedDevices,
      isScanning,
      printStatus,
      printError,
      btAvailable: isBluetoothAvailable(),
      scanPairedDevices,
      selectDevice,
      clearDevice,
      printReceipt,
      resetPrintStatus,
    }),
    [savedDevice, pairedDevices, isScanning, printStatus, printError, scanPairedDevices, selectDevice, clearDevice, printReceipt, resetPrintStatus],
  );

  return <PrinterContext.Provider value={value}>{children}</PrinterContext.Provider>;
}

export function usePrinter(): PrinterContextValue {
  const ctx = useContext(PrinterContext);
  if (!ctx) throw new Error('usePrinter requires PrinterProvider');
  return ctx;
}
