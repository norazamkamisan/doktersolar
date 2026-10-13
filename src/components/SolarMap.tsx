import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { CircleMarker, MapContainer, Marker, Polygon, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { LatLng } from '../types';

const ESRI_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ESRI_ATTR = 'Imagery &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community';

const DEFAULT_CENTER: LatLng = [3.139, 101.6869]; // Kuala Lumpur

const vertexIcon = L.divIcon({
  className: '',
  html: '<div style="width:14px;height:14px;border-radius:9999px;background:#fff;border:3px solid #f97316;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

interface Props {
  center: LatLng | null;
  roof: LatLng[];
  panels: LatLng[][];
  className?: string;
  /** static snapshot: no pan/zoom, fits to the roof */
  staticView?: boolean;
  drawing?: boolean;
  draft?: LatLng[];
  onMapClick?: (p: LatLng) => void;
  onMapDoubleClick?: () => void;
  editVertices?: boolean;
  onMoveVertex?: (index: number, p: LatLng) => void;
  /** bump to re-centre the map on `center` */
  recenterKey?: number;
}

function Recenter({ center, roof, recenterKey }: { center: LatLng | null; roof: LatLng[]; recenterKey?: number }) {
  const map = useMap();
  useEffect(() => {
    if (roof.length >= 3) map.fitBounds(L.latLngBounds(roof), { padding: [40, 40], maxZoom: 21 });
    else if (center) map.setView(center, 20);
    // only re-run when explicitly asked or when the location changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey, center?.[0], center?.[1]]);
  return null;
}

function ClickHandler({ onClick, onDouble }: { onClick?: (p: LatLng) => void; onDouble?: () => void }) {
  useMapEvents({
    click: (e) => onClick?.([e.latlng.lat, e.latlng.lng]),
    dblclick: () => onDouble?.(),
  });
  return null;
}

function DoubleClickZoomToggle({ disabled }: { disabled: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (disabled) map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
  }, [disabled, map]);
  return null;
}

export default function SolarMap({
  center,
  roof,
  panels,
  className = 'h-[480px]',
  staticView = false,
  drawing = false,
  draft = [],
  onMapClick,
  onMapDoubleClick,
  editVertices = false,
  onMoveVertex,
  recenterKey,
}: Props) {
  const start = center ?? DEFAULT_CENTER;
  const renderer = useMemo(() => L.canvas({ padding: 0.5 }), []);
  const bounds = roof.length >= 3 ? L.latLngBounds(roof) : undefined;

  return (
    <div className={`${className} ${drawing ? 'drawing' : ''} relative overflow-hidden rounded-xl bg-slate-200`}>
      <MapContainer
        center={start}
        zoom={center ? 20 : 12}
        bounds={staticView ? bounds : undefined}
        boundsOptions={{ padding: [30, 30] }}
        maxZoom={21}
        className="h-full w-full"
        renderer={renderer}
        zoomControl={!staticView}
        dragging={!staticView}
        scrollWheelZoom={!staticView}
        doubleClickZoom={!staticView}
        touchZoom={!staticView}
        keyboard={!staticView}
        attributionControl
      >
        <TileLayer url={ESRI_URL} attribution={ESRI_ATTR} maxNativeZoom={19} maxZoom={21} />
        {!staticView && <Recenter center={center} roof={roof} recenterKey={recenterKey} />}
        {!staticView && <ClickHandler onClick={onMapClick} onDouble={onMapDoubleClick} />}
        <DoubleClickZoomToggle disabled={drawing || staticView} />

        {roof.length >= 3 && (
          <Polygon
            positions={roof}
            pathOptions={{ color: '#f97316', weight: 2.5, fillColor: '#f97316', fillOpacity: 0.12 }}
            interactive={false}
          />
        )}
        {panels.map((pts, i) => (
          <Polygon
            key={i}
            positions={pts}
            pathOptions={{ color: '#e2e8f0', weight: 0.8, fillColor: '#1e3a8a', fillOpacity: 0.88 }}
            interactive={false}
          />
        ))}

        {drawing && draft.length > 0 && (
          <>
            <Polyline positions={draft} pathOptions={{ color: '#fb923c', weight: 2.5, dashArray: '6 4' }} interactive={false} />
            {draft.map((p, i) => (
              <CircleMarker
                key={i}
                center={p}
                radius={5}
                pathOptions={{ color: '#fff', weight: 2, fillColor: '#f97316', fillOpacity: 1 }}
                interactive={false}
              />
            ))}
          </>
        )}

        {editVertices &&
          roof.map((p, i) => (
            <Marker
              key={`${i}-${p[0]}-${p[1]}`}
              position={p}
              icon={vertexIcon}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const ll = (e.target as L.Marker).getLatLng();
                  onMoveVertex?.(i, [ll.lat, ll.lng]);
                },
              }}
            />
          ))}

        {!drawing && roof.length < 3 && center && (
          <CircleMarker center={center} radius={7} pathOptions={{ color: '#fff', weight: 2, fillColor: '#f97316', fillOpacity: 1 }} />
        )}
      </MapContainer>
    </div>
  );
}
