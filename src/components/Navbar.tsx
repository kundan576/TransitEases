import React, { useState } from 'react';
import {
  Bus,
  Smartphone,
  PhoneCall,
  FileText,
  Globe,
  SunMoon,
  LogIn,
  LogOut,
  ShieldCheck,
  Menu,
  X,
  Radio,
  MapPin,
  Route as RouteIcon,
  BookmarkCheck,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { useSocket } from '../context/SocketContext';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenSMS: () => void;
  onOpenIVR: () => void;
  onOpenGrievance: () => void;
  onOpenDriverLogin?: () => void;
  onOpenAdminLogin?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  onOpenSMS,
  onOpenIVR,
  onOpenGrievance,
  onOpenDriverLogin,
  onOpenAdminLogin
}) => {
  const { user, logout } = useAuth();
  const {
    lang,
    setLang,
    highContrast,
    toggleHighContrast,
    fontSize,
    setFontSize,
    lowBandwidthMode,
    setLowBandwidthMode
  } = useAccessibility();
  const { isConnected } = useSocket();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showAccessMenu, setShowAccessMenu] = useState(false);

  const navigateTab = (tab: string) => {
    setCurrentTab(tab);
    setMobileMenuOpen(false);
  };

  const handleDriverClick = () => {
    setMobileMenuOpen(false);
    if (!user) {
      if (onOpenDriverLogin) {
        onOpenDriverLogin();
      } else {
        setCurrentTab('auth');
      }
    } else {
      setCurrentTab('driver');
    }
  };

  const handleAdminClick = () => {
    setMobileMenuOpen(false);
    if (!user) {
      if (onOpenAdminLogin) {
        onOpenAdminLogin();
      } else {
        setCurrentTab('auth');
      }
    } else {
      setCurrentTab('admin');
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Zone 1: Brand Mark & Status */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => navigateTab('home')}
              className="flex items-center gap-2.5 text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-lg p-0.5 cursor-pointer"
              aria-label="TransitEase Home"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-900 text-emerald-400 flex items-center justify-center border border-slate-800 shadow-2xs group-hover:bg-slate-800 transition-colors">
                <Bus className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="font-bold text-base tracking-tight text-slate-900 font-sans">
                    TransitEase
                  </span>
                  <span className="hidden sm:inline-block text-[9px] font-mono font-bold tracking-wider text-slate-600 uppercase">
                    City Bus
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isConnected ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="text-[10px] text-slate-500 font-medium">
                    {isConnected ? 'Live Location Online' : 'Connecting Stream'}
                  </span>
                </div>
              </div>
            </button>
          </div>

          {/* Zone 2: Primary Single-Line Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1 text-xs font-semibold text-slate-600 shrink-0">
            <button
              onClick={() => navigateTab('home')}
              className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                currentTab === 'home'
                  ? 'bg-slate-900 text-white'
                  : 'hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              Bus Tracker
            </button>

            <button
              onClick={() => navigateTab('journey')}
              className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                currentTab === 'journey'
                  ? 'bg-slate-900 text-white'
                  : 'hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              Journey Planner
            </button>

            <button
              onClick={() => navigateTab('commute')}
              className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                currentTab === 'commute'
                  ? 'bg-slate-900 text-white'
                  : 'hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              Saved Commutes
            </button>

            <button
              onClick={() => navigateTab('fleet')}
              className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                currentTab === 'fleet'
                  ? 'bg-slate-900 text-white'
                  : 'hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              Corridor Map
            </button>

            <div className="h-4 w-px bg-slate-200 mx-1" aria-hidden="true" />

            <button
              onClick={handleDriverClick}
              className={`px-2.5 py-1.5 rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'driver'
                  ? 'bg-emerald-800 text-white'
                  : 'text-emerald-800 hover:bg-emerald-50'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Driver Portal</span>
            </button>

            <button
              onClick={handleAdminClick}
              className={`px-2.5 py-1.5 rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'admin'
                  ? 'bg-indigo-800 text-white'
                  : 'text-indigo-800 hover:bg-indigo-50'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin Console</span>
            </button>
          </nav>

          {/* Zone 3: Utility Tools & Auth Session */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Quick Inclusivity Actions (Hidden on tiny screens) */}
            <div className="hidden sm:flex items-center gap-1">
              <button
                onClick={onOpenSMS}
                title="Check bus times by SMS"
                className="px-2 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden md:inline">SMS</span>
              </button>

              <button
                onClick={onOpenIVR}
                title="Call Toll-Free Helpline (1800-TRANSIT)"
                className="px-2 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <PhoneCall className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden md:inline">Call Helpline</span>
              </button>

              <button
                onClick={onOpenGrievance}
                title="Report a problem or delay"
                className="p-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 rounded-md transition-colors cursor-pointer"
                aria-label="Report a problem or delay"
              >
                <FileText className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Bilingual Switcher */}
            <button
              onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
              className="px-2 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              aria-label="Toggle language between Hindi and English"
            >
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              <span>{lang === 'en' ? 'हिन्दी' : 'English'}</span>
            </button>

            {/* Accessibility Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowAccessMenu(!showAccessMenu)}
                className="p-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-md transition-colors cursor-pointer"
                title="Accessibility Preferences"
                aria-label="Accessibility options"
              >
                <SunMoon className="w-3.5 h-3.5" />
              </button>

              {showAccessMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-lg p-3 z-50 text-xs space-y-2">
                  <div className="font-bold text-slate-900 border-b border-slate-100 pb-1.5">
                    Accessibility Preferences
                  </div>

                  <button
                    onClick={toggleHighContrast}
                    className="w-full text-left px-2 py-1.5 rounded-md hover:bg-slate-50 flex items-center justify-between font-medium text-slate-700 cursor-pointer"
                  >
                    <span>High Contrast Mode</span>
                    <span className="text-[10px] font-mono font-bold text-emerald-700">
                      {highContrast ? 'ON' : 'OFF'}
                    </span>
                  </button>

                  <button
                    onClick={() => setFontSize(fontSize === 'normal' ? 'large' : 'normal')}
                    className="w-full text-left px-2 py-1.5 rounded-md hover:bg-slate-50 flex items-center justify-between font-medium text-slate-700 cursor-pointer"
                  >
                    <span>Large Display Text</span>
                    <span className="text-[10px] font-mono font-bold text-emerald-700">
                      {fontSize === 'large' ? 'Large' : 'Normal'}
                    </span>
                  </button>

                  <button
                    onClick={() => setLowBandwidthMode(prev => !prev)}
                    className="w-full text-left px-2 py-1.5 rounded-md hover:bg-slate-50 flex items-center justify-between font-medium text-slate-700 cursor-pointer"
                  >
                    <span>Low-Bandwidth Mode</span>
                    <span className="text-[10px] font-mono font-bold text-emerald-700">
                      {lowBandwidthMode ? 'ON' : 'OFF'}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Auth Session Section */}
            {user ? (
              <div className="flex items-center gap-1.5 pl-1" data-testid="user-profile-bar">
                <div className="hidden sm:flex flex-col text-right leading-tight">
                  <span
                    className="text-xs font-bold text-slate-900 max-w-[110px] truncate"
                    data-testid="user-name-label"
                  >
                    {user.name}
                  </span>
                  <span
                    className="text-[10px] font-mono uppercase tracking-wider text-slate-500"
                    data-testid="user-role-badge"
                  >
                    {user.role}
                  </span>
                </div>
                <button
                  onClick={logout}
                  title="Sign Out"
                  className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-md transition-colors cursor-pointer"
                  data-testid="sign-out-btn"
                  aria-label="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => navigateTab('auth')}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors cursor-pointer ml-1"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-3 shadow-lg">
          <div className="grid grid-cols-2 gap-2 text-xs font-medium">
            <button
              onClick={() => navigateTab('home')}
              className={`p-2.5 rounded-md text-left flex items-center gap-2 cursor-pointer ${
                currentTab === 'home'
                  ? 'bg-slate-900 text-white font-bold'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Bus className="w-3.5 h-3.5" />
              <span>Bus Tracker</span>
            </button>

            <button
              onClick={() => navigateTab('journey')}
              className={`p-2.5 rounded-md text-left flex items-center gap-2 cursor-pointer ${
                currentTab === 'journey'
                  ? 'bg-slate-900 text-white font-bold'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <RouteIcon className="w-3.5 h-3.5" />
              <span>Journey Planner</span>
            </button>

            <button
              onClick={() => navigateTab('commute')}
              className={`p-2.5 rounded-md text-left flex items-center gap-2 cursor-pointer ${
                currentTab === 'commute'
                  ? 'bg-slate-900 text-white font-bold'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <BookmarkCheck className="w-3.5 h-3.5" />
              <span>Saved Commutes</span>
            </button>

            <button
              onClick={() => navigateTab('fleet')}
              className={`p-2.5 rounded-md text-left flex items-center gap-2 cursor-pointer ${
                currentTab === 'fleet'
                  ? 'bg-slate-900 text-white font-bold'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Corridor Map</span>
            </button>
          </div>

          <div className="border-t border-slate-100 pt-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Staff & Operations Portals
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={handleDriverClick}
                className="p-2.5 bg-emerald-50 text-emerald-800 rounded-md text-left font-semibold flex items-center gap-2 border border-emerald-200/80 cursor-pointer"
              >
                <Radio className="w-3.5 h-3.5 text-emerald-700" />
                <span>Driver Portal</span>
              </button>

              <button
                onClick={handleAdminClick}
                className="p-2.5 bg-indigo-50 text-indigo-800 rounded-md text-left font-semibold flex items-center gap-2 border border-indigo-200/80 cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-700" />
                <span>Admin Console</span>
              </button>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Quick Help
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenSMS();
                }}
                className="flex-1 py-2 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5 text-slate-600" />
                <span>SMS</span>
              </button>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenIVR();
                }}
                className="flex-1 py-2 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <PhoneCall className="w-3.5 h-3.5 text-slate-600" />
                <span>Call Helpline</span>
              </button>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenGrievance();
                }}
                className="py-2 px-2.5 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Report Issue</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
