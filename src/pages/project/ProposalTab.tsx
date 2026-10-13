import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, ExternalLink, Send } from 'lucide-react';
import type { Project } from '../../types';
import { updateProject, useSettings } from '../../lib/store';
import { shareUrl } from '../../lib/api';
import { date } from '../../lib/format';
import ProposalDocument from '../../components/ProposalDocument';

export default function ProposalTab({ project: p }: { project: Project }) {
  const settings = useSettings();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const url = shareUrl(p, settings);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      prompt('Copy this link:', url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const markSent = () => updateProject(p.id, { status: 'Proposal Sent', proposalSentAt: new Date().toISOString() });

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-slate-600">
          {p.proposalSentAt ? (
            <>
              Proposal sent <span className="font-medium text-slate-800">{date(p.proposalSentAt)}</span>
            </>
          ) : (
            'Preview the proposal your customer will see.'
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={copy}>
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Link copied' : 'Copy share link'}
          </button>
          <Link to={`/proposals/${p.id}`} className="btn-secondary">
            <ExternalLink className="h-4 w-4" /> Open / Export PDF
          </Link>
          {['Lead', 'Designing'].includes(p.status) && (
            <button className="btn-primary" onClick={markSent} disabled={p.systemKw <= 0}>
              <Send className="h-4 w-4" /> Mark as sent
            </button>
          )}
        </div>
      </div>
      <ProposalDocument project={p} settings={settings} />
    </div>
  );
}
