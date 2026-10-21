'use client';

import React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        <textarea
          ref={ref}
          className={`w-full bg-white/[0.04] text-white placeholder:text-neutral-500 text-xs sm:text-sm rounded-[14px] border border-white/[0.08] p-4 transition-all duration-200 focus:border-white/30 focus:bg-white/[0.07] focus:outline-none focus:ring-1 focus:ring-white/20 resize-y leading-relaxed ${
            error ? 'border-rose-500/50 focus:border-rose-500' : ''
          } ${className}`}
          {...props}
        />
        {error && <p className="mt-1.5 text-[11px] text-rose-400">{error}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export default Textarea;
