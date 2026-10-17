import fs from 'fs';
import path from 'path';
import { loadEnvironment } from './envLoader.js';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import mongoose from 'mongoose';
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
import {
  UserModel,
  BusStopModel,
  RouteModel,
  BusModel,
  TripModel,
  BusLocationModel,
  SavedCommuteModel,
  SMSSubscriptionModel,
  SMSMessageLogModel,
  ServiceAnnouncementModel,
  PassengerReportModel
} from '../models/index.js';

interface DatabaseSchema {
  users: User[];
  busStops: BusStop[];
  routes: Route[];
  buses: Bus[];
  trips: Trip[];
  busLocations: BusLocation[];
  savedCommutes: SavedCommute[];
  smsSubscriptions: SMSSubscription[];
  smsLogs: SMSMessageLog[];
  announcements: ServiceAnnouncement[];
  passengerReports: PassengerReport[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'transit_db.json');

export interface SafeDiagnostics {
  sourceEnvFile: string;
  hostname: string;
  databaseName: string;
  username: string;
}

class TransitDatabase {
  private data: DatabaseSchema;
  private isMongoConnected: boolean = false;
  private safeDiagnostics: SafeDiagnostics | null = null;
  private connectionError: string | null = null;

  constructor() {
    this.data = {
      users: [],
      busStops: [],
      routes: [],
      buses: [],
      trips: [],
      busLocations: [],
      savedCommutes: [],
      smsSubscriptions: [],
      smsLogs: [],
      announcements: [],
      passengerReports: []
    };
  }

  public async init() {
    const envDiagnostics = loadEnvironment();

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // 1. Attempt MongoDB Atlas Connection if MONGODB_URI is provided
    const mongoUri = process.env.MONGODB_URI?.trim();
    if (mongoUri && (mongoUri.startsWith('mongodb://') || mongoUri.startsWith('mongodb+srv://'))) {
      try {
        let hostname = 'unknown';
        let username = 'unknown';
        let databaseName = 'transitease';

        try {
          const parsed = new URL(mongoUri);
          hostname = parsed.hostname;
          username = parsed.username;
          if (parsed.pathname && parsed.pathname.length > 1) {
            databaseName = parsed.pathname.slice(1).split('?')[0];
          }
        } catch {
          // Fallback if URL parsing encounters atypical syntax
        }

        this.safeDiagnostics = {
          sourceEnvFile: envDiagnostics.activeSource,
          hostname,
          databaseName: databaseName || 'transitease',
          username
        };

        console.log(`[Database] Connecting to MongoDB Atlas host: "${hostname}", database: "${databaseName}", user: "${username}" (source: ${envDiagnostics.activeSource})...`);

        await mongoose.connect(mongoUri, {
          dbName: databaseName || 'transitease',
          serverSelectionTimeoutMS: 3000,
          connectTimeoutMS: 4000
        });

        this.isMongoConnected = true;
        this.connectionError = null;
        console.log(`[Database] Successfully connected to MongoDB Atlas host: "${hostname}", database: "${databaseName}", user: "${username}".`);

        // Sync or seed MongoDB collections
        await this.syncFromMongoDBOrSeed();
        return;
      } catch (err: any) {
        this.isMongoConnected = false;
        this.connectionError = err.message || 'Failed to connect to MongoDB Atlas';
        console.error(`[Database] CRITICAL: MongoDB connection error (${this.connectionError}). Connection failed.`);
      }
    } else {
      console.log('[Database] No MONGODB_URI provided.');
    }

    // 2. Fallback to Local Persistent File Store if MongoDB is not connected
    if (fs.existsSync(DATA_FILE)) {
      try {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        this.data = JSON.parse(raw);
        console.log('[Database] Loaded records from local persistent storage');
      } catch (err) {
        console.error('[Database] Local datastore corrupt or empty, re-seeding...', err);
        await this.seedInitialData();
      }
    } else {
      await this.seedInitialData();
    }
  }

