import express from 'express';
import QRCode from 'qrcode';
import { db } from '../services/db.js';
import { authMiddleware, AuthRequest, requireRole } from '../services/authService.js';
import { Bus, BusStop, Route, ServiceAnnouncement, DriverStatus, BusLocation } from '../types.js';

const router = express.Router();

router.use(authMiddleware);
router.use(requireRole('admin'));

// 1. Overview Statistics
router.get('/stats', (req, res) => {
  const users = db.getUsers();
  const buses = db.getBuses();
  const trips = db.getTrips();
  const stops = db.getStops();
  const routes = db.getRoutes();
  const reports = db.getPassengerReports();
  const smsLogs = db.getSMSLogs();

  const activeTrips = trips.filter(t => t.status === 'in_progress');
  const drivers = users.filter(u => u.role === 'driver');
  const pendingDrivers = drivers.filter(d => d.driverStatus === 'pending');
  const openReports = reports.filter(r => r.status !== 'resolved');

  res.json({
    stats: {
      totalBuses: buses.length,
      inServiceBuses: buses.filter(b => b.status === 'in_service').length,
      activeTrips: activeTrips.length,
      totalDrivers: drivers.length,
      pendingDrivers: pendingDrivers.length,
      totalPassengers: users.filter(u => u.role === 'passenger').length,
      totalStops: stops.length,
      totalRoutes: routes.length,
      openReports: openReports.length,
      smsDispatched: smsLogs.length
    },
    dbStatus: db.getStatus()
  });
});

// 2. Drivers List & Verification
router.get('/drivers', (req, res) => {
  const drivers = db.getUsers().filter(u => u.role === 'driver').map(d => {
    const assignedBus = d.assignedBusId ? db.getBusById(d.assignedBusId) : db.getBusByDriverId(d.id);
    return {
      id: d.id,
      name: d.name,
      mobile: d.mobile,
      email: d.email,
      licenseNumber: d.licenseNumber,
      driverStatus: d.driverStatus,
      assignedBus: assignedBus ? { id: assignedBus.id, busNumber: assignedBus.busNumber } : null,
      createdAt: d.createdAt
    };
  });

  res.json({ drivers });
});

router.post('/drivers/:id/verify', async (req, res) => {
  const { status } = req.body; // 'approved' | 'rejected'
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Status must be approved, rejected, or pending.' });
  }

  const updated = await db.updateUser(req.params.id, { driverStatus: status as DriverStatus });
  if (!updated) return res.status(404).json({ error: 'Driver not found.' });

  res.json({ message: `Driver verification status set to ${status}.`, driver: updated });
});

// 3. Driver to Bus Assignment
router.post('/assign-driver', async (req, res) => {
  const { driverId, busId } = req.body;
  const driver = db.getUserById(driverId);
  const bus = db.getBusById(busId);

  if (!driver || driver.role !== 'driver') {
    return res.status(404).json({ error: 'Driver account not found.' });
  }
  if (!bus) {
    return res.status(404).json({ error: 'Bus record not found.' });
  }
  if (driver.driverStatus !== 'approved') {
    return res.status(400).json({ error: 'Only verified and approved drivers can be assigned to a bus.' });
  }

  // Clear previous assignments
  for (const b of db.getBuses()) {
    if (b.assignedDriverId === driverId && b.id !== busId) {
      await db.updateBus(b.id, { assignedDriverId: null });
    }
  }

  await db.updateBus(bus.id, { assignedDriverId: driverId });
  await db.updateUser(driver.id, { assignedBusId: bus.id });

  res.json({
    message: `Driver ${driver.name} assigned to Bus ${bus.busNumber}.`,
    bus: db.getBusById(bus.id)
  });
});

// 4. Bus Registration & Fleet Management
router.post('/buses', async (req, res) => {
  const { busNumber, registrationNumber, capacity, currentRouteId } = req.body;
  if (!busNumber || !registrationNumber) {
    return res.status(400).json({ error: 'Bus number and official registration number are required.' });
  }

  const existing = db.getBusByNumber(busNumber);
  if (existing) {
    return res.status(409).json({ error: `A bus with number "${busNumber}" is already registered.` });
  }

  const newBus: Bus = {
    id: `bus-${Date.now()}`,
    busNumber: busNumber.trim().toUpperCase(),
    registrationNumber: registrationNumber.trim().toUpperCase(),
    capacity: Number(capacity) || 40,
    currentRouteId: currentRouteId || null,
    assignedDriverId: null,
    status: 'in_service',
    crowdLevel: 'seats_available',
    crowdUpdatedAt: new Date().toISOString()
  };

  await db.addBus(newBus);
  res.status(201).json({ message: 'Bus registered successfully.', bus: newBus });
});

router.put('/buses/:id', async (req, res) => {
  const { status, currentRouteId } = req.body;
  const updated = await db.updateBus(req.params.id, {
    ...(status && { status }),
    ...(currentRouteId !== undefined && { currentRouteId })
  });

  if (!updated) return res.status(404).json({ error: 'Bus not found.' });
  res.json({ message: 'Bus record updated.', bus: updated });
});

