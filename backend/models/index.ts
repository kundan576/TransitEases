import mongoose, { Schema, Document } from 'mongoose';
import {
  User,
  BusStop,
  Route,
  Bus,
  Trip,
  BusLocation,
  SavedCommute,
  SMSSubscription,
  SMSMessageLog,
  ServiceAnnouncement,
  PassengerReport
} from '../types.js';

const toJSONTransform = {
  transform: (_: any, ret: any) => {
    if (ret._id) {
      ret.id = ret._id.toString();
      delete ret._id;
    }
    delete ret.__v;
    return ret;
  }
};

// --- User Schema ---
export interface IUserDocument extends Omit<User, 'id'>, Document {}
const UserSchema = new Schema<IUserDocument>({
  name: { type: String, required: true, trim: true },
  mobile: { type: String, required: true, unique: true, index: true },
  email: { type: String, trim: true, lowercase: true, sparse: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['passenger', 'driver', 'admin'], default: 'passenger', required: true },
  driverStatus: { type: String, enum: ['pending', 'approved', 'rejected'] },
  licenseNumber: { type: String, trim: true },
  assignedBusId: { type: String, default: null },
  language: { type: String, enum: ['en', 'hi'], default: 'en' },
  createdAt: { type: String, default: () => new Date().toISOString() }
}, { toJSON: toJSONTransform });

