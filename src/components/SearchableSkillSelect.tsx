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

/** Select-style skill field. Clicking it opens a searchable menu; results filter as the user types. */
export function SearchableSkillSelect({
  options,
  value,
  onChange,
  inputId,
  ariaLabel = 'Select a skill',
  placeholder = 'Search skills by name or category…',
  disabled = false,
  required = false,
}: SearchableSkillSelectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsId = useId();
  const searchId = useId();
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
    if (open) searchInputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    function closeWhenOutside(event: PointerEvent) {
      if (containerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setQuery('');
    }
    document.addEventListener('pointerdown', closeWhenOutside);
    return () => document.removeEventListener('pointerdown', closeWhenOutside);
  }, []);

  function closeMenu(returnFocus = false) {
    setOpen(false);
    setQuery('');
    if (returnFocus) triggerRef.current?.focus();
  }

  function selectSkill(skill: SkillOption) {
    onChange(skill.id);
    closeMenu(true);
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        ref={triggerRef}
        id={inputId}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={resultsId}
        aria-haspopup="listbox"
        aria-required={required}
        disabled={disabled}
        onClick={() => {
          if (open) closeMenu();
          else {
            setQuery('');
            setOpen(true);
          }
        }}
        className="input-field flex w-full items-center justify-between gap-3 text-left"
      >
        <span className={selectedSkill ? 'truncate text-text-primary' : 'truncate text-text-secondary'}>
          {selectedSkill?.name ?? 'Select a skill'}
        </span>
        <ChevronDown size={15} aria-hidden="true" className={`shrink-0 text-text-secondary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-base-border bg-white shadow-xl">
          <div className="border-b border-base-border p-2.5">
            <label htmlFor={searchId} className="mb-1.5 block text-[11px] font-semibold text-text-secondary">
              Search skills
            </label>
            <div className="relative">
              <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                ref={searchInputRef}
                id={searchId}
                type="search"
                autoComplete="off"
                role="searchbox"
                aria-label="Search matching skills"
                aria-controls={resultsId}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    closeMenu(true);
                  } else if (event.key === 'Enter' && filteredSkills.length > 0) {
                    event.preventDefault();
                    selectSkill(filteredSkills[0]);
                  }
                }}
                placeholder={placeholder}
                className="input-field w-full pl-9 pr-3 text-xs"
              />
            </div>
          </div>

          <div id={resultsId} role="listbox" aria-label="Matching skills" className="max-h-64 overflow-y-auto p-1.5">
            {filteredSkills.length === 0 ? (
              <p className="px-3 py-5 text-center text-xs text-text-secondary">
                No matching skills. Try another name or category.
              </p>
            ) : filteredSkills.map((skill) => (
              <button
                key={skill.id}
                type="button"
                role="option"
                aria-selected={skill.id === value}
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
          <div className="border-t border-base-border px-3 py-2 text-[10px] text-text-secondary">
            {query.trim() ? `${filteredSkills.length} matching skill${filteredSkills.length === 1 ? '' : 's'}` : `${options.length} skills available`}
          </div>
        </div>
      )}
    </div>
  );
}
