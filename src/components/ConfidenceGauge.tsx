interface ConfidenceGaugeProps {
  value: number; // 0-1
  label?: string;
  size?: number;
}

export default function ConfidenceGauge({ value, label = 'Confidence', size = 100 }: ConfidenceGaugeProps) {
  const pct = Math.round(value * 100);
  const strokeColor = pct >= 70 ? 'hsl(var(--gain))' : pct >= 50 ? 'hsl(var(--warning))' : 'hsl(var(--loss))';
  const textColor = pct >= 70 ? 'text-gain' : pct >= 50 ? 'text-warning' : 'text-loss';
  const bgColor = pct >= 70 ? 'bg-gain/10' : pct >= 50 ? 'bg-warning/10' : 'bg-loss/10';

  const cx = size / 2;
  const cy = size / 2 + 4;
  const r = size / 2 - 12;
  const strokeW = 6;

  // Arc: -210° to 30° (240° sweep, bottom-centered)
  const startDeg = -210;
  const sweepDeg = 240;
  const endDeg = startDeg + sweepDeg;

  const toRad = (d: number) => (d * Math.PI) / 180;
  const ptOnArc = (deg: number) => ({
    x: cx + r * Math.cos(toRad(deg)),
    y: cy + r * Math.sin(toRad(deg)),
  });

  const arcPath = (from: number, to: number) => {
    const s = ptOnArc(from);
    const e = ptOnArc(to);
    const large = Math.abs(to - from) > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  const bgArc = arcPath(startDeg, endDeg);
  const filledEnd = startDeg + (pct / 100) * sweepDeg;
  const filledArc = arcPath(startDeg, filledEnd);

  // Needle
  const needleDeg = filledEnd;
  const needleLen = r - 4;
  const needleTip = {
    x: cx + needleLen * Math.cos(toRad(needleDeg)),
    y: cy + needleLen * Math.sin(toRad(needleDeg)),
  };

  // Tick marks at 0%, 25%, 50%, 75%, 100%
  const ticks = [0, 25, 50, 75, 100];

  return (
    <div className={`flex flex-col items-center rounded-lg p-2 ${bgColor}`}>
      <span className="text-[9px] text-muted-foreground font-mono uppercase tracking-wider mb-0.5">{label}</span>
      <svg width={size} height={size * 0.62} viewBox={`0 0 ${size} ${size * 0.62}`}>
        {/* Background arc */}
        <path d={bgArc} fill="none" stroke="hsl(var(--secondary))" strokeWidth={strokeW} strokeLinecap="round" />
        {/* Filled arc */}
        {pct > 0 && (
          <path d={filledArc} fill="none" stroke={strokeColor} strokeWidth={strokeW} strokeLinecap="round" className="transition-all duration-700" />
        )}
        {/* Tick marks */}
        {ticks.map(t => {
          const deg = startDeg + (t / 100) * sweepDeg;
          const inner = { x: cx + (r - 8) * Math.cos(toRad(deg)), y: cy + (r - 8) * Math.sin(toRad(deg)) };
          const outer = { x: cx + (r + 2) * Math.cos(toRad(deg)), y: cy + (r + 2) * Math.sin(toRad(deg)) };
          return (
            <line key={t} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="hsl(var(--muted-foreground))" strokeWidth={0.8} opacity={0.3} />
          );
        })}
        {/* Needle */}
        <line x1={cx} y1={cy} x2={needleTip.x} y2={needleTip.y} stroke={strokeColor} strokeWidth={1.5} strokeLinecap="round" className="transition-all duration-700" />
        <circle cx={cx} cy={cy} r={2.5} fill={strokeColor} className="transition-all duration-700" />
        {/* Center percentage */}
        <text x={cx} y={cy - 6} textAnchor="middle" className="fill-foreground" style={{ fontSize: size * 0.18, fontFamily: 'monospace', fontWeight: 700 }}>
          {pct}%
        </text>
        <text x={cx} y={cy + 6} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: size * 0.08 }}>
          {pct >= 70 ? 'HIGH' : pct >= 50 ? 'MODERATE' : 'LOW'}
        </text>
      </svg>
    </div>
  );
}
