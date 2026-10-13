import { useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Copy, Printer } from 'lucide-react';
import { useProject, useSettings } from '../lib/store';
import { readSharePayload, shareUrl } from '../lib/api';
import ProposalDocument from '../components/ProposalDocument';
import { LogoMark } from '../components/Logo';

/**
 * Customer-facing proposal. Loads from this browser's storage when available,
 * otherwise from the data embedded in a share link (#d=...).
 */
export default function ProposalView() {
  const { id } = useParams();
  const { hash } = useLocation();
  const local = useProject(id);
  const localSettings = useSettings();
  const shared = useMemo(() => readSharePayload(hash), [hash]);
  const [copied, setCopied] = useState(false);

  // live data wins on the installer's own browser; customers see the shared snapshot
  const project = local ?? shared?.p;
  const settings = local || !shared ? localSettings : { ...shared.s, logo: null };

  if (!project) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <LogoMark className="h-10 w-10" />
        <p className="font-medium text-slate-800">Proposal not found</p>
        <p className="max-w-sm text-sm text-slate-500">This link may be incomplete. Ask your installer to send the full share link.</p>
      </div>
    );
  }

  const copy = async () => {
    const url = local ? shareUrl(local, localSettings) : window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      prompt('Copy this link:', url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-full bg-slate-100 py-4 sm:py-8">
      <div className="no-print mx-auto mb-4 flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4">
        {local ? (
          <Link to={`/projects/${project.id}/proposal`} className="btn-ghost">
            <ArrowLeft className="h-4 w-4" /> Back to project
          </Link>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={copy}>
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Share link'}
          </button>
          <button className="btn-primary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Export to PDF
          </button>
        </div>
      </div>
      <div className="px-3 sm:px-4">
        <ProposalDocument project={project} settings={settings} />
      </div>
    </div>
  );
}
