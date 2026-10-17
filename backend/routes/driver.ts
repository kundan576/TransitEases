import express from 'express';
import { db } from '../services/db.js';
import { authMiddleware, AuthRequest, requireRole } from '../services/authService.js';
import { BusLocation, Trip, CrowdLevel } from '../types.js';
import { haversineDistanceKm } from '../services/etaService.js';

const router = express.Router();

// All driver endpoints require driver role
router.use(authMiddleware);
router.use(requireRole('driver'));

// 1. Get Driver Status and Assigned Bus details
router.get('/status', (req: AuthRequest, res) => {
  const driverId = req.user!.id;
  const driver = db.getUserById(driverId);
  if (!driver) return res.status(404).json({ error: 'Driver not found.' });

  const assignedBus = driver.assignedBusId ? db.getBusById(driver.assignedBusId) : db.getBusByDriverId(driverId);
  const activeTrip = db.getActiveTripByDriverId(driverId);
  const route = activeTrip ? db.getRouteById(activeTrip.routeId) : (assignedBus?.currentRouteId ? db.getRouteById(assignedBus.currentRouteId) : null);
  const latestLocation = assignedBus ? db.getLatestLocationByBusId(assignedBus.id) : null;
  const allStops = db.getStops();

  const stopsChecklist = route ? route.stops.map(s => {
    const stopObj = allStops.find(stop => stop.id === s.stopId);
    return {
      order: s.order,
      stopId: s.stopId,
      name: stopObj ? stopObj.name : 'Unknown Stop',
      code: stopObj ? stopObj.code : '',
      lat: stopObj?.lat,
      lng: stopObj?.lng
    };
  }) : [];

  res.json({
    driver: {
      id: driver.id,
      name: driver.name,
      mobile: driver.mobile,
      driverStatus: driver.driverStatus,
      licenseNumber: driver.licenseNumber
    },
    assignedBus: assignedBus ? {
      id: assignedBus.id,
      busNumber: assignedBus.busNumber,
      registrationNumber: assignedBus.registrationNumber,
      capacity: assignedBus.capacity,
      crowdLevel: assignedBus.crowdLevel
    } : null,
    activeTrip,
    route,
    stopsChecklist,
    latestLocation
  });
});

// 2. Start Trip & Share Live Location
router.post('/start-trip', (req: AuthRequest, res) => {
  const driverId = req.user!.id;
  const driver = db.getUserById(driverId);

  if (!driver || driver.driverStatus !== 'approved') {
    return res.status(403).json({
      error: 'Your driver account has not been approved by an administrator yet. You cannot operate a bus.'
    });
  }

  const assignedBus = driver.assignedBusId ? db.getBusById(driver.assignedBusId) : db.getBusByDriverId(driverId);
  if (!assignedBus) {
    return res.status(400).json({
      error: 'No bus is currently assigned to your account. Please request administrator assignment.'
    });
  }

  // Check if trip is already active
  const existingTrip = db.getActiveTripByDriverId(driverId);
  if (existingTrip) {
    return res.json({ message: 'Trip is already active.', trip: existingTrip });
  }

  const routeId = assignedBus.currentRouteId || db.getRoutes()[0]?.id;
  if (!routeId) {
    return res.status(400).json({ error: 'Assigned bus has no route configured.' });
  }

  const newTrip: Trip = {
    id: `trip-${Date.now()}`,
    tripNumber: `TRP-${assignedBus.busNumber}-${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).replace(':', '')}`,
    busId: assignedBus.id,
    driverId,
    routeId,
    status: 'in_progress',
    startTime: new Date().toISOString(),
    currentStopIndex: 0,
    delayMinutes: 0
  };

  db.addTrip(newTrip);

  res.status(201).json({
    message: 'Trip started successfully. Smartphone GPS sharing is now enabled.',
    trip: newTrip,
    assignedBus
  });
});

// 3. End Trip
router.post('/end-trip', (req: AuthRequest, res) => {
  const driverId = req.user!.id;
  const activeTrip = db.getActiveTripByDriverId(driverId);

  if (!activeTrip) {
    return res.status(400).json({ error: 'No active trip to end.' });
  }

  const updatedTrip = db.updateTrip(activeTrip.id, {
    status: 'completed',
    endTime: new Date().toISOString()
  });

  res.json({
    message: 'Trip ended. GPS location sharing stopped.',
    trip: updatedTrip
  });
});

