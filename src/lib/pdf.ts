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

  const PAGE_W = 210;
  const PAGE_H = 297;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });

  // Each [data-pdf-page] element is laid out at A4 size (see ProposalDocument) and becomes one page.
  const pages = Array.from(article.querySelectorAll<HTMLElement>('[data-pdf-page]'));
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
    if (i > 0) pdf.addPage();
    // fit the page image to A4 (it already has A4 proportions)
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
