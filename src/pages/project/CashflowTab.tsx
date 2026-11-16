import { Plus } from 'lucide-react';
import type { CashInRow, CashOutRow, PaymentRow, Project, ProjectCashflow, Settings } from '../../types';
import { PAY_STATUSES, PRIORITIES } from '../../types';
import { updateProject, useSettings } from '../../lib/store';
import { money } from '../../lib/format';
import { cashflowOf, newRowId, todayIso } from '../../lib/costing';
import { balanceOf, cashInStatusPatch, cashOutStatus, daysOverdue, summarize } from '../../lib/cashflow';
import { DateCell, DeleteCell, KpiTile, NumCell, SelectCell, TextCell } from '../../components/Cells';

type Kind = keyof ProjectCashflow;

function patchCash<K extends Kind>(p: Project, kind: K, rows: (old: ProjectCashflow[K]) => ProjectCashflow[K]) {
  updateProject(p.id, (prev) => {
    const c = cashflowOf(prev);
    return { cashflow: { ...c, [kind]: rows(c[kind]) } };
  });
}

function editRow<K extends Kind>(p: Project, kind: K, id: string, patch: Partial<ProjectCashflow[K][number]>) {
  patchCash(p, kind, (rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) as ProjectCashflow[K]);
}

function removeRow(p: Project, kind: Kind, id: string) {
  patchCash(p, kind, (rows) => rows.filter((r) => r.id !== id) as never);
}

export default function CashflowTab({ project: p }: { project: Project }) {
  const s = useSettings();
  const c = cashflowOf(p);
  const sum = summarize([p], new Date().getFullYear());
  const rm = (v: number) => money(v, s.currency, 2);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiTile tone="green" label="Cash in" value={rm(sum.cashIn)} sub="received (Paid rows only)" />
        <KpiTile tone="red" label="Cash out" value={rm(sum.cashOut)} sub="paid out (Paid rows only)" />
        <KpiTile tone="blue" label="Net cashflow" value={rm(sum.net)} sub={sum.net >= 0 ? 'POSITIVE' : 'NEGATIVE'} />
        <KpiTile tone="violet" label="Receivable" value={rm(sum.receivable)} sub="still to collect" />
        <KpiTile tone="orange" label="Payable" value={rm(sum.payable)} sub="still to pay" />
      </div>

      <Payments project={p} rows={c.payments} settings={s} />
      <CashIn project={p} rows={c.cashIn} settings={s} />
      <CashOut project={p} rows={c.cashOut} settings={s} />
    </div>
  );
}

function Section({ title, sub, onAdd, addLabel, children }: { title: string; sub: string; onAdd: () => void; addLabel: string; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">{sub}</p>
        </div>
        <button className="btn-primary" onClick={onAdd}>
          <Plus className="h-4 w-4" /> {addLabel}
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">{children}</div>
    </section>
  );
}