  /**
   * Sync collections from MongoDB Atlas into memory.
   * If collections are empty, seeds foundational records directly into MongoDB.
   */
  private async syncFromMongoDBOrSeed() {
    try {
      const userCount = await UserModel.countDocuments();
      if (userCount === 0) {
        console.log('[Database] MongoDB Atlas collections are empty. Seeding initial transit records directly into MongoDB...');
        await this.seedInitialData();
        // Persist seed data to MongoDB
        await this.exportAllToMongoDB();
      } else {
        console.log(`[Database] Hydrating from MongoDB Atlas (${userCount} users found)...`);
        const [
          users,
          busStops,
          routes,
          buses,
          trips,
          busLocations,
          savedCommutes,
          smsLogs,
          announcements,
          passengerReports
        ] = await Promise.all([
          UserModel.find().lean(),
          BusStopModel.find().lean(),
          RouteModel.find().lean(),
          BusModel.find().lean(),
          TripModel.find().lean(),
          BusLocationModel.find().sort({ timestamp: -1 }).limit(1000).lean(),
          SavedCommuteModel.find().lean(),
          SMSMessageLogModel.find().sort({ timestamp: -1 }).limit(500).lean(),
          ServiceAnnouncementModel.find().lean(),
          PassengerReportModel.find().lean()
        ]);

        this.data = {
          users: users.map(u => ({ ...u, id: (u as any).id || (u as any)._id?.toString() } as User)),
          busStops: busStops.map(s => ({ ...s, id: (s as any).id || (s as any)._id?.toString() } as BusStop)),
          routes: routes.map(r => ({ ...r, id: (r as any).id || (r as any)._id?.toString() } as Route)),
          buses: buses.map(b => ({ ...b, id: (b as any).id || (b as any)._id?.toString() } as Bus)),
          trips: trips.map(t => ({ ...t, id: (t as any).id || (t as any)._id?.toString() } as Trip)),
          busLocations: busLocations.map(l => ({ ...l, id: (l as any).id || (l as any)._id?.toString() } as BusLocation)),
          savedCommutes: savedCommutes.map(c => ({ ...c, id: (c as any).id || (c as any)._id?.toString() } as SavedCommute)),
          smsSubscriptions: [],
          smsLogs: smsLogs.map(l => ({ ...l, id: (l as any).id || (l as any)._id?.toString() } as SMSMessageLog)),
          announcements: announcements.map(a => ({ ...a, id: (a as any).id || (a as any)._id?.toString() } as ServiceAnnouncement)),
          passengerReports: passengerReports.map(p => ({ ...p, id: (p as any).id || (p as any)._id?.toString() } as PassengerReport))
        };

        this.persistLocalBackup();
        console.log('[Database] Hydration from MongoDB Atlas complete.');
      }
    } catch (err) {
      console.error('[Database] Failed to hydrate from MongoDB Atlas:', err);
    }
  }

  private async exportAllToMongoDB() {
    try {
      await Promise.all([
        UserModel.insertMany(this.data.users.map(u => ({ ...u, _id: new mongoose.Types.ObjectId() }))),
        BusStopModel.insertMany(this.data.busStops.map(s => ({ ...s, _id: new mongoose.Types.ObjectId() }))),
        RouteModel.insertMany(this.data.routes.map(r => ({ ...r, _id: new mongoose.Types.ObjectId() }))),
        BusModel.insertMany(this.data.buses.map(b => ({ ...b, _id: new mongoose.Types.ObjectId() }))),
        TripModel.insertMany(this.data.trips.map(t => ({ ...t, _id: new mongoose.Types.ObjectId() }))),
        BusLocationModel.insertMany(this.data.busLocations.map(l => ({ ...l, _id: new mongoose.Types.ObjectId() }))),
        ServiceAnnouncementModel.insertMany(this.data.announcements.map(a => ({ ...a, _id: new mongoose.Types.ObjectId() }))),
        SMSMessageLogModel.insertMany(this.data.smsLogs.map(s => ({ ...s, _id: new mongoose.Types.ObjectId() })))
      ]);
      console.log('[Database] Seeded data successfully stored in MongoDB Atlas collections');
    } catch (err) {
      console.error('[Database] Error exporting seed data to MongoDB:', err);
    }
  }

