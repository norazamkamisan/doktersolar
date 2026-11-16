/**
 * Builds a real PDF file of a proposal in the browser and downloads it.
 * Works in browsers that ignore window.print() (some phone browsers and in-app browsers).
 *
 * The caller renders the proposal off-screen at a fixed A4-like width with a system font
 * (see ProposalActions), so the PDF looks the same on phones and desktops, and the text
 * measured on the page matches the text drawn into the images. Each proposal page becomes one
 * A4 page of the PDF.
 * The PDF libraries are loaded on demand.
 */

/** Width the off-screen proposal is laid out at, in CSS px (A4 at 96 dpi). */
export const PDF_RENDER_WIDTH = 794;

/** System fonts are available inside the captured images; web fonts (Inter) are not. */
export const PDF_FONT_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

/** Wait until map tiles have loaded and charts have drawn (or give up after `timeoutMs`). */
export async function waitForRender(root: HTMLElement, timeoutMs = 10000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const tiles = Array.from(root.querySelectorAll<HTMLImageElement>('img.leaflet-tile'));
    const hasMap = !!root.querySelector('.leaflet-container');
    const tilesReady = !hasMap || (tiles.length > 0 && tiles.every((t) => t.complete));
    const chartsReady = root.querySelectorAll('.recharts-surface').length >= root.querySelectorAll('.recharts-responsive-container').length;
    if (tilesReady && chartsReady) break;
    await sleep(150);
  }
  await nextFrame();
  await sleep(200);
}

export async function downloadProposalPdf(article: HTMLElement, fileName: string): Promise<void> {
  const [{ toJpeg }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);

  // Each [data-pdf-page] element becomes one page: A4 portrait for the standard proposal,
  // a 16:9 slide (13.33 × 7.5 in) for the Zero Capex deck.
  const pages = Array.from(article.querySelectorAll<HTMLElement>('[data-pdf-page]'));
  const sizeOf = (el: HTMLElement): [number, number] => (el.offsetWidth > el.offsetHeight ? [338.67, 190.5] : [210, 297]);
  const first = pages[0] ? sizeOf(pages[0]) : ([210, 297] as [number, number]);
  const pdf = new jsPDF({ unit: 'mm', format: first, orientation: first[0] > first[1] ? 'landscape' : 'portrait', compress: true });

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const width = page.offsetWidth;
    const height = page.offsetHeight;
    if (!width || !height) continue;
    const image = await toJpeg(page, {
      width,
      height,
      pixelRatio: 2,
      quality: 0.9,
      backgroundColor: '#ffffff',
      skipFonts: true, // the off-screen copy uses system fonts, so nothing needs embedding
    });
    const [PAGE_W, PAGE_H] = sizeOf(page);
    if (i > 0) pdf.addPage([PAGE_W, PAGE_H], PAGE_W > PAGE_H ? 'landscape' : 'portrait');
    // fit the page image to the page (it already has the page's proportions)
    const scale = Math.min(PAGE_W / width, PAGE_H / height);
    const w = width * scale;
    const h = height * scale;
    pdf.addImage(image, 'JPEG', (PAGE_W - w) / 2, 0, w, h, undefined, 'FAST');
  }

  pdf.save(fileName);
}

export function proposalFileName(customerName: string): string {
  const safe = customerName.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'customer';
  return `Solar-proposal-${safe}.pdf`;
}
