import React, { useState, useEffect } from 'react';
import { BusSearch } from '../components/BusSearch';
import { BusMap } from '../components/BusMap';
import { StopQRModal } from '../components/StopQRModal';
import { BusStop, Route } from '../types';
import { useSocket } from '../context/SocketContext';
import { useAccessibility } from '../context/AccessibilityContext';
import {
  QrCode,
  MapPin,
  Clock,
  ArrowRight,
  Route as RouteIcon,
  Navigation,
  Compass,
  CheckCircle2,
  Smartphone,
  PhoneCall,
  FileText
} from 'lucide-react';

export const PassengerHome: React.FC<{ onNavigateToJourney?: () => void }> = ({ onNavigateToJourney }) => {
  const [activeSearchResult, setActiveSearchResult] = useState<any>(null);
  const [stops, setStops] = useState<BusStop[]>([]);
  const [selectedStopForQR, setSelectedStopForQR] = useState<BusStop | null>(null);
  const [allRoutes, setAllRoutes] = useState<Route[]>([]);
  const { socket } = useSocket();
  const { lang } = useAccessibility();

  // Load stops and routes on mount
  useEffect(() => {
    fetch('/api/stops')
      .then(res => res.json())
      .then(d => {
        if (d.stops) setStops(d.stops);
      })
      .catch(() => {});

    fetch('/api/routes')
      .then(res => res.json())
      .then(d => {
        if (d.routes) setAllRoutes(d.routes);
      })
      .catch(() => {});

    // Default search for initial corridor preview
    fetch('/api/buses/search?query=UP16-1001')
      .then(res => res.json())
      .then(d => {
        if (d.found) setActiveSearchResult(d);
      })
      .catch(() => {});
  }, []);

  // Listen for live socket coordinate broadcasts for active bus
  useEffect(() => {
    if (!socket || !activeSearchResult?.bus?.id) return;

    const busId = activeSearchResult.bus.id;
    socket.emit('bus:join_tracking', busId);

    const handleLocationUpdate = (payload: any) => {
      if (payload.busId === busId && payload.location) {
        setActiveSearchResult((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            location: {
              ...payload.location,
              isStale: false
            },
            staleWarning: null
          };
        });
      }
    };

    const handleCrowdUpdate = (payload: any) => {
      if (payload.busId === busId) {
        setActiveSearchResult((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            bus: {
              ...prev.bus,
              crowdLevel: payload.crowdLevel,
              crowdUpdatedAt: payload.crowdUpdatedAt
            }
          };
        });
      }
    };

    socket.on('bus:location_broadcast', handleLocationUpdate);
    socket.on('bus:crowd_update', handleCrowdUpdate);

    return () => {
      socket.emit('bus:leave_tracking', busId);
      socket.off('bus:location_broadcast', handleLocationUpdate);
      socket.off('bus:crowd_update', handleCrowdUpdate);
    };
  }, [socket, activeSearchResult?.bus?.id]);

  const selectRoute = (route: Route) => {
    const primeBus = route.routeNumber === '101' ? 'UP16-1001' : 'UP16-1002';
    fetch(`/api/buses/search?query=${primeBus}`)
      .then(res => res.json())
      .then(d => {
        if (d.found) {
          setActiveSearchResult(d);
          window.scrollTo({ top: 160, behavior: 'smooth' });
        }
      })
      .catch(() => {});
  };

  return (
    <div className="space-y-6">
      {/* 1. Trustworthy Transport Authority Banner */}
      <section className="bg-slate-900 text-white rounded-xl p-6 sm:p-8 border border-slate-800 shadow-xs relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <div className="text-xs text-emerald-400 font-semibold mb-2">
            Live Bus Tracking · Greater Noida
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-sans text-balance">
            {lang === 'hi'
              ? 'वास्तविक समय में अपनी नगर बस ट्रैक करें'
              : 'Reliable, Live Bus Tracking for Indian Cities'}
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
            {lang === 'hi'
              ? 'ड्राइवर के स्मार्टफोन जीपीएस से लाइव लोकेशन, आगामी स्टॉप आगमन समय और बस में सीटों की उपलब्धता देखें।'
              : 'Live GPS updates from bus drivers, estimated arrival times, and seat crowding.'}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-slate-300">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Real-Time Coordinates</span>
            </div>
            <span className="text-slate-600 hidden sm:inline" aria-hidden="true">·</span>
            <div className="flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>SMS & Helpline</span>
            </div>
            <span className="text-slate-600 hidden sm:inline" aria-hidden="true">·</span>
            <div className="flex items-center gap-1.5">
              <QrCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Stop QR Codes</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Primary Search Box */}
      <BusSearch onSearchResult={(res) => setActiveSearchResult(res)} />

      {/* 3. Live Interactive Map & Upcoming Stops Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Live Map Panel */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 flex-1 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-slate-700" />
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  {activeSearchResult?.bus
                    ? `Live Location: Bus ${activeSearchResult.bus.busNumber}`
                    : 'City Bus Map'}
                </h3>
              </div>
              {activeSearchResult?.location && (
                <div className="text-xs text-slate-600 flex items-center gap-1.5 font-medium">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      activeSearchResult.location.isStale ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    aria-hidden="true"
                  />
                  <span>{activeSearchResult.location.isStale ? 'Stale Signal' : 'Live GPS Feed'}</span>
                </div>
              )}
            </div>

            <BusMap
              location={activeSearchResult?.location}
              busNumber={activeSearchResult?.bus?.busNumber}
              routePolyline={activeSearchResult?.route?.polylineCoords}
              stops={stops}
              staleWarning={activeSearchResult?.staleWarning}
              height="440px"
            />
          </div>
        </div>

        {/* Upcoming Stops & Route Timeline */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 flex-1 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-700" />
                <span>Upcoming Stops & ETAs</span>
              </h3>
              {activeSearchResult?.etas && (
                <span className="text-[11px] font-mono font-medium text-slate-500 tabular-nums">
                  {activeSearchResult.etas.filter((e: any) => !e.isPassed).length} Stops Left
                </span>
              )}
            </div>

            {activeSearchResult?.etas && activeSearchResult.etas.length > 0 ? (
              <div className="space-y-2 overflow-y-auto max-h-[380px] pr-1">
                {activeSearchResult.etas.map((etaItem: any, idx: number) => {
                  const isNextStop = idx === activeSearchResult.etas.findIndex((e: any) => !e.isPassed);

                  return (
                    <div
                      key={etaItem.stop.id}
                      className={`p-2.5 rounded-lg border text-xs transition-colors flex items-center justify-between ${
                        etaItem.isPassed
                          ? 'bg-slate-50/70 border-slate-200 text-slate-400 opacity-60'
                          : isNextStop
                          ? 'bg-emerald-50/80 border-emerald-300 text-slate-900 shadow-2xs font-semibold'
                          : 'bg-white border-slate-200/90 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center font-mono text-[10px] font-bold ${
                            etaItem.isPassed
                              ? 'bg-slate-200 text-slate-600'
                              : isNextStop
                              ? 'bg-emerald-700 text-white'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {etaItem.order}
                        </div>
                        <div>
                          <div className="font-semibold leading-tight text-slate-900">
                            {lang === 'hi' ? etaItem.stop.nameHi : etaItem.stop.name}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                            Stop Code: {etaItem.stop.code}
                          </div>
                        </div>
                      </div>

                      <div className="text-right pl-2 shrink-0">
                        {etaItem.isPassed ? (
                          <span className="text-[10px] font-medium text-slate-400">Passed</span>
                        ) : (
                          <div>
                            <div className="font-bold font-mono text-emerald-800 tabular-nums">
                              ~{etaItem.estimatedMinutes} min
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono tabular-nums">
                              {etaItem.estimatedArrivalTime}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center p-6 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-slate-500 text-xs my-auto">
                <MapPin className="w-5 h-5 mx-auto mb-2 text-slate-400" />
                <span>Search for an active bus above to inspect its real-time ordered stop arrivals.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Route Discovery Explorer */}
      <section className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <RouteIcon className="w-4 h-4 text-slate-700" />
              <span>Bus Routes</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Daily bus routes connecting metro stations, colleges, and local neighborhoods
            </p>
          </div>

          {onNavigateToJourney && (
            <button
              onClick={onNavigateToJourney}
              className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 transition-colors self-start sm:self-auto cursor-pointer"
            >
              <span>Plan A-to-B Journey</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {allRoutes.map(route => (
            <div
              key={route.id}
              className="p-4 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-lg transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold bg-slate-900 text-white px-2 py-0.5 rounded-sm">
                      Route {route.routeNumber}
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      {route.stops.length} Stops
                    </span>
                  </div>
                  <span className="text-xs font-mono font-semibold text-slate-700 tabular-nums">
                    Base Fare: ₹{route.fareBase}
                  </span>
                </div>

                <h4 className="font-bold text-slate-900 text-sm">
                  {lang === 'hi' ? route.nameHi : route.name}
                </h4>

                <div className="mt-2 text-xs text-slate-600 flex items-center gap-2 flex-wrap">
                  <span className="text-slate-500">Service Hours: 06:00 AM – 10:30 PM</span>
                  <span className="text-slate-300" aria-hidden="true">·</span>
                  <span className="text-slate-500">Frequency: Every 15 mins</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => selectRoute(route)}
                  className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Track Route Buses</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Physical Bus Stop Signage with QR Code Generator */}
      <section className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <QrCode className="w-4 h-4 text-slate-700" />
              <span>Bus Stops & QR Codes</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Scan the QR code at any bus stop to view upcoming buses right away
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {stops.map(stop => (
            <div
              key={stop.id}
              onClick={() => setSelectedStopForQR(stop)}
              className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer flex items-center justify-between group"
            >
              <div>
                <span className="font-mono text-[10px] font-bold text-slate-700 bg-white border border-slate-200 px-1.5 py-0.5 rounded-sm">
                  {stop.code}
                </span>
                <h4 className="font-bold text-slate-900 text-xs mt-1.5 group-hover:text-emerald-800 transition-colors">
                  {lang === 'hi' ? stop.nameHi : stop.name}
                </h4>
                {stop.landmark && (
                  <p className="text-[11px] text-slate-500 truncate max-w-[170px] mt-0.5">
                    {stop.landmark}
                  </p>
                )}
              </div>

              <div className="p-2 bg-white rounded-md border border-slate-200 shadow-2xs group-hover:scale-105 transition-transform shrink-0">
                <QrCode className="w-4 h-4 text-slate-700" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Stop QR Modal */}
      <StopQRModal stop={selectedStopForQR} onClose={() => setSelectedStopForQR(null)} />
    </div>
  );
};
