/**
 * Receipt export helpers.
 *
 * `jspdf` and `html2canvas` are pulled in with a dynamic import so the ~400 kB
 * they add is only downloaded when a receipt is actually on screen.
 */
import { fileStamp } from './dateUtils';

const MM_PER_PX = 25.4 / 96;

/** Thermal head resolution: 203 dpi is 8 dots per millimetre (576 dots on 72 mm). */
const DOTS_PER_MM = 8;

/**
 * Luminance below which a pixel becomes a printed dot. Only anti-aliased
 * glyph edges land in between (the thermal layout is pure black on white),
 * so a fairly high cut keeps strokes solid instead of letting them fade.
 */
const THERMAL_THRESHOLD = 170;

const PRINT_STYLE_ID = 'ap-sand-page-size';
const PRINT_ROOT_ID = 'receipt-print-root';

/**
 * Paper profiles. `width` is the page (and printable) width, `gutter` the
 * blank margin kept inside it on each side.
 *
 * TVS MLP 3120: 3 inch roll, 72 mm print width, 203 dpi thermal head. The
 * wide gutter is deliberate: a printer app set to an 80 mm roll can centre
 * the 576-dot image on 640 dots, shifting it about 4 mm right, and the head
 * then drops whatever lands past its 72 mm - the ends of right-aligned values.
 */
const PRINT_PROFILES = {
  TVS_MLP_3120: { width: 72, gutter: 6, thermal: true },
  THERMAL_76: { width: 76, gutter: 3, thermal: true },
  THERMAL_80: { width: 80, gutter: 4, thermal: true },
  A4: { width: 110, gutter: 0, thermal: false },
};

const profileFor = (paperSize) => PRINT_PROFILES[paperSize] || PRINT_PROFILES.TVS_MLP_3120;

/** A thermal image or PDF only makes sense on a roll, so A4 falls back to the TVS roll. */
const thermalProfileFor = (paperSize) => {
  const profile = profileFor(paperSize);
  return profile.thermal ? profile : PRINT_PROFILES.TVS_MLP_3120;
};

const resolveSheet = (sheet) =>
  sheet || document.querySelector('#receipt-print-area .receipt-sheet');

/** Start fetching the capture libraries so a tap on "Printer Image" renders fast. */
export const preloadExportTools = () => {
  import('html2canvas').catch(() => {});
};

/**
 * Clone the sheet into an off-screen `.receipt-print-root` holder, where
 * `styles/print.css` gives it the paper layout for `profile`.
 */
const mountPrintClone = (source, profile) => {
  const holder = document.createElement('div');
  holder.className = `receipt-print-root ${profile.thermal ? 'is-thermal' : 'is-a4'}`;
  holder.style.setProperty('--print-width', `${profile.width}mm`);
  holder.style.setProperty('--print-gutter', `${profile.gutter}mm`);
  holder.appendChild(source.cloneNode(true));
  document.body.appendChild(holder);
  return holder;
};

/**
 * Scale `source` to exactly `dots` wide and snap every pixel to black or
 * white, the only two things a thermal head can print. Left to the printer
 * app, grey anti-aliasing is what turns thin text into faint speckle.
 */
const toMonochrome = (source, dots) => {
  const height = Math.round((source.height * dots) / source.width);
  const canvas = document.createElement('canvas');
  canvas.width = dots;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, dots, height);
  ctx.drawImage(source, 0, 0, dots, height);

  const image = ctx.getImageData(0, 0, dots, height);
  const px = image.data;
  for (let i = 0; i < px.length; i += 4) {
    const luminance = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    const value = luminance < THERMAL_THRESHOLD ? 0 : 255;
    px[i] = value;
    px[i + 1] = value;
    px[i + 2] = value;
    px[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
};

/**
 * Render the receipt the way the thermal head will print it: the compact
 * thermal layout, one canvas pixel per printer dot (576 wide for the TVS
 * MLP 3120), pure black and white.
 *
 * @param {HTMLElement} [sheet] The `.receipt-sheet` to render.
 * @param {string} [paperSize] Key of PRINT_PROFILES.
 * @returns {Promise<HTMLCanvasElement>}
 */
export const renderThermalCanvas = async (sheet, paperSize = 'TVS_MLP_3120') => {
  const source = resolveSheet(sheet);
  if (!source) throw new Error('Nothing to print.');

  const profile = thermalProfileFor(paperSize);
  const { default: html2canvas } = await import('html2canvas');
  const holder = mountPrintClone(source, profile);

  try {
    if (document.fonts?.ready) await document.fonts.ready;
    const element = holder.firstElementChild;
    const dots = Math.round(profile.width * DOTS_PER_MM);
    const capture = await html2canvas(element, {
      scale: dots / element.getBoundingClientRect().width,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    });
    return toMonochrome(capture, dots);
  } finally {
    holder.remove();
  }
};

const canvasToBlob = (canvas) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Unable to create the receipt image.'))),
      'image/png'
    );
  });

const downloadBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};

/**
 * Produce the printer-ready PNG and hand it over: on a phone through the
 * share sheet (pick the Bluetooth printer app), otherwise as a download.
 *
 * @returns {Promise<'shared' | 'cancelled' | 'downloaded'>}
 */
export const shareThermalImage = async (sheet, options = {}) => {
  const { paperSize = 'TVS_MLP_3120', fileName, title = 'AP SAND Receipt' } = options;
  const canvas = await renderThermalCanvas(sheet, paperSize);
  const blob = await canvasToBlob(canvas);
  const name = fileName || `AP-SAND-Receipt-${fileStamp()}.png`;
  const file = new File([blob], name, { type: 'image/png' });

  const touchDevice = window.matchMedia?.('(pointer: coarse)').matches;
  if (touchDevice && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
      // NotAllowedError: the tap "expired" while the image rendered on a slow
      // phone. A download still gets the image to the printer app.
    }
  }

  downloadBlob(blob, name);
  return 'downloaded';
};

/**
 * Render a DOM node into a PDF.
 *
 * Thermal sizes produce a single continuous page exactly as wide as the roll,
 * rendered at the printer's own 203 dpi in pure black and white so a printer
 * app prints it dot for dot. A4 paginates the colour capture across as many
 * sheets as it needs.
 *
 * @param {HTMLElement} element  Node to capture (the receipt sheet).
 * @param {object}      options
 * @param {string}      [options.fileName]
 * @param {string}      [options.paperSize] Key of PRINT_PROFILES.
 */
export const exportElementToPdf = async (element, options = {}) => {
  if (!element) throw new Error('Nothing to export.');

  const { fileName, paperSize = 'TVS_MLP_3120' } = options;
  const name = fileName || `AP-SAND-Receipt-${fileStamp()}.pdf`;
  const { jsPDF } = await import('jspdf');

  if (paperSize !== 'A4') {
    const canvas = await renderThermalCanvas(element, paperSize);
    const widthMm = canvas.width / DOTS_PER_MM;
    const heightMm = canvas.height / DOTS_PER_MM;
    const pdf = new jsPDF({
      unit: 'mm',
      format: [widthMm, heightMm],
      orientation: heightMm >= widthMm ? 'portrait' : 'landscape',
    });
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, widthMm, heightMm, '', 'FAST');
    pdf.save(name);
    return name;
  }

  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(element, {
    scale: Math.min(3, Math.max(2, window.devicePixelRatio || 1)),
    backgroundColor: '#FFFFFF',
    useCORS: true,
    logging: false,
    windowWidth: element.scrollWidth,
  });

  const imageData = canvas.toDataURL('image/png', 1.0);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const usableWidth = pageWidth - margin * 2;
  const imageHeight = (canvas.height * usableWidth) / canvas.width;

  let remaining = imageHeight;
  let offset = 0;
  while (remaining > 0) {
    pdf.addImage(imageData, 'PNG', margin, margin - offset, usableWidth, imageHeight, '', 'FAST');
    remaining -= pageHeight - margin * 2;
    offset += pageHeight - margin * 2;
    if (remaining > 0) pdf.addPage();
  }
  pdf.save(name);
  return name;
};

/**
 * Print the receipt, and only the receipt.
 *
 * The sheet is cloned into `#receipt-print-root` and everything else on the
 * page is hidden (see `styles/print.css`).
 *
 * Thermal rolls deliberately get no `@page` size: when the CSS page is longer
 * than the paper the printer driver reports, the browser shrinks the whole
 * receipt to fit, which is what printed it at a third of the roll width.
 * Left to the driver's paper, the receipt keeps its real size and simply
 * runs on down the roll.
 *
 * @param {string} paperSize  Key of PRINT_PROFILES.
 * @param {HTMLElement} [sheet] The `.receipt-sheet` to print.
 */
export const printReceipt = (paperSize = 'TVS_MLP_3120', sheet) => {
  const source = resolveSheet(sheet);
  if (!source) {
    window.print();
    return;
  }

  const profile = profileFor(paperSize);
  const root = document.documentElement;

  document.getElementById(PRINT_ROOT_ID)?.remove();
  const holder = mountPrintClone(source, profile);
  holder.id = PRINT_ROOT_ID;

  let style = document.getElementById(PRINT_STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = PRINT_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = profile.thermal
    ? '@page { margin: 0; }'
    : '@page { size: A4 portrait; margin: 12mm; }';

  root.classList.add('is-printing');

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    root.classList.remove('is-printing');
    holder.remove();
    style?.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);

  // Give the browser a frame to lay the clone out before opening the dialog.
  window.requestAnimationFrame(() => {
    window.print();
    // Mobile browsers return from print() immediately and do not always fire
    // `afterprint`. The clone is off-screen and harmless, so wait generously
    // rather than pull it out from under a print preview that is still open.
    window.setTimeout(cleanup, 60000);
  });
};

export const pxToMm = (px) => px * MM_PER_PX;
