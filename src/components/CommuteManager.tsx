import React, { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, CheckCircle2, AlertTriangle, Smartphone, X } from 'lucide-react';
import { Route, BusStop, SavedCommute } from '../types';
import { useAuth } from '../context/AuthContext';
import { useAccessibility } from '../context/AccessibilityContext';

export const CommuteManager: React.FC = () => {
  const { user, token } = useAuth();
  const { t } = useAccessibility();

  const [commutes, setCommutes] = useState<SavedCommute[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [stops, setStops] = useState<BusStop[]>([]);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('Morning Office Ride');
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [boardingStopId, setBoardingStopId] = useState('');
  const [destStopId, setDestStopId] = useState('');
  const [departureTime, setDepartureTime] = useState('08:30');
  const [thresholdMinutes, setThresholdMinutes] = useState(10);
  const [channel, setChannel] = useState<'sms' | 'push' | 'both'>('both');
  const [phone, setPhone] = useState(user?.mobile || '');

  const fetchCommutes = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/commutes', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCommutes(data.commutes || []);
      }
    } catch (err) {
      console.error('Failed to fetch commutes:', err);
    }
  };

  useEffect(() => {
    fetch('/api/routes')
      .then(res => res.json())
      .then(d => {
        if (d.routes) {
          setRoutes(d.routes);
          if (d.routes.length > 0) setSelectedRouteId(d.routes[0].id);
        }
      });

    fetch('/api/stops')
      .then(res => res.json())
      .then(d => {
        if (d.stops) {
          setStops(d.stops);
          if (d.stops.length > 1) {
            setBoardingStopId(d.stops[0].id);
            setDestStopId(d.stops[1].id);
          }
        }
      });

    fetchCommutes();
  }, [token]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setLoading(true);
    try {
      const res = await fetch('/api/commutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          routeId: selectedRouteId,
          boardingStopId,
          destinationStopId: destStopId,
          departureTime,
          thresholdMinutes,
          notificationChannel: channel,
          phone
        })
      });

      const data = await res.json();
      if (res.ok) {
        setMessage('Daily commute alert registered. TransitEase background worker will monitor approaching buses.');
        setShowAddModal(false);
        fetchCommutes();
      } else {
        setMessage(data.error || 'Failed to save commute.');
      }
    } catch {
      setMessage('Network error connecting to transit backend.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id: string, currentActive: boolean) => {
    if (!token) return;
    try {
      await fetch(`/api/commutes/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ active: !currentActive })
      });
      fetchCommutes();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    try {
      await fetch(`/api/commutes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchCommutes();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Saved Daily Commutes</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated alerts when your bus is approaching your regular boarding stop
          </p>
        </div>

        {user && (
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Commute Alert</span>
          </button>
        )}
      </div>

      {message && (
        <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {!user ? (
        <div className="p-6 bg-slate-50 rounded-lg border border-slate-200 text-center text-xs text-slate-600">
          <p className="font-semibold text-slate-800">Sign in to save and monitor daily commute routes</p>
          <p className="text-slate-500 mt-1">Receive proactive SMS or push alerts before your bus arrives at your stop.</p>
        </div>
      ) : commutes.length === 0 ? (
        <div className="p-6 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-center text-xs text-slate-500">
          <Bell className="w-5 h-5 mx-auto mb-2 text-slate-400" />
          <p className="font-medium text-slate-700">No saved daily commute routes yet.</p>
          <p className="mt-1">Add your morning or evening route to receive automated arrival alerts.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {commutes.map(c => {
            const bStop = stops.find(s => s.id === c.boardingStopId);
            const dStop = stops.find(s => s.id === c.destinationStopId);
            const route = routes.find(r => r.id === c.routeId);

            return (
              <div
                key={c.id}
                className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{c.name}</span>
                    {route && (
                      <span className="font-mono text-[10px] bg-slate-900 text-white px-1.5 py-0.5 rounded-sm font-semibold">
                        Route {route.routeNumber}
                      </span>
                    )}
                  </div>

                  <div className="text-slate-600 mt-1 flex items-center gap-1.5 text-[11px] flex-wrap">
                    <span>From: <strong>{bStop?.name || 'Boarding'}</strong></span>
                    <span>→</span>
                    <span>To: <strong>{dStop?.name || 'Destination'}</strong></span>
                  </div>

                  <div className="text-slate-500 text-[11px] mt-1 flex items-center gap-3 font-mono tabular-nums">
                    <span>Departure: {c.departureTime}</span>
                    <span>·</span>
                    <span>Alert: {c.thresholdMinutes} mins prior</span>
                    <span>·</span>
                    <span className="uppercase text-[10px]">{c.notificationChannel}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => handleToggle(c.id, c.active)}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold border cursor-pointer transition-colors ${
                      c.active
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-slate-200 text-slate-600 border-slate-300'
                    }`}
                  >
                    {c.active ? 'Alert Active' : 'Paused'}
                  </button>

                  <button
                    onClick={() => handleDelete(c.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                    title="Delete commute"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[1200] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl border border-slate-200 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
              <h3 className="font-bold text-sm text-slate-900">Add Saved Commute Alert</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Commute Label</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Route</label>
                <select
                  value={selectedRouteId}
                  onChange={e => setSelectedRouteId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs"
                >
                  {routes.map(r => (
                    <option key={r.id} value={r.id}>Route {r.routeNumber} ({r.name})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Boarding Stop</label>
                  <select
                    value={boardingStopId}
                    onChange={e => setBoardingStopId(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs"
                  >
                    {stops.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Destination Stop</label>
                  <select
                    value={destStopId}
                    onChange={e => setDestStopId(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs"
                  >
                    {stops.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Expected Departure</label>
                  <input
                    type="time"
                    value={departureTime}
                    onChange={e => setDepartureTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Alert Threshold</label>
                  <select
                    value={thresholdMinutes}
                    onChange={e => setThresholdMinutes(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs"
                  >
                    <option value={5}>5 mins before</option>
                    <option value={10}>10 mins before</option>
                    <option value={15}>15 mins before</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mobile for SMS Alert</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="10-digit mobile"
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono text-xs"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-xs transition cursor-pointer shadow-2xs disabled:opacity-50 mt-1"
              >
                {loading ? 'Saving...' : 'Save Commute Alert'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
