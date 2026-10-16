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
      ? 'bg-green-50 text-success border-green-200'
      : variant === 'missing'
        ? 'bg-red-50 text-critical border-red-200'
        : 'bg-gray-50 text-text-primary border-base-border hover:border-primary/50';

  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors ${variantStyles}`}>
      <span className="truncate">{name}</span>
      {showLevel && typeof level === 'number' && (
        <span className="flex items-center gap-0.5 ml-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <span
              key={star}
              className={`w-1.5 h-1.5 rounded-full ${star <= level ? 'bg-primary' : 'bg-gray-300'}`}
            />
          ))}
        </span>
      )}
    </span>
  );
}
