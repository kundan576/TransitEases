import React, { useState } from 'react';
import { Search, Bus as BusIcon, Phone, AlertCircle, Volume2, ShieldCheck, Clock, MapPin, Gauge } from 'lucide-react';
import { CrowdingBadge } from './CrowdingBadge';
import { useAccessibility } from '../context/AccessibilityContext';

interface BusSearchProps {
  onSearchResult: (result: any) => void;
}

export const BusSearch: React.FC<BusSearchProps> = ({ onSearchResult }) => {
  const [searchType, setSearchType] = useState<'bus' | 'driver'>('bus');
  const [query, setQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeResult, setActiveResult] = useState<any>(null);

  const { t, speak, lang } = useAccessibility();

  const handleSearch = async (e?: React.FormEvent, overrideValue?: string) => {
    if (e) e.preventDefault();
    const val = (overrideValue !== undefined ? overrideValue : query).trim();
    if (!val) {
      setError(
        searchType === 'bus'
          ? 'Please enter a bus number (e.g. UP16-1001)'
          : 'Please enter a 10-digit driver mobile number'
      );
      return;
    }

    setLoading(true);
    setError(null);
    setActiveResult(null);

    try {
      const endpoint =
        searchType === 'bus'
          ? `/api/buses/search?query=${encodeURIComponent(val)}`
          : `/api/buses/driver-phone?phone=${encodeURIComponent(val)}`;

      const res = await fetch(endpoint);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || data.message || 'No records found.');
        setLoading(false);
        return;
      }

      if (data.found === false) {
        setError(data.message || 'No bus found matching your query.');
        setLoading(false);
        return;
      }

      if (searchType === 'driver') {
        if (!data.isSharing) {
          setError(data.message || 'Driver is currently off-duty or not transmitting GPS.');
          setActiveResult(data);
          onSearchResult(null);
          setLoading(false);
          return;
        }
      }

      setActiveResult(data);
      onSearchResult(data);
    } catch {
      setError('Connection failure. Could not reach TransitEase servers.');
    } finally {
      setLoading(false);
    }
  };

  const playTTS = () => {
    if (!activeResult) return;
    const busNum = activeResult.bus?.busNumber || 'Bus';
    const nextStopName = activeResult.nextStop
      ? (lang === 'hi' ? activeResult.nextStop.nameHi : activeResult.nextStop.name)
      : 'Terminal';
    const mins = activeResult.nextStop?.estimatedMinutes || 0;

    const speechText =
      lang === 'hi'
        ? `बस ${busNum}। अगला स्टॉप ${nextStopName} है। अनुमानित आगमन समय ${mins} मिनट है।`
        : `Bus ${busNum}. Next stop is ${nextStopName}, expected in approximately ${mins} minutes.`;

    speak(speechText);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>{t('findBus')}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time GPS updates directly from active buses
          </p>
        </div>

        {/* Quick Testing Shortcuts */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[11px] font-medium text-slate-400">Quick Test:</span>
          <button
            type="button"
            onClick={() => {
              setSearchType('bus');
              setQuery('UP16-1001');
              handleSearch(undefined, 'UP16-1001');
            }}
            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-mono text-[11px] font-medium transition-colors cursor-pointer"
          >
            UP16-1001
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchType('bus');
              setQuery('UP16-1002');
              handleSearch(undefined, 'UP16-1002');
            }}
            className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-mono text-[11px] font-medium transition-colors cursor-pointer"
          >
            UP16-1002
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchType('driver');
              setQuery('9876543210');
              handleSearch(undefined, '9876543210');
            }}
            className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-md font-mono text-[11px] font-medium transition-colors border border-emerald-200/70 cursor-pointer"
          >
            Driver 9876543210
          </button>
        </div>
      </div>

      {/* Segmented Dual Search Switch */}
      <div className="inline-flex p-1 bg-slate-100 rounded-lg mb-3 text-xs font-semibold" role="tablist">
        <button
          type="button"
          onClick={() => {
            setSearchType('bus');
            setError(null);
            setQuery('');
          }}
          className={`flex items-center gap-1.5 py-1.5 px-3 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
            searchType === 'bus'
              ? 'bg-white text-slate-900 shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          role="tab"
          aria-selected={searchType === 'bus'}
        >
          <BusIcon className="w-3.5 h-3.5" />
          <span>{t('searchByBusNumber')}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSearchType('driver');
            setError(null);
            setQuery('');
          }}
          className={`flex items-center gap-1.5 py-1.5 px-3 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
            searchType === 'driver'
              ? 'bg-white text-slate-900 shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          role="tab"
          aria-selected={searchType === 'driver'}
        >
          <Phone className="w-3.5 h-3.5" />
          <span>{t('searchByDriverPhone')}</span>
        </button>
      </div>

      {/* Search Input Form */}
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            {searchType === 'bus' ? <BusIcon className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
          </div>
          <input
            type={searchType === 'bus' ? 'text' : 'tel'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              searchType === 'bus'
                ? t('enterBusNumberPlaceholder')
                : t('enterDriverPhonePlaceholder')
            }
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white text-xs sm:text-sm font-medium transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2 rounded-lg text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs shrink-0"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          <span>{t('searchButton')}</span>
        </button>
      </form>

      {/* Driver Privacy Notice */}
      {searchType === 'driver' && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>{t('driverPhoneMaskedNotice')}</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Found Bus Live Card */}
      {activeResult && activeResult.found && activeResult.bus && (
        <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200/90">
          <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-200/80">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-bold text-slate-900 tracking-tight font-mono">
                  {activeResult.bus.busNumber}
                </span>
                <span className="text-xs font-mono text-slate-500">
                  {activeResult.bus.registrationNumber}
                </span>
                <CrowdingBadge level={activeResult.bus.crowdLevel} updatedAt={activeResult.bus.crowdUpdatedAt} />
              </div>

              {activeResult.route && (
                <div className="text-xs text-slate-600 font-medium mt-1 flex items-center gap-1.5">
                  <span className="font-bold text-slate-900">Route {activeResult.route.routeNumber}:</span>
                  <span>{lang === 'hi' ? activeResult.route.nameHi : activeResult.route.name}</span>
                </div>
              )}
            </div>

            <button
              onClick={playTTS}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-xs font-medium flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              title="Announce Next Stop"
            >
              <Volume2 className="w-3.5 h-3.5 text-emerald-700" />
              <span>{t('textToSpeech')}</span>
            </button>
          </div>

          {/* Telemetry Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 text-xs">
            {activeResult.nextStop && (
              <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                <div className="text-slate-500 flex items-center gap-1 text-[11px] font-medium">
                  <MapPin className="w-3 h-3 text-emerald-600" />
                  <span>{t('nextStop')}</span>
                </div>
                <div className="font-bold text-slate-900 truncate mt-0.5">
                  {lang === 'hi' ? activeResult.nextStop.nameHi : activeResult.nextStop.name}
                </div>
                <div className="text-[11px] font-mono text-emerald-700 font-semibold tabular-nums">
                  ETA: ~{activeResult.nextStop.estimatedMinutes}m ({activeResult.nextStop.estimatedArrivalTime})
                </div>
              </div>
            )}

            {activeResult.location && (
              <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                <div className="text-slate-500 flex items-center gap-1 text-[11px] font-medium">
                  <Gauge className="w-3 h-3 text-slate-600" />
                  <span>Road Speed</span>
                </div>
                <div className="font-bold font-mono text-slate-900 mt-0.5 tabular-nums">
                  {activeResult.location.speed} km/h
                </div>
                <div className="text-[10px] font-mono text-slate-500 tabular-nums">
                  ±{activeResult.location.accuracy}m GPS Fix
                </div>
              </div>
            )}

            {activeResult.driver && (
              <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                <div className="text-slate-500 flex items-center gap-1 text-[11px] font-medium">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>Assigned Driver</span>
                </div>
                <div className="font-bold text-slate-900 truncate mt-0.5">
                  {activeResult.driver.name}
                </div>
                <div className="text-[11px] font-mono text-slate-600 tabular-nums">
                  {activeResult.driver.maskedMobile}
                </div>
              </div>
            )}

            {activeResult.location && (
              <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                <div className="text-slate-500 flex items-center gap-1 text-[11px] font-medium">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>{t('lastUpdate')}</span>
                </div>
                <div className="font-bold font-mono text-slate-900 mt-0.5 tabular-nums">
                  {new Date(activeResult.location.timestamp).toLocaleTimeString()}
                </div>
                <div
                  className={`text-[10px] font-medium ${
                    activeResult.location.isStale ? 'text-amber-700' : 'text-emerald-700'
                  }`}
                >
                  {activeResult.location.isStale ? 'Stale GPS (>3 min)' : 'Signal Active'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