// 4. Update GPS Location from Driver's Smartphone Geolocation API (Section 7)
router.post('/location', async (req: AuthRequest, res) => {
  try {
    const driverId = req.user!.id;
    const { lat, lng, speed, heading, accuracy, timestamp } = req.body;

    // Coordinate validation
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'Valid numerical latitude and longitude are required.' });
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'Latitude must be between -90 and 90, Longitude between -180 and 180.' });
    }

    // Verify driver has an active trip and assigned bus
    const activeTrip = db.getActiveTripByDriverId(driverId);
    if (!activeTrip) {
      return res.status(403).json({
        error: 'Location rejected. GPS updates are only permitted during an authorized, active trip.'
      });
    }

    const bus = db.getBusById(activeTrip.busId);
    if (!bus) {
      return res.status(404).json({ error: 'Associated bus record not found.' });
    }

    const locationRecord: BusLocation = {
      id: `loc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tripId: activeTrip.id,
      busId: bus.id,
      driverId,
      lat,
      lng,
      speed: typeof speed === 'number' && speed >= 0 ? Math.round(speed * 3.6) : 0, // convert m/s to km/h if from browser
      heading: typeof heading === 'number' ? heading : 0,
      accuracy: typeof accuracy === 'number' ? Math.round(accuracy) : 10,
      timestamp: timestamp || new Date().toISOString(),
      source: 'browser_gps'
    };

    await db.recordLocation(locationRecord);

    // Stop progression check: if bus is within 150m of next stop, advance stop index
    const route = db.getRouteById(activeTrip.routeId);
    if (route && route.stops.length > activeTrip.currentStopIndex) {
      const nextStopItem = route.stops[activeTrip.currentStopIndex];
      const stopObj = db.getStopById(nextStopItem.stopId);
      if (stopObj) {
        const distKm = haversineDistanceKm(lat, lng, stopObj.lat, stopObj.lng);
        if (distKm <= 0.15 && activeTrip.currentStopIndex < route.stops.length - 1) {
          await db.updateTrip(activeTrip.id, {
            currentStopIndex: activeTrip.currentStopIndex + 1
          });
        }
      }
    }

    // Broadcast through global socket if available
    const io = req.app.get('io');
    if (io) {
      io.emit('bus:location_broadcast', {
        busId: bus.id,
        busNumber: bus.busNumber,
        driverId,
        tripId: activeTrip.id,
        routeId: activeTrip.routeId,
        location: locationRecord
      });
    }

    res.json({
      success: true,
      message: 'Location accepted and broadcasted.',
      location: locationRecord
    });
  } catch (err: any) {
    console.error('Driver location update error:', err);
    res.status(500).json({ error: 'Failed to record driver location.' });
  }
});

// 5. Driver updates bus crowd level (Section 18)
router.post('/crowd', async (req: AuthRequest, res) => {
  const driverId = req.user!.id;
  const { crowdLevel } = req.body;

  if (!['seats_available', 'moderately_crowded', 'very_crowded'].includes(crowdLevel)) {
    return res.status(400).json({ error: 'Invalid crowd level selection.' });
  }

  const driver = db.getUserById(driverId);
  const bus = driver?.assignedBusId ? db.getBusById(driver.assignedBusId) : db.getBusByDriverId(driverId);

  if (!bus) {
    return res.status(400).json({ error: 'No bus assigned to update crowd status.' });
  }

  const updatedBus = await db.updateBus(bus.id, {
    crowdLevel: crowdLevel as CrowdLevel,
    crowdUpdatedAt: new Date().toISOString()
  });

  // Broadcast crowd update to passengers
  const io = req.app.get('io');
  if (io) {
    io.emit('bus:crowd_update', {
      busId: bus.id,
      crowdLevel,
      crowdUpdatedAt: updatedBus?.crowdUpdatedAt
    });
  }

  res.json({
    success: true,
    message: 'Crowd occupancy updated.',
    crowdLevel: updatedBus?.crowdLevel,
    crowdUpdatedAt: updatedBus?.crowdUpdatedAt
  });
});

export default router;
