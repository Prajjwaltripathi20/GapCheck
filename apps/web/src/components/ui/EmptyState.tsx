'use client';

import React from 'react';
import Button from './Button';

export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`border border-[rgba(255,255,255,0.06)] rounded-[14px] bg-[#121316] p-8 sm:p-12 text-center max-w-lg mx-auto ${className}`}
    >
      <h3 className="text-base sm:text-lg font-medium text-zinc-100 tracking-tight">
        {title}
      </h3>
      <p className="mt-2 text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-sm mx-auto">
        {description}
      </p>
      {actionLabel && onAction && (
        <div className="mt-6">
          <Button variant="primary" size="md" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};

export default EmptyState;
