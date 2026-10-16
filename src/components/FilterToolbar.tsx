import React from 'react';
import { Filter } from 'lucide-react';

interface FilterToolbarProps {
  children: React.ReactNode;
  onReset?: () => void;
  className?: string;
}

export function FilterToolbar({ children, onReset, className = '' }: FilterToolbarProps) {
  return (
    <div className={`flex flex-wrap items-center gap-3 relative z-10 ${className}`}>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary uppercase tracking-wider mr-1">
        <Filter size={13} className="text-primary" />
        <span>Filters</span>
      </div>
      <div className="flex flex-wrap items-center gap-3 flex-1">
        {children}
      </div>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-text-secondary hover:text-text-primary px-2.5 py-1 rounded-md hover:bg-base-hover transition-colors font-medium"
        >
          Reset filters
        </button>
      )}
    </div>
  );
}

interface SelectFilterProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}

export function SelectFilter({ label, value, onChange, options, className = '' }: SelectFilterProps) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <label className="text-xs text-text-secondary font-medium whitespace-nowrap">{label}:</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field py-1 px-2 text-xs font-medium bg-white border-base-border focus:border-primary cursor-pointer rounded-md shadow-xs"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-white text-text-primary">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
