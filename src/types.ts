export type UserRole = 'passenger' | 'driver' | 'admin';
export type DriverStatus = 'pending' | 'approved' | 'rejected';
export type BusStatus = 'in_service' | 'maintenance' | 'out_of_service';
export type TripStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type CrowdLevel = 'seats_available' | 'moderately_crowded' | 'very_crowded';

export function getRoleMismatchMessage(actualRole: string, expectedRole?: string): string {
  if (actualRole === 'passenger') {
    return 'This account is registered as a passenger. Please use Passenger login.';
  }
  if (actualRole === 'driver') {
    return 'This account is registered as a driver. Please use Driver login.';
  }
  if (actualRole === 'admin') {
    return 'This account is registered as an administrator. Please use Admin login.';
  }
  return `This account is registered as a ${actualRole}. Please use the appropriate login portal.`;
}

export interface User {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  role: UserRole;
  driverStatus?: DriverStatus;
  licenseNumber?: string;
  assignedBusId?: string | null;
  assignedBus?: Bus | null;
  language?: 'en' | 'hi';
}

export interface BusStop {
  id: string;
  code: string;
  name: string;
  nameHi: string;
  lat: number;
  lng: number;
  landmark?: string;
  qrCodeDataUrl?: string;
}

export interface RouteStopItem {
  stopId: string;
  order: number;
  distanceKm: number;
  avgTimeMins: number;
  stopName?: string;
  stopNameHi?: string;
  stopCode?: string;
}

export interface Route {
  id: string;
  routeNumber: string;
  name: string;
  nameHi: string;
  startStopId: string;
  endStopId: string;
  stops: RouteStopItem[];
  polylineCoords: [number, number][];
  fareBase: number;
  farePerKm: number;
  active: boolean;
}

export interface Bus {
  id: string;
  busNumber: string;
  registrationNumber: string;
  capacity: number;
  currentRouteId?: string | null;
  assignedDriverId?: string | null;
  status: BusStatus;
  crowdLevel: CrowdLevel;
  crowdUpdatedAt?: string;
}

export interface BusLocation {
  id: string;
  tripId: string;
  busId: string;
  driverId: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  accuracy: number;
  timestamp: string;
  isStale?: boolean;
  source: 'browser_gps' | 'simulator';
}

export interface StopETA {
  stop: BusStop;
  order: number;
  distanceKm: number;
  estimatedMinutes: number;
  estimatedArrivalTime: string;
  isPassed: boolean;
}

export interface SavedCommute {
  id: string;
  userId: string;
  name: string;
  busId?: string;
  routeId: string;
  boardingStopId: string;
  destinationStopId: string;
  departureTime: string;
  thresholdMinutes: number;
  notificationChannel: 'sms' | 'push' | 'both';
  phone: string;
  active: boolean;
  lastAlertSentAt?: string;
  route?: Route | null;
  bus?: Bus | null;
  boardingStop?: BusStop | null;
  destinationStop?: BusStop | null;
}

export interface ServiceAnnouncement {
  id: string;
  title: string;
  titleHi: string;
  message: string;
  messageHi: string;
  type: 'delay' | 'diversion' | 'cancellation' | 'info';
  affectedRouteIds: string[];
  active: boolean;
  createdAt: string;
  createdBy: string;
}

export interface PassengerReport {
  id: string;
  referenceNumber: string;
  passengerName?: string;
  passengerMobile?: string;
  busId?: string;
  routeId?: string;
  category: string;
  description: string;
  status: 'pending' | 'under_review' | 'resolved';
  resolutionNotes?: string;
  createdAt: string;
}

export interface SMSMessageLog {
  id: string;
  mobile: string;
  message: string;
  type: 'outbound_alert' | 'inbound_command' | 'reply_command';
  status: 'delivered' | 'sent' | 'failed' | 'simulated';
  provider: string;
  command?: string;
  timestamp: string;
}
