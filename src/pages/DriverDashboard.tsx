import React, { useState, useEffect, useRef } from 'react';
import {
  Navigation,
  Play,
  Square,
  Users,
  AlertTriangle,
  MapPin,
  LogOut,
  Radio
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CrowdLevel } from '../types';

interface DriverDashboardProps {
  onSwitchToDriverLogin?: () => void;
  onNavigateHome?: () => void;
}

export const DriverDashboard: React.FC<DriverDashboardProps> = ({
  onSwitchToDriverLogin,
  onNavigateHome
}) => {
  const { user, token, logout } = useAuth();
  const [driverData, setDriverData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [backendAuthorized, setBackendAuthorized] = useState<boolean | null>(null);
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [currentCoords, setCurrentCoords] = useState<{
    lat: number;
    lng: number;
    accuracy: number;
    speed: number;
    heading: number;
  } | null>(null);
  const [lastSentTime, setLastSentTime] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [crowdLevel, setCrowdLevel] = useState<CrowdLevel>('seats_available');

  const watchIdRef = useRef<number | null>(null);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStatus = async () => {
    if (!token || !user || user.role !== 'driver') {
      setBackendAuthorized(false);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/driver/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDriverData(data);
        setBackendAuthorized(true);
        setErrorMsg(null);
        if (data.assignedBus?.crowdLevel) {
          setCrowdLevel(data.assignedBus.crowdLevel);
        }
        if (data.activeTrip && data.activeTrip.status === 'in_progress') {
          setIsTracking(true);
        } else {
          setIsTracking(false);
        }
      } else {
        setBackendAuthorized(false);
        const err = await res.json();
        setErrorMsg(err.error || 'Failed to verify driver account with backend.');
      }
    } catch {
      setBackendAuthorized(false);
      setErrorMsg('Failed to connect to transit server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    return () => {
      stopGpsWatch();
    };
  }, [token]);

  // Start GPS Geolocation Watcher
  const startGpsWatch = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation API is not supported by your browser or smartphone.');
      return;
    }

    const handleGeolocationError = (err: GeolocationPositionError) => {
      switch (err.code) {
        case 1:
          setErrorMsg('GPS location permission was denied. Please allow location access in your device or browser settings.');
          break;
        case 2:
          setErrorMsg('GPS position is currently unavailable. Ensure device location services are turned on.');
          break;
        case 3:
          setErrorMsg('GPS location request timed out. Retrying satellite fix...');
          break;
        default:
          setErrorMsg(`GPS error: ${err.message || 'Unable to retrieve device position.'}`);
      }
    };

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          speed: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0,
          heading: Math.round(pos.coords.heading || 0)
        };
        setCurrentCoords(coords);
      },
      (err) => {
        console.warn('Geolocation watch error:', err.message);
        handleGeolocationError(err);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 3000
      }
    );
    watchIdRef.current = id;

    intervalIdRef.current = setInterval(async () => {
      if (!token) return;
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const res = await fetch('/api/driver/location', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                speed: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0,
                heading: pos.coords.heading || 0,
                accuracy: pos.coords.accuracy,
                timestamp: new Date().toISOString()
              })
            });
            if (res.ok) {
              setLastSentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
              setErrorMsg(null);
            } else {
              const errData = await res.json().catch(() => ({}));
              setErrorMsg(errData.error || 'Transit server rejected live coordinate update.');
            }
          } catch (e) {
            console.error('Failed to post live coordinates:', e);
            setErrorMsg('Network error: Unable to transmit coordinates to transit server. Retrying automatically.');
          }
        },
        (err) => {
          handleGeolocationError(err);
        },
        { enableHighAccuracy: true }
      );
    }, 5000);
  };

  const stopGpsWatch = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
  };

  const handleStartTrip = async () => {
    if (!token) return;
    setErrorMsg(null);

    try {
      const res = await fetch('/api/driver/start-trip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to start trip.');
        return;
      }

      setIsTracking(true);
      startGpsWatch();
      fetchStatus();
    } catch {
      setErrorMsg('Failed to communicate with transit dispatch system.');
    }
  };

  const handleEndTrip = async () => {
    if (!token) return;
    try {
      await fetch('/api/driver/end-trip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      stopGpsWatch();
      setIsTracking(false);
      fetchStatus();
    } catch {
      setErrorMsg('Failed to end trip.');
    }
  };

  const handleUpdateCrowd = async (newLevel: CrowdLevel) => {
    if (!token) return;
    setCrowdLevel(newLevel);
    try {
      await fetch('/api/driver/crowd', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ crowdLevel: newLevel })
      });
    } catch {
      console.error('Failed to update crowding');
    }
  };

  // 1. Unauthenticated User State
  if (!user) {
    return (
      <div className="max-w-md mx-auto my-8 p-6 bg-white rounded-xl shadow-2xs border border-slate-200/90 text-center space-y-4">
        <div className="w-10 h-10 bg-slate-900 text-emerald-400 rounded-lg flex items-center justify-center mx-auto shadow-2xs">
          <Radio className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-lg text-slate-900">Driver Portal Sign In</h3>
          <p className="text-xs text-slate-500 mt-1">
            Bus drivers share live GPS location and update passenger seat availability
          </p>
        </div>
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1 text-left">
          <span className="font-semibold text-slate-700 block text-[11px]">Demo Driver Credentials:</span>
          <div className="font-mono text-xs text-slate-800 flex justify-between items-center">
            <span>Mobile: <strong>9876543210</strong></span>
            <span>Password: <strong>driver123</strong></span>
          </div>
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={() => onSwitchToDriverLogin?.()}
            className="w-full py-2 px-4 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
          >
            Sign In with Driver Credentials
          </button>
          <button
            onClick={() => onNavigateHome?.()}
            className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            Return to Passenger Home
          </button>
        </div>
      </div>
    );
  }

  // 2. Logged In as Passenger or Non-Driver
  if (user.role !== 'driver') {
    const handleLogoutAndLoginAsDriver = () => {
      logout();
      onSwitchToDriverLogin?.();
    };

    return (
      <div className="max-w-md mx-auto my-8 p-6 bg-white rounded-xl shadow-2xs border border-slate-200/90 text-center space-y-4">
        <div className="w-10 h-10 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg flex items-center justify-center mx-auto">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-lg text-slate-900">Driver Portal Access Restricted</h3>
          <p className="text-xs text-slate-500 mt-1">
            Current Session: <strong className="text-slate-800">{user.name}</strong> ({user.role === 'passenger' ? 'Passenger Account' : user.role.toUpperCase()})
          </p>
        </div>
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-left text-xs space-y-1.5 text-amber-900">
          <div className="font-semibold text-[11px] uppercase tracking-wider text-amber-800">
            Passenger Account Detected
          </div>
          <p className="text-amber-800 text-xs leading-relaxed">
            The Driver Portal requires an authorized driver account to share live location.
          </p>
          <div className="pt-2 border-t border-amber-200 font-mono text-[11px] text-amber-900 flex justify-between">
            <span>Demo Driver: <strong>9876543210</strong></span>
            <span>Password: <strong>driver123</strong></span>
          </div>
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={handleLogoutAndLoginAsDriver}
            className="w-full py-2 px-4 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs cursor-pointer flex items-center justify-center gap-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign In as Driver</span>
          </button>
          <button
            onClick={() => onNavigateHome?.()}
            className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            Return to Passenger Home
          </button>
        </div>
      </div>
    );
  }

  // 3. Backend Verification Loading State
  if (loading) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white rounded-xl shadow-2xs border border-slate-200/90 text-center space-y-3">
        <div className="w-5 h-5 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-medium text-slate-600">Verifying driver credentials with transit authority...</p>
      </div>
    );
  }

  // 4. Backend Verification Denied
  if (backendAuthorized === false) {
    return (
      <div className="max-w-md mx-auto my-8 p-6 bg-white rounded-xl shadow-2xs border border-slate-200/90 text-center space-y-4">
        <div className="w-10 h-10 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg flex items-center justify-center mx-auto">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-lg text-slate-900">Backend Verification Denied</h3>
          <p className="text-xs text-rose-600 font-medium mt-1">
            {errorMsg || 'The transit server rejected access. Driver permissions could not be verified.'}
          </p>
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={() => {
              logout();
              onSwitchToDriverLogin?.();
            }}
            className="w-full py-2 px-4 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
          >
            Sign In with Valid Driver Account
          </button>
          <button
            onClick={() => onNavigateHome?.()}
            className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            Return to Passenger Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Top Driver Header */}
      <div className="bg-white rounded-xl p-5 shadow-2xs border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              {user.name}
            </h2>
            <span
              className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-sm border ${
                driverData?.driver?.driverStatus === 'approved'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              {driverData?.driver?.driverStatus || 'Pending Verification'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Mobile: <span className="font-mono font-semibold text-slate-800 tabular-nums">+91 {user.mobile}</span>
            {driverData?.driver?.licenseNumber && ` · License: ${driverData.driver.licenseNumber}`}
          </p>
        </div>

        {/* Assigned Bus Tag */}
        {driverData?.assignedBus ? (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 sm:text-right">
            <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block">
              Assigned Vehicle
            </span>
            <div className="text-sm font-bold font-mono text-slate-900">
              {driverData.assignedBus.busNumber}
            </div>
            <div className="text-[10px] font-mono text-slate-500">
              {driverData.assignedBus.registrationNumber}
            </div>
          </div>
        ) : (
          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 font-medium">
            No vehicle assigned by transport dispatch.
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}

      {/* Main Trip & Live GPS Control Card */}
      <div className="bg-white rounded-xl p-5 shadow-2xs border border-slate-200/90 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-900 flex items-center gap-2">
              <Navigation className="w-4 h-4 text-slate-700" />
              <span>Smartphone GPS Live Tracking</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Transmits high-accuracy coordinates to the passenger arrival calculation engine
            </p>
          </div>

          <div>
            {!isTracking ? (
              <button
                onClick={handleStartTrip}
                disabled={driverData?.driver?.driverStatus !== 'approved' || !driverData?.assignedBus}
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Start Trip & Broadcast GPS</span>
              </button>
            ) : (
              <button
                onClick={handleEndTrip}
                className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                <Square className="w-3.5 h-3.5" />
                <span>End Trip & Stop Broadcast</span>
              </button>
            )}
          </div>
        </div>

        {/* Live GPS Telemetry Status */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Live Location Status
            </span>
            <div className="text-xs sm:text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isTracking ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              <span>{isTracking ? 'BROADCASTING' : 'OFFLINE'}</span>
            </div>
            <div className="text-[10px] font-mono text-slate-500 mt-0.5 tabular-nums">
              {lastSentTime ? `Synced: ${lastSentTime}` : 'Not transmitting'}
            </div>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Road Speed
            </span>
            <div className="text-xs sm:text-sm font-bold font-mono text-slate-900 mt-1 tabular-nums">
              {currentCoords?.speed || 0} km/h
            </div>
            <div className="text-[10px] font-mono text-slate-500 mt-0.5 tabular-nums">
              Heading: {currentCoords?.heading || 0}°
            </div>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Fix Precision
            </span>
            <div className="text-xs sm:text-sm font-bold font-mono text-emerald-800 mt-1 tabular-nums">
              ±{currentCoords?.accuracy || 8} meters
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              High Accuracy
            </div>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Active Trip Number
            </span>
            <div className="text-xs font-mono font-bold text-slate-900 mt-1 truncate">
              {driverData?.activeTrip?.tripNumber || 'None'}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Route {driverData?.route?.routeNumber || '101'}
            </div>
          </div>
        </div>

        {/* Real Crowding Occupancy Reporting */}
        <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-700" />
              <span>Report Passenger Seat Availability</span>
            </span>
            <span className="text-[10px] text-slate-500">
              Updates passenger screen & SMS responses instantly
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleUpdateCrowd('seats_available')}
              className={`p-2 rounded-lg border font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                crowdLevel === 'seats_available'
                  ? 'bg-emerald-800 text-white border-emerald-800 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${crowdLevel === 'seats_available' ? 'bg-white' : 'bg-emerald-500'}`} />
              <span>Seats Available</span>
            </button>

            <button
              type="button"
              onClick={() => handleUpdateCrowd('moderately_crowded')}
              className={`p-2 rounded-lg border font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                crowdLevel === 'moderately_crowded'
                  ? 'bg-amber-700 text-white border-amber-700 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${crowdLevel === 'moderately_crowded' ? 'bg-white' : 'bg-amber-500'}`} />
              <span>Moderately Crowded</span>
            </button>

            <button
              type="button"
              onClick={() => handleUpdateCrowd('very_crowded')}
              className={`p-2 rounded-lg border font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                crowdLevel === 'very_crowded'
                  ? 'bg-rose-800 text-white border-rose-800 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${crowdLevel === 'very_crowded' ? 'bg-white' : 'bg-rose-500'}`} />
              <span>Standing Only (Full)</span>
            </button>
          </div>
        </div>

        {/* Operating Route Stop Checklist */}
        <div>
          <h4 className="font-bold text-xs text-slate-900 mb-2 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-slate-600" />
            <span>Stop Progression: {driverData?.route?.name || 'Assigned Route'}</span>
          </h4>
          <div className="space-y-1.5">
            {driverData?.stopsChecklist?.map((s: any, idx: number) => {
              const currentIdx = driverData.activeTrip?.currentStopIndex || 0;
              const isPassed = idx < currentIdx;
              const isNext = idx === currentIdx;

              return (
                <div
                  key={s.stopId}
                  className={`p-2 rounded-lg border text-xs flex items-center justify-between transition-colors ${
                    isPassed
                      ? 'bg-slate-50 text-slate-400 border-slate-200'
                      : isNext
                      ? 'bg-emerald-50 border-emerald-300 text-slate-900 font-semibold'
                      : 'bg-white border-slate-200/90 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 font-mono flex items-center justify-center text-[10px]">
                      {s.order}
                    </span>
                    <span>{s.name}</span>
                    <span className="text-[10px] font-mono text-slate-500 font-normal">
                      ({s.code})
                    </span>
                  </div>

                  <div>
                    {isPassed ? (
                      <span className="text-[10px] font-medium text-slate-400">Passed</span>
                    ) : isNext ? (
                      <span className="text-emerald-900 bg-emerald-100 border border-emerald-200 text-[10px] px-1.5 py-0.5 rounded-sm font-bold uppercase tracking-wider">
                        Next Stop
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500">Upcoming</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Operating Guidance Note */}
        <div className="p-3 bg-slate-50 rounded-lg text-[11px] text-slate-500 border border-slate-200/80 space-y-0.5">
          <p className="font-semibold text-slate-700">Driver Guidance & Power Advisory:</p>
          <p>
            Please keep this screen open while operating your scheduled route. Ensure your phone remains connected to the bus USB dashboard charger to prevent battery discharge.
          </p>
        </div>
      </div>
    </div>
  );
};
