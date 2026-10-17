import { db } from './db.js';
import { calculateTripStopETAs, isLocationStale } from './etaService.js';
import { sendSMS } from './smsService.js';

let workerInterval: NodeJS.Timeout | null = null;

export function startNotificationWorker() {
  if (workerInterval) return;

  console.log('[Notification Worker] Started background check service (running every 15s)');

  workerInterval = setInterval(async () => {
    try {
      await processCommuteAlerts();
      await processSMSAlerts();
    } catch (err) {
      console.error('[Notification Worker Error]', err);
    }
  }, 15000);
}

export function stopNotificationWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
}

async function processCommuteAlerts() {
  const commutes = db.getSavedCommutes().filter(c => c.active);
  if (commutes.length === 0) return;

  const activeTrips = db.getTrips().filter(t => t.status === 'in_progress');
  const allStops = db.getStops();

  for (const commute of commutes) {
    // Check if an alert was already sent within the past 25 minutes
    if (commute.lastAlertSentAt) {
      const diffMinutes = (Date.now() - new Date(commute.lastAlertSentAt).getTime()) / 60000;
      if (diffMinutes < 25) continue;
    }

    // Find active trip matching route or specific bus
    const matchingTrip = activeTrips.find(t => {
      if (commute.busId) return t.busId === commute.busId;
      return t.routeId === commute.routeId;
    });

    if (!matchingTrip) continue;

    const route = db.getRouteById(matchingTrip.routeId);
    const bus = db.getBusById(matchingTrip.busId);
    const loc = db.getLatestLocationByBusId(matchingTrip.busId);
    if (!route || !bus || !loc) continue;

    // Do not alert on stale GPS (> 3 mins)
    if (isLocationStale(loc.timestamp)) continue;

    const etas = calculateTripStopETAs(loc, route, allStops, matchingTrip);
    const boardingEta = etas.find(e => e.stop.id === commute.boardingStopId);

    if (boardingEta && !boardingEta.isPassed && boardingEta.estimatedMinutes <= commute.thresholdMinutes) {
      const msg = `TransitEase Commute Alert: Bus ${bus.busNumber} is approx ${boardingEta.estimatedMinutes} mins away from ${boardingEta.stop.name}. Please get ready.`;

      if (commute.notificationChannel === 'sms' || commute.notificationChannel === 'both') {
        await sendSMS(commute.phone, msg, 'outbound_alert');
      }

      db.updateSavedCommute(commute.id, {
        lastAlertSentAt: new Date().toISOString()
      });
      console.log(`[Notification Worker] Commute alert dispatched to ${commute.phone} for Bus ${bus.busNumber}`);
    }
  }
}

async function processSMSAlerts() {
  const subs = db.getSMSSubscriptions().filter(s => s.active && s.stopId && s.busId);
  if (subs.length === 0) return;

  const activeTrips = db.getTrips().filter(t => t.status === 'in_progress');
  const allStops = db.getStops();

  for (const sub of subs) {
    const matchingTrip = activeTrips.find(t => t.busId === sub.busId);
    if (!matchingTrip) continue;

    const route = db.getRouteById(matchingTrip.routeId);
    const bus = db.getBusById(matchingTrip.busId);
    const loc = db.getLatestLocationByBusId(matchingTrip.busId);
    if (!route || !bus || !loc || isLocationStale(loc.timestamp)) continue;

    const etas = calculateTripStopETAs(loc, route, allStops, matchingTrip);
    const targetEta = etas.find(e => e.stop.id === sub.stopId);

    if (targetEta && !targetEta.isPassed && targetEta.estimatedMinutes <= sub.thresholdMinutes) {
      const timeStr = new Date(loc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const msg = `TransitEase: Bus ${bus.busNumber} is expected at ${targetEta.stop.name} in about ${targetEta.estimatedMinutes} minutes. Last GPS: ${timeStr}. Arrival is an estimate.`;

      await sendSMS(sub.mobile, msg, 'outbound_alert');

      // Once arrival alert threshold is reached, complete this subscription to prevent spamming
      sub.active = false;
      console.log(`[Notification Worker] SMS arrival alert delivered to ${sub.mobile}`);
    }
  }
}
