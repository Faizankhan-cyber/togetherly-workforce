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
    clamped >= overloadedThreshold ? 'text-critical' : clamped <= underutilizedThreshold ? 'text-primary' : 'text-success';

  const fillClass =
    clamped >= overloadedThreshold
      ? 'bg-critical'
      : clamped <= underutilizedThreshold
        ? 'bg-primary'
        : 'bg-success';

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-medium text-text-secondary">{label ?? 'Utilization'}</span>
        <span className="text-xs font-bold font-mono text-text-primary">{clamped}%</span>
      </div>
      <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${fillClass} transition-all duration-500 ease-out`}
          style={{ width: `${clamped}%` }}
        />
        {overloadedThreshold < 100 && (
          <div
            className="absolute top-0 h-full w-px bg-red-400"
            style={{ left: `${overloadedThreshold}%` }}
          />
        )}
      </div>
      {showLabel && (
        <div className={`text-[10px] mt-0.5 font-semibold ${statusColor}`}>{statusText}</div>
      )}
    </div>
  );
}
