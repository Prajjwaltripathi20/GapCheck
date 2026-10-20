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
    sm: 'text-[11px] px-2.5 py-0.5',
    md: 'text-xs px-3 py-1',
  };

  const variantClasses = {
    default: 'bg-[#181a1e] text-[#d1d5db] border-[rgba(255,255,255,0.08)]',
    neutral: 'bg-[rgba(255,255,255,0.03)] text-[#9ca3af] border-[rgba(255,255,255,0.06)]',
    verified: 'bg-[rgba(16,185,129,0.07)] text-[#34d399] border-[rgba(16,185,129,0.2)]',
    weak: 'bg-[rgba(245,158,11,0.07)] text-[#fbbf24] border-[rgba(245,158,11,0.2)]',
    unverified: 'bg-[rgba(244,63,94,0.07)] text-[#fb7185] border-[rgba(244,63,94,0.2)]',
    active: 'bg-white text-black border-white font-medium shadow-sm',
  };

  const interactiveClasses = interactive
    ? 'cursor-pointer hover:border-[rgba(255,255,255,0.2)] hover:bg-[#202328] active:scale-[0.98] transition-all'
    : '';

  const selectedClasses = selected
    ? 'bg-white text-black border-white font-medium'
    : '';

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border font-normal tracking-tight transition-colors duration-150 ${sizeClasses[size]} ${selected ? selectedClasses : variantClasses[variant]} ${interactiveClasses} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Pill;
