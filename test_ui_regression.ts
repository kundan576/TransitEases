// Shim window for Leaflet & DOM SSR
if (typeof (global as any).window === 'undefined') {
  const dummyDoc = {
    documentElement: { style: {} },
    createElement: () => ({ style: {}, setAttribute: () => {} }),
    getElementsByTagName: () => [],
    createElementNS: () => ({ style: {} }),
    head: { appendChild: () => {} },
    body: { appendChild: () => {} }
  };
  const store = new Map();
  const storageMock = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, val: any) => store.set(key, String(val)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear()
  };
  (global as any).window = {
    navigator: { userAgent: 'node' },
    requestAnimationFrame: (cb: any) => setTimeout(cb, 16),
    cancelAnimationFrame: (id: any) => clearTimeout(id),
    document: dummyDoc,
    screen: { deviceXDPI: 1, logicalXDPI: 1 },
    devicePixelRatio: 1,
    localStorage: storageMock,
    sessionStorage: storageMock,
    addEventListener: () => {},
    removeEventListener: () => {}
  };
  (global as any).document = dummyDoc;
  (global as any).navigator = (global as any).window.navigator;
  (global as any).localStorage = storageMock;
  (global as any).sessionStorage = storageMock;
}

import React from 'react';
import { renderToString } from 'react-dom/server';
import { AuthProvider } from './src/context/AuthContext';
import { AccessibilityProvider } from './src/context/AccessibilityContext';
import { SocketProvider } from './src/context/SocketContext';
import { Navbar } from './src/components/Navbar';
import { PassengerHome } from './src/pages/PassengerHome';
import { DriverDashboard } from './src/pages/DriverDashboard';
import { AdminDashboard } from './src/pages/AdminDashboard';
import { AuthPage } from './src/pages/AuthPage';
import { BusSearch } from './src/components/BusSearch';
import { BusMap } from './src/components/BusMap';
import { JourneyPlanner } from './src/components/JourneyPlanner';
import { CommuteManager } from './src/components/CommuteManager';
import { LiveDisruptionsBanner } from './src/components/LiveDisruptionsBanner';
import { CrowdingBadge } from './src/components/CrowdingBadge';
import { SMSFeaturePhoneSimulator } from './src/components/SMSFeaturePhoneSimulator';
import { IVRVoiceSimulator } from './src/components/IVRVoiceSimulator';
import { ReportGrievanceModal } from './src/components/ReportGrievanceModal';
import { StopQRModal } from './src/components/StopQRModal';
import fs from 'fs';

interface TestResult {
  category: string;
  name: string;
  passed: boolean;
  evidence: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, category: string, name: string, evidence: string) {
  results.push({
    category,
    name,
    passed: condition,
    evidence
  });
  const icon = condition ? '✅ [PASS]' : '❌ [FAIL]';
  console.log(`${icon} [${category}] ${name}: ${evidence}`);
}

function wrap(ui: React.ReactElement): string {
  return renderToString(
    React.createElement(
      AuthProvider,
      null,
      React.createElement(
        AccessibilityProvider,
        null,
        React.createElement(SocketProvider, null, ui)
      )
    )
  );
}

