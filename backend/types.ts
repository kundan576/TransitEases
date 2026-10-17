export type UserRole = 'passenger' | 'driver' | 'admin';
export type DriverStatus = 'pending' | 'approved' | 'rejected';
export type BusStatus = 'in_service' | 'maintenance' | 'out_of_service';
export type TripStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type CrowdLevel = 'seats_available' | 'moderately_crowded' | 'very_crowded';

export interface User {
  id: string;
  name: string;
  mobile: string; // Normalized: 10 digits or E.164
  email?: string;
  password: string;
  role: UserRole;
  driverStatus?: DriverStatus;
  licenseNumber?: string;
  assignedBusId?: string | null;
  language?: 'en' | 'hi';
  createdAt: string;
}

export interface BusStop {
  id: string;
  code: string; // e.g. "KNP01"
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
}

export interface Route {
  id: string;
  routeNumber: string; // e.g. "101"
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
  busNumber: string; // e.g. "UP16-1001"
  registrationNumber: string;
  capacity: number;
  currentRouteId?: string | null;
  assignedDriverId?: string | null;
  status: BusStatus;
  crowdLevel: CrowdLevel;
  crowdUpdatedAt?: string;
}

export interface Trip {
  id: string;
  tripNumber: string;
  busId: string;
  driverId: string;
  routeId: string;
  status: TripStatus;
  startTime: string;
  endTime?: string;
  currentStopIndex: number;
  delayMinutes: number;
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
  source: 'browser_gps' | 'simulator';
}

export interface SavedCommute {
  id: string;
  userId: string;
  name: string;
  busId?: string;
  routeId: string;
  boardingStopId: string;
  destinationStopId: string;
  departureTime: string; // HH:mm
  thresholdMinutes: number; // 5, 10, 15
  notificationChannel: 'sms' | 'push' | 'both';
  phone: string;
  active: boolean;
  lastAlertSentAt?: string;
}

export interface SMSSubscription {
  id: string;
  mobile: string;
  consent: boolean;
  language: 'en' | 'hi';
  busId?: string;
  stopId?: string;
  thresholdMinutes: number;
  active: boolean;
  subscribedAt: string;
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
  category: 'incorrect_location' | 'missed_stop' | 'unsafe_driving' | 'accessibility' | 'cleanliness' | 'other';
  description: string;
  status: 'pending' | 'under_review' | 'resolved';
  resolutionNotes?: string;
  createdAt: string;
}
