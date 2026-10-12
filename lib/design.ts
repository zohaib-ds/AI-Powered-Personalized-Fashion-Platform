// Shared design model. Everything is in centimetres on the flat garment,
// seen from the side being printed (x to the right, y up from the hem).

export type Side = 'front' | 'back';

export interface PrintArea {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

// 12 x 16 in print box on the free-size tee. Confirm with the printers.
export const PRINT_AREAS: Record<Side, PrintArea> = {
  front: { cx: 0, cy: 38, w: 30.5, h: 40.6 },
  back: { cx: 0, cy: 46, w: 30.5, h: 40.6 },
};

export const CM_PER_IN = 2.54;
export const PRINT_DPI = 300;

export interface Colour {
  id: string;
  name: string;
  hex: string;
}

export const COLOURS: Colour[] = [
  { id: 'white', name: 'White', hex: '#f3f2ee' },
  { id: 'black', name: 'Black', hex: '#121315' },
  { id: 'sand', name: 'Sand', hex: '#d8c6a5' },
  { id: 'bottle-green', name: 'Bottle green', hex: '#2e4a3b' },
  { id: 'navy', name: 'Navy', hex: '#1f2a44' },
  { id: 'maroon', name: 'Maroon', hex: '#5e1f28' },
  { id: 'lavender', name: 'Lavender', hex: '#bfb2d9' },
  { id: 'grey-melange', name: 'Grey melange', hex: '#9a9ca0' },
];

// The geometry of one print layer: enough for pricing and for the printer.
export interface LayerGeometry {
  side: Side;
  type: 'image' | 'text';
  x: number;
  y: number;
  w: number;
  aspect: number;
  rot: number;
}

export interface DesignSummary {
  colourId: string;
  heavy: boolean;
  qty: number;
  layers: (LayerGeometry & { name?: string; text?: string; font?: string; color?: string })[];
}

export function layerCorners(L: LayerGeometry): [number, number][] {
  const r = (L.rot * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const hw = L.w / 2;
  const hh = L.w / L.aspect / 2;
  return (
    [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ] as [number, number][]
  ).map(([x, y]) => [L.x + x * c - y * s, L.y + x * s + y * c]);
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  w: number;
  h: number;
}

// Bounding box of everything printed on one side, clipped to the print area.
export function printedBox(layers: LayerGeometry[], side: Side): Box | null {
  const pa = PRINT_AREAS[side];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let any = false;
  for (const L of layers) {
    if (L.side !== side) continue;
    any = true;
    for (const [x, y] of layerCorners(L)) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  if (!any) return null;
  x0 = Math.max(x0, pa.cx - pa.w / 2);
  x1 = Math.min(x1, pa.cx + pa.w / 2);
  y0 = Math.max(y0, pa.cy - pa.h / 2);
  y1 = Math.min(y1, pa.cy + pa.h / 2);
  if (x1 <= x0 || y1 <= y0) return null;
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

export function isDelhiPincode(pin: string): boolean {
  return /^110\d{3}$/.test(pin.trim());
}
