import { FormEvent, useMemo, useState } from 'react';
import { Check, Loader2, MousePointerClick, Move, PenLine, RotateCcw, Search, Trash2, Undo2, X, type LucideIcon } from 'lucide-react';
import type { LatLng, Project } from '../../types';
import { updateDesign, updateProject } from '../../lib/store';
import { geocode } from '../../lib/api';
import { layoutPanels, recommendedKw, systemKw } from '../../lib/solar';
import { num } from '../../lib/format';
import SolarMap from '../../components/SolarMap';
import { NumberField } from '../../components/ui';

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const compass = (az: number) => COMPASS[Math.round((((az % 360) + 360) % 360) / 45) % 8];

/** drop near-duplicate consecutive points (a double-click fires two clicks first) */
function cleanRing(pts: LatLng[]): LatLng[] {
  const out: LatLng[] = [];
  for (const p of pts) {
    const prev = out[out.length - 1];
    if (!prev || Math.abs(prev[0] - p[0]) > 2e-7 || Math.abs(prev[1] - p[1]) > 2e-7) out.push(p);
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (out.length > 3 && Math.abs(first[0] - last[0]) < 2e-7 && Math.abs(first[1] - last[1]) < 2e-7) out.pop();
  return out;
}

/**
 * Map toolbar button.
 * - `primary`: orange, label always visible
 * - `compact`: label hidden on phones (icon-only), visible from `sm` up
 * - `iconOnly`: never shows a label
 * The label is always exposed via aria-label/title for screen readers and hover.
 */
function ToolButton({
  icon: Icon,
  label,
  onClick,
  primary = false,
  compact = false,
  iconOnly = false,
  active = false,
  disabled = false,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  primary?: boolean;
  compact?: boolean;
  iconOnly?: boolean;
  active?: boolean;
  disabled?: boolean;
}) {
  const base = primary ? 'btn-primary' : 'btn-secondary';
  const pad = iconOnly ? '!px-2.5' : compact ? '!px-2.5 sm:!px-3.5' : '';
  const activeCls = active ? '!border-brand-400 !text-brand-700' : '';
  return (
    <button
      type="button"
      className={`${base} ${pad} ${activeCls} shadow`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active || undefined}
      title={label}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {!iconOnly && <span className={compact ? 'hidden sm:inline' : undefined}>{label}</span>}
    </button>
  );
}

export default function DesignTab({ project: p }: { project: Project }) {
  const d = p.design;
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState<LatLng[]>([]);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState(p.address);
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState('');
  const [recenterKey, setRecenterKey] = useState(0);

  const layout = useMemo(() => layoutPanels(d), [d]);
  const sizeKw = systemKw(layout.panels.length, d.panelWattage);
  const recommended = recommendedKw(p.monthlyBill, p.energy);
  const center: LatLng | null = p.lat != null && p.lng != null ? [p.lat, p.lng] : null;

  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearchMsg('');
    try {
      const r = await geocode(query);
      if (r) {
        updateProject(p.id, { lat: r.lat, lng: r.lng, address: query });
        setRecenterKey((k) => k + 1);
      } else setSearchMsg('No match found. Try adding the city or postcode.');
    } catch (err) {
      setSearchMsg((err as Error).message);
    }
    setSearching(false);
  };

  const startDrawing = () => {
    setEditing(false);
    setDraft([]);
    setDrawing(true);
  };

  const finish = () => {
    const ring = cleanRing(draft);
    if (ring.length < 3) return;
    updateDesign(p.id, { roof: ring });
    if (p.status === 'Lead') updateProject(p.id, { status: 'Designing' });
    setDrawing(false);
    setDraft([]);
  };

  const moveVertex = (i: number, ll: LatLng) => updateDesign(p.id, { roof: d.roof.map((v, j) => (j === i ? ll : v)) });

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-3">
        <form onSubmit={search} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find address" />
          </div>
          <button className="btn-secondary" disabled={searching}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Go'}
          </button>
        </form>
        {searchMsg && <p className="text-xs text-red-600">{searchMsg}</p>}

        <div className="relative">
          <SolarMap
            center={center}
            roof={drawing ? [] : d.roof}
            panels={drawing ? [] : layout.panels}
            className="h-[420px] sm:h-[560px]"
            drawing={drawing}
            draft={draft}
            onMapClick={(pt) => drawing && setDraft((cur) => [...cur, pt])}
            onMapDoubleClick={() => drawing && finish()}
            editVertices={editing && !drawing}
            onMoveVertex={moveVertex}
            recenterKey={recenterKey}
          />

          {/* floating toolbar: primary action keeps its label; secondary actions are icon-only on phones */}
          <div className="absolute left-14 right-3 top-3 z-[500] flex flex-wrap items-center gap-2 sm:right-auto">
            {!drawing ? (
              <>
                <ToolButton primary icon={PenLine} label={d.roof.length ? 'Redraw roof' : 'Draw roof'} onClick={startDrawing} />
                {d.roof.length >= 3 && (
                  <>
                    <ToolButton
                      icon={Move}
                      label={editing ? 'Done editing' : 'Edit corners'}
                      compact
                      active={editing}
                      onClick={() => setEditing(!editing)}
                    />
                    <ToolButton
                      icon={Trash2}
                      label="Clear roof"
                      compact
                      onClick={() => {
                        setEditing(false);
                        updateDesign(p.id, { roof: [] });
                      }}
                    />
                  </>
                )}
                <ToolButton icon={RotateCcw} label="Re-centre map" iconOnly onClick={() => setRecenterKey((k) => k + 1)} />
              </>
            ) : (
              <>
                <ToolButton primary icon={Check} label="Finish" onClick={finish} disabled={cleanRing(draft).length < 3} />
                <ToolButton icon={Undo2} label="Undo" compact onClick={() => setDraft((c) => c.slice(0, -1))} disabled={!draft.length} />
                <ToolButton
                  icon={X}
                  label="Cancel"
                  compact
                  onClick={() => {
                    setDrawing(false);
                    setDraft([]);
                  }}
                />
              </>
            )}
          </div>

          {(drawing || !d.roof.length) && (
            <div className="pointer-events-none absolute bottom-6 left-1/2 z-[500] w-max max-w-[90%] -translate-x-1/2 rounded-full bg-slate-900/80 px-4 py-2 text-center text-xs text-white">
              <MousePointerClick className="mr-1 inline h-3.5 w-3.5" />
              {drawing
                ? `Click each roof corner (${draft.length} placed). Double-click or press Finish to close.`
                : 'Press “Draw roof”, then click around the roof face you want to cover.'}
            </div>
          )}
        </div>
        <p className="text-xs text-slate-500">
          Panels are filled in rows facing the azimuth, respecting the edge setback. Draw one polygon per roof face for best results. Plan-view
          panel length is reduced by cos(tilt) to account for roof pitch.
        </p>
      </div>

      <aside className="space-y-4">
        <section className="card p-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-slate-500">Panels</p>
              <p className="text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">{layout.panels.length}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">System size</p>
              <p className="text-3xl font-semibold tracking-tight text-brand-600 tabular-nums">
                {num(sizeKw, 2)}
                <span className="ml-1 text-base font-medium text-slate-500">kWp</span>
              </p>
            </div>
          </div>
          <dl className="mt-4 space-y-1.5 border-t border-slate-100 pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Roof area (plan)</dt>
              <dd className="font-medium tabular-nums">{num(layout.roofAreaM2, 1)} m²</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Roof area (sloped)</dt>
              <dd className="font-medium tabular-nums">{num(layout.slopedAreaM2, 1)} m²</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Recommended for bill</dt>
              <dd className="font-medium tabular-nums">{num(recommended, 2)} kWp</dd>
            </div>
          </dl>
          {recommended > 0 && sizeKw > 0 && (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" title="Designed size vs recommended">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, (sizeKw / recommended) * 100)}%` }} />
            </div>
          )}
        </section>

        <section className="card space-y-4 p-5">
          <h3 className="font-semibold text-slate-900">Panel settings</h3>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Wattage" suffix="W" value={d.panelWattage} min={50} onChange={(v) => updateDesign(p.id, { panelWattage: v })} />
            <NumberField label="Max panels" suffix="0 = ∞" value={d.maxPanels} min={0} step={1} onChange={(v) => updateDesign(p.id, { maxPanels: Math.max(0, Math.round(v)) })} />
            <NumberField label="Width" suffix="m" value={d.panelWidth} min={0.3} step={0.001} onChange={(v) => updateDesign(p.id, { panelWidth: v })} />
            <NumberField label="Length" suffix="m" value={d.panelHeight} min={0.3} step={0.001} onChange={(v) => updateDesign(p.id, { panelHeight: v })} />
          </div>
          <div>
            <label className="label">Orientation</label>
            <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1">
              {(['portrait', 'landscape'] as const).map((o) => (
                <button
                  key={o}
                  onClick={() => updateDesign(p.id, { orientation: o })}
                  className={`rounded-md py-1.5 text-sm font-medium capitalize transition ${
                    d.orientation === o ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="flex justify-between">
              <label className="label">Tilt (roof pitch)</label>
              <span className="text-xs font-medium tabular-nums text-slate-700">{d.tilt}°</span>
            </div>
            <input type="range" min={0} max={60} value={d.tilt} onChange={(e) => updateDesign(p.id, { tilt: Number(e.target.value) })} className="w-full accent-brand-500" />
          </div>
          <div>
            <div className="flex justify-between">
              <label className="label">Azimuth (direction panels face)</label>
              <span className="text-xs font-medium tabular-nums text-slate-700">
                {d.azimuth}° {compass(d.azimuth)}
              </span>
            </div>
            <input type="range" min={0} max={359} value={d.azimuth} onChange={(e) => updateDesign(p.id, { azimuth: Number(e.target.value) })} className="w-full accent-brand-500" />
            <div className="mt-1 grid grid-cols-4 gap-1">
              {[
                ['N', 0],
                ['E', 90],
                ['S', 180],
                ['W', 270],
              ].map(([l, v]) => (
                <button key={l} className="rounded-md bg-slate-100 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200" onClick={() => updateDesign(p.id, { azimuth: v as number })}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Edge setback" suffix="m" value={d.setback} min={0} step={0.05} onChange={(v) => updateDesign(p.id, { setback: Math.max(0, v) })} />
            <NumberField label="Panel gap" suffix="m" value={d.gap} min={0} step={0.01} onChange={(v) => updateDesign(p.id, { gap: Math.max(0, v) })} />
          </div>
        </section>
      </aside>
    </div>
  );
}
