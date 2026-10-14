import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Download, Loader2, Printer, Share2 } from 'lucide-react';
import type { Project } from '../types';
import { shareProposal } from '../lib/api';
import { PDF_FONT_STACK, PDF_RENDER_WIDTH, downloadProposalPdf, proposalFileName, waitForRender } from '../lib/pdf';
import ProposalDocument, { type DocSettings } from './ProposalDocument';

/**
 * Share link + Print + Download PDF buttons for a proposal.
 * `shareUrl` overrides the link (e.g. a customer re-sharing the link they received).
 */
export default function ProposalActions({
  project,
  settings,
  shareUrl,
  compact = false,
}: {
  project: Project;
  settings: DocSettings;
  shareUrl?: string;
  compact?: boolean;
}) {
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'shared'>('idle');
  const [pdfState, setPdfState] = useState<'idle' | 'busy' | 'error'>('idle');

  const share = async () => {
    const result = await shareProposal(project, settings, shareUrl);
    if (result === 'cancelled') return;
    setShareState(result);
    setTimeout(() => setShareState('idle'), 2500);
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={share}>
          {shareState === 'idle' ? <Share2 className="h-4 w-4" /> : <Check className="h-4 w-4 text-emerald-600" />}
          {shareState === 'copied' ? 'Link copied' : shareState === 'shared' ? 'Shared' : 'Share link'}
        </button>
        <button
          type="button"
          className="btn-secondary !px-2.5"
          onClick={() => window.print()}
          aria-label="Print"
          title="Print (or Save as PDF from the print dialog)"
        >
          <Printer className="h-4 w-4" />
          {!compact && <span className="hidden sm:inline">Print</span>}
        </button>
        <button type="button" className="btn-primary" onClick={() => setPdfState('busy')} disabled={pdfState === 'busy'}>
          {pdfState === 'busy' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {pdfState === 'busy' ? 'Creating PDF…' : 'Download PDF'}
        </button>
      </div>
      {pdfState === 'error' && (
        <p className="text-xs text-red-600" role="alert">
          Couldn't create the PDF. Try again, or use Print → Save as PDF.
        </p>
      )}
      {pdfState === 'busy' && (
        <PdfExport
          project={project}
          settings={settings}
          onDone={(ok) => setPdfState(ok ? 'idle' : 'error')}
        />
      )}
    </div>
  );
}

/**
 * Renders the proposal off-screen at a fixed width with system fonts, captures it to a PDF,
 * then reports back. Same result on phones and desktops.
 */
function PdfExport({ project, settings, onDone }: { project: Project; settings: DocSettings; onDone: (ok: boolean) => void }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!ref.current) throw new Error('Proposal did not render');
        await waitForRender(ref.current);
        if (cancelled) return;
        await downloadProposalPdf(ref.current, proposalFileName(project.customerName));
        if (!cancelled) onDone(true);
      } catch (err) {
        console.error('PDF export failed', err);
        if (!cancelled) onDone(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // run once per export
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: -20000,
        top: 0,
        width: PDF_RENDER_WIDTH,
        fontFamily: PDF_FONT_STACK,
        pointerEvents: 'none',
        background: '#fff',
      }}
    >
      <ProposalDocument ref={ref} project={project} settings={settings} forExport />
    </div>,
    document.body,
  );
}
