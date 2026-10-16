interface MatchScoreProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showPercent?: boolean;
}

export function MatchScore({ score, size = 'md', showPercent = false }: MatchScoreProps) {
  const radius = size === 'sm' ? 18 : size === 'lg' ? 32 : 24;
  const strokeWidth = size === 'sm' ? 3.5 : size === 'lg' ? 5.5 : 4.5;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(Math.max(score, 0), 100) / 100) * circumference;

  const color =
    score >= 75 ? '#107C10' : score >= 50 ? '#0078D4' : score >= 30 ? '#CA5010' : '#D13438';
  const fontSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-xl' : 'text-sm';
  const sizePx = radius * 2 + strokeWidth * 2;

  return (
    <div
      className="relative inline-flex items-center justify-center flex-shrink-0"
      style={{ width: sizePx, height: sizePx }}
      title={`Match Score: ${score}%`}
    >
      <svg width={sizePx} height={sizePx} className="-rotate-90">
        <circle
          cx={radius + strokeWidth}
          cy={radius + strokeWidth}
          r={radius}
          fill="none"
          stroke="#E1E6ED"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={radius + strokeWidth}
          cy={radius + strokeWidth}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className={`font-bold ${fontSize} text-text-primary tracking-tight leading-none`}>
          {score}{showPercent && <span className="text-[10px] text-text-secondary">%</span>}
        </span>
      </div>
    </div>
  );
}
