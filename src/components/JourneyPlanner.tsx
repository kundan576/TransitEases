import React, { useState, useEffect } from 'react';
import { ArrowLeftRight, Clock, MapPin, Bus as BusIcon, AlertCircle } from 'lucide-react';
import { BusStop } from '../types';
import { CrowdingBadge } from './CrowdingBadge';
import { useAccessibility } from '../context/AccessibilityContext';

interface JourneyPlannerProps {
  onSelectBusToTrack: (busNumber: string) => void;
}

export const JourneyPlanner: React.FC<JourneyPlannerProps> = ({ onSelectBusToTrack }) => {
  const [stops, setStops] = useState<BusStop[]>([]);
  const [originStopId, setOriginStopId] = useState<string>('');
  const [destStopId, setDestStopId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [planResult, setPlanResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const { t, lang } = useAccessibility();

  useEffect(() => {
    fetch('/api/stops')
      .then(res => res.json())
      .then(data => {
        if (data.stops && data.stops.length > 0) {
          setStops(data.stops);
          setOriginStopId(data.stops[0].id);
          if (data.stops.length > 1) {
            setDestStopId(data.stops[4]?.id || data.stops[1].id);
          }
        }
      })
      .catch(err => console.error('Failed to load stops:', err));
  }, []);

  const handleSwap = () => {
    const temp = originStopId;
    setOriginStopId(destStopId);
    setDestStopId(temp);
    setPlanResult(null);
  };

  const handleSearchJourneys = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!originStopId || !destStopId) {
      setError('Please select both boarding and destination stops.');
      return;
    }
    if (originStopId === destStopId) {
      setError('Origin and destination cannot be identical.');
      return;
    }

    setLoading(true);
    setError(null);
    setPlanResult(null);

    try {
      const res = await fetch(`/api/routes/plan?originStopId=${originStopId}&destStopId=${destStopId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to compute route.');
      } else {
        setPlanResult(data);
      }
    } catch {
      setError('Connection failure searching journey plan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 sm:p-6">
      <div className="mb-4">
        <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
          {t('journeyPlanner')}
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Find eligible direct buses, calculated travel times, and distance-based fares
        </p>
      </div>

      {/* Origin / Destination Pickers with Swap */}
      <form onSubmit={handleSearchJourneys} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-11 gap-2 items-center">
          <div className="sm:col-span-5 relative">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('fromStop')}
            </label>
            <div className="relative">
              <MapPin className="w-3.5 h-3.5 text-emerald-700 absolute left-3 top-3 pointer-events-none" />
              <select
                value={originStopId}
                onChange={(e) => setOriginStopId(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {stops.map(s => (
                  <option key={s.id} value={s.id}>
                    {lang === 'hi' ? s.nameHi : s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="sm:col-span-1 flex justify-center pt-2 sm:pt-5">
            <button
              type="button"
              onClick={handleSwap}
              title={t('swapStops')}
              aria-label="Swap boarding and destination stops"
              className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition cursor-pointer"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="sm:col-span-5 relative">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('toStop')}
            </label>
            <div className="relative">
              <MapPin className="w-3.5 h-3.5 text-rose-700 absolute left-3 top-3 pointer-events-none" />
              <select
                value={destStopId}
                onChange={(e) => setDestStopId(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {stops.map(s => (
                  <option key={s.id} value={s.id}>
                    {lang === 'hi' ? s.nameHi : s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition cursor-pointer shadow-2xs disabled:opacity-50"
        >
          {loading ? 'Finding Options...' : 'Find Direct Transit Options'}
        </button>
      </form>

      {error && (
        <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Plan Results */}
      {planResult && (
        <div className="mt-4 pt-4 border-t border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>
              Distance: <strong className="font-mono text-slate-900 tabular-nums">{planResult.distanceKm} km</strong>
            </span>
            <span>
              Calculated Fare: <strong className="font-mono text-slate-900 tabular-nums">₹{planResult.fare}</strong>
            </span>
          </div>

          {planResult.options && planResult.options.length > 0 ? (
            <div className="space-y-2">
              {planResult.options.map((opt: any) => (
                <div
                  key={opt.routeId}
                  className="p-3 bg-slate-50 border border-slate-200/90 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold bg-slate-900 text-white px-1.5 py-0.5 rounded-sm text-[11px]">
                        Route {opt.routeNumber}
                      </span>
                      <span className="font-semibold text-slate-900">{opt.routeName}</span>
                    </div>

                    <div className="flex items-center gap-3 text-slate-500 text-[11px] mt-1 tabular-nums">
                      <span>Travel: ~{opt.estimatedTravelTimeMinutes} mins</span>
                      <span>·</span>
                      <span>Frequency: ~{opt.frequencyMinutes} mins</span>
                    </div>
                  </div>

                  {opt.availableBuses && opt.availableBuses.length > 0 && (
                    <div className="flex items-center gap-2">
                      {opt.availableBuses.map((bus: any) => (
                        <div key={bus.busId} className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onSelectBusToTrack(bus.busNumber)}
                            className="px-2 py-1 bg-emerald-800 hover:bg-emerald-900 text-white rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <BusIcon className="w-3 h-3" />
                            <span>Track {bus.busNumber}</span>
                          </button>
                          <CrowdingBadge level={bus.crowdLevel} size="sm" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-slate-50 text-slate-600 rounded-lg text-xs text-center border border-slate-200">
              No direct bus found connecting these two stops.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
