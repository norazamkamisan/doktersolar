import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { money } from '../lib/format';

const GRID = '#e2e8f0';
const AXIS = { fontSize: 12, fill: '#64748b' };

function shortMoney(v: number, currency: string) {
  return Math.abs(v) >= 1000 ? money(v / 1000, currency, Math.abs(v) >= 10000 ? 0 : 1) + 'k' : money(v, currency);
}

function Tip({ title, lines }: { title: string; lines: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-slate-700">{title}</p>
      {lines.map((l) => (
        <p key={l.label} className="flex items-center gap-2 tabular-nums text-slate-900">
          {l.color && <span className="h-2 w-2 rounded-sm" style={{ background: l.color }} />}
          <span className="text-slate-500">{l.label}</span> <span className="ml-auto font-semibold">{l.value}</span>
        </p>
      ))}
    </div>
  );
}

export interface Slice {
  name: string;
  value: number;
  color: string;
}

/** Doughnut (or pie) with a legend and share-of-total tooltip. */
export function MoneyDonut({ data, currency, hole = true, height = 260 }: { data: Slice[]; currency: string; hole?: boolean; height?: number }) {
  const slices = data.filter((d) => d.value > 0);
  const total = slices.reduce((a, d) => a + d.value, 0);
  if (!slices.length) return <NoData height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={slices} dataKey="value" nameKey="name" innerRadius={hole ? '52%' : 0} outerRadius="82%" paddingAngle={1} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
          {slices.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }) =>
            active && payload?.length ? (
              <Tip
                title={String(payload[0].name)}
                lines={[{ label: `${((Number(payload[0].value) / total) * 100).toFixed(1)}%`, value: money(Number(payload[0].value), currency, 2) }]}
              />
            ) : null
          }
        />
        <Legend layout="vertical" align="right" verticalAlign="middle" iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Two bars per group (light = first series, solid = second), each group in its own colour. */
export function PairedBars({
  data,
  currency,
  first,
  second,
  height = 280,
}: {
  data: { name: string; a: number; b: number; color: string }[];
  currency: string;
  first: string;
  second: string;
  height?: number;
}) {
  if (!data.length) return <NoData height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} interval={0} angle={data.length > 5 ? -20 : 0} textAnchor={data.length > 5 ? 'end' : 'middle'} height={data.length > 5 ? 56 : 30} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={64} tickFormatter={(v) => shortMoney(v, currency)} />
        <Tooltip
          cursor={{ fill: '#f1f5f9' }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <Tip
                title={String(label)}
                lines={[
                  { label: first, value: money(Number(payload[0].value), currency, 2) },
                  { label: second, value: money(Number(payload[1]?.value ?? 0), currency, 2) },
                ]}
              />
            ) : null
          }
        />
        <Bar dataKey="a" name={first} radius={[4, 4, 0, 0]} maxBarSize={34} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} fillOpacity={0.4} stroke={d.color} strokeWidth={1.5} />
          ))}
        </Bar>
        <Bar dataKey="b" name={second} radius={[4, 4, 0, 0]} maxBarSize={34} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Two fixed-colour series side by side (e.g. cash in green vs cash out red). */
export function TwoSeriesBars({
  data,
  currency,
  series,
  height = 280,
}: {
  data: Record<string, string | number>[];
  currency: string;
  series: { key: string; label: string; color: string }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={64} tickFormatter={(v) => shortMoney(v, currency)} />
        <Tooltip
          cursor={{ fill: '#f1f5f9' }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <Tip title={String(label)} lines={payload.map((x) => ({ label: String(x.name), value: money(Number(x.value), currency, 2), color: String(x.color) }))} />
            ) : null
          }
        />
        <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Net cashflow by month; points are green when positive and red when negative. */
export function NetLine({ data, currency, height = 280 }: { data: { name: string; net: number }[]; currency: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={64} tickFormatter={(v) => shortMoney(v, currency)} />
        <ReferenceLine y={0} stroke="#94a3b8" />
        <Tooltip
          content={({ active, payload, label }) =>
            active && payload?.length ? <Tip title={String(label)} lines={[{ label: 'Net cashflow', value: money(Number(payload[0].value), currency, 2) }]} /> : null
          }
        />
        <Line
          type="monotone"
          dataKey="net"
          stroke="#3b82f6"
          strokeWidth={2.5}
          isAnimationActive={false}
          dot={(props: { cx?: number; cy?: number; payload?: { net: number }; index?: number }) => (
            <circle key={props.index} cx={props.cx} cy={props.cy} r={4.5} fill={(props.payload?.net ?? 0) < 0 ? '#ef4444' : '#10b981'} stroke="#fff" strokeWidth={1.5} />
          )}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Horizontal bars, one colour each (e.g. margin % by pricing scenario). */
export function ColorBars({ data, format, height = 220 }: { data: { name: string; value: number; color: string }[]; format: (v: number) => string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={format} />
        <YAxis type="category" dataKey="name" tick={AXIS} axisLine={false} tickLine={false} width={96} />
        <Tooltip
          cursor={{ fill: '#f1f5f9' }}
          content={({ active, payload, label }) => (active && payload?.length ? <Tip title={String(label)} lines={[{ label: 'Value', value: format(Number(payload[0].value)) }]} /> : null)}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={26} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function NoData({ height }: { height: number }) {
  return (
    <div className="flex items-center justify-center rounded-lg bg-slate-50 text-sm text-slate-400" style={{ height }}>
      Nothing to show yet
    </div>
  );
}
