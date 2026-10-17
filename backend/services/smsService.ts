import { db } from './db.js';
import { calculateTripStopETAs, isLocationStale } from './etaService.js';
import { SMSMessageLog, SMSSubscription } from '../types.js';

export interface SendSMSResult {
  success: boolean;
  messageId: string;
  status: 'delivered' | 'sent' | 'simulated' | 'failed';
  provider: string;
  error?: string;
}

export async function sendSMS(toMobile: string, message: string, commandType: SMSMessageLog['type'] = 'outbound_alert'): Promise<SendSMSResult> {
  const cleanMobile = toMobile.replace(/\D/g, '').slice(-10);
  const messageId = `sms-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // Real SMS sending is disabled per project configuration so network calls never block login, DB, or GPS
  const logEntry: SMSMessageLog = {
    id: messageId,
    mobile: cleanMobile,
    message,
    type: commandType,
    status: 'simulated',
    provider: 'simulator',
    timestamp: new Date().toISOString()
  };
  db.addSMSLog(logEntry);

  return {
    success: true,
    messageId,
    status: 'simulated',
    provider: 'simulator'
  };
}

export async function processInboundSMS(fromMobile: string, rawText: string): Promise<string> {
  const cleanMobile = fromMobile.replace(/\D/g, '').slice(-10);
  const text = rawText.trim();
  const parts = text.split(/\s+/);
  const command = parts[0]?.toUpperCase() || 'HELP';

  // Log incoming command
  db.addSMSLog({
    id: `inbound-${Date.now()}`,
    mobile: cleanMobile,
    message: rawText,
    type: 'inbound_command',
    status: 'delivered',
    provider: process.env.SMS_PROVIDER || 'simulator',
    command,
    timestamp: new Date().toISOString()
  });

  let reply = '';

  switch (command) {
    case 'BUS': {
      const busNumQuery = parts[1];
      if (!busNumQuery) {
        reply = 'TransitEase: Please specify bus number. Example: BUS UP16-1001';
        break;
      }
      const bus = db.getBusByNumber(busNumQuery);
      if (!bus) {
        reply = `TransitEase: Bus ${busNumQuery} not found in city registry. Send HELP for assistance.`;
        break;
      }
      const activeTrip = db.getActiveTripByBusId(bus.id);
      if (!activeTrip) {
        reply = `TransitEase: Bus ${bus.busNumber} is registered (${bus.registrationNumber}) but is currently NOT on an active trip.`;
        break;
      }
      const loc = db.getLatestLocationByBusId(bus.id);
      const route = db.getRouteById(activeTrip.routeId);
      const allStops = db.getStops();

      if (!loc) {
        reply = `TransitEase: Bus ${bus.busNumber} is on Route ${route?.routeNumber || 'Active'}, but driver has not shared GPS yet.`;
      } else {
        const stale = isLocationStale(loc.timestamp);
        const etas = route ? calculateTripStopETAs(loc, route, allStops, activeTrip) : [];
        const nextStopEta = etas.find(e => !e.isPassed);
        const timeStr = new Date(loc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (stale) {
          reply = `TransitEase: Bus ${bus.busNumber} (Route ${route?.routeNumber || ''}). Warning: Last GPS was at ${timeStr} and may not be current. Status: in_progress.`;
        } else {
          reply = `TransitEase: Bus ${bus.busNumber} live at ${loc.speed}km/h. Next: ${nextStopEta ? nextStopEta.stop.name : 'Terminal'} in ~${nextStopEta ? nextStopEta.estimatedMinutes : 0}m. Crowd: ${bus.crowdLevel.replace('_', ' ')}. (GPS: ${timeStr})`;
        }
      }
      break;
    }

    case 'STOP': {
      const stopCode = parts[1]?.toUpperCase();
      if (!stopCode) {
        reply = 'TransitEase: Please enter stop code. Example: STOP KNP01. Codes are printed on bus stop signs.';
        break;
      }
      const stop = db.getStopByCode(stopCode);
      if (!stop) {
        reply = `TransitEase: Stop code ${stopCode} not found. Check stop sign or send HELP.`;
        break;
      }

      // Find active trips passing this stop
      const allRoutes = db.getRoutes().filter(r => r.stops.some(s => s.stopId === stop.id));
      const activeTrips = db.getTrips().filter(t => t.status === 'in_progress' && allRoutes.some(r => r.id === t.routeId));

      if (activeTrips.length === 0) {
        reply = `TransitEase: Stop ${stop.code} (${stop.name}). No active buses currently approaching this stop.`;
      } else {
        const arrivals: string[] = [];
        for (const trip of activeTrips) {
          const bus = db.getBusById(trip.busId);
          const route = db.getRouteById(trip.routeId);
          const loc = db.getLatestLocationByBusId(trip.busId);
          if (bus && route) {
            const etas = calculateTripStopETAs(loc, route, db.getStops(), trip);
            const thisStopEta = etas.find(e => e.stop.id === stop.id);
            if (thisStopEta && !thisStopEta.isPassed) {
              arrivals.push(`${bus.busNumber} in ~${thisStopEta.estimatedMinutes}m`);
            }
          }
        }
        if (arrivals.length === 0) {
          reply = `TransitEase: Stop ${stop.code} (${stop.name}). Approaching buses have already passed or are starting soon.`;
        } else {
          reply = `TransitEase: Stop ${stop.code} (${stop.name}). Next arrivals: ${arrivals.join(', ')}.`;
        }
      }
      break;
    }

    case 'ROUTE': {
      const fromCode = parts[1]?.toUpperCase();
      const toCode = parts[2]?.toUpperCase();
      if (!fromCode || !toCode) {
        reply = 'TransitEase: Specify origin and destination. Example: ROUTE KNP01 SRJ05';
        break;
      }
      const fromStop = db.getStopByCode(fromCode);
      const toStop = db.getStopByCode(toCode);
      if (!fromStop || !toStop) {
        reply = 'TransitEase: One or both stop codes were not found. Example: ROUTE KNP01 SRJ05';
        break;
      }

      const matchingRoute = db.getRoutes().find(r => {
        const idx1 = r.stops.findIndex(s => s.stopId === fromStop.id);
        const idx2 = r.stops.findIndex(s => s.stopId === toStop.id);
        return idx1 !== -1 && idx2 !== -1 && idx1 < idx2;
      });

      if (!matchingRoute) {
        reply = `TransitEase: No direct bus route found between ${fromCode} and ${toCode}. Multi-stop transfers coming soon.`;
      } else {
        const idx1 = matchingRoute.stops.findIndex(s => s.stopId === fromStop.id);
        const idx2 = matchingRoute.stops.findIndex(s => s.stopId === toStop.id);
        const stopsCount = idx2 - idx1;
        const approxMins = (idx2 - idx1) * 7;
        reply = `TransitEase: Take Route ${matchingRoute.routeNumber} (${matchingRoute.name}). ${stopsCount} stops, ~${approxMins} mins. Base fare ₹${matchingRoute.fareBase}.`;
      }
      break;
    }

    case 'ALERT': {
      const busNumQuery = parts[1];
      const stopCodeQuery = parts[2]?.toUpperCase();
      const minsThreshold = parseInt(parts[3] || '10', 10);

      if (!busNumQuery || !stopCodeQuery) {
        reply = 'TransitEase: Format: ALERT <busNumber> <stopCode> <mins>. Example: ALERT UP16-1001 KNP01 10';
        break;
      }

      const bus = db.getBusByNumber(busNumQuery);
      const stop = db.getStopByCode(stopCodeQuery);
      if (!bus) {
        reply = `TransitEase: Bus ${busNumQuery} not found.`;
        break;
      }
      if (!stop) {
        reply = `TransitEase: Stop code ${stopCodeQuery} not found.`;
        break;
      }

      const sub: SMSSubscription = {
        id: `sub-${Date.now()}`,
        mobile: cleanMobile,
        consent: true,
        language: 'en',
        busId: bus.id,
        stopId: stop.id,
        thresholdMinutes: minsThreshold > 0 ? minsThreshold : 10,
        active: true,
        subscribedAt: new Date().toISOString()
      };
      db.addSMSSubscription(sub);

      reply = `TransitEase: Alert active! We will SMS you ${sub.thresholdMinutes} mins before Bus ${bus.busNumber} reaches ${stop.name}. Reply CANCEL to stop.`;
      break;
    }

    case 'MYALERTS': {
      const subs = db.getSMSSubscriptions(cleanMobile).filter(s => s.active);
      if (subs.length === 0) {
        reply = 'TransitEase: You have no active SMS arrival alerts. Set one with ALERT <bus> <stop> <mins>.';
      } else {
        const details = subs.map(s => {
          const bus = s.busId ? db.getBusById(s.busId)?.busNumber : 'Bus';
          const stop = s.stopId ? db.getStopById(s.stopId)?.code : 'Stop';
          return `${bus}@${stop} (${s.thresholdMinutes}m)`;
        }).join(', ');
        reply = `TransitEase: Your active alerts: ${details}. Reply CANCEL to remove all.`;
      }
      break;
    }

    case 'CANCEL':
    case 'STOP': {
      // In SMS telecom standards, sending CANCEL or STOP cancels subscription
      const cancelled = db.cancelSMSSubscriptionsByMobile(cleanMobile);
      reply = `TransitEase: You have unsubscribed from arrival alerts (${cancelled} cancelled). You will receive no further automatic SMS.`;
      break;
    }

    case 'HELP':
    default: {
      reply = 'TransitEase SMS Commands: BUS <num> (live GPS), STOP <code> (arrivals), ROUTE <s1> <s2> (journey), ALERT <bus> <stop> <m>, MYALERTS, CANCEL.';
      break;
    }
  }

  // Send reply log
  await sendSMS(cleanMobile, reply, 'reply_command');
  return reply;
}
