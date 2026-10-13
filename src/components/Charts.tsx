import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { money, num } from '../lib/format';

const ACCENT = '#f97316';
const GRID = '#e2e8f0';
const AXIS = { fontSize: 12, fill: '#64748b' };

function TipBox({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="text-slate-500">{title}</p>
      <p className="mt-0.5 font-semibold text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}

export function CountBarChart({ data, unit }: { data: { label: string; value: number }[]; unit: string }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} domain={[0, (max: number) => Math.max(3, max + 1)]} tick={AXIS} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: '#f1f5f9' }}
          content={({ active, payload, label }) =>
            active && payload?.length ? <TipBox title={String(label)} value={`${payload[0].value} ${unit}`} /> : null
          }
        />
        <Bar dataKey="value" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MonthlyProductionChart({ data }: { data: { label: string; kwh: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => num(v)} width={48} />
        <Tooltip
          cursor={{ fill: '#f1f5f9' }}
          content={({ active, payload, label }) =>
            active && payload?.length ? <TipBox title={String(label)} value={`${num(Number(payload[0].value))} kWh`} /> : null
          }
        />
        <Bar dataKey="kwh" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CashflowChart({ data, currency }: { data: { year: number; cumulative: number }[]; currency: string }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <defs>
          <linearGradient id="cf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity={0.25} />
            <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="year" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => `Yr ${v}`} interval={4} />
        <YAxis
          tick={AXIS}
          axisLine={false}
          tickLine={false}
          width={72}
          tickFormatter={(v) => money(v / 1000, currency) + 'k'}
        />
        <ReferenceLine y={0} stroke="#94a3b8" />
        <Tooltip
          cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <TipBox title={`End of year ${label}`} value={`${money(Number(payload[0].value), currency)} cumulative`} />
            ) : null
          }
        />
        <Area type="monotone" dataKey="cumulative" stroke={ACCENT} strokeWidth={2} fill="url(#cf)" isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
