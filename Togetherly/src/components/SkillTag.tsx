import { getSkillName } from '@/utils';

interface SkillTagProps {
  skillId: string;
  level?: number;
  showLevel?: boolean;
}

export function SkillTag({ skillId, level, showLevel = false }: SkillTagProps) {
  const name = getSkillName(skillId);
  const levelDots = level ? '●'.repeat(level) + '○'.repeat(5 - level) : '';

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-base-bg border border-base-border px-2 py-1 text-xs text-text-primary">
      {name}
      {showLevel && level && (
        <span className="text-text-secondary text-[10px] tracking-widest">{levelDots}</span>
      )}
    </span>
  );
}
