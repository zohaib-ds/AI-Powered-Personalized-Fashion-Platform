// Sample artwork drawn in code (1024 px squares) and text rendering for layers.

type Draw = (x: CanvasRenderingContext2D) => void;

export const SAMPLE_ART: Record<string, Draw> = {
  Sunset: (x) => {
    const c = 512;
    x.save();
    x.beginPath(); x.arc(c, c, 440, 0, Math.PI * 2); x.clip();
    const g = x.createLinearGradient(0, 80, 0, 900);
    g.addColorStop(0, '#ffcf3a'); g.addColorStop(0.55, '#ff7a2f'); g.addColorStop(1, '#e0335a');
    x.fillStyle = g; x.fillRect(0, 0, 1024, 1024);
    x.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 7; i++) x.fillRect(0, 560 + i * 58, 1024, 10 + i * 5);
    x.globalCompositeOperation = 'source-over';
    x.fillStyle = '#22253a';
    x.beginPath(); x.moveTo(60, 1024); x.lineTo(60, 760); x.lineTo(300, 600); x.lineTo(430, 700); x.lineTo(620, 520); x.lineTo(980, 800); x.lineTo(980, 1024); x.fill();
    x.restore();
  },
  Bloom: (x) => {
    x.translate(512, 512);
    const cols = ['#e2453c', '#f2a51a', '#2b6f8f'];
    for (let r = 3; r >= 1; r--) {
      x.fillStyle = cols[r - 1];
      for (let i = 0; i < 12; i++) {
        x.save(); x.rotate((i * Math.PI) / 6 + r * 0.26);
        x.beginPath(); x.ellipse(0, -r * 120, 70 + r * 12, r * 120, 0, 0, Math.PI * 2); x.fill();
        x.restore();
      }
    }
    x.fillStyle = '#1d1f2b'; x.beginPath(); x.arc(0, 0, 90, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#f2a51a'; x.beginPath(); x.arc(0, 0, 40, 0, Math.PI * 2); x.fill();
  },
  Waves: (x) => {
    x.lineWidth = 26; x.lineCap = 'round';
    const cols = ['#2b6f8f', '#37a3a0', '#e8a20c'];
    for (let r = 0; r < 9; r++) {
      x.strokeStyle = cols[r % 3];
      x.beginPath();
      for (let i = 0; i <= 60; i++) {
        const px = 80 + i * 14.4, py = 180 + r * 80 + Math.sin((i / 60) * Math.PI * 3 + r * 0.6) * 50;
        if (i) x.lineTo(px, py); else x.moveTo(px, py);
      }
      x.stroke();
    }
  },
  Badge: (x) => {
    x.translate(512, 512); x.strokeStyle = '#15171c'; x.fillStyle = '#15171c';
    x.lineWidth = 22; x.beginPath(); x.arc(0, 0, 440, 0, Math.PI * 2); x.stroke();
    x.lineWidth = 8; x.beginPath(); x.arc(0, 0, 395, 0, Math.PI * 2); x.stroke();
    x.font = '400 300px Anton, Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('DLI', 0, 10);
    x.font = '400 64px "Bebas Neue", sans-serif';
    const label = 'EST. 2026  ·  MADE IN DELHI  ·  ';
    for (let i = 0; i < label.length; i++) {
      x.save(); x.rotate(-Math.PI / 2 + i * ((Math.PI * 2) / label.length)); x.fillText(label[i], 0, -330); x.restore();
    }
    for (const sx of [-1, 1]) { x.beginPath(); x.arc(sx * 250, 0, 14, 0, Math.PI * 2); x.fill(); }
  },
};

export function artCanvas(name: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  SAMPLE_ART[name](c.getContext('2d')!);
  return c;
}

export const TEXT_FONTS = ['Anton', 'Bebas Neue', 'Archivo Black', 'Permanent Marker', 'Pacifico', 'Playfair Display'];

export function fontSpec(font: string, px: number) {
  return font === 'Playfair Display' ? `italic 700 ${px}px "Playfair Display"` : `400 ${px}px "${font}"`;
}

export function textCanvas(text: string, font: string, color: string, outline: boolean): HTMLCanvasElement {
  const spec = fontSpec(font, 160);
  const m = document.createElement('canvas').getContext('2d')!;
  m.font = spec;
  const met = m.measureText(text || ' ');
  const pad = 30, asc = met.actualBoundingBoxAscent || 120, desc = met.actualBoundingBoxDescent || 30;
  const c = document.createElement('canvas');
  c.width = Math.ceil(met.width + pad * 2);
  c.height = Math.ceil(asc + desc + pad * 2);
  const x = c.getContext('2d')!;
  x.font = spec; x.fillStyle = color; x.lineJoin = 'round';
  if (outline) {
    x.lineWidth = 12; x.strokeStyle = color; x.strokeText(text, pad, pad + asc);
    x.globalCompositeOperation = 'destination-out'; x.fillText(text, pad, pad + asc);
  } else {
    x.fillText(text, pad, pad + asc);
  }
  return c;
}
