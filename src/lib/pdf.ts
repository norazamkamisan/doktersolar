/**
 * Builds a real PDF file of a proposal in the browser and downloads it.
 * Works in browsers that ignore window.print() (some phone browsers and in-app browsers).
 *
 * Each top-level block of the proposal is rendered to an image and placed on A4 pages,
 * moving to a new page rather than splitting a block. The libraries are loaded on demand.
 */
export async function downloadProposalPdf(article: HTMLElement, fileName: string): Promise<void> {
  const [{ toJpeg, getFontEmbedCSS }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);

  const PAGE_W = 210;
  const PAGE_H = 297;
  const MARGIN = 12;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const CONTENT_H = PAGE_H - MARGIN * 2;

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const pixelRatio = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
  const fontEmbedCSS = await getFontEmbedCSS(article).catch(() => undefined);

  let y = MARGIN;
  for (const block of Array.from(article.children) as HTMLElement[]) {
    const rect = block.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;

    const mmPerPx = CONTENT_W / rect.width;
    let w = CONTENT_W;
    let h = rect.height * mmPerPx;
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

    const image = await toJpeg(block, { pixelRatio, quality: 0.92, backgroundColor: '#ffffff', fontEmbedCSS });
    pdf.addImage(image, 'JPEG', MARGIN + (CONTENT_W - w) / 2, y, w, h, undefined, 'FAST');
    y += h;
  }

  pdf.save(fileName);
}

export function proposalFileName(customerName: string): string {
  const safe = customerName.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'customer';
  return `Solar-proposal-${safe}.pdf`;
}
