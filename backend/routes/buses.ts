import express from 'express';
import { db } from '../services/db.js';
import { calculateTripStopETAs, isLocationStale, StopETA } from '../services/etaService.js';

const router = express.Router();

function maskMobileNumber(phone: string): string {
  const clean = phone.replace(/\D/g, '').slice(-10);
  if (clean.length < 5) return '***';
  return `+91 ${clean.slice(0, 5)}*****`;
}

// 1. Search by Bus Number (Section 6A)
router.get('/search', (req, res) => {
  try {
    const query = req.query.query as string;
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Please enter a bus number to search.' });
    }

    const bus = db.getBusByNumber(query);
    if (!bus) {
      return res.status(404).json({
        found: false,
        message: `No bus registered with number "${query}". Please check the registration or ask station staff.`
      });
    }

    const assignedDriver = bus.assignedDriverId ? db.getUserById(bus.assignedDriverId) : null;
    const activeTrip = db.getActiveTripByBusId(bus.id);
    const route = activeTrip ? db.getRouteById(activeTrip.routeId) : (bus.currentRouteId ? db.getRouteById(bus.currentRouteId) : null);
    const location = db.getLatestLocationByBusId(bus.id);
    const allStops = db.getStops();

    let etas: any[] = [];
    let isStale = false;
    let staleWarning: string | null = null;

    if (location) {
      isStale = isLocationStale(location.timestamp);
      if (isStale) {
        const timeStr = new Date(location.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        staleWarning = `Last location update: ${timeStr}. This location may not be current.`;
      }
      if (route) {
        etas = calculateTripStopETAs(location, route, allStops, activeTrip || undefined);
      }
    }

    const nextStopEta = etas.find((e: StopETA) => !e.isPassed) || null;

    res.json({
      found: true,
      bus: {
        id: bus.id,
        busNumber: bus.busNumber,
        registrationNumber: bus.registrationNumber,
        capacity: bus.capacity,
        status: bus.status,
        crowdLevel: bus.crowdLevel,
        crowdUpdatedAt: bus.crowdUpdatedAt
      },
      driver: assignedDriver ? {
        name: assignedDriver.name,
        maskedMobile: maskMobileNumber(assignedDriver.mobile),
        verified: assignedDriver.driverStatus === 'approved'
      } : null,
      activeTrip: activeTrip ? {
        id: activeTrip.id,
        tripNumber: activeTrip.tripNumber,
        startTime: activeTrip.startTime,
        delayMinutes: activeTrip.delayMinutes,
        status: activeTrip.status
      } : null,
      route: route ? {
        id: route.id,
        routeNumber: route.routeNumber,
        name: route.name,
        nameHi: route.nameHi,
        polylineCoords: route.polylineCoords,
        fareBase: route.fareBase
      } : null,
      location: location ? {
        lat: location.lat,
        lng: location.lng,
        speed: location.speed,
        heading: location.heading,
        accuracy: location.accuracy,
        timestamp: location.timestamp,
        isStale
      } : null,
      staleWarning,
      etas,
      nextStop: nextStopEta ? {
        name: nextStopEta.stop.name,
        nameHi: nextStopEta.stop.nameHi,
        code: nextStopEta.stop.code,
        estimatedMinutes: nextStopEta.estimatedMinutes,
        estimatedArrivalTime: nextStopEta.estimatedArrivalTime
      } : null
    });
  } catch (err: any) {
    console.error('Bus search error:', err);
    res.status(500).json({ error: 'Failed to process bus search.' });
  }
});

