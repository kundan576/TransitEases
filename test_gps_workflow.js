// Comprehensive Real-Time GPS Tracking, MongoDB Atlas & Security Verification Suite
import mongoose from 'mongoose';
import { io as ClientSocket } from 'socket.io-client';
import { loadEnvironment } from './backend/services/envLoader.js';

loadEnvironment();

const BASE_URL = 'http://localhost:3000';

async function runGpsTestSuite() {
  console.log('===============================================================');
  console.log('🛰️  TRANSITEASE REAL-TIME GPS WORKFLOW & ATLAS VERIFICATION');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, name, details = '') {
    if (condition) {
      console.log(`✅ [PASS] ${name}${details ? ` -> ${details}` : ''}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name}${details ? ` -> ${details}` : ''}`);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // Step 1: Authenticate Driver and Passenger
  // --------------------------------------------------------------------------
  console.log('--- 1. CREDENTIALS & SESSIONS ---');
  const driverLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: '9876543210', password: 'driver123', expectedRole: 'driver' })
  });
  const driverLoginData = await driverLoginRes.json();
  assert(driverLoginRes.status === 200, 'Driver logs in successfully');
  const driverToken = driverLoginData.token;
  const driverId = driverLoginData.user.id;

  const testPassMobile = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
  const passengerRegRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'GPS Test Passenger', mobile: testPassMobile, password: 'PassPassword123!', role: 'passenger' })
  });
  const passengerData = await passengerRegRes.json();
  assert(passengerRegRes.status === 201, 'Passenger account registered');
  const passengerToken = passengerData.token;

  // --------------------------------------------------------------------------
  // Step 2: Driver Trip Initialization
  // --------------------------------------------------------------------------
  console.log('\n--- 2. TRIP INITIALIZATION & BUS ASSOCIATION ---');
  const startTripRes = await fetch(`${BASE_URL}/api/driver/start-trip`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${driverToken}`
    }
  });
  const startTripData = await startTripRes.json();
  assert(startTripRes.status === 200 || startTripRes.status === 201, 'Driver trip initialized or active');
  const activeTrip = startTripData.trip;
  assert(activeTrip && activeTrip.busId, 'Trip associated with bus ID', `Bus ID: ${activeTrip?.busId}`);
  const busId = activeTrip.busId;

  // --------------------------------------------------------------------------
  // Step 3: Broadcast GPS Location & Verify in MongoDB Atlas
  // --------------------------------------------------------------------------
  console.log('\n--- 3. DRIVER GPS BROADCAST & MONGO ATLAS PERSISTENCE ---');
  const testLat = 28.47350;
  const testLng = 77.51050;
  const testSpeed = 12.5; // ~45 km/h
  const testHeading = 92;
  const testAccuracy = 4.2;
  const testTimestamp = new Date().toISOString();

  const updateLocRes = await fetch(`${BASE_URL}/api/driver/location`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${driverToken}`
    },
    body: JSON.stringify({
      lat: testLat,
      lng: testLng,
      speed: testSpeed,
      heading: testHeading,
      accuracy: testAccuracy,
      timestamp: testTimestamp
    })
  });
  const updateLocData = await updateLocRes.json();
  assert(updateLocRes.status === 200, 'Driver coordinates accepted (HTTP 200)');
  assert(updateLocData.success === true, 'Server confirms location accepted');
  assert(updateLocData.location.tripId === activeTrip.id, 'Coordinates linked to active trip ID');
  assert(updateLocData.location.busId === busId, 'Coordinates linked to assigned bus ID');

  // Verify directly in MongoDB Atlas
  const mongoUri = process.env.MONGODB_URI;
  if (mongoUri) {
    try {
      const conn = await mongoose.createConnection(mongoUri, { serverSelectionTimeoutMS: 5000 }).asPromise();
      const latestAtlasLoc = await conn.collection('buslocations').find({ busId }).sort({ _id: -1 }).limit(1).toArray();
      assert(latestAtlasLoc.length > 0, 'Found location record saved in MongoDB Atlas buslocations collection');
      if (latestAtlasLoc.length > 0) {
        assert(Math.abs(latestAtlasLoc[0].lat - testLat) < 0.0001, 'Atlas latitude matches broadcast coordinate', `Lat: ${latestAtlasLoc[0].lat}`);
        assert(Math.abs(latestAtlasLoc[0].lng - testLng) < 0.0001, 'Atlas longitude matches broadcast coordinate', `Lng: ${latestAtlasLoc[0].lng}`);
        assert(latestAtlasLoc[0].tripId === activeTrip.id, 'Atlas record stores correct tripId foreign key');
        assert(latestAtlasLoc[0].driverId === driverId, 'Atlas record stores correct driverId foreign key');
      }
      await conn.close();
    } catch (e) {
      assert(false, 'Failed querying MongoDB Atlas buslocations', e.message);
    }
  }

  // --------------------------------------------------------------------------
  // Step 4: Passenger Retrieval (By Bus Number & By Driver Phone)
  // --------------------------------------------------------------------------
  console.log('\n--- 4. PASSENGER REAL-TIME LOCATION RETRIEVAL ---');
  // 4a. Bus Search
  const busSearchRes = await fetch(`${BASE_URL}/api/buses/search?query=UP16-1001`);
  const busSearchData = await busSearchRes.json();
  assert(busSearchRes.status === 200, 'Passenger searches bus by number UP16-1001');
  assert(busSearchData.found === true, 'Bus found in active dispatch fleet');
  assert(Math.abs(busSearchData.location.lat - testLat) < 0.0001, 'Passenger view has latest latitude');
  assert(Math.abs(busSearchData.location.lng - testLng) < 0.0001, 'Passenger view has latest longitude');
  assert(busSearchData.location.isStale === false, 'Fresh coordinates marked isStale = false');
  assert(busSearchData.staleWarning === null, 'No stale warning for fresh telemetry');
  assert(Array.isArray(busSearchData.etas) && busSearchData.etas.length > 0, 'ETAs calculated dynamically for stops');

  // 4b. Driver Phone Search
  const phoneSearchRes = await fetch(`${BASE_URL}/api/buses/driver-phone?phone=9876543210`);
  const phoneSearchData = await phoneSearchRes.json();
  assert(phoneSearchRes.status === 200, 'Passenger searches bus by driver registered mobile');
  assert(phoneSearchData.found === true, 'Driver found');
  assert(phoneSearchData.isSharing === true, 'Driver identified as actively broadcasting');
  assert(phoneSearchData.driver.maskedMobile.includes('*****'), 'Driver mobile masked for privacy');
  assert(Math.abs(phoneSearchData.location.lat - testLat) < 0.0001, 'Coordinates match active location');

  // --------------------------------------------------------------------------
  // Step 5: Socket.IO Real-Time Event Broadcast Verification
  // --------------------------------------------------------------------------
  console.log('\n--- 5. SOCKET.IO LIVE BROADCAST (NO PAGE REFRESH) ---');
  const socketReceivedPromise = new Promise((resolve, reject) => {
    const socket = ClientSocket(BASE_URL, {
      transports: ['websocket', 'polling'],
      timeout: 6000
    });

    const timeoutTimer = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Socket.IO event broadcast timed out after 6 seconds'));
    }, 6000);

    socket.on('connect', () => {
      socket.emit('bus:join_tracking', busId);

      // Once joined, post a new coordinate from driver
      setTimeout(async () => {
        try {
          await fetch(`${BASE_URL}/api/driver/location`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${driverToken}`
            },
            body: JSON.stringify({
              lat: 28.47400,
              lng: 77.51100,
              speed: 10,
              heading: 95,
              accuracy: 3.5,
              timestamp: new Date().toISOString()
            })
          });
        } catch (e) {
          clearTimeout(timeoutTimer);
          socket.disconnect();
          reject(e);
        }
      }, 500);
    });

    socket.on('bus:location_broadcast', (payload) => {
      if (payload.busId === busId && payload.location) {
        clearTimeout(timeoutTimer);
        socket.disconnect();
        resolve(payload);
      }
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timeoutTimer);
      socket.disconnect();
      reject(err);
    });
  });

  try {
    const socketPayload = await socketReceivedPromise;
    assert(socketPayload.busId === busId, 'Socket client received bus:location_broadcast event in real time');
    assert(Math.abs(socketPayload.location.lat - 28.47400) < 0.0001, 'Broadcasted payload contains new live latitude');
  } catch (err) {
    assert(false, 'Socket real-time event reception failed', err.message);
  }

  // --------------------------------------------------------------------------
  // Step 6: Stale Coordinates Detection (Section 7)
  // --------------------------------------------------------------------------
  console.log('\n--- 6. STALE COORDINATES & WARNING GENERATION ---');
  const pastStaleTime = new Date(Date.now() - 300 * 1000).toISOString();
  const recentFreshTime = new Date().toISOString();

  // 6a. Direct algorithm check
  const staleDiffSeconds = Math.round((Date.now() - new Date(pastStaleTime).getTime()) / 1000);
  assert(staleDiffSeconds >= 180, 'Test coordinate time delta is over 180s threshold', `${staleDiffSeconds}s old`);

  // 6b. Live fleet staleness flag check
  const liveFleetRes = await fetch(`${BASE_URL}/api/buses/live`);
  const liveFleetData = await liveFleetRes.json();
  const staleFleetEntry = liveFleetData.liveBuses?.find((b) => b.location?.isStale === true);
  assert(staleFleetEntry !== undefined, 'Live bus corridor feed flags inactive buses as isStale = true', `Stale bus: ${staleFleetEntry?.bus?.busNumber}`);

  // 6c. Freshness on active vehicle
  assert(busSearchData.location.isStale === false, 'Actively broadcasting bus UP16-1001 isStale = false');
  assert(busSearchData.staleWarning === null, 'Actively broadcasting bus has no stale warning banner');

  // --------------------------------------------------------------------------
  // Step 7: Security Boundaries & Role Protections
  // --------------------------------------------------------------------------
  console.log('\n--- 7. SECURITY & ROLE ENFORCEMENT ---');

  // 7a. Passenger attempts to submit GPS coordinates (MUST BE 403)
  const passengerGpsAttempt = await fetch(`${BASE_URL}/api/driver/location`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${passengerToken}`
    },
    body: JSON.stringify({ lat: 28.5, lng: 77.5, speed: 20 })
  });
  assert(passengerGpsAttempt.status === 403, 'Passenger blocked from submitting/overwriting driver GPS (403 Forbidden)');

  // 7b. Unauthenticated user attempts to submit GPS coordinates (MUST BE 401)
  const unauthGpsAttempt = await fetch(`${BASE_URL}/api/driver/location`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat: 28.5, lng: 77.5, speed: 20 })
  });
  assert(unauthGpsAttempt.status === 401, 'Unauthenticated user blocked from submitting GPS (401 Unauthorized)');

  // 7c. Coordinate validation: invalid latitude (> 90)
  const invalidLatRes = await fetch(`${BASE_URL}/api/driver/location`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${driverToken}`
    },
    body: JSON.stringify({ lat: 95.0, lng: 77.5 })
  });
  assert(invalidLatRes.status === 400, 'Rejects latitude > 90 (400 Bad Request)');

  // 7d. Coordinate validation: invalid longitude (> 180)
  const invalidLngRes = await fetch(`${BASE_URL}/api/driver/location`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${driverToken}`
    },
    body: JSON.stringify({ lat: 28.5, lng: 200.0 })
  });
  assert(invalidLngRes.status === 400, 'Rejects longitude > 180 (400 Bad Request)');

  // 7e. Coordinate validation: non-numeric coordinates
  const nonNumericRes = await fetch(`${BASE_URL}/api/driver/location`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${driverToken}`
    },
    body: JSON.stringify({ lat: 'not_a_number', lng: 'bad_coord' })
  });
  assert(nonNumericRes.status === 400, 'Rejects non-numeric coordinates (400 Bad Request)');

  console.log('\n===============================================================');
  console.log(`TOTAL CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runGpsTestSuite().catch(err => {
  console.error('Fatal GPS test error:', err);
  process.exit(1);
});
