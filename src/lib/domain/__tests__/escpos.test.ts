import {
  ESC,
  GS,
  initialize,
  align,
  bold,
  doubleSize,
  textLine,
  feed,
  cut,
  qrCode,
  chunkBytes,
  toAscii,
  bytesToBase64,
} from '../escpos';

// ESC/POS is a byte protocol, so every test pins exact bytes. A printer
// does not forgive an off-by-one: a wrong parameter byte prints garbage
// or nothing at all, which is why these are literal arrays not shapes.

describe('control commands', () => {
  it('initialize resets the printer with ESC @', () => {
    expect(initialize()).toEqual([ESC, 0x40]);
  });

  it('align maps left/center/right onto ESC a 0/1/2', () => {
    expect(align('left')).toEqual([ESC, 0x61, 0]);
    expect(align('center')).toEqual([ESC, 0x61, 1]);
    expect(align('right')).toEqual([ESC, 0x61, 2]);
  });

  it('bold toggles ESC E', () => {
    expect(bold(true)).toEqual([ESC, 0x45, 1]);
    expect(bold(false)).toEqual([ESC, 0x45, 0]);
  });

  it('doubleSize sets GS ! to double width and height, and back', () => {
    expect(doubleSize(true)).toEqual([GS, 0x21, 0x11]);
    expect(doubleSize(false)).toEqual([GS, 0x21, 0x00]);
  });

  it('feed emits ESC d n and clamps to the one-byte range', () => {
    expect(feed(3)).toEqual([ESC, 0x64, 3]);
    expect(feed(0)).toEqual([ESC, 0x64, 0]);
    expect(feed(999)).toEqual([ESC, 0x64, 255]);
  });

  it('cut feeds and partial-cuts with GS V 66 0', () => {
    expect(cut()).toEqual([GS, 0x56, 66, 0]);
  });
});

describe('text', () => {
  it('toAscii keeps printable ASCII and replaces everything else with ?', () => {
    expect(toAscii('Wash 5kg')).toEqual([87, 97, 115, 104, 32, 53, 107, 103]);
    // The peso sign is outside code page 0; the receipt builder avoids it,
    // but the encoder must still never emit a multi-byte UTF-8 sequence.
    expect(toAscii('₱5')).toEqual([63, 53]);
    expect(toAscii('café')).toEqual([99, 97, 102, 63]);
  });

  it('textLine appends a line feed', () => {
    expect(textLine('Hi')).toEqual([72, 105, 0x0a]);
    expect(textLine('')).toEqual([0x0a]);
  });
});

describe('qrCode', () => {
  const data = 'milaundry://order/abc?token=xyz';
  const bytes = qrCode(data, 6);

  it('selects model 2, then size, then error correction, then stores, then prints', () => {
    const model = [GS, 0x28, 0x6b, 4, 0, 49, 65, 50, 0];
    const size = [GS, 0x28, 0x6b, 3, 0, 49, 67, 6];
    const ec = [GS, 0x28, 0x6b, 3, 0, 49, 69, 49];
    const storeHeader = [GS, 0x28, 0x6b, data.length + 3, 0, 49, 80, 48];
    const print = [GS, 0x28, 0x6b, 3, 0, 49, 81, 48];
    expect(bytes.slice(0, model.length)).toEqual(model);
    let at = model.length;
    expect(bytes.slice(at, at + size.length)).toEqual(size);
    at += size.length;
    expect(bytes.slice(at, at + ec.length)).toEqual(ec);
    at += ec.length;
    expect(bytes.slice(at, at + storeHeader.length)).toEqual(storeHeader);
    at += storeHeader.length;
    expect(bytes.slice(at, at + data.length)).toEqual(toAscii(data));
    at += data.length;
    expect(bytes.slice(at)).toEqual(print);
  });

  it('splits the store length across pL and pH for long payloads', () => {
    const long = 'x'.repeat(300);
    const out = qrCode(long, 4);
    // The store header is GS ( k pL pH 49 80 48; find the 80 that follows 49.
    const storeAt = out.findIndex((b, i) => b === 49 && out[i + 1] === 80 && out[i + 2] === 48);
    const pL = out[storeAt - 2];
    const pH = out[storeAt - 1];
    expect(pL + pH * 256).toBe(303);
  });

  it('clamps the module size to the 1..16 range printers accept', () => {
    expect(qrCode('a', 0)[16]).toBe(1);
    expect(qrCode('a', 99)[16]).toBe(16);
  });
});

describe('chunkBytes', () => {
  it('slices a byte list into MTU-sized pieces without losing bytes', () => {
    const bytes = Array.from({ length: 45 }, (_, i) => i);
    const chunks = chunkBytes(bytes, 20);
    expect(chunks.map((c) => c.length)).toEqual([20, 20, 5]);
    expect(chunks.flat()).toEqual(bytes);
  });

  it('returns no chunks for an empty payload and guards a zero size', () => {
    expect(chunkBytes([], 20)).toEqual([]);
    expect(chunkBytes([1, 2, 3], 0)).toEqual([[1, 2, 3]]);
  });
});

describe('bytesToBase64', () => {
  it('encodes with padding exactly as the BLE library expects', () => {
    expect(bytesToBase64([])).toBe('');
    expect(bytesToBase64([0x1b, 0x40])).toBe('G0A=');
    expect(bytesToBase64([72, 105, 0x0a])).toBe('SGkK');
    expect(bytesToBase64([255, 254, 253, 252])).toBe('//79/A==');
  });
});
