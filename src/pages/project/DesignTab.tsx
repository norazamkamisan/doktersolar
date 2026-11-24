import { FormEvent, useMemo, useState } from 'react';
import { Check, Loader2, MousePointerClick, Move, PenLine, Plus, RotateCcw, Search, Trash2, Undo2, X, type LucideIcon } from 'lucide-react';
import type { LatLng, Project, RoofFace } from '../../types';
import { updateDesign, updateProject, useSettings } from '../../lib/store';
import SiteVisitChecklist, { checklistKindOf } from '../../components/SiteVisit';
import { progress } from '../../lib/siteVisit';
import { geocode } from '../../lib/api';
import { compass, facesPatch, layoutPanels, recommendedKw, systemKw } from '../../lib/solar';
import { num } from '../../lib/format';
import SolarMap from '../../components/SolarMap';
import { NumberField } from '../../components/ui';

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

/** Design tab: the roof layout, or the site visit checklist. */
export default function DesignTab({ project: p }: { project: Project }) {
  const settings = useSettings();
  const [view, setView] = useState<'roof' | 'site'>(() => (window.location.hash === '#site-visit' ? 'site' : 'roof'));
  const show = (v: 'roof' | 'site') => {
    setView(v);
    window.history.replaceState(window.history.state, '', v === 'site' ? '#site-visit' : window.location.pathname + window.location.search);
  };
  const { done, total } = progress(p.siteVisit, checklistKindOf(p));
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Design view">
        {(
          [
            ['roof', 'Roof design'],
            ['site', `Site visit (${done}/${total})`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={view === k}
            onClick={() => show(k)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${view === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {view === 'roof' ? <RoofDesign project={p} /> : <SiteVisitChecklist project={p} settings={settings} />}
    </div>
  );
}

function RoofDesign({ project: p }: { project: Project }) {
  const d = p.design;
  /** null = not drawing; -1 = drawing a new roof; n = redrawing roof n */
  const [drawTarget, setDrawTarget] = useState<number | null>(null);
  const drawing = drawTarget !== null;
  const [draft, setDraft] = useState<LatLng[]>([]);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(0);
  const [query, setQuery] = useState(p.address);
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState('');
  const [searchInfo, setSearchInfo] = useState('');
  const [recenterKey, setRecenterKey] = useState(0);

  const layout = useMemo(() => layoutPanels(d), [d]);
  const faces = layout.faces;
  const active = Math.min(selected, Math.max(0, faces.length - 1));
  const face = faces[active];
  const sizeKw = systemKw(layout.panels.length, d.panelWattage);
  const recommended = recommendedKw(p);
  const center: LatLng | null = p.lat != null && p.lng != null ? [p.lat, p.lng] : null;
  const multi = faces.length > 1;

  const setFaces = (next: RoofFace[]) => updateDesign(p.id, facesPatch(next));
  const plainFaces = (): RoofFace[] => faces.map(({ roof, tilt, azimuth }) => ({ roof, tilt, azimuth }));
  const updateFace = (i: number, patch: Partial<RoofFace>) => setFaces(plainFaces().map((f, j) => (j === i ? { ...f, ...patch } : f)));
  // tilt / azimuth apply to the selected roof (or to the design itself before any roof is drawn)
  const setTilt = (tilt: number) => (face ? updateFace(active, { tilt }) : updateDesign(p.id, { tilt }));
  const setAzimuth = (azimuth: number) => (face ? updateFace(active, { azimuth }) : updateDesign(p.id, { azimuth }));
  const tilt = face?.tilt ?? d.tilt;
  const azimuth = face?.azimuth ?? d.azimuth;

  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearchMsg('');
    setSearchInfo('');
    try {
      const r = await geocode(query);
      if (r) {
        updateProject(p.id, { lat: r.lat, lng: r.lng, address: query });
        setRecenterKey((k) => k + 1);
        if (r.approximate) setSearchInfo(`Closest match: ${r.label}. Check it's the right building before drawing.`);
      } else setSearchMsg('No match found. Try adding the town or postcode, e.g. "Jalan Tun Dr. Ismail, Seremban".');
    } catch (err) {
      setSearchMsg((err as Error).message);
    }
    setSearching(false);
  };

  const startDrawing = (target: number) => {
    setEditing(false);
    setDraft([]);
    setDrawTarget(target);
  };

  const stopDrawing = () => {
    setDrawTarget(null);
    setDraft([]);
  };

  const finish = () => {
    const ring = cleanRing(draft);
    if (ring.length < 3 || drawTarget === null) return;
    if (drawTarget < 0 || drawTarget >= faces.length) {
      // a new roof starts with the selected roof's pitch and direction; change them under "Roofs"
      setFaces([...plainFaces(), { roof: ring, tilt, azimuth }]);
      setSelected(faces.length);
    } else {
      updateFace(drawTarget, { roof: ring });
    }
    if (p.status === 'Lead') updateProject(p.id, { status: 'Designing' });
    stopDrawing();
  };

  const deleteFace = (i: number) => {
    setEditing(false);
    setFaces(plainFaces().filter((_, j) => j !== i));
    setSelected(Math.max(0, i - 1));
  };

  const moveVertex = (vi: number, ll: LatLng) => {
    if (face) updateFace(active, { roof: face.roof.map((v, j) => (j === vi ? ll : v)) });
  };

  const drawingLabel = drawTarget !== null && drawTarget >= 0 && drawTarget < faces.length ? `roof ${drawTarget + 1}` : `roof ${faces.length + 1}`;

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
        {searchInfo && <p className="text-xs text-amber-700">{searchInfo}</p>}
        {!!p.importedKw && !faces.length && !drawing && (
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800" role="note">
            {p.bill ? 'Sized from the TNB bill' : 'Imported from OpenSolar'} as a <strong>{num(p.importedKw, 2)} kWp</strong> system.
            Draw the roof to lay out panels here; the drawn layout then replaces {p.bill ? 'the recommended' : 'the imported'} size.
          </div>
        )}
        {!center && !drawing && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="status">
            <strong>This project has no map location yet.</strong>{' '}
            {faces.length
              ? 'The roof below may be in the wrong place. Search for the address above to check.'
              : "Search for the address above before drawing the roof. If it isn't found, add the town or postcode."}
          </div>
        )}

        <div className="relative">
          <SolarMap
            center={center}
            roofs={faces.map((f, i) => (drawing && i === drawTarget ? [] : f.roof))}
            activeRoof={drawing || !multi ? -1 : active}
            onSelectRoof={(i) => setSelected(i)}
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
              faces.length ? (
                <>
                  <ToolButton primary icon={Plus} label="Add roof" onClick={() => startDrawing(-1)} />
                  <ToolButton icon={PenLine} label={multi ? `Redraw roof ${active + 1}` : 'Redraw roof'} compact onClick={() => startDrawing(active)} />
                  <ToolButton
                    icon={Move}
                    label={editing ? 'Done editing' : 'Edit corners'}
                    compact
                    active={editing}
                    onClick={() => setEditing(!editing)}
                  />
                  <ToolButton icon={Trash2} label={multi ? `Delete roof ${active + 1}` : 'Clear roof'} compact onClick={() => deleteFace(active)} />
                  <ToolButton icon={RotateCcw} label="Re-centre map" iconOnly onClick={() => setRecenterKey((k) => k + 1)} />
                </>
              ) : (
                <>
                  <ToolButton primary icon={PenLine} label="Draw roof" onClick={() => startDrawing(-1)} />
                  <ToolButton icon={RotateCcw} label="Re-centre map" iconOnly onClick={() => setRecenterKey((k) => k + 1)} />
                </>
              )
            ) : (
              <>
                <ToolButton primary icon={Check} label="Finish" onClick={finish} disabled={cleanRing(draft).length < 3} />
                <ToolButton icon={Undo2} label="Undo" compact onClick={() => setDraft((c) => c.slice(0, -1))} disabled={!draft.length} />
                <ToolButton icon={X} label="Cancel" compact onClick={stopDrawing} />
              </>
            )}
          </div>

          {(drawing || !faces.length) && (
            <div className="pointer-events-none absolute bottom-6 left-1/2 z-[500] w-max max-w-[90%] -translate-x-1/2 rounded-full bg-slate-900/80 px-4 py-2 text-center text-xs text-white">
              <MousePointerClick className="mr-1 inline h-3.5 w-3.5" />
              {drawing
                ? `Click each corner of ${drawingLabel} (${draft.length} placed). Double-click or press Finish to close.`
                : 'Press “Draw roof”, then click around the roof face you want to cover.'}
            </div>
          )}
        </div>
        <p className="text-xs text-slate-500">
          Draw one outline per roof face. Use <strong>Add roof</strong> for each side of the roof that should get panels, then set each
          one&apos;s direction and tilt under <strong>Roofs</strong>. Click an outline on the map to select it. Panels are filled in rows facing
          each roof&apos;s direction, respecting the edge setback; plan-view panel length is reduced by cos(tilt) to account for roof pitch.
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
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Roofs</h3>
            {faces.length > 0 && !drawing && (
              <button type="button" className="text-sm font-medium text-brand-600 hover:text-brand-700" onClick={() => startDrawing(-1)}>
                + Add roof
              </button>
            )}
          </div>
          {faces.length > 0 ? (
            <ul className="space-y-1.5" aria-label="Roof faces">
              {faces.map((f, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setSelected(i)}
                    aria-pressed={i === active}
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition ${
                      i === active ? 'border-brand-300 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: i === active || !multi ? '#f97316' : '#fcd34d' }} /* matches the outline on the map */ aria-hidden="true" />
                    <span className="flex-1 font-medium text-slate-800">Roof {i + 1}</span>
                    <span className="tabular-nums text-slate-500">
                      {f.panels.length} panels · {compass(f.azimuth)} · {f.tilt}°
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No roof drawn yet. These settings apply to the first roof you draw.</p>
          )}

          <div className="space-y-4 border-t border-slate-100 pt-4">
            {multi && <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Roof {active + 1}</p>}
            <div>
              <div className="flex justify-between">
                <label className="label" htmlFor="roof-tilt">
                  Tilt (roof pitch)
                </label>
                <span className="text-xs font-medium tabular-nums text-slate-700">{tilt}°</span>
              </div>
              <input id="roof-tilt" type="range" min={0} max={60} value={tilt} onChange={(e) => setTilt(Number(e.target.value))} className="w-full accent-brand-500" />
            </div>
            <div>
              <div className="flex justify-between">
                <label className="label" htmlFor="roof-azimuth">
                  Azimuth (direction panels face)
                </label>
                <span className="text-xs font-medium tabular-nums text-slate-700">
                  {azimuth}° {compass(azimuth)}
                </span>
              </div>
              <input
                id="roof-azimuth"
                type="range"
                min={0}
                max={359}
                value={azimuth}
                onChange={(e) => setAzimuth(Number(e.target.value))}
                className="w-full accent-brand-500"
              />
              <div className="mt-1 grid grid-cols-4 gap-1">
                {[
                  ['N', 0],
                  ['E', 90],
                  ['S', 180],
                  ['W', 270],
                ].map(([l, v]) => (
                  <button
                    key={l}
                    type="button"
                    className={`rounded-md py-1 text-xs font-medium ${azimuth === v ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    onClick={() => setAzimuth(v as number)}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="card space-y-4 p-5">
          <h3 className="font-semibold text-slate-900">Panel settings{multi ? ' (all roofs)' : ''}</h3>
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
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Edge setback" suffix="m" value={d.setback} min={0} step={0.05} onChange={(v) => updateDesign(p.id, { setback: Math.max(0, v) })} />
            <NumberField label="Panel gap" suffix="m" value={d.gap} min={0} step={0.01} onChange={(v) => updateDesign(p.id, { gap: Math.max(0, v) })} />
          </div>
        </section>
      </aside>
    </div>
  );
}
