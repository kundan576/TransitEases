import express from 'express';
import { db } from '../services/db.js';
import { calculateTripStopETAs, isLocationStale, StopETA } from '../services/etaService.js';

const router = express.Router();

// 1. Get all stops
router.get('/', (req, res) => {
  const stops = db.getStops();
  res.json({ stops });
});

// 2. Get stop by code or ID (For QR code scans and stop signage lookup)
router.get('/:codeOrId', (req, res) => {
  const param = req.params.codeOrId;
  let stop = db.getStopByCode(param);
  if (!stop) {
    stop = db.getStopById(param);
  }

  if (!stop) {
    return res.status(404).json({ error: `Bus stop with code "${param}" not found.` });
  }

  // Find all routes that include this stop
  const routesPassingStop = db.getRoutes().filter(r => 
    r.active && r.stops.some(s => s.stopId === stop!.id)
  );

  // Find active trips passing this stop
  const activeTrips = db.getTrips().filter(t => 
    t.status === 'in_progress' && routesPassingStop.some(r => r.id === t.routeId)
  );

  const upcomingBuses: any[] = [];
  const allStops = db.getStops();

  for (const trip of activeTrips) {
    const bus = db.getBusById(trip.busId);
    const route = db.getRouteById(trip.routeId);
    if (!bus || !route) continue;

    const loc = db.getLatestLocationByBusId(bus.id);
    const etas = calculateTripStopETAs(loc, route, allStops, trip);
    const thisStopEta = etas.find((e: StopETA) => e.stop.id === stop!.id);

    if (thisStopEta && !thisStopEta.isPassed) {
      upcomingBuses.push({
        busId: bus.id,
        busNumber: bus.busNumber,
        routeNumber: route.routeNumber,
        routeName: route.name,
        crowdLevel: bus.crowdLevel,
        estimatedMinutes: thisStopEta.estimatedMinutes,
        estimatedArrivalTime: thisStopEta.estimatedArrivalTime,
        delayMinutes: trip.delayMinutes,
        isStaleGps: loc ? isLocationStale(loc.timestamp) : true
      });
    }
  }

  upcomingBuses.sort((a, b) => a.estimatedMinutes - b.estimatedMinutes);

  res.json({
    stop,
    routes: routesPassingStop.map(r => ({
      id: r.id,
      routeNumber: r.routeNumber,
      name: r.name,
      nameHi: r.nameHi
    })),
    upcomingBuses
  });
});

export default router;
