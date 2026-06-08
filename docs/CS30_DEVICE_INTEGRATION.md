# YardFlow — CS30 Device Integration

**Status:** Architecture design (R7.8 — pre-implementation)  
**Version:** 1.0  
**Related:** [R7_BLUETOOTH_RECEIPT_PRINTING_REPORT.md](../R7_BLUETOOTH_RECEIPT_PRINTING_REPORT.md) · [R7_5_REPRINT_DEVICE_VERIFICATION_REPORT.md](../R7_5_REPRINT_DEVICE_VERIFICATION_REPORT.md) · [SYSTEM_RULES.md](./SYSTEM_RULES.md)

---

## 1. Overview

The YardFlow POS app runs on two primary hardware targets:

| Device | OS | Printer | Integration method |
|--------|-----|---------|-------------------|
| **CS30 Pro** (primary) | Android 10 | Built-in 2-inch 58mm thermal | CS30 SDK via AIDL / PosApiHelper |
| **Generic Android** (fallback) | Android 8+ | External Bluetooth ESC/POS | react-native-bluetooth-classic |

The current implementation (R7) uses Bluetooth exclusively. This document designs the adapter pattern that will support the CS30 built-in printer as the primary path while retaining Bluetooth as fallback.

---

## 2. CS30 Pro SDK Findings

### 2.1 SDK overview

The CS30 Pro (running Android 10.0, build `a51_v0.08_20210324c` or later) exposes a built-in printer via an **AIDL service interface**. The device manufacturer provides a Java-based helper class.

**Required SDK files:**

| File | Purpose |
|------|---------|
| `ICiontekPosService.aidl` | AIDL interface definition for the built-in POS service |
| `PosApiHelper.java` | Java wrapper around the AIDL binder; manages connection lifecycle |

### 2.2 Print API methods

| Method | Parameters | Notes |
|--------|------------|-------|
| `PrintInit()` | — | Reset printer state, set default font and line spacing |
| `PrintStr(String text)` | UTF-8 text string | Append a text string to the print buffer |
| `PrintStart()` | — | Flush buffer and execute the print job |
| `PrintCheckStatus()` | — | Returns current printer status as an integer code |
| `PrintSetGray(int level)` | 1–8 (default 4) | Set print density; higher = darker |
| `PrintSetFont(byte size, byte align, byte attr)` | size: 0=normal 1=double-wide 2=double-height 3=double; align: 0=left 1=center 2=right; attr: 0=normal 1=bold | Set font properties before calling PrintStr |
| `PrintBmp(Bitmap bmp)` | Android Bitmap | Print a raster image (e.g. logo) |
| `PrintBarcode(String data, int symbology, int height, int width, int textPos)` | — | Print 1D barcode |
| `PrintQrCode_Cut(String data, int size, int level)` | size: 1–16; level: 0=L,1=M,2=Q,3=H | Print QR code and auto-cut paper |

### 2.3 Printer status codes

| Code | Meaning | Recommended UX action |
|------|---------|----------------------|
| 0 | Ready | Proceed with print |
| 1 | No paper | Show "Load paper in printer" alert |
| 2 | Too hot | Show "Printer is overheated — wait before printing" |
| 3 | Low voltage | Show "Printer battery low" (if mobile device) |
| 4 | Busy | Retry after short delay (500ms); show spinner |
| 8 | Timeout | Show "Printer timed out — try again" |
| 16 | Data error | Show "Print data error — try again" |
| other | Unknown error | Show "Printer error (code X) — contact support" |

### 2.4 Runtime requirements

- Android OS: **10.0 or later**
- Build number: **a51_v0.08_20210324c or later**
- Service: POS service must be running (system service on CS30, always-on)
- Permissions: `android.permission.INTERNET` (already in manifest); no additional permissions required for built-in printer AIDL

### 2.5 Character set

The CS30 built-in printer operates at **32 characters per line (58mm paper, 2-inch)** — same as the existing `COLS_58MM = 32` constant in `escpos.ts`. The existing `ReceiptData` formatting for 32 columns is directly compatible with the CS30 built-in printer.

---

## 3. Adapter Architecture

### 3.1 PrinterAdapter interface

