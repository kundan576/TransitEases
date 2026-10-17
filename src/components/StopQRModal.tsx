import React, { useState, useEffect } from 'react';
import { QrCode, Printer, X, Bus as BusIcon, Bell, CheckCircle2 } from 'lucide-react';
import { BusStop } from '../types';
import { CrowdingBadge } from './CrowdingBadge';
import { useAccessibility } from '../context/AccessibilityContext';

interface StopQRModalProps {
  stop: BusStop | null;
  onClose: () => void;
}

export const StopQRModal: React.FC<StopQRModalProps> = ({ stop, onClose }) => {
  const { lang } = useAccessibility();
  const [stopDetails, setStopDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [mobileNumber, setMobileNumber] = useState('');
  const [subscribing, setSubscribing] = useState(false);
  const [subscribedMsg, setSubscribedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!stop) return;
    setLoading(true);
    fetch(`/api/stops/${stop.code}`)
      .then(res => res.json())
      .then(d => {
        setStopDetails(d);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [stop]);

  if (!stop) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleQuickSubscribe = async (e: React.FormEvent, busId: string) => {
    e.preventDefault();
    if (!mobileNumber.trim()) return;

    setSubscribing(true);
    try {
      const res = await fetch('/api/sms/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: mobileNumber,
          busId,
          stopId: stop.id,
          thresholdMinutes: 10,
          language: lang
        })
      });
      if (res.ok) {
        setSubscribedMsg(`Subscribed! Arrival SMS will be sent to ${mobileNumber}.`);
      }
    } catch {
      // error handled
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-5 sm:p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-slate-100 text-slate-800 rounded-lg">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">{stop.name}</h3>
              <p className="text-xs text-slate-500 font-mono">
                Official Stop Code: <strong className="text-blue-700">{stop.code}</strong>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Physical Signage Preview */}
        <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300 text-center mb-4">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
            Physical Bus Stop Signage
          </div>
          <h4 className="font-bold text-base text-slate-900">{stop.name}</h4>
          <p className="text-xs text-slate-600 mb-3">{stop.nameHi}</p>

          {stop.qrCodeDataUrl ? (
            <img
              src={stop.qrCodeDataUrl}
              alt={`QR Code for ${stop.name}`}
              className="w-32 h-32 mx-auto bg-white p-1.5 rounded-lg shadow-2xs border border-slate-200"
            />
          ) : (
            <div className="w-32 h-32 mx-auto bg-slate-200 rounded-lg flex items-center justify-center text-xs text-slate-500">
              Generating QR...
            </div>
          )}

          <div className="mt-3 text-xs text-slate-600">
            Scan with smartphone camera OR send SMS:
            <div className="font-mono font-bold text-blue-800 bg-white py-1 px-2.5 rounded border border-slate-200 inline-block mt-1 text-xs">
              STOP {stop.code} to 56767
            </div>
          </div>

          <div className="mt-3 flex justify-center">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Signage Plate</span>
            </button>
          </div>
        </div>

        {/* Live Arrivals at This Stop */}
        <div>
          <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">
            Live Approaching Buses
          </h4>

          {subscribedMsg && (
            <div className="mb-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{subscribedMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="text-xs text-slate-500 py-3 text-center">Loading approaching buses...</div>
          ) : stopDetails?.upcomingBuses?.length === 0 ? (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 text-center">
              No active buses currently approaching this stop. Next scheduled trip in approx 15 mins.
            </div>
          ) : (
            <div className="space-y-2">
              {stopDetails?.upcomingBuses?.map((b: any) => (
                <div
                  key={b.busId}
                  className="p-3 bg-slate-50 border border-slate-200/90 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <BusIcon className="w-3.5 h-3.5 text-blue-700" />
                      <span className="font-bold font-mono text-slate-900">{b.busNumber}</span>
                      <span className="text-slate-600">Route {b.routeNumber}</span>
                      <CrowdingBadge level={b.crowdLevel} size="sm" />
                    </div>
                    <div className="text-xs text-emerald-700 font-semibold mt-1 font-mono tabular-nums">
                      ETA: ~{b.estimatedMinutes} mins ({b.estimatedArrivalTime})
                    </div>
                  </div>

                  <form
                    onSubmit={(e) => handleQuickSubscribe(e, b.busId)}
                    className="flex items-center gap-1.5"
                  >
                    <input
                      type="tel"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      placeholder="Mobile for SMS"
                      className="px-2 py-1 bg-white border border-slate-200 rounded text-xs w-28 font-mono"
                    />
                    <button
                      type="submit"
                      disabled={subscribing}
                      className="px-2 py-1 bg-purple-700 hover:bg-purple-800 text-white rounded text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      title="Receive SMS when 10 min away"
                    >
                      <Bell className="w-3 h-3" />
                      <span>Alert</span>
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
