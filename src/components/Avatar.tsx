interface AvatarProps {
  name: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function Avatar({ name, color = '#0078D4', size = 'md', className = '' }: AvatarProps) {
  const initials = (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

  const sizeClasses = {
    sm: 'w-7 h-7 text-[11px] font-semibold',
    md: 'w-8 h-8 text-xs font-bold',
    lg: 'w-10 h-10 text-sm font-bold',
    xl: 'w-12 h-12 text-base font-bold',
  };

  return (
    <div
      className={`rounded-full flex items-center justify-center text-white shrink-0 select-none shadow-sm ${sizeClasses[size]} ${className}`}
      style={{
        backgroundColor: color,
      }}
      title={name}
      aria-label={name}
    >
      <span>{initials}</span>
    </div>
  );
}
