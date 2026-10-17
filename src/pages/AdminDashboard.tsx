import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Users,
  Bus,
  Navigation,
  AlertTriangle,
  MessageSquare,
  CheckCircle2,
  FileText,
  QrCode,
  Play,
  Radio,
  LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BusMap } from '../components/BusMap';

interface AdminDashboardProps {
  onSwitchToAdminLogin?: () => void;
  onNavigateHome?: () => void;
  onNavigateDriver?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onSwitchToAdminLogin,
  onNavigateHome,
  onNavigateDriver
}) => {
  const { user, token, logout } = useAuth();
  const [backendAuthorized, setBackendAuthorized] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'drivers' | 'fleet' | 'stops' | 'disruptions' | 'reports' | 'sms'>('overview');
  const [stats, setStats] = useState<any>(null);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [stops, setStops] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [smsLogs, setSmsLogs] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [liveBuses, setLiveBuses] = useState<any[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  // New Bus form
  const [newBusNumber, setNewBusNumber] = useState('');
  const [newRegNumber, setNewRegNumber] = useState('');
  const [newCapacity, setNewCapacity] = useState('45');
  const [selectedRouteForBus, setSelectedRouteForBus] = useState('');

  // Announcement form
  const [alertTitle, setAlertTitle] = useState('');
  const [alertTitleHi, setAlertTitleHi] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertMessageHi, setAlertMessageHi] = useState('');
  const [alertType, setAlertType] = useState<'delay' | 'diversion' | 'cancellation' | 'info'>('delay');

  // Simulator step
  const [simStepIndex, setSimStepIndex] = useState(0);

  const fetchAll = async () => {
    if (!token) {
      setBackendAuthorized(false);
      return;
    }
    try {
      const headers = { Authorization: `Bearer ${token}` };

      // Stats
      const statsRes = await fetch('/api/admin/stats', { headers });
      if (statsRes.status === 401 || statsRes.status === 403) {
        setBackendAuthorized(false);
        return;
      }
      if (statsRes.ok) {
        setBackendAuthorized(true);
        setStats(await statsRes.json());
      }

      // Drivers
      const driversRes = await fetch('/api/admin/drivers', { headers });
      if (driversRes.ok) {
        const d = await driversRes.json();
        setDrivers(d.drivers || []);
      }

      // Live buses
      const liveRes = await fetch('/api/buses/live');
      if (liveRes.ok) {
        const d = await liveRes.json();
        setLiveBuses(d.liveBuses || []);
      }

      // Reports
      const repRes = await fetch('/api/admin/reports', { headers });
      if (repRes.ok) {
        const d = await repRes.json();
        setReports(d.reports || []);
      }

      // Announcements
      const annRes = await fetch('/api/admin/announcements', { headers });
      if (annRes.ok) {
        const d = await annRes.json();
        setAnnouncements(d.announcements || []);
      }

      // SMS Logs
      const smsRes = await fetch('/api/admin/sms-logs', { headers });
      if (smsRes.ok) {
        const d = await smsRes.json();
        setSmsLogs(d.logs || []);
      }

      // Routes and stops
      const rRes = await fetch('/api/routes');
      if (rRes.ok) {
        const d = await rRes.json();
        setRoutes(d.routes || []);
        if (d.routes.length > 0) setSelectedRouteForBus(d.routes[0].id);
      }

      const sRes = await fetch('/api/stops');
      if (sRes.ok) {
        const d = await sRes.json();
        setStops(d.stops || []);
      }
    } catch (err) {
      console.error('Error fetching admin data:', err);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [token]);

  const handleVerifyDriver = async (driverId: string, status: 'approved' | 'rejected') => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/drivers/${driverId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        setMessage(`Driver status updated to ${status}.`);
        fetchAll();
      }
    } catch {
      setMessage('Failed to update driver status.');
    }
  };

  const handleAssignDriver = async (driverId: string, busId: string) => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/assign-driver', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ driverId, busId })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message || 'Driver assigned successfully.');
        fetchAll();
      } else {
        setMessage(data.error || 'Assignment failed.');
      }
    } catch {
      setMessage('Error assigning driver.');
    }
  };

  const handleCreateBus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const res = await fetch('/api/admin/buses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          busNumber: newBusNumber,
          registrationNumber: newRegNumber,
          capacity: newCapacity,
          currentRouteId: selectedRouteForBus
        })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('New bus registered in fleet.');
        setNewBusNumber('');
        setNewRegNumber('');
        fetchAll();
      } else {
        setMessage(data.error || 'Bus creation failed.');
      }
    } catch {
      setMessage('Network error creating bus.');
    }
  };

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: alertTitle,
          titleHi: alertTitleHi || alertTitle,
          message: alertMessage,
          messageHi: alertMessageHi || alertMessage,
          type: alertType,
          affectedRouteIds: routes.map(r => r.id)
        })
      });
      if (res.ok) {
        setMessage('Service disruption published to passenger applications.');
        setAlertTitle('');
        setAlertMessage('');
        fetchAll();
      }
    } catch {
      setMessage('Error publishing alert.');
    }
  };

  const handleResolveReport = async (reportId: string, notes: string) => {
    if (!token) return;
    try {
      await fetch(`/api/admin/reports/${reportId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status: 'resolved',
          resolutionNotes: notes || 'Investigated by fleet management. Crew advised.'
        })
      });
      setMessage('Report marked resolved.');
      fetchAll();
    } catch {
      setMessage('Error updating report.');
    }
  };

  const handleSimulateGpsStep = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/simulate-gps-step', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          busId: 'bus-1001',
          stepIndex: simStepIndex
        })
      });
      const d = await res.json();
      if (res.ok) {
        setMessage(d.message);
        setSimStepIndex(d.nextStepIndex);
        fetchAll();
      }
    } catch {
      setMessage('Error stepping simulator.');
    }
  };

  // 1. Unauthenticated User State
  if (!user) {
    return (
      <div className="max-w-md mx-auto my-8 p-6 bg-white rounded-xl shadow-2xs border border-slate-200/90 text-center space-y-4">
        <div className="w-10 h-10 bg-indigo-50 text-indigo-700 rounded-lg flex items-center justify-center mx-auto border border-indigo-200/80">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <h3 className="font-bold text-lg text-slate-900 tracking-tight">
          Administrator Access Required
        </h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          Sign in to approve drivers, manage routes, post service alerts, and view live buses.
        </p>
        <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-lg text-left space-y-1">
          <span className="text-[11px] font-bold text-indigo-900 block">
            Demo Admin Credentials:
          </span>
          <div className="text-xs font-mono text-indigo-800 flex justify-between">
            <span>Email: <strong>admin@transitease.city</strong></span>
            <span>Password: <strong>admin123</strong></span>
          </div>
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={() => onSwitchToAdminLogin?.()}
            className="w-full py-2 px-4 bg-indigo-800 hover:bg-indigo-900 text-white rounded-lg font-semibold text-xs transition cursor-pointer shadow-2xs"
          >
            Sign In with Administrator Credentials
          </button>
          <button
            onClick={() => onNavigateHome?.()}
            className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-xs transition cursor-pointer"
          >
            Return to Passenger Home
          </button>
        </div>
      </div>
    );
  }

  // 2. Authenticated Non-Admin User (Passenger or Driver)
  if (user && user.role !== 'admin') {
    return (
      <div className="max-w-md mx-auto my-8 p-6 bg-white rounded-xl shadow-2xs border border-slate-200/90 text-center space-y-4">
        <div className="w-10 h-10 bg-amber-50 text-amber-700 rounded-lg flex items-center justify-center mx-auto border border-amber-200/80">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <h3 className="font-bold text-lg text-slate-900 tracking-tight">
          Administrator Access Denied
        </h3>
        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
          Current Session: <strong className="text-slate-800">{user.name}</strong> ({user.role === 'passenger' ? 'Passenger Account' : 'Driver Account'})
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          {user.role === 'passenger'
            ? 'You are signed in as a passenger. Admin controls are restricted to transport managers.'
            : 'You are signed in as a driver. Admin controls are restricted to transport managers.'}
        </p>
        <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-lg text-left space-y-1">
          <span className="text-[11px] font-bold text-indigo-900 block">
            Demo Admin Credentials:
          </span>
          <div className="text-xs font-mono text-indigo-800 flex justify-between">
            <span>Email: <strong>admin@transitease.city</strong></span>
            <span>Password: <strong>admin123</strong></span>
          </div>
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={() => {
              logout();
              onSwitchToAdminLogin?.();
            }}
            className="w-full py-2 px-4 bg-indigo-800 hover:bg-indigo-900 text-white rounded-lg font-semibold text-xs shadow-2xs transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out & Log In as Administrator</span>
          </button>
          <button
            onClick={() => {
              if (user.role === 'driver') {
                onNavigateDriver?.();
              } else {
                onNavigateHome?.();
              }
            }}
            className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-xs transition cursor-pointer"
          >
            {user.role === 'driver' ? 'Return to Driver Portal' : 'Return to Passenger Home'}
          </button>
        </div>
      </div>
    );
  }

  // 3. Backend Verification Gate
  if (backendAuthorized === false) {
    return (
      <div className="max-w-md mx-auto my-8 p-6 bg-white rounded-xl shadow-2xs border border-slate-200/90 text-center space-y-4">
        <div className="w-10 h-10 bg-rose-50 text-rose-700 rounded-lg flex items-center justify-center mx-auto border border-rose-200/80">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <h3 className="font-bold text-lg text-slate-900 tracking-tight">
          Unauthorized Administrator Session
        </h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          The TransitEase server rejected access to administrator endpoints (HTTP 403 Forbidden). Backend verification confirmed this session does not possess administrator authority.
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={() => {
              logout();
              onSwitchToAdminLogin?.();
            }}
            className="w-full py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-xs transition cursor-pointer shadow-2xs"
          >
            Sign In with Valid Administrator Account
          </button>
          <button
            onClick={() => onNavigateHome?.()}
            className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-xs transition cursor-pointer"
          >
            Return to Passenger Home
          </button>
        </div>
      </div>
    );
  }

  // Format buses for multi-bus map view
  const multiBusesList = liveBuses
    .filter(b => b.location && b.bus)
    .map(b => ({
      busId: b.bus.id,
      busNumber: b.bus.busNumber,
      routeNumber: b.route?.routeNumber,
      lat: b.location.lat,
      lng: b.location.lng,
      speed: b.location.speed,
      heading: b.location.heading,
      isStale: b.location.isStale
    }));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl p-5 shadow-2xs border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Transit Admin Dashboard
            </h2>
            <span className="text-[10px] font-mono bg-indigo-50 text-indigo-800 border border-indigo-200 font-bold px-2 py-0.5 rounded-sm uppercase">
              Admin
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Signed in: <strong>{user.name}</strong> · Database: <strong>{stats?.dbStatus?.storageType || 'Connected'}</strong>
          </p>
        </div>

        {/* Development Route Simulator Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSimulateGpsStep}
            title="Step Bus UP16-1001 forward along route coordinates"
            className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Simulate GPS Move (Step {simStepIndex + 1})</span>
          </button>
        </div>
      </div>

      {message && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-900 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Real Statistics Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="bg-white p-3.5 rounded-lg border border-slate-200/90 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Active Buses</span>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
            {stats?.stats?.activeTrips ?? 2}
          </div>
          <span className="text-[10px] text-emerald-700 font-medium mt-0.5 block">Broadcasting Live</span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200/90 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Buses</span>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
            {stats?.stats?.totalBuses ?? 3}
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Registered Vehicles</span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200/90 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Drivers</span>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
            {stats?.stats?.totalDrivers ?? 3}
          </div>
          <span className="text-[10px] text-amber-700 font-medium mt-0.5 block">
            {stats?.stats?.pendingDrivers ?? 1} Pending Approval
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200/90 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Bus Stops</span>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
            {stats?.stats?.totalStops ?? 7}
          </div>
          <span className="text-[10px] text-blue-700 font-medium mt-0.5 block">With QR Codes</span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200/90 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">SMS Inquiries</span>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
            {stats?.stats?.smsDispatched ?? 4}
          </div>
          <span className="text-[10px] text-purple-700 font-medium mt-0.5 block">Messages Processed</span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200/90 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Grievances</span>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1 tabular-nums">
            {stats?.stats?.openReports ?? 0}
          </div>
          <span className="text-[10px] text-rose-700 font-medium mt-0.5 block">Open Issues</span>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex overflow-x-auto border-b border-slate-200 gap-1 pb-1 text-xs font-semibold text-slate-600 no-scrollbar">
        {[
          { id: 'overview', label: 'Live Fleet Map' },
          { id: 'drivers', label: `Driver Verification (${stats?.stats?.pendingDrivers || 0})` },
          { id: 'fleet', label: 'Manage Buses' },
          { id: 'stops', label: 'Stops & QR Signage' },
          { id: 'disruptions', label: 'Service Alerts' },
          { id: 'reports', label: 'Passenger Grievances' },
          { id: 'sms', label: 'SMS Logs' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`px-3 py-1.5 rounded-md transition-colors shrink-0 cursor-pointer whitespace-nowrap ${
              activeTab === t.id
                ? 'bg-slate-900 text-white font-bold'
                : 'hover:bg-slate-100 text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: LIVE FLEET MAP */}
      {activeTab === 'overview' && (
        <div className="bg-white rounded-xl p-4 sm:p-5 shadow-2xs border border-slate-200/90 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              Live Bus Map
            </h3>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {multiBusesList.length} Active Vehicles
            </span>
          </div>

          <BusMap
            multiBuses={multiBusesList}
            stops={stops}
            height="500px"
          />
        </div>
      )}

      {/* TAB 2: DRIVER VERIFICATION & ASSIGNMENT */}
      {activeTab === 'drivers' && (
        <div className="bg-white rounded-xl p-4 sm:p-5 shadow-2xs border border-slate-200/90 space-y-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              Driver Verification & Bus Assignment
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Drivers must be approved by an administrator before broadcasting GPS coordinates or starting trips.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-y border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Driver Name</th>
                  <th className="py-2.5 px-3">Mobile Number</th>
                  <th className="py-2.5 px-3">License Number</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Assigned Bus</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {drivers.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{d.name}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600 tabular-nums">+91 {d.mobile}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{d.licenseNumber || 'N/A'}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-sm font-semibold text-[10px] capitalize border ${
                        d.driverStatus === 'approved'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : d.driverStatus === 'rejected'
                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        {d.driverStatus || 'pending'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {d.assignedBus ? (
                        <span className="font-bold font-mono text-slate-800">{d.assignedBus.busNumber}</span>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-1">
                      {d.driverStatus !== 'approved' && (
                        <button
                          onClick={() => handleVerifyDriver(d.id, 'approved')}
                          className="px-2 py-1 bg-emerald-800 hover:bg-emerald-900 text-white rounded text-[11px] font-semibold cursor-pointer"
                        >
                          Approve
                        </button>
                      )}
                      {d.driverStatus !== 'rejected' && (
                        <button
                          onClick={() => handleVerifyDriver(d.id, 'rejected')}
                          className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded text-[11px] font-semibold cursor-pointer"
                        >
                          Reject
                        </button>
                      )}
                      {d.driverStatus === 'approved' && !d.assignedBus && (
                        <button
                          onClick={() => handleAssignDriver(d.id, 'bus-2005')}
                          className="px-2 py-1 bg-blue-700 hover:bg-blue-800 text-white rounded text-[11px] font-semibold cursor-pointer"
                        >
                          Assign Bus 2005
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: FLEET REGISTRATION */}
      {activeTab === 'fleet' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-4 bg-white rounded-xl p-4 sm:p-5 shadow-2xs border border-slate-200/90">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base mb-3">Register New Bus</h3>
            <form onSubmit={handleCreateBus} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Bus Identifier</label>
                <input
                  type="text"
                  value={newBusNumber}
                  onChange={(e) => setNewBusNumber(e.target.value)}
                  placeholder="e.g. UP16-3050"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Registration Plate</label>
                <input
                  type="text"
                  value={newRegNumber}
                  onChange={(e) => setNewRegNumber(e.target.value)}
                  placeholder="UP 16 BT 3050"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assigned Route</label>
                <select
                  value={selectedRouteForBus}
                  onChange={(e) => setSelectedRouteForBus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {routes.map(r => (
                    <option key={r.id} value={r.id}>Route {r.routeNumber} ({r.name})</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold transition cursor-pointer shadow-2xs"
              >
                Register Bus in Fleet
              </button>
            </form>
          </div>

          <div className="lg:col-span-8 bg-white rounded-xl p-4 sm:p-5 shadow-2xs border border-slate-200/90">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base mb-3">Fleet Inventory</h3>
            <div className="space-y-2.5">
              {routes.map(r => (
                <div key={r.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200/90 text-xs">
                  <div className="font-bold text-slate-900">
                    Route {r.routeNumber}: {r.name}
                  </div>
                  <div className="text-slate-500 text-[11px] mt-0.5 tabular-nums">
                    {r.stops?.length || 0} Ordered Stops · Base Fare: ₹{r.fareBase} (₹{r.farePerKm}/km)
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: STOPS & QR */}
      {activeTab === 'stops' && (
        <div className="bg-white rounded-xl p-4 sm:p-5 shadow-2xs border border-slate-200/90 space-y-3">
          <h3 className="font-bold text-slate-900 text-sm sm:text-base">
            Bus Stops & QR Codes
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stops.map(s => (
              <div key={s.id} className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-lg flex items-center justify-between">
                <div>
                  <span className="font-mono text-xs font-bold text-blue-800 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-sm">
                    {s.code}
                  </span>
                  <div className="font-bold text-slate-900 text-xs mt-1.5">{s.name}</div>
                  <div className="text-[11px] text-slate-500">{s.nameHi}</div>
                  <div className="text-[10px] text-slate-400 mt-1 font-mono tabular-nums">
                    GPS: {s.lat.toFixed(4)}, {s.lng.toFixed(4)}
                  </div>
                </div>

                {s.qrCodeDataUrl && (
                  <img src={s.qrCodeDataUrl} alt={s.name} className="w-14 h-14 bg-white p-1 rounded-md border border-slate-200 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: SERVICE DISRUPTIONS */}
      {activeTab === 'disruptions' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 bg-white rounded-xl p-4 sm:p-5 shadow-2xs border border-slate-200/90">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base mb-3">
              Post a Service Alert
            </h3>
            <form onSubmit={handlePublishAnnouncement} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notice Type</label>
                <select
                  value={alertType}
                  onChange={(e) => setAlertType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                >
                  <option value="delay">Route Delay</option>
                  <option value="diversion">Route Diversion</option>
                  <option value="cancellation">Trip Cancellation</option>
                  <option value="info">General Advisory</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Title (English)</label>
                <input
                  type="text"
                  value={alertTitle}
                  onChange={(e) => setAlertTitle(e.target.value)}
                  placeholder="Single-lane traffic on Knowledge Park Road"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Title (Hindi)</label>
                <input
                  type="text"
                  value={alertTitleHi}
                  onChange={(e) => setAlertTitleHi(e.target.value)}
                  placeholder="नॉलेज पार्क मार्ग पर धीमी गति से यातायात"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Message Body</label>
                <textarea
                  value={alertMessage}
                  onChange={(e) => setAlertMessage(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                  placeholder="Explain delay duration or bypass stops..."
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg font-semibold transition cursor-pointer shadow-2xs"
              >
                Publish Emergency Notice
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 bg-white rounded-xl p-4 sm:p-5 shadow-2xs border border-slate-200/90">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base mb-3">Published Alerts</h3>
            <div className="space-y-2.5">
              {announcements.map(a => (
                <div key={a.id} className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-lg text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-950 uppercase text-[10px]">{a.type}</span>
                    <span className="text-[10px] font-mono text-amber-800">{new Date(a.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="font-semibold text-slate-900">{a.title}</div>
                  <div className="text-slate-600">{a.message}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: PASSENGER GRIEVANCES */}
      {activeTab === 'reports' && (
        <div className="bg-white rounded-xl p-4 sm:p-5 shadow-2xs border border-slate-200/90 space-y-3">
          <h3 className="font-bold text-slate-900 text-sm sm:text-base">Passenger Grievance Queue</h3>
          {reports.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-lg">
              No passenger grievances filed.
            </div>
          ) : (
            <div className="space-y-2.5">
              {reports.map(r => (
                <div key={r.id} className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-lg text-xs flex flex-col sm:flex-row justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900">{r.referenceNumber}</span>
                      <span className={`px-2 py-0.5 rounded-sm font-semibold text-[10px] uppercase border ${
                        r.status === 'resolved'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}>
                        {r.status}
                      </span>
                      <span className="text-slate-500">Category: <strong>{r.category}</strong></span>
                    </div>
                    <p className="text-slate-700 mt-1 font-medium">{r.description}</p>
                    <div className="text-[10px] text-slate-400 mt-1 font-mono">
                      Reported by: {r.passengerName} {r.passengerMobile && `(${r.passengerMobile})`} · {new Date(r.createdAt).toLocaleString()}
                    </div>
                  </div>

                  {r.status !== 'resolved' && (
                    <button
                      onClick={() => handleResolveReport(r.id, 'Issue reviewed and addressed.')}
                      className="px-2.5 py-1 bg-emerald-800 hover:bg-emerald-900 text-white rounded text-xs font-semibold shrink-0 self-start cursor-pointer shadow-2xs"
                    >
                      Mark Resolved
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 7: SMS LOGS */}
      {activeTab === 'sms' && (
        <div className="bg-white rounded-xl p-4 sm:p-5 shadow-2xs border border-slate-200/90 space-y-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">SMS Messages</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Recent text messages, incoming bus requests, and reply status.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] border-y border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Mobile</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Message Text</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px]">
                {smsLogs.map(l => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap tabular-nums">
                      {new Date(l.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-800 tabular-nums">+91 {l.mobile}</td>
                    <td className="py-2.5 px-3 text-blue-700 uppercase font-semibold">{l.type}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-1.5 py-0.5 rounded-sm font-semibold uppercase text-[10px] border ${
                        l.status === 'delivered' || l.status === 'sent' || l.status === 'simulated'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-sans">{l.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