```typescript
// apps/pos/src/printing/printer.adapter.ts

export interface PrinterAdapter {
  /** Human-readable name for this adapter */
  readonly name: string;

  /** True if this adapter can be used on the current device/runtime */
  isAvailable(): Promise<boolean>;

  /** Print a formatted receipt. Throws on failure. */
  print(receipt: ReceiptData): Promise<void>;

  /** Check printer status before printing. Throws with user-facing message if not ready. */
  checkStatus(): Promise<void>;
}
```

### 3.2 CS30BuiltInPrinterAdapter

```typescript
// apps/pos/src/printing/adapters/cs30-builtin.adapter.ts

export class CS30BuiltInPrinterAdapter implements PrinterAdapter {
  readonly name = 'CS30 Built-in';

  async isAvailable(): Promise<boolean> {
    // Check: is this a CS30 device?
    // Method: check android.os.Build.MODEL for "CS30" or "C30"
    // AND check if PosApiHelper AIDL service is bindable
    // Returns false on non-CS30 devices and in Expo Go
  }

  async checkStatus(): Promise<void> {
    // Call PosApiHelper.PrintCheckStatus()
    // Map status codes to user-facing messages (see §2.3)
    // Throw with message if not ready (status ≠ 0, 4)
    // Retry once on status=4 (busy) after 500ms
  }

  async print(receipt: ReceiptData): Promise<void> {
    // 1. PosApiHelper.PrintInit()
    // 2. PosApiHelper.PrintSetFont(0, 1, 0)  // normal, center, normal
    // 3. PosApiHelper.PrintStr(formatHeader(receipt))  // yard name, title
    // 4. PosApiHelper.PrintSetFont(0, 0, 0)  // normal, left, normal
    // 5. For each receipt line: PosApiHelper.PrintStr(formatLine(line))
    // 6. PosApiHelper.PrintStr(formatTotal(receipt))
    // 7. PosApiHelper.PrintStr(formatFooter(receipt))
    // 8. PosApiHelper.PrintQrCode_Cut(receipt.referenceId, 4, 1)  // optional QR
    //    OR PosApiHelper.PrintStart() if no QR
  }
}
```

**Native module requirement:** `CS30BuiltInPrinterAdapter` requires a React Native native module that bridges to `PosApiHelper.java`. This module is not yet implemented. The adapter class is designed now; the native bridge implementation is R8.3+.

### 3.3 BluetoothEscposPrinterAdapter

```typescript
// apps/pos/src/printing/adapters/bluetooth-escpos.adapter.ts

export class BluetoothEscposPrinterAdapter implements PrinterAdapter {
  readonly name = 'Bluetooth ESC/POS';
  private readonly deviceAddress: string;

  constructor(deviceAddress: string) {
    this.deviceAddress = deviceAddress;
  }

  async isAvailable(): Promise<boolean> {
    return isBluetoothAvailable();  // existing check from printer.service.ts
  }

  async checkStatus(): Promise<void> {
    // Bluetooth status is checked implicitly during connection
    // No pre-flight status API available for generic BT printers
    if (!isBluetoothAvailable()) {
      throw new Error('Bluetooth printing is not available on this device');
    }
  }

  async print(receipt: ReceiptData): Promise<void> {
    const bytes = buildReceiptBytes(receipt);  // existing escpos.ts
    await connectAndPrint(this.deviceAddress, bytes);  // existing printer.service.ts
  }
}
```

### 3.4 FuturePdfShareAdapter (placeholder design)

```typescript
// apps/pos/src/printing/adapters/pdf-share.adapter.ts (future)

export class FuturePdfShareAdapter implements PrinterAdapter {
  readonly name = 'Share as PDF';
  // Not implemented. Design only.
  // When implemented: generate PDF from ReceiptData, open native share sheet
  // Use case: devices without printer, WhatsApp receipt sharing
}
```

### 3.5 PrinterAdapterFactory

```typescript
// apps/pos/src/printing/printer.adapter.factory.ts

export async function getPreferredAdapter(
  savedBluetoothAddress: string | null,
): Promise<PrinterAdapter | null> {
  // Priority 1: CS30 built-in (if on CS30 device)
  const cs30 = new CS30BuiltInPrinterAdapter();
  if (await cs30.isAvailable()) return cs30;

  // Priority 2: Bluetooth (if device paired and address saved)
  if (savedBluetoothAddress) {
    const bt = new BluetoothEscposPrinterAdapter(savedBluetoothAddress);
    if (await bt.isAvailable()) return bt;
  }

  // No printer available
  return null;
}
```

