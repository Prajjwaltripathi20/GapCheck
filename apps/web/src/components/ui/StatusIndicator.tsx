import React from 'react';

export interface StatusIndicatorProps {
  status: 'verified' | 'supported' | 'weakly_supported' | 'unverified' | 'pending';
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  size = 'md',
  showLabel = true,
  className = '',
}) => {
  const configs = {
    verified: {
      color: 'bg-emerald-400',
      border: 'border-emerald-500/30',
      label: 'Verified',
      symbol: '✓',
    },
    supported: {
      color: 'bg-emerald-400',
      border: 'border-emerald-500/30',
      label: 'Supported',
      symbol: '✓',
    },
    weakly_supported: {
      color: 'bg-amber-400',
      border: 'border-amber-500/30',
      label: 'Partial',
      symbol: '△',
    },
    unverified: {
      color: 'bg-rose-400',
      border: 'border-rose-500/30',
      label: 'Unverified',
      symbol: '×',
    },
    pending: {
      color: 'bg-zinc-400',
      border: 'border-zinc-500/30',
      label: 'Pending',
      symbol: '○',
    },
  };

  const current = configs[status] || configs.pending;

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        className={`inline-block rounded-full ${current.color} ${
          size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2'
        }`}
      />
      {showLabel && (
        <span className="text-xs text-zinc-300 font-medium">
          {current.label}
        </span>
      )}
    </div>
  );
};

export default StatusIndicator;
