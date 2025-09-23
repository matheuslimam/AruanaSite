// src/components/Chip.tsx
import React from 'react';

type ChipProps = {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  theme?: 'light' | 'dark'; // 👈 novo
};

export function Chip({ active, onClick, children, className = '', disabled, theme = 'light' }: ChipProps) {
  // classes base de cada tema
  const base =
    'inline-flex items-center gap-2 px-4 h-10 rounded-full border transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

  const themeClasses =
    theme === 'dark'
      ? {
          active: 'bg-white text-slate-900 border-white shadow-sm',
          idle: 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10',
          ring: 'focus-visible:ring-white/40 focus-visible:ring-offset-transparent',
        }
      : {
          active: 'bg-slate-900 text-white border-slate-900 shadow-sm',
          idle: 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/70',
          ring: 'focus-visible:ring-slate-400/60 focus-visible:ring-offset-white',
        };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        base,
        themeClasses.ring,
        disabled ? 'opacity-60 cursor-not-allowed' : '',
        active ? themeClasses.active : themeClasses.idle,
        className,
      ].join(' ')}
    >
      {children}
    </button>
  );
}

type ChipGroupProps<T extends string> = {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  theme?: 'light' | 'dark'; // 👈 novo
};

export function ChipGroup<T extends string>({ options, value, onChange, className='', theme='light' }: ChipGroupProps<T>) {
  return (
    <div className={['flex flex-wrap gap-2', className].join(' ')}>
      {options.map(opt => (
        <Chip
          key={opt.value}
          active={opt.value === value}
          onClick={() => onChange(opt.value)}
          theme={theme}
        >
          {opt.label}
        </Chip>
      ))}
    </div>
  );
}
