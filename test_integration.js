// Automated Integration Test for MongoDB, JWT Authentication, Role Authorization, and GPS Tracking
const BASE_URL = 'http://localhost:3000';

async function testSuite() {
  console.log('====================================================');
  console.log('🚀 TRANSITEASE: INTEGRATION & SECURITY VERIFICATION');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // TEST 1: Database Health & Connectivity
  console.log('\n--- 1. DATABASE CONNECTIVITY ---');
  try {
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200, 'Health endpoint responds with 200 OK');
    assert(healthData.status === 'healthy', 'System status is healthy');
    assert(healthData.database && typeof healthData.database.records.users === 'number', 'Database records reporting active');
    console.log(`   Storage mode: ${healthData.database.storageType}`);
    console.log(`   Registered Users: ${healthData.database.records.users}, Buses: ${healthData.database.records.buses}, Stops: ${healthData.database.records.busStops}`);
  } catch (err) {
    assert(false, `Health endpoint failed: ${err.message}`);
  }

  // TEST 2: User Registration & Validation
  console.log('\n--- 2. REGISTRATION & BCRYPT PASSWORD HASHING ---');
  const testMobile = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
  let passengerToken = '';
  let passengerId = '';

  try {
    // 2a. Validation: Missing password should fail
    const badReg = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test User', mobile: testMobile })
    });
    assert(badReg.status === 400, 'Rejects registration when required fields are missing (400)');

    // 2b. Validation: Public registration cannot create admin
    const adminRegAttempt = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Fake Admin', mobile: '9111222333', password: 'password123', role: 'admin' })
    });
    assert(adminRegAttempt.status === 403, 'Rejects public admin registration attempts (403)');

    // 2c. Valid Passenger Registration
    const validReg = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Automated Test Passenger',
        mobile: testMobile,
        password: 'SecurePassword123!',
        role: 'passenger'
      })
    });
    const regData = await validReg.json();
    assert(validReg.status === 201, 'Registers new passenger with 201 Created');
    assert(typeof regData.token === 'string' && regData.token.length > 20, 'Returns signed JWT token on registration');
    assert(regData.user.role === 'passenger', 'User assigned passenger role');
    assert(regData.user.password === undefined, 'Password hash is NOT exposed in response');
    passengerToken = regData.token;
    passengerId = regData.user.id;

    // 2d. Duplicate Mobile Rejection
    const dupReg = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate Passenger',
        mobile: testMobile,
        password: 'AnotherPassword',
        role: 'passenger'
      })
    });
    assert(dupReg.status === 409, 'Rejects duplicate mobile registration (409 Conflict)');
  } catch (err) {
    assert(false, `Registration suite failed: ${err.message}`);
  }

  // TEST 3: Login & JWT Authentication
  console.log('\n--- 3. LOGIN & JWT AUTHENTICATION ---');
  try {
    // 3a. Invalid password rejection
    const badLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testMobile, password: 'WrongPassword' })
    });
    assert(badLogin.status === 401, 'Rejects incorrect password (401 Unauthorized)');

    // 3b. Successful Login
    const goodLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testMobile, password: 'SecurePassword123!' })
    });
    const loginData = await goodLogin.json();
    assert(goodLogin.status === 200, 'Logs in successfully with correct credentials (200 OK)');
    assert(typeof loginData.token === 'string', 'Returns fresh JWT token');
    passengerToken = loginData.token;

    // 3c. Protected /api/auth/me Profile verification
    const profileRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${passengerToken}` }
    });
    const profileData = await profileRes.json();
    assert(profileRes.status === 200, 'Retrieves authenticated profile via Bearer JWT token');
    assert(profileData.user.mobile === testMobile, 'Profile mobile matches registered user');
  } catch (err) {
    assert(false, `Login suite failed: ${err.message}`);
  }

  // TEST 4: Role-Based Authorization
  console.log('\n--- 4. ROLE-BASED ACCESS CONTROL (RBAC) ---');
  let driverToken = '';
  let adminToken = '';

  try {
    // 4a. Passenger tries to access Driver-only endpoint -> MUST BE 403
    const passengerDriverAttempt = await fetch(`${BASE_URL}/api/driver/status`, {
      headers: { Authorization: `Bearer ${passengerToken}` }
    });
    assert(passengerDriverAttempt.status === 403, 'Blocks passenger from driver portal (/api/driver/status -> 403 Forbidden)');

    // 4b. Passenger tries to access Admin-only endpoint -> MUST BE 403
    const passengerAdminAttempt = await fetch(`${BASE_URL}/api/admin/stats`, {
      headers: { Authorization: `Bearer ${passengerToken}` }
    });
    assert(passengerAdminAttempt.status === 403, 'Blocks passenger from admin console (/api/admin/stats -> 403 Forbidden)');

    // 4c. Driver Login & Driver Access
    const driverLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: '9876543210', password: 'driver123' })
    });
    const driverData = await driverLogin.json();
    assert(driverLogin.status === 200 && driverData.user.role === 'driver', 'Driver logs in successfully');
    driverToken = driverData.token;

    // Driver accesses Driver endpoint -> MUST BE 200
    const driverStatus = await fetch(`${BASE_URL}/api/driver/status`, {
      headers: { Authorization: `Bearer ${driverToken}` }
    });
    assert(driverStatus.status === 200, 'Allows verified driver to access driver status');

    // Driver tries to access Admin endpoint -> MUST BE 403
    const driverAdminAttempt = await fetch(`${BASE_URL}/api/admin/stats`, {
      headers: { Authorization: `Bearer ${driverToken}` }
    });
    assert(driverAdminAttempt.status === 403, 'Blocks driver from admin endpoints (/api/admin/stats -> 403 Forbidden)');

    // 4d. Admin Login & Full Access
    const adminLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin@transitease.city', password: 'admin123' })
    });
    const adminData = await adminLogin.json();
    assert(adminLogin.status === 200 && adminData.user.role === 'admin', 'Administrator logs in successfully');
    adminToken = adminData.token;

    const adminStats = await fetch(`${BASE_URL}/api/admin/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminStats.status === 200, 'Allows admin to access admin console (/api/admin/stats -> 200 OK)');
  } catch (err) {
    assert(false, `RBAC suite failed: ${err.message}`);
  }

  // TEST 5: Real Driver GPS Updates & Passenger Retrieval
  console.log('\n--- 5. DRIVER GPS UPDATE & PASSENGER RETRIEVAL ---');
  try {
    // 5a. Driver starts trip
    const startTripRes = await fetch(`${BASE_URL}/api/driver/start-trip`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverToken}`
      }
    });
    assert(startTripRes.status === 200 || startTripRes.status === 201, 'Driver trip initialized or active');

    // 5b. Driver submits high-accuracy smartphone GPS coordinates
    const testLat = 28.47250;
    const testLng = 77.50980;
    const testSpeed = 10; // ~36 km/h
    const testTime = new Date().toISOString();

    const locUpdateRes = await fetch(`${BASE_URL}/api/driver/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${driverToken}`
      },
      body: JSON.stringify({
        lat: testLat,
        lng: testLng,
        speed: testSpeed,
        heading: 85,
        accuracy: 4.8,
        timestamp: testTime
      })
    });
    const locUpdateData = await locUpdateRes.json();
    assert(locUpdateRes.status === 200 && locUpdateData.success === true, 'Driver smartphone GPS update accepted and stored (200 OK)');

    // 5c. Passenger searches bus by Bus Number ('UP16-1001')
    const busSearchRes = await fetch(`${BASE_URL}/api/buses/search?query=UP16-1001`);
    const busSearchData = await busSearchRes.json();
    assert(busSearchRes.status === 200 && busSearchData.found === true, 'Passenger finds bus by Bus Number');
    assert(busSearchData.location && Math.abs(busSearchData.location.lat - testLat) < 0.001, 'Passenger view displays latest actual stored GPS latitude');
    assert(busSearchData.location && Math.abs(busSearchData.location.lng - testLng) < 0.001, 'Passenger view displays latest actual stored GPS longitude');
    assert(busSearchData.location.speed === 36, 'Speed conversion (10 m/s -> 36 km/h) accurate');

    // 5d. Passenger searches bus by Driver's Mobile Number ('9876543210')
    const driverSearchRes = await fetch(`${BASE_URL}/api/buses/driver-phone?phone=9876543210`);
    const driverSearchData = await driverSearchRes.json();
    assert(driverSearchRes.status === 200 && driverSearchData.found === true, 'Passenger finds bus by Driver registered mobile number');
    assert(driverSearchData.isSharing === true, 'Driver reported as actively sharing live GPS');
    assert(driverSearchData.driver.maskedMobile.includes('*****'), 'Driver personal mobile number is securely masked for privacy (+91 98765*****)');
    assert(driverSearchData.location && Math.abs(driverSearchData.location.lat - testLat) < 0.001, 'Coordinates match driver\'s stored GPS position');
  } catch (err) {
    assert(false, `GPS integration suite failed: ${err.message}`);
  }

  // TEST 6: Data Persistence & Stop Retrieval
  console.log('\n--- 6. DATA PERSISTENCE & STOPS ---');
  try {
    const stopsRes = await fetch(`${BASE_URL}/api/stops`);
    const stopsData = await stopsRes.json();
    assert(stopsRes.status === 200, 'Stops retrieved from database (200 OK)');
    assert(Array.isArray(stopsData.stops) && stopsData.stops.length > 0, `Stops populated (${stopsData.stops.length} stops found)`);

    const routesRes = await fetch(`${BASE_URL}/api/routes`);
    const routesData = await routesRes.json();
    assert(routesRes.status === 200 && Array.isArray(routesData.routes), 'Routes retrieved from database');
  } catch (err) {
    assert(false, `Data persistence suite failed: ${err.message}`);
  }

  console.log('\n====================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

testSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