function Head({ cols, right }: { cols: string[]; right: number[] }) {
  return (
    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
      <tr>
        {cols.map((h, i) => (
          <th key={h + i} className={`whitespace-nowrap px-2 py-2 font-medium ${right.includes(i) ? 'text-right' : ''}`}>
            {h}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function Empty({ cols, text }: { cols: number; text: string }) {
  return (
    <tr>
      <td colSpan={cols} className="px-3 py-6 text-center text-slate-500">
        {text}
      </td>
    </tr>
  );
}

function Payments({ project: p, rows, settings: s }: { project: Project; rows: PaymentRow[]; settings: Settings }) {
  const rm = (v: number) => money(v, s.currency, 2);
  const set = (id: string, patch: Partial<PaymentRow>) => editRow(p, 'payments', id, patch);
  const add = () =>
    patchCash(p, 'payments', (r) => [
      ...r,
      { id: newRowId(), due: todayIso(), payee: '', category: s.cashCategories[0] ?? 'Material', description: '', ref: '', amount: 0, status: 'Not Paid', paid: 0, priority: 'Medium', remarks: '' },
    ]);
  return (
    <Section title="Payment tracker" sub="Bills to pay: suppliers, subcon and crew. Balance and days overdue work out automatically." onAdd={add} addLabel="Add payment">
      <table className="w-full text-sm">
        <Head cols={['Due date', 'Payee', 'Category', 'Description', 'Ref', 'Amount due', 'Status', 'Paid', 'Balance', 'Priority', 'Overdue', 'Remarks', '']} right={[5, 7, 8, 10]} />
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => {
            const od = daysOverdue(r);
            return (
              <tr key={r.id}>
                <td className="px-1 py-1"><DateCell label={`Due date ${i + 1}`} value={r.due} onChange={(v) => set(r.id, { due: v })} /></td>
                <td className="px-1 py-1"><TextCell label={`Payee ${i + 1}`} value={r.payee} onChange={(v) => set(r.id, { payee: v })} /></td>
                <td className="px-1 py-1"><SelectCell label={`Category ${i + 1}`} value={r.category} options={s.cashCategories} onChange={(v) => set(r.id, { category: v })} /></td>
                <td className="px-1 py-1"><TextCell className="min-w-[200px]" label={`Description ${i + 1}`} value={r.description} onChange={(v) => set(r.id, { description: v })} /></td>
                <td className="px-1 py-1"><TextCell label={`Ref ${i + 1}`} value={r.ref} onChange={(v) => set(r.id, { ref: v })} /></td>
                <td className="px-1 py-1"><NumCell label={`Amount due ${i + 1}`} value={r.amount} onChange={(v) => set(r.id, { amount: v ?? 0 })} /></td>
                <td className="px-1 py-1"><SelectCell label={`Status ${i + 1}`} value={r.status} options={PAY_STATUSES} onChange={(v) => set(r.id, { status: v as PaymentRow['status'] })} /></td>
                <td className="px-1 py-1"><NumCell label={`Paid ${i + 1}`} value={r.paid} onChange={(v) => set(r.id, { paid: v ?? 0 })} /></td>
                <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums">{rm(balanceOf(r))}</td>
                <td className="px-1 py-1"><SelectCell label={`Priority ${i + 1}`} value={r.priority} options={PRIORITIES} onChange={(v) => set(r.id, { priority: v as PaymentRow['priority'] })} /></td>
                <td className="px-2 py-1 text-right">
                  {od ? <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">{od} d</span> : <span className="text-slate-400">0</span>}
                </td>
                <td className="px-1 py-1"><TextCell className="min-w-[160px]" label={`Remarks ${i + 1}`} value={r.remarks} onChange={(v) => set(r.id, { remarks: v })} /></td>
                <td className="px-1 py-1"><DeleteCell label={`Remove payment ${i + 1}`} onDelete={() => removeRow(p, 'payments', r.id)} /></td>
              </tr>
            );
          })}
          {!rows.length && <Empty cols={13} text="No payments yet." />}
        </tbody>
        {rows.length > 0 && (
          <tfoot className="bg-slate-50 font-semibold">
            <tr>
              <td className="px-2 py-2" colSpan={5}>Total</td>
              <td className="px-2 py-2 text-right tabular-nums">{rm(rows.reduce((a, r) => a + r.amount, 0))}</td>
              <td />
              <td className="px-2 py-2 text-right tabular-nums">{rm(rows.reduce((a, r) => a + r.paid, 0))}</td>
              <td className="px-2 py-2 text-right tabular-nums">{rm(rows.reduce((a, r) => a + balanceOf(r), 0))}</td>
              <td colSpan={4} />
            </tr>
          </tfoot>
        )}
      </table>
    </Section>
  );
}

function CashIn({ project: p, rows, settings: s }: { project: Project; rows: CashInRow[]; settings: Settings }) {
  const rm = (v: number) => money(v, s.currency, 2);
  const set = (id: string, patch: Partial<CashInRow>) => editRow(p, 'cashIn', id, patch);
  const add = () => patchCash(p, 'cashIn', (r) => [...r, { id: newRowId(), date: todayIso(), ref: '', received: 0, outstanding: 0, status: 'Not Paid', remarks: '' }]);
  return (
    <Section title="Cash in" sub={`Money from ${p.customerName}: deposit, progress claims, final payment, VO. Only rows marked Paid count as cash received; Not Paid amounts are still to collect.`} onAdd={add} addLabel="Add cash in">
      <table className="w-full text-sm">
        <Head cols={['Date received / expected', 'Claim / milestone', 'Received', 'Outstanding', 'Status', 'Remarks', '']} right={[2, 3]} />
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <tr key={r.id}>
              <td className="px-1 py-1"><DateCell label={`Date ${i + 1}`} value={r.date} onChange={(v) => set(r.id, { date: v })} /></td>
              <td className="px-1 py-1"><TextCell className="min-w-[180px]" label={`Claim ${i + 1}`} value={r.ref} onChange={(v) => set(r.id, { ref: v })} /></td>
              <td className="px-1 py-1"><NumCell label={`Received ${i + 1}`} value={r.received} onChange={(v) => set(r.id, { received: v ?? 0 })} /></td>
              <td className="px-1 py-1"><NumCell label={`Outstanding ${i + 1}`} value={r.outstanding} onChange={(v) => set(r.id, { outstanding: v ?? 0 })} /></td>
              <td className="px-1 py-1"><SelectCell label={`Status ${i + 1}`} value={r.status} options={PAY_STATUSES} onChange={(v) => set(r.id, cashInStatusPatch(r, v as CashInRow['status']))} /></td>
              <td className="px-1 py-1"><TextCell className="min-w-[220px]" label={`Remarks ${i + 1}`} value={r.remarks} onChange={(v) => set(r.id, { remarks: v })} /></td>
              <td className="px-1 py-1"><DeleteCell label={`Remove cash in ${i + 1}`} onDelete={() => removeRow(p, 'cashIn', r.id)} /></td>
            </tr>
          ))}
          {!rows.length && <Empty cols={7} text="No cash in yet." />}
        </tbody>
        {rows.length > 0 && (
          <tfoot className="bg-slate-50 font-semibold">
            <tr>
              <td className="px-2 py-2" colSpan={2}>Total</td>
              <td className="px-2 py-2 text-right tabular-nums">{rm(rows.reduce((a, r) => a + r.received, 0))}</td>
              <td className="px-2 py-2 text-right tabular-nums">{rm(rows.reduce((a, r) => a + r.outstanding, 0))}</td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        )}
      </table>
    </Section>
  );
}

function CashOut({ project: p, rows, settings: s }: { project: Project; rows: CashOutRow[]; settings: Settings }) {
  const rm = (v: number) => money(v, s.currency, 2);
  const set = (id: string, patch: Partial<CashOutRow>) => editRow(p, 'cashOut', id, patch);
  const add = () =>
    patchCash(p, 'cashOut', (r) => [
      ...r,
      { id: newRowId(), date: todayIso(), payee: '', category: s.cashCategories[0] ?? 'Material', description: '', amount: 0, status: 'Paid', method: s.payMethods[0] ?? '', remarks: '' },
    ]);
  return (
    <Section title="Cash out" sub="Payments for this job. Only rows marked Paid count as cash out; Not Paid rows show as payable." onAdd={add} addLabel="Add cash out">
      <datalist id="pay-methods">
        {s.payMethods.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
      <table className="w-full text-sm">
        <Head cols={['Date paid / due', 'Payee', 'Category', 'Description', 'Amount', 'Status', 'Method', 'Remarks', '']} right={[4]} />
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <tr key={r.id}>
              <td className="px-1 py-1"><DateCell label={`Date ${i + 1}`} value={r.date} onChange={(v) => set(r.id, { date: v })} /></td>
              <td className="px-1 py-1"><TextCell label={`Payee ${i + 1}`} value={r.payee} onChange={(v) => set(r.id, { payee: v })} /></td>
              <td className="px-1 py-1"><SelectCell label={`Category ${i + 1}`} value={r.category} options={s.cashCategories} onChange={(v) => set(r.id, { category: v })} /></td>
              <td className="px-1 py-1"><TextCell className="min-w-[200px]" label={`Description ${i + 1}`} value={r.description} onChange={(v) => set(r.id, { description: v })} /></td>
              <td className="px-1 py-1"><NumCell label={`Amount ${i + 1}`} value={r.amount} onChange={(v) => set(r.id, { amount: v ?? 0 })} /></td>
              <td className="px-1 py-1"><SelectCell label={`Status ${i + 1}`} value={cashOutStatus(r)} options={PAY_STATUSES} onChange={(v) => set(r.id, { status: v as CashInRow['status'] })} /></td>
              <td className="px-1 py-1"><TextCell label={`Method ${i + 1}`} list="pay-methods" value={r.method} onChange={(v) => set(r.id, { method: v })} /></td>
              <td className="px-1 py-1"><TextCell className="min-w-[180px]" label={`Remarks ${i + 1}`} value={r.remarks} onChange={(v) => set(r.id, { remarks: v })} /></td>
              <td className="px-1 py-1"><DeleteCell label={`Remove cash out ${i + 1}`} onDelete={() => removeRow(p, 'cashOut', r.id)} /></td>
            </tr>
          ))}
          {!rows.length && <Empty cols={9} text="No cash out yet." />}
        </tbody>
        {rows.length > 0 && (
          <tfoot className="bg-slate-50 font-semibold">
            <tr>
              <td className="px-2 py-2" colSpan={4}>Total</td>
              <td className="px-2 py-2 text-right tabular-nums">{rm(rows.reduce((a, r) => a + r.amount, 0))}</td>
              <td colSpan={4} />
            </tr>
          </tfoot>
        )}
      </table>
    </Section>
  );
}