// 5. Stops Management & Printable QR Code Generation
router.post('/stops', async (req, res) => {
  try {
    const { code, name, nameHi, lat, lng, landmark } = req.body;
    if (!code || !name || typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'Stop code, name, and valid latitude/longitude coordinates are required.' });
    }

    const cleanCode = code.trim().toUpperCase();
    if (db.getStopByCode(cleanCode)) {
      return res.status(409).json({ error: `Stop code "${cleanCode}" is already in use.` });
    }

    // Generate real QR code data URL
    const qrCodeDataUrl = await QRCode.toDataURL(JSON.stringify({
      app: 'TransitEase',
      stopCode: cleanCode,
      name,
      url: `/stop/${cleanCode}`
    }));

    const newStop: BusStop = {
      id: `stop-${Date.now()}`,
      code: cleanCode,
      name: name.trim(),
      nameHi: nameHi?.trim() || name.trim(),
      lat,
      lng,
      landmark: landmark?.trim(),
      qrCodeDataUrl
    };

    db.addStop(newStop);
    res.status(201).json({ message: 'Bus stop registered with QR code.', stop: newStop });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create bus stop.' });
  }
});

// 6. Routes Management
router.post('/routes', async (req, res) => {
  const { routeNumber, name, nameHi, startStopId, endStopId, stops, polylineCoords, fareBase, farePerKm } = req.body;
  if (!routeNumber || !name || !stops || !Array.isArray(stops)) {
    return res.status(400).json({ error: 'Route number, name, and ordered stops array are required.' });
  }

  const newRoute: Route = {
    id: `route-${Date.now()}`,
    routeNumber: routeNumber.trim(),
    name: name.trim(),
    nameHi: nameHi?.trim() || name.trim(),
    startStopId,
    endStopId,
    stops,
    polylineCoords: polylineCoords || [],
    fareBase: Number(fareBase) || 10,
    farePerKm: Number(farePerKm) || 2.0,
    active: true
  };

  await db.addRoute(newRoute);
  res.status(201).json({ message: 'Route created successfully.', route: newRoute });
});

// 7. Service Disruption Alerts Management (Section 16)
router.get('/announcements', (req, res) => {
  res.json({ announcements: db.getAnnouncements(false) });
});

router.post('/announcements', async (req: AuthRequest, res) => {
  const { title, titleHi, message, messageHi, type, affectedRouteIds } = req.body;
  if (!title || !message) {
    return res.status(400).json({ error: 'Title and announcement message are required.' });
  }

  const announcement: ServiceAnnouncement = {
    id: `ann-${Date.now()}`,
    title: title.trim(),
    titleHi: titleHi?.trim() || title.trim(),
    message: message.trim(),
    messageHi: messageHi?.trim() || message.trim(),
    type: type || 'delay',
    affectedRouteIds: affectedRouteIds || [],
    active: true,
    createdAt: new Date().toISOString(),
    createdBy: req.user?.name || 'Administrator'
  };

  await db.addAnnouncement(announcement);

  // Broadcast announcement to active sockets
  const io = req.app.get('io');
  if (io) {
    io.emit('announcement:new', announcement);
  }

  res.status(201).json({ message: 'Service alert published to passengers.', announcement });
});

router.delete('/announcements/:id', async (req, res) => {
  await db.updateAnnouncement(req.params.id, { active: false });
  res.json({ message: 'Announcement archived.' });
});

// 8. Passenger Reports / Grievances Review (Section 19)
router.get('/reports', (req, res) => {
  res.json({ reports: db.getPassengerReports() });
});

router.put('/reports/:id', async (req, res) => {
  const { status, resolutionNotes } = req.body;
  const updated = await db.updatePassengerReport(req.params.id, {
    ...(status && { status }),
    ...(resolutionNotes && { resolutionNotes })
  });

  if (!updated) return res.status(404).json({ error: 'Report not found.' });
  res.json({ message: 'Report updated.', report: updated });
});

// 9. SMS Delivery Logs
router.get('/sms-logs', (req, res) => {
  res.json({ logs: db.getSMSLogs() });
});

// 10. Development GPS Route Simulator Step (Explicitly labelled for viva / demo testing)
router.post('/simulate-gps-step', (req, res) => {
  const { busId, stepIndex } = req.body;
  const bus = db.getBusById(busId || 'bus-1001');
  if (!bus) return res.status(404).json({ error: 'Bus not found.' });

  const activeTrip = db.getActiveTripByBusId(bus.id);
  if (!activeTrip) {
    return res.status(400).json({ error: 'Bus must have an active trip to simulate GPS movement.' });
  }

  const route = db.getRouteById(activeTrip.routeId);
  if (!route || route.polylineCoords.length === 0) {
    return res.status(400).json({ error: 'Route has no coordinate geometry to traverse.' });
  }

  const coords = route.polylineCoords;
  const idx = typeof stepIndex === 'number' ? stepIndex % coords.length : Math.floor(Math.random() * coords.length);
  const [lat, lng] = coords[idx];

  const simulatedLoc: BusLocation = {
    id: `loc-sim-${Date.now()}`,
    tripId: activeTrip.id,
    busId: bus.id,
    driverId: activeTrip.driverId,
    lat,
    lng,
    speed: Math.floor(25 + Math.random() * 15),
    heading: Math.floor(Math.random() * 360),
    accuracy: 6.0,
    timestamp: new Date().toISOString(),
    source: 'simulator'
  };

  db.recordLocation(simulatedLoc);

  const io = req.app.get('io');
  if (io) {
    io.emit('bus:location_broadcast', {
      busId: bus.id,
      busNumber: bus.busNumber,
      driverId: activeTrip.driverId,
      tripId: activeTrip.id,
      routeId: activeTrip.routeId,
      location: simulatedLoc
    });
  }

  res.json({
    message: `[GPS Simulator] Bus ${bus.busNumber} updated to step ${idx} (${lat}, ${lng})`,
    location: simulatedLoc,
    nextStepIndex: (idx + 1) % coords.length
  });
});

export default router;