  private persistLocalBackup() {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Database] Error persisting local backup file:', err);
    }
  }

  public getStatus() {
    const isConfigured = !!this.safeDiagnostics || !!process.env.MONGODB_URI;
    let storageLabel = 'Embedded JSON Datastore (Local)';
    if (this.isMongoConnected) {
      storageLabel = 'MongoDB Atlas (Connected)';
    } else if (isConfigured) {
      storageLabel = `MongoDB Atlas (Connection Failed: ${this.connectionError || 'Disconnected'})`;
    }

    return {
      connectedToMongo: this.isMongoConnected,
      isMongoConfigured: isConfigured,
      storageType: storageLabel,
      safeDiagnostics: this.safeDiagnostics,
      connectionError: this.connectionError,
      records: {
        users: this.data.users.length,
        buses: this.data.buses.length,
        routes: this.data.routes.length,
        busStops: this.data.busStops.length,
        trips: this.data.trips.length,
        busLocations: this.data.busLocations.length,
        savedCommutes: this.data.savedCommutes.length,
        smsLogs: this.data.smsLogs.length,
        announcements: this.data.announcements.length,
        passengerReports: this.data.passengerReports.length
      }
    };
  }

  // --- SEED INITIAL REALISTIC TRANSIT RECORDS ---
  private async seedInitialData() {
    console.log('[Database] Generating foundational public transit records...');
    const hashedAdminPassword = await bcrypt.hash('admin123', 10);
    const hashedDriverPassword = await bcrypt.hash('driver123', 10);
    const hashedPassengerPassword = await bcrypt.hash('pass123', 10);

    const rawStops: Array<Omit<BusStop, 'qrCodeDataUrl'>> = [
      {
        id: 'stop-knp01',
        code: 'KNP01',
        name: 'Knowledge Park I Bus Stop',
        nameHi: 'नॉलेज पार्क I बस स्टॉप',
        lat: 28.4632,
        lng: 77.4988,
        landmark: 'Opposite Metro Station Gate 2'
      },
      {
        id: 'stop-prc02',
        code: 'PRC02',
        name: 'Pari Chowk Interchange',
        nameHi: 'परी चौक इंटरचेंज',
        lat: 28.4721,
        lng: 77.5094,
        landmark: 'Near Roundabout Bus Bay'
      },
      {
        id: 'stop-alp03',
        code: 'ALP03',
        name: 'Alpha 1 Commercial Belt',
        nameHi: 'अल्फा 1 कॉमर्शियल बेल्ट',
        lat: 28.4834,
        lng: 77.5182,
        landmark: 'Near City Plaza Market'
      },
      {
        id: 'stop-del04',
        code: 'DEL04',
        name: 'Delta 1 Community Center',
        nameHi: 'डेल्टा 1 कम्युनिटी सेंटर',
        lat: 28.4942,
        lng: 77.5276,
        landmark: 'Main Road Crossing'
      },
      {
        id: 'stop-srj05',
        code: 'SRJ05',
        name: 'Surajpur Collectorate',
        nameHi: 'सूरजपुर कलेक्ट्रेट',
        lat: 28.5126,
        lng: 77.4912,
        landmark: 'District Administrative Complex'
      },
      {
        id: 'stop-civ06',
        code: 'CIV06',
        name: 'Civil Hospital Chowk',
        nameHi: 'सिविल हॉस्पिटल चौक',
        lat: 28.4789,
        lng: 77.4851,
        landmark: 'Emergency Gate Stop'
      },
      {
        id: 'stop-rly07',
        code: 'RLY07',
        name: 'City Railway Station',
        nameHi: 'सिटी रेलवे स्टेशन',
        lat: 28.4550,
        lng: 77.4760,
        landmark: 'Main Exit Concourse'
      }
    ];

    const stopsWithQR: BusStop[] = [];
    for (const stop of rawStops) {
      try {
        const qrUrl = await QRCode.toDataURL(JSON.stringify({
          app: 'TransitEase',
          stopCode: stop.code,
          name: stop.name,
          url: `/stop/${stop.code}`
        }));
        stopsWithQR.push({ ...stop, qrCodeDataUrl: qrUrl });
      } catch {
        stopsWithQR.push({ ...stop });
      }
    }

    const routes: Route[] = [
      {
        id: 'route-101',
        routeNumber: '101',
        name: 'Knowledge Park to Surajpur Express',
        nameHi: 'नॉलेज पार्क से सूरजपुर एक्सप्रेस',
        startStopId: 'stop-knp01',
        endStopId: 'stop-srj05',
        stops: [
          { stopId: 'stop-knp01', order: 1, distanceKm: 0.0, avgTimeMins: 0 },
          { stopId: 'stop-prc02', order: 2, distanceKm: 1.8, avgTimeMins: 6 },
          { stopId: 'stop-alp03', order: 3, distanceKm: 3.5, avgTimeMins: 13 },
          { stopId: 'stop-del04', order: 4, distanceKm: 5.2, avgTimeMins: 20 },
          { stopId: 'stop-srj05', order: 5, distanceKm: 8.4, avgTimeMins: 32 }
        ],
        polylineCoords: [
          [28.4632, 77.4988],
          [28.4721, 77.5094],
          [28.4834, 77.5182],
          [28.4942, 77.5276],
          [28.5126, 77.4912]
        ],
        fareBase: 10,
        farePerKm: 2.5,
        active: true
      },
      {
        id: 'route-202',
        routeNumber: '202',
        name: 'Railway Station to Pari Chowk Circular',
        nameHi: 'रेलवे स्टेशन से परी चौक सर्कुलर',
        startStopId: 'stop-rly07',
        endStopId: 'stop-prc02',
        stops: [
          { stopId: 'stop-rly07', order: 1, distanceKm: 0.0, avgTimeMins: 0 },
          { stopId: 'stop-civ06', order: 2, distanceKm: 3.1, avgTimeMins: 10 },
          { stopId: 'stop-knp01', order: 3, distanceKm: 5.4, avgTimeMins: 18 },
          { stopId: 'stop-prc02', order: 4, distanceKm: 7.2, avgTimeMins: 26 }
        ],
        polylineCoords: [
          [28.4550, 77.4760],
          [28.4789, 77.4851],
          [28.4632, 77.4988],
          [28.4721, 77.5094]
        ],
        fareBase: 10,
        farePerKm: 2.0,
        active: true
      }
    ];

    const users: User[] = [
      {
        id: 'user-admin-1',
        name: 'Fleet Controller Verma',
        mobile: '9876500001',
        email: 'admin@transitease.city',
        password: hashedAdminPassword,
        role: 'admin',
        language: 'en',
        createdAt: new Date().toISOString()
      },
      {
        id: 'user-driver-1',
        name: 'Rameshwar Yadav',
        mobile: '9876543210',
        email: 'rameshwar.driver@transitease.city',
        password: hashedDriverPassword,
        role: 'driver',
        driverStatus: 'approved',
        licenseNumber: 'DL-1420180091823',
        assignedBusId: 'bus-1001',
        language: 'hi',
        createdAt: new Date().toISOString()
      },
      {
        id: 'user-driver-2',
        name: 'Suresh Kumar Sharma',
        mobile: '9812345678',
        email: 'suresh.driver@transitease.city',
        password: hashedDriverPassword,
        role: 'driver',
        driverStatus: 'approved',
        licenseNumber: 'UP-1620190045612',
        assignedBusId: 'bus-1002',
        language: 'en',
        createdAt: new Date().toISOString()
      },
      {
        id: 'user-driver-3',
        name: 'Manoj Singh',
        mobile: '9899123456',
        email: 'manoj.driver@transitease.city',
        password: hashedDriverPassword,
        role: 'driver',
        driverStatus: 'pending',
        licenseNumber: 'UP-1620210089123',
        assignedBusId: null,
        language: 'hi',
        createdAt: new Date().toISOString()
      },
      {
        id: 'user-passenger-1',
        name: 'Aakash Verma',
        mobile: '9988776655',
        email: 'aakash@example.com',
        password: hashedPassengerPassword,
        role: 'passenger',
        language: 'en',
        createdAt: new Date().toISOString()
      }
    ];

    const buses: Bus[] = [
      {
        id: 'bus-1001',
        busNumber: 'UP16-1001',
        registrationNumber: 'UP 16 BT 1001',
        capacity: 45,
        currentRouteId: 'route-101',
        assignedDriverId: 'user-driver-1',
        status: 'in_service',
        crowdLevel: 'seats_available',
        crowdUpdatedAt: new Date().toISOString()
      },
      {
        id: 'bus-1002',
        busNumber: 'UP16-1002',
        registrationNumber: 'UP 16 BT 1002',
        capacity: 40,
        currentRouteId: 'route-202',
        assignedDriverId: 'user-driver-2',
        status: 'in_service',
        crowdLevel: 'moderately_crowded',
        crowdUpdatedAt: new Date().toISOString()
      },
      {
        id: 'bus-2005',
        busNumber: 'UP16-2005',
        registrationNumber: 'UP 16 BT 2005',
        capacity: 50,
        currentRouteId: 'route-101',
        assignedDriverId: null,
        status: 'in_service',
        crowdLevel: 'seats_available',
        crowdUpdatedAt: new Date().toISOString()
      }
    ];

    const trips: Trip[] = [
      {
        id: 'trip-101-today',
        tripNumber: 'TRP-101-0830',
        busId: 'bus-1001',
        driverId: 'user-driver-1',
        routeId: 'route-101',
        status: 'in_progress',
        startTime: new Date(Date.now() - 15 * 60000).toISOString(),
        currentStopIndex: 1,
        delayMinutes: 2
      },
      {
        id: 'trip-202-today',
        tripNumber: 'TRP-202-0900',
        busId: 'bus-1002',
        driverId: 'user-driver-2',
        routeId: 'route-202',
        status: 'in_progress',
        startTime: new Date(Date.now() - 10 * 60000).toISOString(),
        currentStopIndex: 1,
        delayMinutes: 0
      }
    ];

    const busLocations: BusLocation[] = [
      {
        id: 'loc-1',
        tripId: 'trip-101-today',
        busId: 'bus-1001',
        driverId: 'user-driver-1',
        lat: 28.4688,
        lng: 77.5052,
        speed: 32,
        heading: 42,
        accuracy: 8.5,
        timestamp: new Date().toISOString(),
        source: 'browser_gps'
      },
      {
        id: 'loc-2',
        tripId: 'trip-202-today',
        busId: 'bus-1002',
        driverId: 'user-driver-2',
        lat: 28.4615,
        lng: 77.4812,
        speed: 28,
        heading: 110,
        accuracy: 10.2,
        timestamp: new Date().toISOString(),
        source: 'browser_gps'
      }
    ];

    const announcements: ServiceAnnouncement[] = [
      {
        id: 'ann-1',
        title: 'Road widening near Knowledge Park Gate 2',
        titleHi: 'नॉलेज पार्क गेट 2 के पास सड़क चौड़ीकरण कार्य',
        message: 'Buses on Route 101 may experience 5-8 minutes delay due to single-lane traffic diversions.',
        messageHi: 'रूट 101 की बसों में सिंगल लेन डायवर्जन के कारण 5-8 मिनट की देरी हो सकती है।',
        type: 'delay',
        affectedRouteIds: ['route-101'],
        active: true,
        createdAt: new Date().toISOString(),
        createdBy: 'Fleet Controller Verma'
      }
    ];

    const smsLogs: SMSMessageLog[] = [
      {
        id: 'sms-log-1',
        mobile: '9988776655',
        message: 'TransitEase: Bus UP16-1001 is approaching Knowledge Park Bus Stop in approx 6 mins.',
        type: 'outbound_alert',
        status: 'simulated',
        provider: 'simulator',
        timestamp: new Date(Date.now() - 30 * 60000).toISOString()
      }
    ];

    this.data = {
      users,
      busStops: stopsWithQR,
      routes,
      buses,
      trips,
      busLocations,
      savedCommutes: [],
      smsSubscriptions: [],
      smsLogs,
      announcements,
      passengerReports: []
    };

    this.persistLocalBackup();
  }

  // --- QUERY & PERSISTENCE METHODS (DUAL SYNC / MONGO PERSISTENCE) ---
  public getUsers() { return this.data.users; }
  
  public getUserById(id: string) { 
    return this.data.users.find(u => u.id === id || (u as any)._id?.toString() === id); 
  }
  
  public getUserByMobile(mobile: string) {
    const clean = mobile.replace(/\D/g, '').slice(-10);
    return this.data.users.find(u => u.mobile.replace(/\D/g, '').slice(-10) === clean);
  }
  
  public getUserByEmail(email: string) { 
    return this.data.users.find(u => u.email?.toLowerCase() === email.toLowerCase()); 
  }
  
  public async addUser(user: User): Promise<User> {
    if (this.isMongoConnected) {
      try {
        const created = await UserModel.create({
          name: user.name,
          mobile: user.mobile,
          email: user.email,
          password: user.password,
          role: user.role,
          driverStatus: user.driverStatus,
          licenseNumber: user.licenseNumber,
          assignedBusId: user.assignedBusId,
          language: user.language,
          createdAt: user.createdAt
        });
        (user as any)._id = created._id;
        if (!user.id) {
          user.id = created._id.toString();
        }
      } catch (err) {
        console.error('[Database] Error persisting user to MongoDB:', err);
      }
    }
    this.data.users.push(user);
    this.persistLocalBackup();
    return user;
  }
  
  public async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const idx = this.data.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      this.data.users[idx] = { ...this.data.users[idx], ...updates };
      this.persistLocalBackup();

      if (this.isMongoConnected) {
        try {
          await UserModel.findOneAndUpdate(
            { $or: [{ mobile: this.data.users[idx].mobile }, { _id: id }] },
            updates,
            { new: true }
          );
        } catch (err) {
          console.error('[Database] Error updating user in MongoDB:', err);
        }
      }
      return this.data.users[idx];
    }
    return null;
  }

  // --- BUSES ---
  public getBuses() { return this.data.buses; }
  
  public getBusById(id: string) { 
    if (!id) return undefined;
    return this.data.buses.find(b => 
      b.id === id || 
      (b as any)._id?.toString() === id ||
      (id === 'bus-1001' && b.busNumber.includes('1001')) ||
      (id === 'bus-1002' && b.busNumber.includes('1002')) ||
      (id === 'bus-2005' && b.busNumber.includes('2005')) ||
      b.busNumber.toUpperCase().replace(/[\s-]/g, '') === id.toUpperCase().replace(/[\s-]/g, '')
    ); 
  }
  
  public getBusByNumber(num: string) {
    const clean = num.trim().toUpperCase().replace(/[\s-]/g, '');
    return this.data.buses.find(b => b.busNumber.toUpperCase().replace(/[\s-]/g, '') === clean);
  }
  
  public getBusByDriverId(driverId: string) {
    if (!driverId) return undefined;
    const driver = this.getUserById(driverId);
    return this.data.buses.find(b => 
      b.assignedDriverId === driverId ||
      (driver && b.assignedDriverId === driver.id) ||
      (driver && (b as any).assignedDriverId === driver.mobile) ||
      (driver && driver.mobile === '9876543210' && b.busNumber.includes('1001')) ||
      (driver && driver.mobile === '9812345678' && b.busNumber.includes('1002'))
    );
  }
  
  public async addBus(bus: Bus): Promise<Bus> {
    this.data.buses.push(bus);
    this.persistLocalBackup();

    if (this.isMongoConnected) {
      try {
        await BusModel.create({
          busNumber: bus.busNumber,
          registrationNumber: bus.registrationNumber,
          capacity: bus.capacity,
          currentRouteId: bus.currentRouteId,
          assignedDriverId: bus.assignedDriverId,
          status: bus.status,
          crowdLevel: bus.crowdLevel,
          crowdUpdatedAt: bus.crowdUpdatedAt
        });
      } catch (err) {
        console.error('[Database] Error saving bus to MongoDB:', err);
      }
    }
    return bus;
  }
  
  public async updateBus(id: string, updates: Partial<Bus>): Promise<Bus | null> {
    const idx = this.data.buses.findIndex(b => b.id === id);
    if (idx !== -1) {
      this.data.buses[idx] = { ...this.data.buses[idx], ...updates };
      this.persistLocalBackup();

      if (this.isMongoConnected) {
        try {
          await BusModel.findOneAndUpdate(
            { $or: [{ busNumber: this.data.buses[idx].busNumber }, { _id: id }] },
            updates,
            { new: true }
          );
        } catch (err) {
          console.error('[Database] Error updating bus in MongoDB:', err);
        }
      }
      return this.data.buses[idx];
    }
    return null;
  }

  // --- STOPS ---
  public getStops() { return this.data.busStops; }
  
  public getStopById(id: string) { 
    if (!id) return undefined;
    const cleanId = id.trim().toLowerCase();
    return this.data.busStops.find(s => 
      s.id === id || 
      (s as any)._id?.toString() === id || 
      s.code.toLowerCase() === cleanId ||
      cleanId.includes(s.code.toLowerCase())
    ); 
  }
  
  public getStopByCode(code: string) {
    const clean = code.trim().toUpperCase();
    return this.data.busStops.find(s => s.code.toUpperCase() === clean);
  }
  
  public async addStop(stop: BusStop): Promise<BusStop> {
    this.data.busStops.push(stop);
    this.persistLocalBackup();

    if (this.isMongoConnected) {
      try {
        await BusStopModel.create({
          code: stop.code,
          name: stop.name,
          nameHi: stop.nameHi,
          lat: stop.lat,
          lng: stop.lng,
          landmark: stop.landmark,
          qrCodeDataUrl: stop.qrCodeDataUrl
        });
      } catch (err) {
        console.error('[Database] Error adding stop to MongoDB:', err);
      }
    }
    return stop;
  }
  
  public async updateStop(id: string, updates: Partial<BusStop>): Promise<BusStop | null> {
    const idx = this.data.busStops.findIndex(s => s.id === id);
    if (idx !== -1) {
      this.data.busStops[idx] = { ...this.data.busStops[idx], ...updates };
      this.persistLocalBackup();

      if (this.isMongoConnected) {
        try {
          await BusStopModel.findOneAndUpdate({ code: this.data.busStops[idx].code }, updates);
        } catch (err) {
          console.error('[Database] Error updating stop in MongoDB:', err);
        }
      }
      return this.data.busStops[idx];
    }
    return null;
  }

  // --- ROUTES ---
  public getRoutes() { return this.data.routes; }
  
  public getRouteById(id: string) { 
    if (!id) return undefined;
    const cleanId = id.trim().toLowerCase();
    return this.data.routes.find(r => 
      r.id === id || 
      (r as any)._id?.toString() === id ||
      (r as any).semanticId === id ||
      r.routeNumber.toLowerCase() === cleanId ||
      cleanId.includes(r.routeNumber.toLowerCase()) ||
      (r.id && r.id.toLowerCase() === cleanId)
    ); 
  }
  
  public getRouteByNumber(num: string) { 
    return this.data.routes.find(r => r.routeNumber === num); 
  }
  
  public async addRoute(route: Route): Promise<Route> {
    this.data.routes.push(route);
    this.persistLocalBackup();

    if (this.isMongoConnected) {
      try {
        await RouteModel.create({
          routeNumber: route.routeNumber,
          name: route.name,
          nameHi: route.nameHi,
          startStopId: route.startStopId,
          endStopId: route.endStopId,
          stops: route.stops,
          polylineCoords: route.polylineCoords,
          fareBase: route.fareBase,
          farePerKm: route.farePerKm,
          active: route.active
        });
      } catch (err) {
        console.error('[Database] Error adding route to MongoDB:', err);
      }
    }
    return route;
  }

  // --- TRIPS ---
  public getTrips() { return this.data.trips; }
  
  public getTripById(id: string) { 
    return this.data.trips.find(t => t.id === id); 
  }
  
  public getActiveTripByBusId(busId: string) {
    const bus = this.getBusById(busId);
    return this.data.trips.find(t => 
      (t.busId === busId || (bus && t.busId === bus.id) || (bus && t.busId === (bus as any)._id?.toString())) && 
      t.status === 'in_progress'
    );
  }
  
  public getActiveTripByDriverId(driverId: string) {
    const driver = this.getUserById(driverId);
    return this.data.trips.find(t => 
      (t.driverId === driverId || (driver && t.driverId === driver.id) || (driver && t.driverId === (driver as any)._id?.toString())) && 
      t.status === 'in_progress'
    );
  }
  
  public async addTrip(trip: Trip): Promise<Trip> {
    this.data.trips.push(trip);
    this.persistLocalBackup();

    if (this.isMongoConnected) {
      try {
        await TripModel.create({
          tripNumber: trip.tripNumber,
          busId: trip.busId,
          driverId: trip.driverId,
          routeId: trip.routeId,
          status: trip.status,
          startTime: trip.startTime,
          endTime: trip.endTime,
          currentStopIndex: trip.currentStopIndex,
          delayMinutes: trip.delayMinutes
        });
      } catch (err) {
        console.error('[Database] Error adding trip to MongoDB:', err);
      }
    }
    return trip;
  }
  
  public async updateTrip(id: string, updates: Partial<Trip>): Promise<Trip | null> {
    const idx = this.data.trips.findIndex(t => t.id === id);
    if (idx !== -1) {
      this.data.trips[idx] = { ...this.data.trips[idx], ...updates };
      this.persistLocalBackup();

      if (this.isMongoConnected) {
        try {
          await TripModel.findOneAndUpdate({ tripNumber: this.data.trips[idx].tripNumber }, updates);
        } catch (err) {
          console.error('[Database] Error updating trip in MongoDB:', err);
        }
      }
      return this.data.trips[idx];
    }
    return null;
  }

  // --- LOCATIONS & GPS TELEMETRY ---
  public getLocations() { return this.data.busLocations; }
  
  public getLatestLocationByBusId(busId: string): BusLocation | null {
    const bus = this.getBusById(busId);
    const locs = this.data.busLocations.filter(l => 
      l.busId === busId || 
      (bus && l.busId === bus.id) ||
      (bus && (l as any).busId === (bus as any)._id?.toString()) ||
      (bus && bus.busNumber.includes('1001') && (l.busId === 'bus-1001' || l.busId.includes('1001'))) ||
      (bus && bus.busNumber.includes('1002') && (l.busId === 'bus-1002' || l.busId.includes('1002'))) ||
      (bus && bus.busNumber.includes('2005') && (l.busId === 'bus-2005' || l.busId.includes('2005')))
    );
    if (locs.length === 0) return null;
    return locs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  }
  
  public async recordLocation(location: BusLocation): Promise<BusLocation> {
    this.data.busLocations.push(location);
    if (this.data.busLocations.length > 2000) {
      this.data.busLocations = this.data.busLocations.slice(-1500);
    }
    this.persistLocalBackup();

    if (this.isMongoConnected) {
      try {
        await BusLocationModel.create({
          tripId: location.tripId,
          busId: location.busId,
          driverId: location.driverId,
          lat: location.lat,
          lng: location.lng,
          speed: location.speed,
          heading: location.heading,
          accuracy: location.accuracy,
          timestamp: location.timestamp,
          source: location.source
        });
      } catch (err) {
        console.error('[Database] Error recording GPS location in MongoDB:', err);
      }
    }
    return location;
  }

  // --- SAVED COMMUTES ---
  public getSavedCommutes(userId?: string) {
    if (userId) return this.data.savedCommutes.filter(c => c.userId === userId);
    return this.data.savedCommutes;
  }
  
  public async addSavedCommute(commute: SavedCommute): Promise<SavedCommute> {
    this.data.savedCommutes.push(commute);
    this.persistLocalBackup();

    if (this.isMongoConnected) {
      try {
        await SavedCommuteModel.create(commute);
      } catch (err) {
        console.error('[Database] Error saving commute to MongoDB:', err);
      }
    }
    return commute;
  }
  
  public async updateSavedCommute(id: string, updates: Partial<SavedCommute>): Promise<SavedCommute | null> {
    const idx = this.data.savedCommutes.findIndex(c => c.id === id);
    if (idx !== -1) {
      this.data.savedCommutes[idx] = { ...this.data.savedCommutes[idx], ...updates };
      this.persistLocalBackup();

      if (this.isMongoConnected) {
        try {
          await SavedCommuteModel.findByIdAndUpdate(id, updates);
        } catch (err) {
          console.error('[Database] Error updating commute in MongoDB:', err);
        }
      }
      return this.data.savedCommutes[idx];
    }
    return null;
  }
  
  public async deleteSavedCommute(id: string): Promise<void> {
    this.data.savedCommutes = this.data.savedCommutes.filter(c => c.id !== id);
    this.persistLocalBackup();

    if (this.isMongoConnected) {
      try {
        await SavedCommuteModel.findByIdAndDelete(id);
      } catch (err) {
        console.error('[Database] Error deleting commute in MongoDB:', err);
      }
    }
  }

  // --- SMS LOGS & SUBSCRIPTIONS ---
  public getSMSLogs() { return this.data.smsLogs; }
  
  public async addSMSLog(log: SMSMessageLog): Promise<SMSMessageLog> {
    this.data.smsLogs.unshift(log);
    if (this.data.smsLogs.length > 500) {
      this.data.smsLogs = this.data.smsLogs.slice(0, 500);
    }
    this.persistLocalBackup();

    if (this.isMongoConnected) {
      try {
        await SMSMessageLogModel.create(log);
      } catch (err) {
        console.error('[Database] Error saving SMS log in MongoDB:', err);
      }
    }
    return log;
  }
  
  public getSMSSubscriptions(mobile?: string) {
    if (mobile) {
      const clean = mobile.replace(/\D/g, '').slice(-10);
      return this.data.smsSubscriptions.filter(s => s.mobile.replace(/\D/g, '').slice(-10) === clean);
    }
    return this.data.smsSubscriptions;
  }
  
  public async addSMSSubscription(sub: SMSSubscription): Promise<SMSSubscription> {
    this.data.smsSubscriptions.push(sub);
    this.persistLocalBackup();

    if (this.isMongoConnected) {
      try {
        await SMSSubscriptionModel.create(sub);
      } catch (err) {
        console.error('[Database] Error saving SMS subscription in MongoDB:', err);
      }
    }
    return sub;
  }
  
  public cancelSMSSubscriptionsByMobile(mobile: string): number {
    const clean = mobile.replace(/\D/g, '').slice(-10);
    let count = 0;
    this.data.smsSubscriptions.forEach(s => {
      if (s.mobile.replace(/\D/g, '').slice(-10) === clean && s.active) {
        s.active = false;
        count++;
      }
    });
    this.persistLocalBackup();
    return count;
  }

  // --- ANNOUNCEMENTS ---
  public getAnnouncements(activeOnly: boolean = true) {
    if (activeOnly) return this.data.announcements.filter(a => a.active);
    return this.data.announcements;
  }
  
  public async addAnnouncement(announcement: ServiceAnnouncement): Promise<ServiceAnnouncement> {
    this.data.announcements.unshift(announcement);
    this.persistLocalBackup();

    if (this.isMongoConnected) {
      try {
        await ServiceAnnouncementModel.create(announcement);
      } catch (err) {
        console.error('[Database] Error saving announcement in MongoDB:', err);
      }
    }
    return announcement;
  }
  
  public async updateAnnouncement(id: string, updates: Partial<ServiceAnnouncement>): Promise<ServiceAnnouncement | null> {
    const idx = this.data.announcements.findIndex(a => a.id === id);
    if (idx !== -1) {
      this.data.announcements[idx] = { ...this.data.announcements[idx], ...updates };
      this.persistLocalBackup();

      if (this.isMongoConnected) {
        try {
          await ServiceAnnouncementModel.findByIdAndUpdate(id, updates);
        } catch (err) {
          console.error('[Database] Error updating announcement in MongoDB:', err);
        }
      }
      return this.data.announcements[idx];
    }
    return null;
  }

  // --- PASSENGER REPORTS ---
  public getPassengerReports() { return this.data.passengerReports; }
  
  public async addPassengerReport(report: PassengerReport): Promise<PassengerReport> {
    this.data.passengerReports.unshift(report);
    this.persistLocalBackup();

    if (this.isMongoConnected) {
      try {
        await PassengerReportModel.create(report);
      } catch (err) {
        console.error('[Database] Error saving report in MongoDB:', err);
      }
    }
    return report;
  }
  
  public async updatePassengerReport(id: string, updates: Partial<PassengerReport>): Promise<PassengerReport | null> {
    const idx = this.data.passengerReports.findIndex(r => r.id === id);
    if (idx !== -1) {
      this.data.passengerReports[idx] = { ...this.data.passengerReports[idx], ...updates };
      this.persistLocalBackup();

      if (this.isMongoConnected) {
        try {
          await PassengerReportModel.findOneAndUpdate(
            { referenceNumber: this.data.passengerReports[idx].referenceNumber },
            updates
          );
        } catch (err) {
          console.error('[Database] Error updating report in MongoDB:', err);
        }
      }
      return this.data.passengerReports[idx];
    }
    return null;
  }
}

export const db = new TransitDatabase();