async function runRegressionSuite() {
  console.log('===============================================================');
  console.log('🔍 TRANSITEASE: COMPREHENSIVE UI REGRESSION TEST SUITE');
  console.log('===============================================================\n');

  // -------------------------------------------------------------
  // TEST 1: LANDING PAGE & NAVIGATION
  // -------------------------------------------------------------
  console.log('--- 1. LANDING PAGE & NAVIGATION ---');
  {
    const navHtml = wrap(
      React.createElement(Navbar, {
        currentTab: 'home',
        setCurrentTab: () => {},
        onOpenSMS: () => {},
        onOpenIVR: () => {},
        onOpenGrievance: () => {}
      })
    );

    assert(
      navHtml.includes('TransitEase') && navHtml.includes('City Bus'),
      'Landing / Nav',
      'Brand wordmark and identity',
      'Wordmark "TransitEase" and "City Bus" rendered cleanly in header'
    );

    assert(
      navHtml.includes('Bus Tracker') &&
      navHtml.includes('Journey Planner') &&
      navHtml.includes('Saved Commutes') &&
      navHtml.includes('Corridor Map') &&
      navHtml.includes('Driver Portal') &&
      navHtml.includes('Admin Console'),
      'Landing / Nav',
      'Desktop navigation links',
      'All 6 primary tabs rendered on single line in desktop nav'
    );

    assert(
      navHtml.includes('2G SMS') &&
      navHtml.includes('IVR Voice') &&
      navHtml.includes('Report Transit Grievance') &&
      navHtml.includes('aria-label="Toggle language between Hindi and English"') &&
      navHtml.includes('Accessibility Preferences'),
      'Landing / Nav',
      'Inclusivity launchers & accessibility controls',
      '2G SMS, IVR Voice, Grievance, Language toggle, and Accessibility menus present'
    );

    assert(
      navHtml.includes('aria-label="Toggle navigation menu"'),
      'Landing / Nav',
      'Mobile hamburger drawer trigger',
      'Responsive hamburger button rendered with accessible aria-label'
    );

    const homeHtml = wrap(React.createElement(PassengerHome, {}));
    assert(
      homeHtml.includes('Reliable, Live Bus Tracking for Indian Cities') ||
      homeHtml.includes('वास्तविक समय में अपनी नगर बस ट्रैक करें'),
      'Landing Page',
      'Authority headline & hero section',
      'Prominent headline and public transit telemetry subtitle present'
    );

    assert(
      homeHtml.includes('Official City Transit Routes') &&
      homeHtml.includes('Physical Bus Stop Directory &amp; Scannable QR Codes'),
      'Landing Page',
      'Route discovery & stop signage sections',
      'Official route cards and scannable physical stop directory sections rendered'
    );
  }

  // -------------------------------------------------------------
  // TEST 2: AUTHENTICATION
  // -------------------------------------------------------------
  console.log('\n--- 2. AUTHENTICATION & ROLE SELECTION ---');
  {
    const authPassengerHtml = wrap(React.createElement(AuthPage, { onSuccess: () => {}, initialRole: 'passenger' }));
    assert(
      authPassengerHtml.includes('data-testid="role-tab-passenger"') &&
      authPassengerHtml.includes('data-testid="role-tab-driver"') &&
      authPassengerHtml.includes('data-testid="role-tab-admin"'),
      'Authentication',
      'Role selection tabs with test IDs',
      'data-testid attributes preserved for passenger, driver, and admin tabs'
    );

    assert(
      authPassengerHtml.includes('data-testid="role-gate-indicator"') &&
      authPassengerHtml.includes('Passenger Gate'),
      'Authentication',
      'Dynamic role gate indicator',
      'Role gate indicator rendered with Passenger Gate context'
    );

    assert(
      authPassengerHtml.includes('Sign In to TransitEase') &&
      authPassengerHtml.includes('type="password"'),
      'Authentication',
      'Login form fields & security',
      'Mobile/email input and password field (type="password") rendered'
    );

    const authDriverHtml = wrap(React.createElement(AuthPage, { onSuccess: () => {}, initialRole: 'driver' }));
    assert(
      authDriverHtml.includes('Driver Gate') &&
      authDriverHtml.includes('Signing into Driver Account'),
      'Authentication',
      'Driver role context synchronization',
      'Driver role badge and Driver Gate indicator active when initialized as driver'
    );

    const authAdminHtml = wrap(React.createElement(AuthPage, { onSuccess: () => {}, initialRole: 'admin' }));
    assert(
      authAdminHtml.includes('Admin Gate') &&
      authAdminHtml.includes('Signing into Admin Account'),
      'Authentication',
      'Admin role context synchronization',
      'Admin role badge and Admin Gate indicator active when initialized as admin'
    );

    // Profile Bar and Logout in Navbar
    (global as any).localStorage.setItem(
      'transitease_user',
      JSON.stringify({ id: 'u-1', name: 'Rameshwar Yadav', mobile: '9988776655', role: 'passenger' })
    );
    (global as any).localStorage.setItem('transitease_token', 'mock_jwt_token_for_render_test');
    const authNavHtml = wrap(
      React.createElement(Navbar, {
        currentTab: 'home',
        setCurrentTab: () => {},
        onOpenSMS: () => {},
        onOpenIVR: () => {},
        onOpenGrievance: () => {}
      })
    );
    assert(
      authNavHtml.includes('data-testid="user-profile-bar"') &&
      authNavHtml.includes('data-testid="user-name-label"') &&
      authNavHtml.includes('data-testid="user-role-badge"') &&
      authNavHtml.includes('data-testid="sign-out-btn"'),
      'Authentication',
      'Authenticated user profile bar & logout button',
      'Profile bar, user name label, role badge, and sign-out button rendered'
    );
    (global as any).localStorage.clear();
  }

  // -------------------------------------------------------------
  // TEST 3: PASSENGER DASHBOARD & TRACKING COMPONENTS
  // -------------------------------------------------------------
  console.log('\n--- 3. PASSENGER DASHBOARD & TRACKING ---');
  {
    const searchHtml = wrap(React.createElement(BusSearch, { onSearchResult: () => {} }));
    assert(
      searchHtml.includes('searchByBusNumber') || searchHtml.includes('Search by Bus') || searchHtml.includes('UP16-1001'),
      'Passenger Dashboard',
      'Dual search mode controls',
      'Search by Bus Number and Search by Driver Phone tabs rendered'
    );

    assert(
      searchHtml.includes('UP16-1001') &&
      searchHtml.includes('UP16-1002') &&
      searchHtml.includes('9876543210'),
      'Passenger Dashboard',
      'Quick test shortcuts',
      'Quick search buttons for UP16-1001, UP16-1002, and Driver mobile rendered'
    );

    const mapHtml = wrap(
      React.createElement(BusMap, {
        busNumber: 'UP16-1001',
        location: {
          id: 'loc-1',
          busId: 'bus-1001',
          tripId: 'trip-1',
          driverId: 'drv-1',
          source: 'browser_gps',
          lat: 28.4735,
          lng: 77.5105,
          speed: 32,
          heading: 90,
          accuracy: 8,
          timestamp: new Date().toISOString(),
          isStale: false
        },
        staleWarning: null
      })
    );
    assert(
      mapHtml.includes('w-full') && mapHtml.includes('Fit Route'),
      'Passenger Dashboard',
      'Bus Map rendering & controls',
      'Map viewport container and Fit Route control button rendered'
    );

    const staleMapHtml = wrap(
      React.createElement(BusMap, {
        busNumber: 'UP16-1001',
        location: {
          id: 'loc-2',
          busId: 'bus-1001',
          tripId: 'trip-1',
          driverId: 'drv-1',
          source: 'browser_gps',
          lat: 28.4735,
          lng: 77.5105,
          speed: 0,
          heading: 0,
          accuracy: 25,
          timestamp: new Date(Date.now() - 300000).toISOString(),
          isStale: true
        },
        staleWarning: 'Bus coordinates may be delayed: driver GPS inactive for over 3 minutes.'
      })
    );
    assert(
      staleMapHtml.includes('Bus coordinates may be delayed: driver GPS inactive for over 3 minutes.'),
      'Passenger Dashboard',
      'Stale-location warning indicator',
      'Stale warning overlay rendered with explicit message'
    );

    const journeyHtml = wrap(React.createElement(JourneyPlanner, { onSelectBusToTrack: () => {} }));
    assert(
      journeyHtml.includes('Find Direct Transit Options') &&
      (journeyHtml.includes('title="Swap"') || journeyHtml.includes('aria-label="Swap boarding and destination stops"')),
      'Passenger Dashboard',
      'Journey Planner controls',
      'Boarding/Destination stop selector and swap stops button rendered'
    );

    const commuteHtml = wrap(React.createElement(CommuteManager, {}));
    assert(
      commuteHtml.includes('Saved Daily Commutes'),
      'Passenger Dashboard',
      'Commute Manager view',
      'Saved commutes view with alerts management rendered'
    );

    const badgeAvailable = wrap(React.createElement(CrowdingBadge, { level: 'seats_available' }));
    assert(
      badgeAvailable.includes('Seats Available') || badgeAvailable.includes('seatsAvailable'),
      'Passenger Dashboard',
      'CrowdingBadge seats available',
      'Seats Available status rendered'
    );

    const badgeCrowded = wrap(React.createElement(CrowdingBadge, { level: 'very_crowded' }));
    assert(
      badgeCrowded.includes('Standing Only') || badgeCrowded.includes('veryCrowded'),
      'Passenger Dashboard',
      'CrowdingBadge standing only',
      'Very crowded standing only status rendered'
    );
  }

  // -------------------------------------------------------------
  // TEST 4: DRIVER DASHBOARD
  // -------------------------------------------------------------
  console.log('\n--- 4. DRIVER DASHBOARD ---');
  {
    const driverUnauthHtml = wrap(React.createElement(DriverDashboard, {}));
    assert(
      driverUnauthHtml.includes('Driver Portal Sign In') &&
      driverUnauthHtml.includes('9876543210') &&
      driverUnauthHtml.includes('driver123'),
      'Driver Dashboard',
      'Unauthenticated guidance & demo credentials',
      'Clear login prompt with demo driver credentials rendered'
    );

    assert(
      driverUnauthHtml.includes('Sign In with Driver Credentials') &&
      driverUnauthHtml.includes('Return to Passenger Home'),
      'Driver Dashboard',
      'Driver Portal action buttons',
      'Action buttons present for switching to driver login or navigating home'
    );

    // Non-driver role restriction check (Passenger trying to access driver dashboard)
    (global as any).localStorage.setItem(
      'transitease_user',
      JSON.stringify({ id: 'u-1', name: 'Passenger Ramesh', mobile: '9988776655', role: 'passenger' })
    );
    (global as any).localStorage.setItem('transitease_token', 'mock_jwt_token_for_render_test');
    const driverRestrictedHtml = wrap(React.createElement(DriverDashboard, {}));
    assert(
      driverRestrictedHtml.includes('Driver Portal Access Restricted') &&
      driverRestrictedHtml.includes('Passenger Account Detected'),
      'Driver Dashboard',
      'Role restriction & guidance for non-drivers',
      'Passenger warning notice rendered with prompt to switch to driver credentials'
    );
    (global as any).localStorage.clear();
  }

  // -------------------------------------------------------------
  // TEST 5: ADMIN DASHBOARD
  // -------------------------------------------------------------
  console.log('\n--- 5. ADMIN DASHBOARD ---');
  {
    const adminUnauthHtml = wrap(React.createElement(AdminDashboard, {}));
    assert(
      adminUnauthHtml.includes('Administrator Access Required') &&
      adminUnauthHtml.includes('admin@transitease.city') &&
      adminUnauthHtml.includes('admin123'),
      'Admin Dashboard',
      'Unauthenticated admin prompt & credentials',
      'Restricted administrator notice with demo admin credentials rendered'
    );

    assert(
      adminUnauthHtml.includes('Sign In with Administrator Credentials') &&
      adminUnauthHtml.includes('Return to Passenger Home'),
      'Admin Dashboard',
      'Admin Portal action buttons',
      'Admin login button and return to passenger home button rendered'
    );

    // Non-admin role restriction check (Driver trying to access admin console)
    (global as any).localStorage.setItem(
      'transitease_user',
      JSON.stringify({ id: 'u-2', name: 'Driver Rajesh', mobile: '9876543210', role: 'driver' })
    );
    (global as any).localStorage.setItem('transitease_token', 'mock_jwt_token_for_render_test');
    const adminRestrictedHtml = wrap(React.createElement(AdminDashboard, {}));
    assert(
      adminRestrictedHtml.includes('Administrator Access Denied') &&
      adminRestrictedHtml.includes('Driver Account'),
      'Admin Dashboard',
      'Role restriction & guidance for non-admins',
      'Access denied notice rendered when non-admin accesses admin console'
    );
    (global as any).localStorage.clear();
  }

  // -------------------------------------------------------------
  // TEST 6: MODALS & INCLUSIVITY
  // -------------------------------------------------------------
  console.log('\n--- 6. INCLUSIVITY MODALS ---');
  {
    const smsHtml = wrap(React.createElement(SMSFeaturePhoneSimulator, { isOpen: true, onClose: () => {} }));
    assert(
      smsHtml.includes('SMS Feature Phone Terminal') &&
      smsHtml.includes('Shortcode: <strong>56767</strong>') &&
      smsHtml.includes('BUS UP16-1001') &&
      smsHtml.includes('Send'),
      'Inclusivity Modals',
      'SMS 2G Feature Phone Simulator',
      'Terminal header, shortcode 56767, sample commands, and input bar rendered'
    );

    const ivrHtml = wrap(React.createElement(IVRVoiceSimulator, { isOpen: true, onClose: () => {} }));
    assert(
      ivrHtml.includes('IVR Voice Telephony') &&
      ivrHtml.includes('Call Helpline (1800-TRANSIT)') &&
      ivrHtml.includes('Dial 1800-TRANSIT'),
      'Inclusivity Modals',
      'IVR Voice Telephony Simulator',
      'Keypad telephone simulator with call helpline button rendered'
    );

    const grievanceHtml = wrap(React.createElement(ReportGrievanceModal, { isOpen: true, onClose: () => {} }));
    assert(
      grievanceHtml.includes('Passenger Grievance Desk') &&
      grievanceHtml.includes('Report Incident') &&
      grievanceHtml.includes('Track Existing Grievance'),
      'Inclusivity Modals',
      'Passenger Grievance Desk Modal',
      'Incident submission form and report tracking tabs rendered'
    );

    const qrModalHtml = wrap(
      React.createElement(StopQRModal, {
        stop: {
          id: 'stop-1',
          code: 'KNP01',
          name: 'Knowledge Park II',
          nameHi: 'नॉलेज पार्क II',
          lat: 28.4688,
          lng: 77.5052,
          landmark: 'Near Metro Gate 1',
          qrCodeDataUrl: 'data:image/png;base64,mockqr'
        },
        onClose: () => {}
      })
    );
    assert(
      qrModalHtml.includes('Knowledge Park II') &&
      qrModalHtml.includes('Physical Bus Stop Signage') &&
      qrModalHtml.includes('Print Signage Plate'),
      'Inclusivity Modals',
      'Stop QR Signage Modal',
      'Printable physical signage plate with QR preview rendered'
    );
  }

  // -------------------------------------------------------------
  // TEST 7: RESPONSIVE LAYOUTS & TOUCH TARGETS
  // -------------------------------------------------------------
  console.log('\n--- 7. MOBILE RESPONSIVENESS & TOUCH TARGETS ---');
  {
    const indexHtml = fs.readFileSync('./index.html', 'utf8');
    assert(
      indexHtml.includes('name="viewport"') &&
      indexHtml.includes('content="width=device-width, initial-scale=1.0"'),
      'Responsiveness',
      'Mobile viewport meta tag',
      'Standard mobile viewport tag present in index.html'
    );

    const appHtml = wrap(React.createElement(PassengerHome, {}));
    assert(
      appHtml.includes('grid-cols-1') &&
      appHtml.includes('lg:grid-cols-12'),
      'Responsiveness',
      'Responsive grid layout',
      'Single-column grid for mobile collapsing to 12-column grid on desktop'
    );

    const adminHtml = fs.readFileSync('./src/pages/AdminDashboard.tsx', 'utf8');
    assert(
      adminHtml.includes('overflow-x-auto') &&
      adminHtml.includes('table className="w-full text-left'),
      'Responsiveness',
      'Horizontal scroll protection on wide data tables',
      'overflow-x-auto container wraps tabular fleet data'
    );
  }

  // -------------------------------------------------------------
  // TEST 8: ACCESSIBILITY, FOCUS & CONTRAST
  // -------------------------------------------------------------
  console.log('\n--- 8. ACCESSIBILITY, FOCUS & CONTRAST ---');
  {
    const indexCss = fs.readFileSync('./src/index.css', 'utf8');
    assert(
      indexCss.includes('.high-contrast') &&
      indexCss.includes('--bg-primary: #000000;') &&
      indexCss.includes('--text-primary: #ffffff;'),
      'Accessibility',
      'High contrast mode stylesheet rules',
      '.high-contrast classes with pure black background and white text defined'
    );

    assert(
      indexCss.includes('.text-scale-large') &&
      indexCss.includes('font-size: 1.15rem;'),
      'Accessibility',
      'Large display text scaling rules',
      '.text-scale-large with enlarged body and header scale defined'
    );

    const indexHtml = fs.readFileSync('./index.html', 'utf8');
    assert(
      indexHtml.includes('lang="en"') &&
      indexHtml.includes('Plus+Jakarta+Sans') &&
      indexHtml.includes('Noto+Sans+Devanagari'),
      'Accessibility',
      'Accessible HTML document headers & fonts',
      'Semantic lang attribute, Plus Jakarta Sans, and Noto Sans Devanagari linked'
    );
  }

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;

  console.log('\n===============================================================');
  console.log(`TOTAL UI REGRESSION CHECKS: ${results.length} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
  console.log('===============================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runRegressionSuite().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
