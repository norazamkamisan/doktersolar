import { Link, useNavigate } from 'react-router-dom';
import type { Project } from '../types';
import { StatusBadge } from './ui';
import { kw, relative } from '../lib/format';

/** Responsive project list: table on desktop, cards on mobile. */
export default function ProjectTable({ projects, extra }: { projects: Project[]; extra?: (p: Project) => React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="th">Customer</th>
              <th className="th">Address</th>
              <th className="th text-right">System size</th>
              <th className="th">Status</th>
              <th className="th">Last updated</th>
              {extra && <th className="th" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {projects.map((p) => (
              <tr key={p.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/projects/${p.id}`)}>
                <td className="td font-medium text-slate-900">{p.customerName}</td>
                <td className="td max-w-[280px] truncate text-slate-600">{p.address}</td>
                <td className="td text-right tabular-nums">{p.systemKw > 0 ? kw(p.systemKw) : '—'}</td>
                <td className="td">
                  <StatusBadge status={p.status} />
                </td>
                <td className="td text-slate-500">{relative(p.updatedAt)}</td>
                {extra && (
                  <td className="td text-right" onClick={(e) => e.stopPropagation()}>
                    {extra(p)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-slate-100 md:hidden">
        {projects.map((p) => (
          <li key={p.id} className="p-4">
            <Link to={`/projects/${p.id}`} className="block">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-slate-900">{p.customerName}</p>
                <StatusBadge status={p.status} />
              </div>
              <p className="mt-1 truncate text-sm text-slate-500">{p.address}</p>
              <p className="mt-1 text-xs text-slate-500">
                {p.systemKw > 0 ? kw(p.systemKw) : 'No design yet'} · {relative(p.updatedAt)}
              </p>
            </Link>
            {extra && <div className="mt-2">{extra(p)}</div>}
          </li>
        ))}
      </ul>
    </>
  );
}