// 2. Search by Driver Mobile Number (Section 6B - CORE REQUIREMENT)
router.get('/driver-phone', (req, res) => {
  try {
    const rawPhone = req.query.phone as string;
    if (!rawPhone || rawPhone.trim().length === 0) {
      return res.status(400).json({ error: 'Please enter the driver\'s registered mobile number.' });
    }

    const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
    }

    // 1. Search DB for verified driver
    const driver = db.getUserByMobile(cleanPhone);
    if (!driver || driver.role !== 'driver') {
      return res.status(404).json({
        found: false,
        message: 'No registered driver found with this mobile number. Please confirm with transit authorities.'
      });
    }

    // 2. Identify bus assigned to that driver
    const bus = driver.assignedBusId ? db.getBusById(driver.assignedBusId) : db.getBusByDriverId(driver.id);
    if (!bus) {
      return res.status(200).json({
        found: true,
        driverName: driver.name,
        maskedMobile: maskMobileNumber(driver.mobile),
        isSharing: false,
        message: 'No bus is currently assigned to this driver.'
      });
    }

    // 3. Check whether driver is sharing location during an active trip
    const activeTrip = db.getActiveTripByDriverId(driver.id) || db.getActiveTripByBusId(bus.id);
    if (!activeTrip) {
      return res.status(200).json({
        found: true,
        driverName: driver.name,
        maskedMobile: maskMobileNumber(driver.mobile),
        busNumber: bus.busNumber,
        isSharing: false,
        message: 'This driver is not currently sharing a live location.'
      });
    }

    // 4. Retrieve latest actual GPS coordinates
    const location = db.getLatestLocationByBusId(bus.id);
    if (!location) {
      return res.status(200).json({
        found: true,
        driverName: driver.name,
        maskedMobile: maskMobileNumber(driver.mobile),
        busNumber: bus.busNumber,
        isSharing: false,
        message: 'This driver is not currently sharing a live location.'
      });
    }

    const isStale = isLocationStale(location.timestamp);
    const timeStr = new Date(location.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let staleWarning: string | null = null;
    if (isStale) {
      staleWarning = `Last location update: ${timeStr}. This location may not be current.`;
    }

    const route = db.getRouteById(activeTrip.routeId);
    const allStops = db.getStops();
    const etas = route ? calculateTripStopETAs(location, route, allStops, activeTrip) : [];
    const nextStopEta = etas.find((e: StopETA) => !e.isPassed) || null;

    res.json({
      found: true,
      isSharing: true,
      driver: {
        name: driver.name,
        maskedMobile: maskMobileNumber(driver.mobile),
        status: driver.driverStatus
      },
      bus: {
        id: bus.id,
        busNumber: bus.busNumber,
        registrationNumber: bus.registrationNumber,
        capacity: bus.capacity,
        crowdLevel: bus.crowdLevel
      },
      activeTrip: {
        id: activeTrip.id,
        tripNumber: activeTrip.tripNumber,
        startTime: activeTrip.startTime,
        delayMinutes: activeTrip.delayMinutes
      },
      route: route ? {
        id: route.id,
        routeNumber: route.routeNumber,
        name: route.name,
        nameHi: route.nameHi,
        polylineCoords: route.polylineCoords
      } : null,
      location: {
        lat: location.lat,
        lng: location.lng,
        speed: location.speed,
        heading: location.heading,
        accuracy: location.accuracy,
        timestamp: location.timestamp,
        isStale
      },
      staleWarning,
      etas,
      nextStop: nextStopEta ? {
        name: nextStopEta.stop.name,
        nameHi: nextStopEta.stop.nameHi,
        code: nextStopEta.stop.code,
        estimatedMinutes: nextStopEta.estimatedMinutes,
        estimatedArrivalTime: nextStopEta.estimatedArrivalTime
      } : null
    });
  } catch (err: any) {
    console.error('Driver phone search error:', err);
    res.status(500).json({ error: 'Failed to search bus by driver phone.' });
  }
});

// 3. List all active buses on trips with their live coordinates
router.get('/live', (req, res) => {
  try {
    const activeTrips = db.getTrips().filter(t => t.status === 'in_progress');
    const results = activeTrips.map(trip => {
      const bus = db.getBusById(trip.busId);
      const driver = db.getUserById(trip.driverId);
      const route = db.getRouteById(trip.routeId);
      const loc = db.getLatestLocationByBusId(trip.busId);
      return {
        tripId: trip.id,
        tripNumber: trip.tripNumber,
        bus: bus ? {
          id: bus.id,
          busNumber: bus.busNumber,
          registrationNumber: bus.registrationNumber,
          crowdLevel: bus.crowdLevel
        } : null,
        driverName: driver ? driver.name : 'Unknown',
        route: route ? {
          id: route.id,
          routeNumber: route.routeNumber,
          name: route.name
        } : null,
        location: loc ? {
          lat: loc.lat,
          lng: loc.lng,
          speed: loc.speed,
          heading: loc.heading,
          accuracy: loc.accuracy,
          timestamp: loc.timestamp,
          isStale: isLocationStale(loc.timestamp)
        } : null
      };
    });

    res.json({ liveBuses: results });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve live buses.' });
  }
});

// 4. Get Bus by ID
router.get('/:id', (req, res) => {
  const bus = db.getBusById(req.params.id);
  if (!bus) return res.status(404).json({ error: 'Bus not found.' });

  const activeTrip = db.getActiveTripByBusId(bus.id);
  const location = db.getLatestLocationByBusId(bus.id);
  const route = activeTrip ? db.getRouteById(activeTrip.routeId) : (bus.currentRouteId ? db.getRouteById(bus.currentRouteId) : null);
  const driver = bus.assignedDriverId ? db.getUserById(bus.assignedDriverId) : null;

  res.json({
    bus,
    activeTrip,
    location,
    route,
    driver: driver ? {
      name: driver.name,
      maskedMobile: maskMobileNumber(driver.mobile)
    } : null
  });
});

export default router;
