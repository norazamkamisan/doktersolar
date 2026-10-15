import type { BillRun } from './tnbBill';

/**
 * Positioned text runs per page ({text, x, y, w} in PDF points, y measured up from the bottom),
 * for layout-aware parsers like the TNB bill reader. pdf.js is loaded on demand, and nothing
 * is uploaded: the file is read in the browser.
 */
export async function pdfToRuns(file: File): Promise<BillRun[][]> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const doc = await task.promise;
    const pages: BillRun[][] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const runs: BillRun[] = [];
      for (const it of content.items) {
        if ('str' in it && it.str.trim()) runs.push({ text: it.str, x: it.transform[4], y: it.transform[5], w: it.width });
      }
      pages.push(runs);
    }
    return pages;
  } finally {
    await task.destroy();
  }
}
