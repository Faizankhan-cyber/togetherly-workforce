import { getSkillName } from '@/utils';

interface SkillTagProps {
  skillId: string;
  level?: number;
  showLevel?: boolean;
  variant?: 'default' | 'matched' | 'missing';
}

export function SkillTag({ skillId, level, showLevel = false, variant = 'default' }: SkillTagProps) {
  const name = getSkillName(skillId);

  const variantStyles =
    variant === 'matched'
      ? 'bg-success/10 text-success border-success/30'
      : variant === 'missing'
        ? 'bg-critical/10 text-critical border-critical/30'
        : 'bg-base-bg/80 text-text-primary border-base-border/80 hover:border-primary/40';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${variantStyles}`}>
      <span className="truncate">{name}</span>
      {showLevel && typeof level === 'number' && (
        <span className="flex items-center gap-0.5 ml-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <span
              key={star}
              className={`w-1.5 h-1.5 rounded-full ${star <= level ? 'bg-primary' : 'bg-base-border'}`}
            />
          ))}
        </span>
      )}
    </span>
  );
}
