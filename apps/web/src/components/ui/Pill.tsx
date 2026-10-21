'use client';

import React from 'react';

export interface PillProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'neutral' | 'verified' | 'weak' | 'unverified' | 'active';
  size?: 'sm' | 'md';
  interactive?: boolean;
  selected?: boolean;
  children: React.ReactNode;
}

export const Pill: React.FC<PillProps> = ({
  variant = 'default',
  size = 'md',
  interactive = false,
  selected = false,
  className = '',
  children,
  ...props
}) => {
  const sizeClasses = {
    sm: 'text-[11px] px-3 py-1',
    md: 'text-xs px-3.5 py-1.5',
  };

  const variantClasses = {
    default: 'bg-white/[0.05] text-neutral-300 border-white/[0.08] backdrop-blur-md',
    neutral: 'bg-white/[0.03] text-neutral-400 border-white/[0.06]',
    verified: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    weak: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    unverified: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    active: 'bg-white text-black border-transparent font-medium shadow-[0_1px_3px_rgba(0,0,0,0.3)]',
  };

  const interactiveClasses = interactive
    ? 'cursor-pointer hover:bg-white/[0.1] hover:text-white transition-all duration-200 active:scale-[0.97]'
    : '';

  const selectedClasses = selected
    ? 'bg-white text-black border-transparent font-medium shadow-[0_1px_4px_rgba(0,0,0,0.4)]'
    : '';

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border tracking-tight transition-all duration-200 ${sizeClasses[size]} ${
        selected ? selectedClasses : variantClasses[variant]
      } ${interactiveClasses} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Pill;
