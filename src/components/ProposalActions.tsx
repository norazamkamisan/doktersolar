import { useState, type RefObject } from 'react';
import { Check, Download, Loader2, Printer, Share2 } from 'lucide-react';
import type { Project, Settings } from '../types';
import { shareProposal } from '../lib/api';
import { downloadProposalPdf, proposalFileName } from '../lib/pdf';

/**
 * Share link + Download PDF + Print buttons for a proposal.
 * `shareUrl` overrides the link (e.g. a customer re-sharing the link they received).
 */
export default function ProposalActions({
  project,
  settings,
  documentRef,
  shareUrl,
  compact = false,
}: {
  project: Project;
  settings: Pick<Settings, 'companyName'>;
  documentRef: RefObject<HTMLElement>;
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

  const download = async () => {
    if (!documentRef.current || pdfState === 'busy') return;
    setPdfState('busy');
    try {
      await downloadProposalPdf(documentRef.current, proposalFileName(project.customerName));
      setPdfState('idle');
    } catch (err) {
      console.error('PDF export failed', err);
      setPdfState('error');
    }
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
        <button type="button" className="btn-primary" onClick={download} disabled={pdfState === 'busy'}>
          {pdfState === 'busy' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {pdfState === 'busy' ? 'Creating PDF…' : 'Download PDF'}
        </button>
      </div>
      {pdfState === 'error' && (
        <p className="text-xs text-red-600" role="alert">
          Couldn't create the PDF. Try again, or use Print → Save as PDF.
        </p>
      )}
    </div>
  );
}
