import { Link } from 'react-router-dom';
import { ExternalLink, Send } from 'lucide-react';
import type { Project } from '../../types';
import { updateProject, useSettings } from '../../lib/store';
import { date } from '../../lib/format';
import ProposalDocument from '../../components/ProposalDocument';
import ProposalActions from '../../components/ProposalActions';

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
      <ProposalDocument project={p} settings={settings} />
    </div>
  );
}
