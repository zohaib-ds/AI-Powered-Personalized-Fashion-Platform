import { COLOURS, ZONE_INFO, ZONES, type DesignSummary } from '@/lib/design';

// Everything a printer needs to print one order: per zone, the file, its size
// and what is on it. Used by the printer portal and the admin page.
export default function PrintSpec({ design, files, links }: { design: DesignSummary; files: Record<string, string>; links: Record<string, string> }) {
  const colour = COLOURS.find((c) => c.id === design.colourId);
  return (
    <div className="spec">
      <div className="spec-shirt">
        <span className="swatch-dot" style={{ background: colour?.hex }} />
        <div>
          <strong>{colour?.name ?? design.colourId} free-size tee × {design.qty}</strong>
          <div className="muted">Same print on every piece</div>
        </div>
      </div>
      {ZONES.filter((z) => design.prints.some((p) => p.zone === z)).map((z) => {
        const info = ZONE_INFO[z];
        const path = files[z];
        const prints = design.prints.filter((p) => p.zone === z);
        return (
          <div key={z} className="spec-zone">
            <div className="spec-file">
              {path && links[path] ? (
                <a href={links[path]} target="_blank" rel="noreferrer" className="checker" title="Open the print file">
                  <img src={links[path]} alt={`${info.label} print file`} />
                </a>
              ) : <div className="checker missing">File missing</div>}
            </div>
            <div className="spec-body">
              <div className="row between">
                <strong>{info.label}</strong>
                {path && links[path] && <a className="btn small" href={links[path]} download={`${z}.png`} target="_blank" rel="noreferrer">Download PNG</a>}
              </div>
              <div className="muted">Print box {info.wCm} × {info.hCm} cm · file is exactly this size at 300 DPI, transparent background</div>
              <ul className="spec-list">
                {prints.map((p, i) => (
                  <li key={i}>
                    <span className="tag">{p.type === 'draw' ? 'Drawing' : p.type === 'image' ? 'Image' : 'Text'}</span>
                    {p.type === 'text' && <> “{p.text}” in {p.font}{p.color && <span className="swatch-dot sm" style={{ background: p.color }} />},</>}
                    {' '}{p.wCm} × {p.hCm} cm
                    {p.rot ? `, rotated ${p.rot}°` : ''}
                    {p.type === 'image' && p.dpi ? <span className={p.dpi < 120 ? 'low' : 'muted'}> · {p.dpi} DPI</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Stars({ n, size = 15 }: { n: number; size?: number }) {
  return (
    <span className="stars" aria-label={`${n} out of 5 stars`} style={{ fontSize: size }}>
      {[1, 2, 3, 4, 5].map((i) => <span key={i} className={i <= n ? 'on' : ''}>★</span>)}
    </span>
  );
}
