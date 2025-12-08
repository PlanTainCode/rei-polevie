import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', label, error, id, options, ...props }, ref) => {
    const selectId = id || props.name;

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-[var(--text-secondary)]"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={`
              w-full h-10 px-3 pr-10 rounded-lg appearance-none
              bg-[var(--bg-tertiary)] border border-[var(--border-color)]
              text-[var(--text-primary)]
              focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors
              ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}
              ${className}
            `}
            {...props}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] pointer-events-none" />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    );
  },
);

Select.displayName = 'Select';

