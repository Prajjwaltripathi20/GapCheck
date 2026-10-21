'use client';

import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'verified' | 'supported' | 'weak' | 'unverified' | 'critical' | 'high' | 'medium' | 'low';
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  className = '',
  children,
  ...props
}) => {
  const variantStyles = {
    neutral: 'bg-[rgba(255,255,255,0.04)] text-zinc-400 border-[rgba(255,255,255,0.08)]',
    verified: 'bg-[rgba(16,185,129,0.08)] text-emerald-400 border-[rgba(16,185,129,0.2)]',
    supported: 'bg-[rgba(59,130,246,0.08)] text-sky-400 border-[rgba(59,130,246,0.2)]',
    weak: 'bg-[rgba(245,158,11,0.08)] text-amber-400 border-[rgba(245,158,11,0.2)]',
    unverified: 'bg-[rgba(244,63,94,0.08)] text-rose-400 border-[rgba(244,63,94,0.2)]',
    critical: 'bg-[rgba(244,63,94,0.1)] text-rose-400 border-[rgba(244,63,94,0.25)] font-semibold',
    high: 'bg-[rgba(245,158,11,0.1)] text-amber-400 border-[rgba(245,158,11,0.25)] font-medium',
    medium: 'bg-[rgba(255,255,255,0.06)] text-zinc-300 border-[rgba(255,255,255,0.12)]',
    low: 'bg-[rgba(255,255,255,0.03)] text-zinc-400 border-[rgba(255,255,255,0.07)]',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-[6px] text-[10px] uppercase font-mono tracking-wider border ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};

export default Badge;
