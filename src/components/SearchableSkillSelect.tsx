import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

type SkillOption = { id: string; name: string; category?: string };

type SearchableSkillSelectProps = {
  options: SkillOption[];
  value: string;
  onChange: (skillId: string) => void;
  inputId: string;
  ariaLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
};

export function SearchableSkillSelect({
  options,
  value,
  onChange,
  inputId,
  ariaLabel = 'Search skills',
  placeholder = 'Search skills by name or category…',
  disabled = false,
  required = false,
}: SearchableSkillSelectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const resultsId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const selectedSkill = options.find((skill) => skill.id === value);

  const filteredSkills = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return options
      .filter((skill) => !term || `${skill.name} ${skill.category ?? ''}`.toLocaleLowerCase().includes(term))
      .slice(0, 100);
  }, [options, query]);

  useEffect(() => {
    function closeWhenOutside(event: PointerEvent) {
      if (containerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setQuery(selectedSkill?.name ?? '');
    }
    document.addEventListener('pointerdown', closeWhenOutside);
    return () => document.removeEventListener('pointerdown', closeWhenOutside);
  }, [selectedSkill?.id, selectedSkill?.name]);

  function selectSkill(skill: SkillOption) {
    onChange(skill.id);
    setQuery(skill.name);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          id={inputId}
          type="text"
          autoComplete="off"
          role="combobox"
          aria-label={ariaLabel}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={resultsId}
          aria-required={required}
          value={open ? query : selectedSkill?.name ?? query}
          placeholder={placeholder}
          disabled={disabled}
          className="input-field w-full pl-9 pr-9"
          onFocus={() => {
            setQuery('');
            setOpen(true);
          }}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            setOpen(true);
            if (value) onChange('');
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false);
              setQuery(selectedSkill?.name ?? '');
            } else if (event.key === 'Enter' && open && filteredSkills.length > 0) {
              event.preventDefault();
              selectSkill(filteredSkills[0]);
            }
          }}
        />
        {selectedSkill && !open
          ? <Check size={14} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-success" />
          : <ChevronDown size={14} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary" />}
      </div>
      {open && !disabled && (
        <div id={resultsId} role="listbox" aria-label="Matching skills" className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-base-border bg-white p-1.5 shadow-xl">
          {filteredSkills.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-text-secondary">No matching skills. Try another name or category.</p>
          ) : filteredSkills.map((skill) => (
            <button
              key={skill.id}
              type="button"
              role="option"
              aria-selected={skill.id === value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectSkill(skill)}
              className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-xs transition-colors ${skill.id === value ? 'bg-primary/10 text-primary' : 'text-text-primary hover:bg-base-subtle'}`}
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold">{skill.name}</span>
                {skill.category && <span className="mt-0.5 block truncate text-[10px] text-text-secondary">{skill.category}</span>}
              </span>
              {skill.id === value && <Check size={14} aria-hidden="true" className="shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
