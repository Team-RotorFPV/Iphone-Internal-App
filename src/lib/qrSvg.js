import createQr from 'qrcode-generator';

// Pure-JS QR → inline SVG string. No native module (react-native-svg is NOT
// used — see lib/lucideIcons.js for why that matters). The output is a
// self-contained <svg> string suitable for embedding in a printable HTML sheet.
//
// Error-correction level M per the tagging spec (good balance; survives a bit of
// print smudging).
export const buildQrSvg = (data, { cellSize = 4, margin = 8, ecl = 'M' } = {}) => {
  const qr = createQr(0, ecl); // typeNumber 0 = auto-fit to data length
  qr.addData(data);
  qr.make();
  return qr.createSvgTag({ cellSize, margin, scalable: true });
};
