// A detail of the painted map (map.base) around one region, used where a season has no event
// art: an old-map vignette with a vermilion seal on the region seat instead of an empty frame.
import { useAsset, useMapData } from '../api/assets';
import { cls } from '../lib/util';

type Pt = [number, number];
export const MAP_BASE_IDS = ['map.base', 'ui.map.base', 'map.base.default'];

export function MapCrop({ region, className, zoom = 3.2 }: { region: string; className?: string; zoom?: number }) {
  const [map] = useMapData();
  const [url] = useAsset(MAP_BASE_IDS);
  const shape = map?.regions.find((r) => r.id === region) ?? map?.regions.find((r) => r.id === 'jingji');
  if (!map || !url || !shape) return null;
  const seatRaw = shape.capital ?? (Array.isArray(shape.seat) ? shape.seat : shape.seat ? [shape.seat.x, shape.seat.y] : null) ?? shape.center ?? shape.label;
  const seat = (seatRaw ?? [map.width / 2, map.height / 2]) as Pt;
  // a 4:3 window around the seat, kept inside the map
  const w = Math.min(map.width, map.width / zoom);
  const h = Math.min(map.height, (w * 3) / 4);
  const x = Math.max(0, Math.min(map.width - w, seat[0] - w / 2));
  const y = Math.max(0, Math.min(map.height - h, seat[1] - h / 2));
  const r = w / 34;
  return (
    <svg className={cls('map-crop', className)} viewBox={`${x} ${y} ${w} ${h}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" data-art="map">
      <defs>
        <radialGradient id="mapcrop-vignette" cx="50%" cy="50%" r="70%">
          <stop offset="55%" stopColor="#2a160c" stopOpacity="0" />
          <stop offset="100%" stopColor="#2a160c" stopOpacity="0.55" />
        </radialGradient>
      </defs>
      <image href={url} x={0} y={0} width={map.width} height={map.height} preserveAspectRatio="none" />
      <rect x={x} y={y} width={w} height={h} fill="#e8d6a8" opacity="0.12" />
      <g transform={`translate(${seat[0]} ${seat[1]})`}>
        <circle r={r * 2.2} fill="none" stroke="#a8322a" strokeWidth={r * 0.28} opacity="0.75" />
        <circle r={r * 0.9} fill="#a8322a" opacity="0.9" />
      </g>
      <rect x={x} y={y} width={w} height={h} fill="url(#mapcrop-vignette)" />
    </svg>
  );
}
