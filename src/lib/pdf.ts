/**
 * Builds a real PDF file of a proposal in the browser and downloads it.
 * Works in browsers that ignore window.print() (some phone browsers and in-app browsers).
 *
 * The caller renders the proposal off-screen at a fixed A4-like width with a system font
 * (see ProposalActions), so the PDF looks the same on phones and desktops, and the text
 * measured on the page matches the text drawn into the images. Each top-level block becomes
 * an image placed on A4 pages, moving to a new page rather than splitting a block.
 * The PDF libraries are loaded on demand.
 */

/** Width the off-screen proposal is laid out at, in CSS px (≈ A4 content width at 96 dpi). */
export const PDF_RENDER_WIDTH = 760;

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
  const MARGIN = 12;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const CONTENT_H = PAGE_H - MARGIN * 2;

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });

  let y = MARGIN;
  for (const block of Array.from(article.children) as HTMLElement[]) {
    const width = block.offsetWidth;
    const height = block.scrollHeight;
    if (!width || !height) continue;

    const mmPerPx = CONTENT_W / width;
    let w = CONTENT_W;
    let h = height * mmPerPx;
    const gap = y > MARGIN ? parseFloat(getComputedStyle(block).marginTop || '0') * mmPerPx : 0;

    if (y + gap + h > PAGE_H - MARGIN && y > MARGIN) {
      pdf.addPage();
      y = MARGIN;
    } else {
      y += gap;
    }
    if (h > CONTENT_H) {
      // a single block taller than a page: shrink it to fit
      w = (CONTENT_W * CONTENT_H) / h;
      h = CONTENT_H;
    }

    const image = await toJpeg(block, {
      width,
      height,
      pixelRatio: 2,
      quality: 0.92,
      backgroundColor: '#ffffff',
      // The block's margin would shift its content down inside an image of the block's own height,
      // clipping the bottom. Spacing between blocks is added by the page layout above instead.
      style: { margin: '0' },
      skipFonts: true, // the off-screen copy uses system fonts, so nothing needs embedding
    });
    pdf.addImage(image, 'JPEG', MARGIN + (CONTENT_W - w) / 2, y, w, h, undefined, 'FAST');
    y += h;
  }

  pdf.save(fileName);
}

export function proposalFileName(customerName: string): string {
  const safe = customerName.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'customer';
  return `Solar-proposal-${safe}.pdf`;
}
