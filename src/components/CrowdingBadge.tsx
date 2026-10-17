import React from 'react';
import { Users } from 'lucide-react';
import { CrowdLevel } from '../types';
import { useAccessibility } from '../context/AccessibilityContext';

interface CrowdingBadgeProps {
  level: CrowdLevel;
  updatedAt?: string;
  size?: 'sm' | 'md';
}

export const CrowdingBadge: React.FC<CrowdingBadgeProps> = ({ level, updatedAt, size = 'md' }) => {
  const { t } = useAccessibility();

  let label = t('seatsAvailable');
  let textClass = 'text-emerald-700 bg-emerald-50/90 border-emerald-200/80';
  let indicatorColor = 'bg-emerald-600';

  if (level === 'moderately_crowded') {
    label = t('moderatelyCrowded');
    textClass = 'text-amber-800 bg-amber-50/90 border-amber-200/80';
    indicatorColor = 'bg-amber-600';
  } else if (level === 'very_crowded') {
    label = t('veryCrowded');
    textClass = 'text-rose-800 bg-rose-50/90 border-rose-200/80';
    indicatorColor = 'bg-rose-600';
  }

  const timeLabel = updatedAt ? new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium border rounded-md ${textClass} ${
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      }`}
      title={timeLabel ? `Reported by bus crew at ${timeLabel}` : 'Reported by on-duty crew'}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${indicatorColor} shrink-0`} aria-hidden="true" />
      <Users className="w-3 h-3 shrink-0 opacity-80" />
      <span className="font-semibold">{label}</span>
      {timeLabel && (
        <span className="opacity-60 text-[10px] font-mono font-normal">
          · {timeLabel}
        </span>
      )}
    </span>
  );
};
