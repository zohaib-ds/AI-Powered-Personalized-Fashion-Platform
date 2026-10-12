import { COLOURS, type DesignSummary, type LayerGeometry, type Side } from '../design';

export interface Layer extends LayerGeometry {
  id: number;
  name: string;
  src: HTMLCanvasElement | HTMLImageElement;
  px?: number; // source width in pixels, for the print-sharpness check
  text?: string;
  font?: string;
  color?: string;
  outline?: boolean;
  thumb?: string;
}

export interface StudioState {
  colourId: string;
  heavy: boolean;
  qty: number;
  side: Side;
  guide: boolean;
  layers: Layer[];
  sel: number | null;
}

type Listener = () => void;

// Tiny mutable store: the 3D engine mutates layers while dragging, React re-renders on `version`.
export class StudioStore {
  state: StudioState = { colourId: COLOURS[0].id, heavy: false, qty: 1, side: 'front', guide: true, layers: [], sel: null };
  private version = 0;
  private nextId = 1;
  private listeners = new Set<Listener>();

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getVersion = () => this.version;

  update(fn?: (s: StudioState) => void) {
    fn?.(this.state);
    this.version++;
    this.listeners.forEach((l) => l());
  }

  newId() {
    return this.nextId++;
  }

  selected(): Layer | undefined {
    return this.state.layers.find((l) => l.id === this.state.sel);
  }
}

export function summarise(store: StudioStore): DesignSummary {
  const s = store.state;
  return {
    colourId: s.colourId,
    heavy: s.heavy,
    qty: s.qty,
    layers: s.layers.map((L) => ({
      side: L.side, type: L.type, x: L.x, y: L.y, w: L.w, aspect: L.aspect, rot: L.rot,
      name: L.name, text: L.text, font: L.font, color: L.color,
    })),
  };
}
