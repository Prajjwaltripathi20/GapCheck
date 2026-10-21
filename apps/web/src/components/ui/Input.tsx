'use client';

import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ error, icon, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        <div className="relative flex items-center">
          {icon && (
            <div className="absolute left-3.5 text-neutral-500 pointer-events-none flex items-center justify-center">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={`w-full bg-white/[0.04] text-white placeholder:text-neutral-500 text-xs sm:text-sm rounded-[12px] border border-white/[0.08] py-2.5 transition-all duration-200 focus:border-white/30 focus:bg-white/[0.07] focus:outline-none focus:ring-1 focus:ring-white/20 ${
              icon ? 'pl-9 pr-3.5' : 'px-3.5'
            } ${error ? 'border-rose-500/50 focus:border-rose-500' : ''} ${className}`}
            {...props}
          />
        </div>
        {error && <p className="mt-1.5 text-[11px] text-rose-400">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
