import React from 'react';

export interface DividerProps {
  className?: string;
  label?: string;
}

export const Divider: React.FC<DividerProps> = ({ className = '', label }) => {
  if (label) {
    return (
      <div className={`relative flex items-center my-6 ${className}`}>
        <div className="flex-grow border-t border-[rgba(255,255,255,0.06)]" />
        <span className="flex-shrink mx-3 text-[11px] font-mono uppercase tracking-wider text-zinc-500">
          {label}
        </span>
        <div className="flex-grow border-t border-[rgba(255,255,255,0.06)]" />
      </div>
    );
  }

  return <hr className={`border-t border-[rgba(255,255,255,0.07)] my-6 ${className}`} />;
};

export default Divider;
