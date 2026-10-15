interface MatchScoreProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

export function MatchScore({ score, size = 'md' }: MatchScoreProps) {
  const radius = size === 'sm' ? 18 : size === 'lg' ? 32 : 24;
  const strokeWidth = size === 'sm' ? 3 : size === 'lg' ? 5 : 4;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color = score >= 75 ? '#22C55E' : score >= 50 ? '#F59E0B' : score >= 25 ? '#22D3EE' : '#F87171';
  const fontSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-lg' : 'text-sm';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: radius * 2 + strokeWidth * 2, height: radius * 2 + strokeWidth * 2 }}>
      <svg width={radius * 2 + strokeWidth * 2} height={radius * 2 + strokeWidth * 2} className="-rotate-90">
        <circle
          cx={radius + strokeWidth}
          cy={radius + strokeWidth}
          r={radius}
          fill="none"
          stroke="#29324B"
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
          className="transition-all duration-500"
        />
      </svg>
      <span className={`absolute font-bold ${fontSize} text-text-primary`}>{score}</span>
    </div>
  );
}
