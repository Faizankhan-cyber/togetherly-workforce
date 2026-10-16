interface CapacityBarProps {
  utilization: number;
  overloadedThreshold?: number;
  underutilizedThreshold?: number;
  showLabel?: boolean;
  label?: string;
}

export function CapacityBar({
  utilization,
  overloadedThreshold = 90,
  underutilizedThreshold = 50,
  showLabel = true,
  label,
}: CapacityBarProps) {
  const clamped = Math.min(Math.max(utilization, 0), 100);

  const statusText =
    clamped >= overloadedThreshold ? 'Overloaded' : clamped <= underutilizedThreshold ? 'Underutilized' : 'Balanced';
  const statusColor =
    clamped >= overloadedThreshold ? 'text-critical' : clamped <= underutilizedThreshold ? 'text-cyan' : 'text-success';

  const gradientClass =
    clamped >= overloadedThreshold
      ? 'from-critical/80 to-critical'
      : clamped <= underutilizedThreshold
        ? 'from-cyan/80 to-cyan'
        : 'from-success/80 to-success';

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-text-secondary">{label ?? 'Utilization'}</span>
        <span className="text-xs font-medium text-text-primary">{clamped}%</span>
      </div>
      <div className="relative h-2 bg-base-bg rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${gradientClass} transition-all duration-700 ease-out`}
          style={{ width: `${clamped}%` }}
        />
        {overloadedThreshold < 100 && (
          <div
            className="absolute top-0 h-full w-px bg-critical/50"
            style={{ left: `${overloadedThreshold}%` }}
          />
        )}
      </div>
      {showLabel && (
        <div className={`text-[10px] mt-1 font-medium ${statusColor}`}>{statusText}</div>
      )}
    </div>
  );
}
