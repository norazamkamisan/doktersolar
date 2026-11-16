import { Link } from 'react-router-dom';
import { ExternalLink, Send } from 'lucide-react';
import type { Project } from '../../types';
import { updateProject, useSettings } from '../../lib/store';
import { date } from '../../lib/format';
import ProposalDocument from '../../components/ProposalDocument';
import ProposalActions from '../../components/ProposalActions';
import QuoteEditor from '../../components/QuoteEditor';
import { isZeroCapexProject } from '../../lib/zeroCapexProject';

export default function ProposalTab({ project: p }: { project: Project }) {
  const settings = useSettings();

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
        <div className="flex flex-wrap items-start justify-end gap-2">
          <Link to={`/proposals/${p.id}`} className="btn-secondary !px-2.5" title="Open customer view" aria-label="Open customer view">
            <ExternalLink className="h-4 w-4" />
          </Link>
          {['Lead', 'Designing'].includes(p.status) && (
            <button className="btn-secondary" onClick={markSent} disabled={p.systemKw <= 0}>
              <Send className="h-4 w-4" /> Mark as sent
            </button>
          )}
          <ProposalActions project={p} settings={settings} compact />
        </div>
      </div>
      {isZeroCapexProject(p) ? (
        <p className="card border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <strong>Zero Capex C&amp;I proposal.</strong> This is a commercial or industrial TNB bill of RM10,000 a month or more, so the proposal is the
          Zero Capex deck. The savings are worked out with the Zero Capex financial model. Bills under RM10,000 get the standard proposal.
        </p>
      ) : (
        <QuoteEditor project={p} settings={settings} />
      )}
      <ProposalDocument project={p} settings={settings} />
    </div>
  );
}