// --- BusStop Schema ---
export interface IBusStopDocument extends Omit<BusStop, 'id'>, Document {}
const BusStopSchema = new Schema<IBusStopDocument>({
  code: { type: String, required: true, unique: true, index: true, uppercase: true },
  name: { type: String, required: true, trim: true },
  nameHi: { type: String, required: true, trim: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  landmark: { type: String, trim: true },
  qrCodeDataUrl: { type: String }
}, { toJSON: toJSONTransform });

// --- Route Schema ---
export interface IRouteDocument extends Omit<Route, 'id'>, Document {}
const RouteSchema = new Schema<IRouteDocument>({
  routeNumber: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  nameHi: { type: String, required: true, trim: true },
  startStopId: { type: String, required: true },
  endStopId: { type: String, required: true },
  stops: [{
    stopId: { type: String, required: true },
    order: { type: Number, required: true },
    distanceKm: { type: Number, required: true },
    avgTimeMins: { type: Number, required: true }
  }],
  polylineCoords: { type: [[Number]], default: [] },
  fareBase: { type: Number, default: 10 },
  farePerKm: { type: Number, default: 2.0 },
  active: { type: Boolean, default: true }
}, { toJSON: toJSONTransform });

// --- Bus Schema ---
export interface IBusDocument extends Omit<Bus, 'id'>, Document {}
const BusSchema = new Schema<IBusDocument>({
  busNumber: { type: String, required: true, unique: true, index: true, uppercase: true },
  registrationNumber: { type: String, required: true, uppercase: true },
  capacity: { type: Number, default: 40 },
  currentRouteId: { type: String, default: null },
  assignedDriverId: { type: String, default: null },
  status: { type: String, enum: ['in_service', 'maintenance', 'out_of_service'], default: 'in_service' },
  crowdLevel: { type: String, enum: ['seats_available', 'moderately_crowded', 'very_crowded'], default: 'seats_available' },
  crowdUpdatedAt: { type: String, default: () => new Date().toISOString() }
}, { toJSON: toJSONTransform });

// --- Trip Schema ---
export interface ITripDocument extends Omit<Trip, 'id'>, Document {}
const TripSchema = new Schema<ITripDocument>({
  tripNumber: { type: String, required: true, unique: true, index: true },
  busId: { type: String, required: true, index: true },
  driverId: { type: String, required: true, index: true },
  routeId: { type: String, required: true, index: true },
  status: { type: String, enum: ['scheduled', 'in_progress', 'completed', 'cancelled'], default: 'scheduled' },
  startTime: { type: String, default: () => new Date().toISOString() },
  endTime: { type: String },
  currentStopIndex: { type: Number, default: 0 },
  delayMinutes: { type: Number, default: 0 }
}, { toJSON: toJSONTransform });

// --- BusLocation Schema ---
export interface IBusLocationDocument extends Omit<BusLocation, 'id'>, Document {}
const BusLocationSchema = new Schema<IBusLocationDocument>({
  tripId: { type: String, required: true, index: true },
  busId: { type: String, required: true, index: true },
  driverId: { type: String, required: true, index: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  speed: { type: Number, default: 0 },
  heading: { type: Number, default: 0 },
  accuracy: { type: Number, default: 10 },
  timestamp: { type: String, default: () => new Date().toISOString(), index: true },
  source: { type: String, enum: ['browser_gps', 'simulator'], default: 'browser_gps' }
}, { toJSON: toJSONTransform });

// --- SavedCommute Schema ---
export interface ISavedCommuteDocument extends Omit<SavedCommute, 'id'>, Document {}
const SavedCommuteSchema = new Schema<ISavedCommuteDocument>({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  busId: { type: String },
  routeId: { type: String, required: true },
  boardingStopId: { type: String, required: true },
  destinationStopId: { type: String, required: true },
  departureTime: { type: String, default: '08:30' },
  thresholdMinutes: { type: Number, default: 10 },
  notificationChannel: { type: String, enum: ['sms', 'push', 'both'], default: 'both' },
  phone: { type: String, required: true },
  active: { type: Boolean, default: true },
  lastAlertSentAt: { type: String }
}, { toJSON: toJSONTransform });

// --- SMSSubscription Schema ---
export interface ISMSSubscriptionDocument extends Omit<SMSSubscription, 'id'>, Document {}
const SMSSubscriptionSchema = new Schema<ISMSSubscriptionDocument>({
  mobile: { type: String, required: true, index: true },
  consent: { type: Boolean, default: true },
  language: { type: String, enum: ['en', 'hi'], default: 'en' },
  busId: { type: String },
  stopId: { type: String },
  thresholdMinutes: { type: Number, default: 10 },
  active: { type: Boolean, default: true },
  subscribedAt: { type: String, default: () => new Date().toISOString() }
});

// --- SMSMessageLog Schema ---
export interface ISMSMessageLogDocument extends Omit<SMSMessageLog, 'id'>, Document {}
const SMSMessageLogSchema = new Schema<ISMSMessageLogDocument>({
  mobile: { type: String, required: true, index: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['outbound_alert', 'inbound_command', 'reply_command'], required: true },
  status: { type: String, enum: ['delivered', 'sent', 'failed', 'simulated'], default: 'simulated' },
  provider: { type: String, default: 'simulator' },
  command: { type: String },
  timestamp: { type: String, default: () => new Date().toISOString() }
});

// --- ServiceAnnouncement Schema ---
export interface IServiceAnnouncementDocument extends Omit<ServiceAnnouncement, 'id'>, Document {}
const ServiceAnnouncementSchema = new Schema<IServiceAnnouncementDocument>({
  title: { type: String, required: true },
  titleHi: { type: String, required: true },
  message: { type: String, required: true },
  messageHi: { type: String, required: true },
  type: { type: String, enum: ['delay', 'diversion', 'cancellation', 'info'], default: 'delay' },
  affectedRouteIds: { type: [String], default: [] },
  active: { type: Boolean, default: true },
  createdAt: { type: String, default: () => new Date().toISOString() },
  createdBy: { type: String, default: 'Administrator' }
});

// --- PassengerReport Schema ---
export interface IPassengerReportDocument extends Omit<PassengerReport, 'id'>, Document {}
const PassengerReportSchema = new Schema<IPassengerReportDocument>({
  referenceNumber: { type: String, required: true, unique: true, index: true },
  passengerName: { type: String, default: 'Anonymous Passenger' },
  passengerMobile: { type: String },
  busId: { type: String },
  routeId: { type: String },
  category: {
    type: String,
    enum: ['incorrect_location', 'missed_stop', 'unsafe_driving', 'accessibility', 'cleanliness', 'other'],
    required: true
  },
  description: { type: String, required: true },
  status: { type: String, enum: ['pending', 'under_review', 'resolved'], default: 'pending' },
  resolutionNotes: { type: String },
  createdAt: { type: String, default: () => new Date().toISOString() }
});

// Model instantiations
export const UserModel = mongoose.models.User || mongoose.model<IUserDocument>('User', UserSchema);
export const BusStopModel = mongoose.models.BusStop || mongoose.model<IBusStopDocument>('BusStop', BusStopSchema);
export const RouteModel = mongoose.models.Route || mongoose.model<IRouteDocument>('Route', RouteSchema);
export const BusModel = mongoose.models.Bus || mongoose.model<IBusDocument>('Bus', BusSchema);
export const TripModel = mongoose.models.Trip || mongoose.model<ITripDocument>('Trip', TripSchema);
export const BusLocationModel = mongoose.models.BusLocation || mongoose.model<IBusLocationDocument>('BusLocation', BusLocationSchema);
export const SavedCommuteModel = mongoose.models.SavedCommute || mongoose.model<ISavedCommuteDocument>('SavedCommute', SavedCommuteSchema);
export const SMSSubscriptionModel = mongoose.models.SMSSubscription || mongoose.model<ISMSSubscriptionDocument>('SMSSubscription', SMSSubscriptionSchema);
export const SMSMessageLogModel = mongoose.models.SMSMessageLog || mongoose.model<ISMSMessageLogDocument>('SMSMessageLog', SMSMessageLogSchema);
export const ServiceAnnouncementModel = mongoose.models.ServiceAnnouncement || mongoose.model<IServiceAnnouncementDocument>('ServiceAnnouncement', ServiceAnnouncementSchema);
export const PassengerReportModel = mongoose.models.PassengerReport || mongoose.model<IPassengerReportDocument>('PassengerReport', PassengerReportSchema);
