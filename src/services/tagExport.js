import { buildQrSvg } from '../lib/qrSvg';

// Build a print-ready HTML sheet: a grid of QR codes, each with its
// human-readable code printed beneath (so a scratched label is recoverable).
// The SVGs are generated in pure JS.

export const buildSheetHtml = (codes, { title = 'RFV Asset Tags', columns = 4 } = {}) => {
  const cells = codes
    .map((code) => {
      const svg = buildQrSvg(code, { cellSize: 4, margin: 2 });
      return `
        <div class="cell">
          <div class="qr">${svg}</div>
          <div class="code">${code}</div>
        </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Roboto, Arial, sans-serif; margin: 16px; color: #111; background: #fff; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  .meta { font-size: 11px; color: #666; margin-bottom: 16px; }
  .grid { display: grid; grid-template-columns: repeat(${columns}, 1fr); gap: 12px; }
  .cell { border: 1px solid #ddd; border-radius: 8px; padding: 10px; text-align: center; page-break-inside: avoid; }
  .qr { width: 100%; }
  .qr svg { width: 100%; height: auto; }
  .code { margin-top: 6px; font-family: "SFMono-Regular", Consolas, monospace; font-size: 13px; letter-spacing: 1px; font-weight: 700; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">${codes.length} tag${codes.length === 1 ? '' : 's'} · generated ${new Date().toLocaleString()}</div>
  <div class="grid">${cells}</div>
</body>
</html>`;
};

/**
 * Open the tag sheet in a new tab/window ready to print or save as PDF.
 * Falls back to a file download if the browser blocks the popup.
 * @param {string[]} codes
 */
export const exportTagsSheet = async (codes) => {
  if (!codes || codes.length === 0) throw new Error('No codes to export');

  const html = buildSheetHtml(codes);
  const win = window.open('', '_blank');

  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    // Give the SVGs a beat to lay out, then open the print dialog.
    win.onload = () => setTimeout(() => win.print(), 250);
    return;
  }

  // Popup blocked → download the sheet instead.
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'RFV_Asset_Tags.html';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
