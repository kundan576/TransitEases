import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { AccessibilityProvider, useAccessibility } from './context/AccessibilityContext';
import { SocketProvider } from './context/SocketContext';
import { Navbar } from './components/Navbar';
import { LiveDisruptionsBanner } from './components/LiveDisruptionsBanner';
import { PassengerHome } from './pages/PassengerHome';
import { DriverDashboard } from './pages/DriverDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { AuthPage } from './pages/AuthPage';
import { JourneyPlanner } from './components/JourneyPlanner';
import { CommuteManager } from './components/CommuteManager';
import { BusMap } from './components/BusMap';
import { SMSFeaturePhoneSimulator } from './components/SMSFeaturePhoneSimulator';
import { IVRVoiceSimulator } from './components/IVRVoiceSimulator';
import { ReportGrievanceModal } from './components/ReportGrievanceModal';
import { Bus, MapPin, Radio, ShieldCheck, Heart } from 'lucide-react';

const MainContent: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('home');
  const [authInitialRole, setAuthInitialRole] = useState<'passenger' | 'driver' | 'admin'>('passenger');
  const [intendedTab, setIntendedTab] = useState<string | null>(null);
  const [showSMSModal, setShowSMSModal] = useState<boolean>(false);
  const [showIVRModal, setShowIVRModal] = useState<boolean>(false);
  const [showGrievanceModal, setShowGrievanceModal] = useState<boolean>(false);
  const [allLiveBuses, setAllLiveBuses] = useState<any[]>([]);
  const [allStops, setAllStops] = useState<any[]>([]);

  const handleOpenDriverLogin = () => {
    setAuthInitialRole('driver');
    setIntendedTab('driver');
    setCurrentTab('auth');
  };

  const handleOpenAdminLogin = () => {
    setAuthInitialRole('admin');
    setIntendedTab('admin');
    setCurrentTab('auth');
  };

  useEffect(() => {
    // Poll live buses for full fleet view
    const fetchLive = () => {
      fetch('/api/buses/live')
        .then(res => res.json())
        .then(d => {
          if (d.liveBuses) setAllLiveBuses(d.liveBuses);
        })
        .catch(() => {});
    };

    fetch('/api/stops')
      .then(res => res.json())
      .then(d => {
        if (d.stops) setAllStops(d.stops);
      })
      .catch(() => {});

    fetchLive();
    const interval = setInterval(fetchLive, 8000);
    return () => clearInterval(interval);
  }, []);

  const multiBusesFormatted = allLiveBuses
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
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Disruptions & Delay Announcement Banner */}
      <LiveDisruptionsBanner />

      {/* Main Responsive Header Navigation */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          if (tab === 'auth') {
            setAuthInitialRole('passenger');
            setIntendedTab(null);
          }
          setCurrentTab(tab);
        }}
        onOpenDriverLogin={handleOpenDriverLogin}
        onOpenAdminLogin={handleOpenAdminLogin}
        onOpenSMS={() => setShowSMSModal(true)}
        onOpenIVR={() => setShowIVRModal(true)}
        onOpenGrievance={() => setShowGrievanceModal(true)}
      />

      {/* Primary Page Canvas */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentTab === 'home' && (
          <PassengerHome onNavigateToJourney={() => setCurrentTab('journey')} />
        )}

        {currentTab === 'journey' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <JourneyPlanner
              onSelectBusToTrack={(busNum) => {
                setCurrentTab('home');
              }}
            />
          </div>
        )}

        {currentTab === 'commute' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <CommuteManager />
          </div>
        )}

        {currentTab === 'fleet' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Real-Time Fleet Corridor Map
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tracking all active municipal buses moving along transit routes simultaneously
                </p>
              </div>
              <div className="text-xs font-semibold text-slate-600 font-mono tabular-nums">
                {multiBusesFormatted.length} Vehicles In Motion
              </div>
            </div>

            <div className="bg-white rounded-xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs">
              <BusMap
                multiBuses={multiBusesFormatted}
                stops={allStops}
                height="560px"
              />
            </div>
          </div>
        )}

        {currentTab === 'driver' && (
          <DriverDashboard
            onSwitchToDriverLogin={handleOpenDriverLogin}
            onNavigateHome={() => setCurrentTab('home')}
          />
        )}

        {currentTab === 'admin' && (
          <AdminDashboard
            onSwitchToAdminLogin={handleOpenAdminLogin}
            onNavigateHome={() => setCurrentTab('home')}
            onNavigateDriver={() => setCurrentTab('driver')}
          />
        )}

        {currentTab === 'auth' && (
          <AuthPage
            key={authInitialRole}
            initialRole={authInitialRole}
            onSuccess={(loggedInRole) => {
              setIntendedTab(null);
              if (loggedInRole === 'driver') {
                setCurrentTab('driver');
              } else if (loggedInRole === 'admin') {
                setCurrentTab('admin');
              } else {
                setCurrentTab('home');
              }
            }}
          />
        )}
      </main>

      {/* Interactive Inclusivity Modals */}
      <SMSFeaturePhoneSimulator
        isOpen={showSMSModal}
        onClose={() => setShowSMSModal(false)}
      />

      <IVRVoiceSimulator
        isOpen={showIVRModal}
        onClose={() => setShowIVRModal(false)}
      />

      <ReportGrievanceModal
        isOpen={showGrievanceModal}
        onClose={() => setShowGrievanceModal(false)}
      />

      {/* Footer */}
      <footer className="mt-12 bg-white border-t border-slate-200/90 text-slate-600 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-slate-900 text-emerald-400 flex items-center justify-center font-bold text-[10px]">
              TE
            </div>
            <span className="font-bold text-slate-900">TransitEase</span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-500 text-[11px]">
              Municipal Real-Time Public Transport Tracking Platform
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-500">
            <span>Leaflet & OSM</span>
            <span>·</span>
            <span>Socket.IO GPS Telemetry</span>
            <span>·</span>
            <span>2G SMS Gateway</span>
            <span>·</span>
            <span>Bilingual (EN / हिन्दी)</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AccessibilityProvider>
        <SocketProvider>
          <MainContent />
        </SocketProvider>
      </AccessibilityProvider>
    </AuthProvider>
  );
}
