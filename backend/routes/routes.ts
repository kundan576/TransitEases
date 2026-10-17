import express from 'express';
import { db } from '../services/db.js';
import { calculateTripStopETAs, isLocationStale, StopETA } from '../services/etaService.js';

const router = express.Router();

// 1. Get all routes
router.get('/', (req, res) => {
  const routes = db.getRoutes().filter(r => r.active);
  const allStops = db.getStops();

  const formatted = routes.map(r => ({
    ...r,
    stopsDetailed: r.stops.map(s => {
      const stopObj = allStops.find(stop => stop.id === s.stopId);
      return {
        ...s,
        stopName: stopObj ? stopObj.name : 'Unknown Stop',
        stopNameHi: stopObj ? stopObj.nameHi : 'अज्ञात स्टॉप',
        stopCode: stopObj ? stopObj.code : ''
      };
    })
  }));

  res.json({ routes: formatted });
});

// 2. Journey Planner: Point A to Point B (Section 9)
router.get('/plan', (req, res) => {
  try {
    const originStopId = req.query.originStopId as string;
    const destStopId = req.query.destStopId as string;

    if (!originStopId || !destStopId) {
      return res.status(400).json({ error: 'Please select both origin and destination stops.' });
    }

    if (originStopId === destStopId) {
      return res.status(400).json({ error: 'Origin and destination cannot be the same stop.' });
    }

    const originStop = db.getStopById(originStopId);
    const destStop = db.getStopById(destStopId);

    if (!originStop || !destStop) {
      return res.status(404).json({ error: 'One or both stops do not exist in the database.' });
    }

    const allRoutes = db.getRoutes().filter(r => r.active);
    const directOptions: any[] = [];

    for (const route of allRoutes) {
      const origIndex = route.stops.findIndex(s => s.stopId === originStopId);
      const destIndex = route.stops.findIndex(s => s.stopId === destStopId);

      // Must serve origin and destination in correct direction (origIndex < destIndex)
      if (origIndex !== -1 && destIndex !== -1 && origIndex < destIndex) {
        const intermediateStops = route.stops.slice(origIndex, destIndex + 1);
        const stopsCount = destIndex - origIndex;

        // Calculate travel distance and estimated duration
        const origDistance = route.stops[origIndex].distanceKm;
        const destDistance = route.stops[destIndex].distanceKm;
        const travelDistanceKm = Math.max(1, Math.round((destDistance - origDistance) * 10) / 10);
        const approxJourneyMinutes = Math.max(5, Math.round(travelDistanceKm * 3.5)); // ~17 km/h city average
        const fare = Math.round(route.fareBase + travelDistanceKm * route.farePerKm);

        // Find active trips and buses on this route
        const activeTrips = db.getTrips().filter(t => t.routeId === route.id && t.status === 'in_progress');
        const eligibleBuses: any[] = [];

        for (const trip of activeTrips) {
          const bus = db.getBusById(trip.busId);
          if (!bus) continue;

          const loc = db.getLatestLocationByBusId(bus.id);
          const etas = calculateTripStopETAs(loc, route, db.getStops(), trip);
          const originEta = etas.find((e: StopETA) => e.stop.id === originStopId);

          // If bus has not already passed the origin stop
          if (originEta && !originEta.isPassed) {
            eligibleBuses.push({
              busId: bus.id,
              busNumber: bus.busNumber,
              capacity: bus.capacity,
              crowdLevel: bus.crowdLevel,
              tripId: trip.id,
              delayMinutes: trip.delayMinutes,
              etaToOriginMinutes: originEta.estimatedMinutes,
              estimatedBoardingTime: originEta.estimatedArrivalTime,
              location: loc ? {
                lat: loc.lat,
                lng: loc.lng,
                speed: loc.speed,
                timestamp: loc.timestamp,
                isStale: isLocationStale(loc.timestamp)
              } : null
            });
          }
        }

        // Sort buses by earliest arrival at origin stop
        eligibleBuses.sort((a, b) => a.etaToOriginMinutes - b.etaToOriginMinutes);

        directOptions.push({
          routeId: route.id,
          routeNumber: route.routeNumber,
          routeName: route.name,
          routeNameHi: route.nameHi,
          originStop: { id: originStop.id, name: originStop.name, code: originStop.code },
          destStop: { id: destStop.id, name: destStop.name, code: destStop.code },
          stopsCount,
          travelDistanceKm,
          approxJourneyMinutes,
          fare,
          polylineCoords: route.polylineCoords,
          eligibleBuses,
          scheduledFrequencyMinutes: 15
        });
      }
    }

    if (directOptions.length === 0) {
      return res.json({
        found: false,
        originStop,
        destStop,
        directOptions: [],
        message: 'No direct buses found between these stops. Direct route planning requires both stops on the same service.'
      });
    }

    res.json({
      found: true,
      originStop,
      destStop,
      directOptions
    });
  } catch (err: any) {
    console.error('Journey planning error:', err);
    res.status(500).json({ error: 'Failed to compute journey plan.' });
  }
});

// 3. Get Route by ID
router.get('/:id', (req, res) => {
  const route = db.getRouteById(req.params.id);
  if (!route) return res.status(404).json({ error: 'Route not found.' });

  const allStops = db.getStops();
  const stopsDetailed = route.stops.map(s => ({
    ...s,
    stop: allStops.find(stop => stop.id === s.stopId) || null
  }));

  res.json({
    route: {
      ...route,
      stopsDetailed
    }
  });
});

export default router;
