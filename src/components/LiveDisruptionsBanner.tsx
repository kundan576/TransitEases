import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { ServiceAnnouncement } from '../types';
import { useAccessibility } from '../context/AccessibilityContext';

export const LiveDisruptionsBanner: React.FC = () => {
  const [announcements, setAnnouncements] = useState<ServiceAnnouncement[]>([]);
  const [dismissed, setDismissed] = useState<boolean>(false);
  const { lang } = useAccessibility();

  useEffect(() => {
    fetch('/api/disruptions')
      .then(res => res.json())
      .then(d => {
        if (d.announcements && d.announcements.length > 0) {
          setAnnouncements(d.announcements);
        }
      })
      .catch(err => console.error(err));
  }, []);

  if (dismissed || announcements.length === 0) return null;

  const current = announcements[0];

  return (
    <div
      role="region"
      aria-label="Service advisory notice"
      className="bg-amber-600 text-white px-4 py-2 text-xs relative z-30 border-b border-amber-700/50 shadow-2xs"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="p-1 bg-amber-700/60 rounded-md shrink-0">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-100" />
          </div>
          <div className="flex items-center gap-2 overflow-hidden truncate">
            <span className="font-mono text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-sm bg-black/25 text-amber-100 shrink-0">
              {current.type}
            </span>
            <span className="truncate text-amber-50">
              <strong className="font-semibold text-white">
                {lang === 'hi' ? current.titleHi : current.title}:
              </strong>{' '}
              {lang === 'hi' ? current.messageHi : current.message}
            </span>
          </div>
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="p-1 hover:bg-amber-700 rounded-md transition-colors shrink-0 cursor-pointer text-amber-100 hover:text-white"
          title="Dismiss Alert"
          aria-label="Dismiss service advisory"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
