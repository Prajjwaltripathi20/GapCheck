'use client';

import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  pill?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  pill = true,
  loading = false,
  disabled = false,
  className = '',
  children,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-medium transition-all duration-200 select-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 active:scale-[0.98]';

  const sizeClasses = {
    sm: 'text-xs h-8 px-3.5 gap-1.5',
    md: 'text-xs h-9 px-4 gap-2',
    lg: 'text-sm h-11 px-6 gap-2.5',
  };

  const radiusClasses = pill ? 'rounded-full' : 'rounded-[12px]';

  const variantClasses = {
    primary:
      'bg-white text-black hover:bg-neutral-200 shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.6)] font-medium',
    secondary:
      'bg-white/[0.08] text-white hover:bg-white/[0.12] border border-white/[0.1] backdrop-blur-md shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]',
    ghost:
      'bg-transparent text-neutral-400 hover:text-white hover:bg-white/[0.06] border border-transparent',
    danger:
      'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20',
  };

  return (
    <button
      disabled={disabled || loading}
      className={`${baseClasses} ${sizeClasses[size]} ${radiusClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {loading && (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
      )}
      {children}
    </button>
  );
};

export default Button;