---

## 4. Migration Plan

### Phase 1 (R7 — current): Bluetooth only

- `printer.service.ts` used directly
- `printer.context.tsx` manages device address and print status
- Works on generic Android devices with paired BT printer
- CS30 built-in NOT yet supported

### Phase 2 (R8.3): CS30 native module + adapter refactor

1. Create `PrinterAdapter` interface
2. Implement `BluetoothEscposPrinterAdapter` wrapping existing `printer.service.ts`
3. Write `CS30NativeModule` (Java/Kotlin):
   - `bindPosService()` / `unbindPosService()`
   - `checkStatus(): Promise<number>`
   - `printInit(): Promise<void>`
   - `printStr(text: string): Promise<void>`
   - `printSetFont(size, align, attr): Promise<void>`
   - `printStart(): Promise<void>`
   - `printQrCodeCut(data, size, level): Promise<void>`
4. Implement `CS30BuiltInPrinterAdapter` using the native module
5. Update `printer.context.tsx` to use `PrinterAdapterFactory`
6. Update `PrinterSettingsScreen` to show adapter info (CS30 auto-detected vs Bluetooth)

**No regressions:** Existing `BluetoothEscposPrinterAdapter` is a thin wrapper; all existing BT behavior is preserved.

### Phase 3 (future): PDF/Share adapter

- Add `FuturePdfShareAdapter`
- Allow "no-printer" path that sends receipt as PDF via WhatsApp or email

---

## 5. PrinterSettingsScreen Changes (R8.3)

### Current (R7)

- Shows list of paired Bluetooth devices
- User taps to select active printer
- Test Print button

### After R8.3

```
Printer Settings

┌─────────────────────────────┐
│ Active printer              │
│                             │
│ ● CS30 Built-in  ←auto      │ (shown only on CS30 devices)
│ ○ Bluetooth: RONGTA RPP300  │
└─────────────────────────────┘

[Test Print]

Bluetooth Devices (paired)
  RONGTA RPP300  — 00:11:22:33:44:55  [Select]
  EPSON TM-T20   — 66:77:88:99:AA:BB  [Select]

[Scan for devices]
```

- On CS30: Built-in is shown first and auto-selected if no BT device previously selected.
- On generic Android: Bluetooth section only.
- Both adapters available simultaneously; user picks preference.

---

## 6. ESC/POS vs CS30 SDK Compatibility

The existing `escpos.ts` generates `Uint8Array` ESC/POS bytes for Bluetooth printing. The CS30 built-in printer **does not use ESC/POS byte streams**; it uses text-based `PrintStr()` calls via AIDL.

**This means:**
- `escpos.ts` is used only by `BluetoothEscposPrinterAdapter`.
- `CS30BuiltInPrinterAdapter` uses `ReceiptData` directly and calls `PosApiHelper` methods.
- The `ReceiptData` type (the language-neutral data model) is the shared interface between both paths.
- Column width is 32 for both (58mm paper). No format changes needed.

Both adapters format from the same `ReceiptData`. The format logic may be extracted into a shared `ReceiptFormatter.formatLines(receipt): string[]` helper to avoid duplication.

---

## 7. Testing Strategy

### Unit tests (no device required)

- `BluetoothEscposPrinterAdapter.print()` — mock `connectAndPrint`; verify correct bytes passed
- `CS30BuiltInPrinterAdapter.print()` — mock `CS30NativeModule`; verify correct API call sequence
- `PrinterAdapterFactory` — verify CS30 takes priority on CS30 device mock
- Status code mapping — verify all codes map to correct user messages

### Device tests (require hardware)

- CS30 Pro: full print cycle — purchase receipt, supplier payment receipt
- CS30 Pro: paper-out handling — remove paper, verify error message
- Generic Android: Bluetooth receipt print — existing flow unchanged

### Regression guard

All existing Bluetooth printing tests from R7 must continue passing after the adapter refactor. The `BluetoothEscposPrinterAdapter` wraps the existing `printer.service.ts` functions directly — no logic change.
