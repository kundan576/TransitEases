import { BusLocation, BusStop, Route, Trip } from '../types.js';

export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function isLocationStale(timestamp: string, thresholdSeconds: number = 180): boolean {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  return diffMs > thresholdSeconds * 1000;
}

export interface StopETA {
  stop: BusStop;
  order: number;
  distanceKm: number;
  estimatedMinutes: number;
  estimatedArrivalTime: string;
  isPassed: boolean;
}

export function calculateTripStopETAs(
  location: BusLocation | null,
  route: Route,
  allStops: BusStop[],
  trip?: Trip
): StopETA[] {
  const results: StopETA[] = [];
  const currentSpeed = location && location.speed > 5 ? location.speed : 22; // Average small city bus speed 22 km/h
  const windingFactor = 1.25; // Urban road network curve multiplier

  let accumulatedMinutes = 0;
  let previousLat = location ? location.lat : 0;
  let previousLng = location ? location.lng : 0;

  const orderedStops = [...route.stops].sort((a, b) => a.order - b.order);

  for (let i = 0; i < orderedStops.length; i++) {
    const routeStop = orderedStops[i];
    const stopObj = allStops.find(s => 
      s.id === routeStop.stopId ||
      (s as any)._id?.toString() === routeStop.stopId ||
      (s.code && routeStop.stopId.toLowerCase().includes(s.code.toLowerCase()))
    );
    if (!stopObj) continue;

    const isPassed = trip ? trip.currentStopIndex > i : false;

    if (!location) {
      // Static timetable estimate if GPS is not yet available
      accumulatedMinutes = routeStop.avgTimeMins;
      const arrivalDate = new Date(Date.now() + accumulatedMinutes * 60000);
      results.push({
        stop: stopObj,
        order: routeStop.order,
        distanceKm: routeStop.distanceKm,
        estimatedMinutes: accumulatedMinutes,
        estimatedArrivalTime: arrivalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isPassed
      });
      continue;
    }

    if (isPassed) {
      results.push({
        stop: stopObj,
        order: routeStop.order,
        distanceKm: 0,
        estimatedMinutes: 0,
        estimatedArrivalTime: 'Passed',
        isPassed: true
      });
      continue;
    }

    let legDistanceKm = 0;
    if (results.filter(r => !r.isPassed).length === 0) {
      // First unpassed stop: calculate direct road distance from current bus GPS
      legDistanceKm = haversineDistanceKm(location.lat, location.lng, stopObj.lat, stopObj.lng) * windingFactor;
    } else {
      // Subsequent stops: use previous stop coordinates
      legDistanceKm = haversineDistanceKm(previousLat, previousLng, stopObj.lat, stopObj.lng) * windingFactor;
    }

    const legMinutes = Math.max(1, Math.round((legDistanceKm / currentSpeed) * 60));
    accumulatedMinutes += legMinutes;
    previousLat = stopObj.lat;
    previousLng = stopObj.lng;

    const arrivalDate = new Date(Date.now() + accumulatedMinutes * 60000);

    results.push({
      stop: stopObj,
      order: routeStop.order,
      distanceKm: Math.round(legDistanceKm * 10) / 10,
      estimatedMinutes: accumulatedMinutes,
      estimatedArrivalTime: arrivalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isPassed: false
    });
  }

  return results;
}
