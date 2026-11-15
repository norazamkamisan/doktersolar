import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, XAxis, YAxis } from 'recharts';
import { money, num } from '../lib/format';

/** Proposal colours: green for solar and savings, grey for today / costs. */
export const GREEN = '#43a047';
export const GREY = '#c7cdd4';
const GRID = '#e2e8f0';
const AXIS = { fontSize: 10, fill: '#64748b' };

/**
 * Charts are drawn at a fixed size (no ResponsiveContainer) so they look the same on screen, in
 * print and in the downloaded PDF. `width` comes from the page layout.
 */
interface Sized {
  width: number;
  height?: number;
}

/** Average kWh per day each month: solar generation next to consumption. */
export function DailyGenUseChart({ data, width, height = 190 }: Sized & { data: { label: string; gen: number; use: number }[] }) {
  return (
    <BarChart width={width} height={height} data={data} margin={{ top: 16, right: 4, bottom: 0, left: -18 }} barGap={2} barCategoryGap="18%">
      <CartesianGrid vertical={false} stroke={GRID} />
      <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
      <YAxis tick={AXIS} axisLine={false} tickLine={false} />
      <Bar dataKey="use" fill={GREY} isAnimationActive={false} maxBarSize={14} />
      <Bar dataKey="gen" fill={GREEN} isAnimationActive={false} maxBarSize={14}>
        <LabelList dataKey="gen" position="top" fontSize={9} fill="#1e293b" formatter={(v: number) => num(v, 1)} />
      </Bar>
    </BarChart>
  );
}

/** Average monthly bill today vs with solar. */
export function BillCompareChart({ before, after, currency, width, height = 170 }: Sized & { before: number; after: number; currency: string }) {
  const data = [
    { label: 'Old Bill', value: before, fill: '#9aa3ad' },
    { label: 'New Bill', value: Math.max(0, after), fill: GREEN },
  ];
  return (
    <BarChart width={width} height={height} data={data} margin={{ top: 16, right: 8, bottom: 0, left: 8 }}>
      <CartesianGrid vertical={false} stroke={GRID} />
      <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
      <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => money(v, currency)} width={52} />
      <Bar dataKey="value" isAnimationActive={false} maxBarSize={90}>
        {data.map((d) => (
          <Cell key={d.label} fill={d.fill} />
        ))}
        <LabelList dataKey="value" position="top" fontSize={10} fill="#1e293b" formatter={(v: number) => money(v, currency)} />
      </Bar>
    </BarChart>
  );
}

/** Cumulative bill savings by year. */
export function CumulativeBillSavingsChart({ data, currency, width, height = 170 }: Sized & { data: { year: number; value: number }[]; currency: string }) {
  return (
    <BarChart width={width} height={height} data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
      <CartesianGrid vertical={false} stroke={GRID} />
      <XAxis dataKey="year" tick={AXIS} axisLine={false} tickLine={false} />
      <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => compactMoney(v, currency)} width={58} />
      <Bar dataKey="value" fill={GREEN} isAnimationActive={false} />
    </BarChart>
  );
}

/** Net cash position by year (after the system cost): grey while negative, green once paid back. */
export function CumulativeNetChart({ data, currency, width, height = 180 }: Sized & { data: { year: number; value: number }[]; currency: string }) {
  return (
    <BarChart width={width} height={height} data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
      <CartesianGrid vertical={false} stroke={GRID} />
      <XAxis dataKey="year" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={18} />
      <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => compactMoney(v, currency)} width={62} />
      <ReferenceLine y={0} stroke="#94a3b8" />
      <Bar dataKey="value" isAnimationActive={false}>
        {data.map((d, i) => (
          <Cell key={i} fill={d.value < 0 ? '#9aa3ad' : GREEN} />
        ))}
      </Bar>
    </BarChart>
  );
}

/** Savings each year, with the initial investment as a negative bar in the first year. */
export function AnnualSavingsChart({ data, currency, width, height = 180 }: Sized & { data: { year: number; value: number }[]; currency: string }) {
  return (
    <BarChart width={width} height={height} data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
      <CartesianGrid vertical={false} stroke={GRID} />
      <XAxis dataKey="year" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={18} />
      <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => compactMoney(v, currency)} width={62} />
      <ReferenceLine y={0} stroke="#94a3b8" />
      <Bar dataKey="value" isAnimationActive={false}>
        {data.map((d, i) => (
          <Cell key={i} fill={d.value < 0 ? '#9aa3ad' : GREEN} />
        ))}
      </Bar>
    </BarChart>
  );
}

/** RM 25,000 → RM25k on axes */
function compactMoney(v: number, currency: string): string {
  const abs = Math.abs(v);
  if (abs >= 1000) return `${v < 0 ? '-' : ''}${money(abs / 1000, currency)}k`;
  return money(v, currency);
}
