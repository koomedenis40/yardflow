'use client';

interface TrendBarsProps {
  label: string;
  values: number[];
  formatValue?: (n: number) => string;
}

export function TrendBars({ label, values, formatValue = (n) => String(n) }: TrendBarsProps) {
  const max = Math.max(...values, 1);
  return (
    <div className="trend-bars">
      <span className="trend-bars__label">{label}</span>
      <div className="trend-bars__chart" role="img" aria-label={label}>
        {values.map((v, i) => (
          <div key={i} className="trend-bars__bar-wrap">
            <div className="trend-bars__bar" style={{ height: `${(v / max) * 100}%` }} />
            <span className="trend-bars__val">{formatValue(v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
