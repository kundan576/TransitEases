// Comprehensive Verification of TransitEase Authentication, RBAC, and MongoDB Atlas
import mongoose from 'mongoose';
import { loadEnvironment } from './backend/services/envLoader.js';

// Load active environment from .env
loadEnvironment();

const BASE_URL = 'http://localhost:3000';

async function runTestSuite() {
  console.log('===============================================================');
  console.log('🔒 TRANSITEASE AUTHENTICATION, RBAC & MONGO ATLAS TEST SUITE');
  console.log('===============================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`✅ [PASS] ${testName}${details ? ` -> ${details}` : ''}`);
      passedCount++;
    } else {
      console.error(`❌ [FAIL] ${testName}${details ? ` -> ${details}` : ''}`);
      failedCount++;
    }
  }

  // --------------------------------------------------------------------------
  // 1. MONGODB ATLAS DIRECT VERIFICATION
  // --------------------------------------------------------------------------
  console.log('--- 1. VERIFY MONGODB ATLAS ACTIVE STORAGE (NOT MOCK / JSON) ---');
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  const healthData = await healthRes.json();

  assert(healthRes.status === 200, 'Health endpoint responds 200 OK');
  assert(healthData.database.connectedToMongo === true, 'Database is connected to MongoDB Atlas');
  assert(healthData.database.storageType.includes('MongoDB Atlas'), 'Active storage type is MongoDB Atlas', healthData.database.storageType);
  assert(healthData.database.safeDiagnostics.sourceEnvFile === '.env', 'Configuration loaded from persistent .env');

  // Verify users exist in MongoDB Atlas via direct Mongoose connection
  const mongoUri = process.env.MONGODB_URI;
  if (mongoUri) {
    try {
      const conn = await mongoose.createConnection(mongoUri, { serverSelectionTimeoutMS: 5000 }).asPromise();
      const usersCount = await conn.collection('users').countDocuments();
      assert(usersCount > 0, 'Users collection directly queryable in MongoDB Atlas', `Found ${usersCount} users in Atlas`);
      const sampleUser = await conn.collection('users').findOne({ role: 'admin' }, { projection: { password: 0 } });
      assert(sampleUser !== null && sampleUser.role === 'admin', 'Found valid Admin account in Atlas', `Admin user id: ${sampleUser._id}`);
      await conn.close();
    } catch (e) {
      assert(false, 'Direct MongoDB Atlas query failed', e.message);
    }
  } else {
    assert(healthData.database.connectedToMongo === true, 'MongoDB Atlas verified via active server diagnostics');
  }

  // --------------------------------------------------------------------------
  // 2. REGISTRATION & PUBLIC ACCESS SECURITY
  // --------------------------------------------------------------------------
  console.log('\n--- 2. REGISTRATION FOR PASSENGER & DRIVER (ADMIN PROTECTED) ---');
  const testPassengerMobile = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
  const testDriverMobile = `9${Math.floor(100000000 + Math.random() * 900000000)}`;

  // 2a. Public registration for passenger
  const passengerRegRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Passenger Atlas',
      mobile: testPassengerMobile,
      password: 'PassengerPassword123!',
      role: 'passenger'
    })
  });
  const passengerRegData = await passengerRegRes.json();
  assert(passengerRegRes.status === 201, 'Public passenger registration returns 201 Created');
  assert(passengerRegData.user?.role === 'passenger', 'Registered user assigned passenger role');
  assert(typeof passengerRegData.token === 'string' && passengerRegData.token.length > 20, 'Returns signed JWT token');
  assert(passengerRegData.user.password === undefined, 'Password hash is excluded from response');

  // 2b. Public registration for driver (starts with pending status)
  const driverRegRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Driver Atlas',
      mobile: testDriverMobile,
      password: 'DriverPassword123!',
      role: 'driver',
      licenseNumber: 'DL-TEST-9988'
    })
  });
  const driverRegData = await driverRegRes.json();
  assert(driverRegRes.status === 201, 'Driver registration accepted (201 Created)');
  assert(driverRegData.user?.role === 'driver', 'Driver assigned driver role');
  assert(driverRegData.user?.driverStatus === 'pending', 'Driver status set to pending until admin verification');

  // 2c. Attempt to publicly register an Admin (Must be forbidden)
  const fakeAdminRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Hacker Admin',
      mobile: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      password: 'HackerPassword!',
      role: 'admin'
    })
  });
  assert(fakeAdminRes.status === 403, 'Rejects public admin creation with 403 Forbidden');

  // --------------------------------------------------------------------------
  // 3. LOGIN & ROLE MISMATCH VALIDATION FOR PASSENGER, DRIVER, ADMIN
  // --------------------------------------------------------------------------
  console.log('\n--- 3. AUTHENTICATION & LOGIN FOR PASSENGER, DRIVER, ADMIN ---');

  // 3a. Passenger login
  const passengerLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: testPassengerMobile, password: 'PassengerPassword123!', expectedRole: 'passenger' })
  });
  const passengerLoginData = await passengerLoginRes.json();
  assert(passengerLoginRes.status === 200, 'Passenger login succeeds with 200 OK');
  assert(passengerLoginData.user?.role === 'passenger', 'Authenticated passenger role is passenger');
  const passengerToken = passengerLoginData.token;

  // 3b. Driver login (existing verified demo driver)
  const driverLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: '9876543210', password: 'driver123', expectedRole: 'driver' })
  });
  const driverLoginData = await driverLoginRes.json();
  assert(driverLoginRes.status === 200, 'Driver login succeeds with 200 OK');
  assert(driverLoginData.user?.role === 'driver', 'Authenticated driver role is driver');
  const driverToken = driverLoginData.token;

  // 3c. Admin login
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@transitease.city', password: 'admin123', expectedRole: 'admin' })
  });
  const adminLoginData = await adminLoginRes.json();
  assert(adminLoginRes.status === 200, 'Admin login succeeds with 200 OK');
  assert(adminLoginData.user?.role === 'admin', 'Authenticated admin role is admin');
  const adminToken = adminLoginData.token;

  // 3d. Role Mismatch Prevention: Passenger credentials entered in Driver login
  const passengerInDriverLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: testPassengerMobile, password: 'PassengerPassword123!', expectedRole: 'driver' })
  });
  const mismatchDriverData = await passengerInDriverLogin.json();
  assert(passengerInDriverLogin.status === 403, 'Rejects passenger credentials submitted with driver role intent (403)');
  assert(mismatchDriverData.actualRole === 'passenger', 'Returns actualRole = passenger for specific UI role-mismatch message');

  // 3e. Role Mismatch Prevention: Passenger credentials entered in Admin login
  const passengerInAdminLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: testPassengerMobile, password: 'PassengerPassword123!', expectedRole: 'admin' })
  });
  const mismatchAdminData = await passengerInAdminLogin.json();
  assert(passengerInAdminLogin.status === 403, 'Rejects passenger credentials submitted with admin role intent (403)');
  assert(mismatchAdminData.actualRole === 'passenger', 'Returns actualRole = passenger for admin context mismatch');

  // 3f. Role Mismatch Prevention: Driver credentials entered in Passenger login
  const driverInPassengerLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: '9876543210', password: 'driver123', expectedRole: 'passenger' })
  });
  const mismatchPassData = await driverInPassengerLogin.json();
  assert(driverInPassengerLogin.status === 403, 'Rejects driver credentials submitted with passenger role intent (403)');
  assert(mismatchPassData.actualRole === 'driver', 'Returns actualRole = driver');

  // --------------------------------------------------------------------------
  // 4. JWT TOKEN VERIFICATION & SESSION PERSISTENCE (/api/auth/me)
  // --------------------------------------------------------------------------
  console.log('\n--- 4. JWT VALIDATION & SESSION REHYDRATION (/api/auth/me) ---');

  // 4a. Passenger session verification
  const passMeRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${passengerToken}` }
  });
  const passMeData = await passMeRes.json();
  assert(passMeRes.status === 200, 'Passenger session rehydration (/api/auth/me) returns 200 OK');
  assert(passMeData.user?.role === 'passenger', 'Rehydrated user role is passenger');
  assert(passMeData.user?.mobile === testPassengerMobile, 'Rehydrated user mobile matches registered mobile');

  // 4b. Driver session verification
  const driverMeRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${driverToken}` }
  });
  const driverMeData = await driverMeRes.json();
  assert(driverMeRes.status === 200, 'Driver session rehydration (/api/auth/me) returns 200 OK');
  assert(driverMeData.user?.role === 'driver', 'Rehydrated user role is driver');

  // 4c. Admin session verification
  const adminMeRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const adminMeData = await adminMeRes.json();
  assert(adminMeRes.status === 200, 'Admin session rehydration (/api/auth/me) returns 200 OK');
  assert(adminMeData.user?.role === 'admin', 'Rehydrated user role is admin');

  // 4d. Unauthenticated request to /api/auth/me
  const unauthMe = await fetch(`${BASE_URL}/api/auth/me`);
  assert(unauthMe.status === 401, 'Unauthenticated request to /api/auth/me returns 401 Unauthorized');

  // 4e. Invalid / Tampered token to /api/auth/me
  const tamperedMe = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: 'Bearer this_is_a_tampered_invalid_token_12345' }
  });
  assert(tamperedMe.status === 401, 'Tampered JWT token rejected with 401 Unauthorized');

  // --------------------------------------------------------------------------
  // 5. ROLE-BASED ACCESS CONTROL (RBAC) BOUNDARY ENFORCEMENT
  // --------------------------------------------------------------------------
  console.log('\n--- 5. RBAC API BOUNDARY RESTRICTIONS ---');

  // 5a. Passenger cannot access Driver APIs
  const pDriverStatus = await fetch(`${BASE_URL}/api/driver/status`, {
    headers: { Authorization: `Bearer ${passengerToken}` }
  });
  assert(pDriverStatus.status === 403, 'Blocks Passenger from /api/driver/status (403 Forbidden)');

  const pDriverLocation = await fetch(`${BASE_URL}/api/driver/location`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${passengerToken}`
    },
    body: JSON.stringify({ lat: 28.5, lng: 77.5 })
  });
  assert(pDriverLocation.status === 403, 'Blocks Passenger from /api/driver/location (403 Forbidden)');

  // 5b. Passenger cannot access Admin APIs
  const pAdminStats = await fetch(`${BASE_URL}/api/admin/stats`, {
    headers: { Authorization: `Bearer ${passengerToken}` }
  });
  assert(pAdminStats.status === 403, 'Blocks Passenger from /api/admin/stats (403 Forbidden)');

  const pAdminCreateBus = await fetch(`${BASE_URL}/api/admin/buses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${passengerToken}`
    },
    body: JSON.stringify({ busNumber: 'HAX-999', registrationNumber: 'UP16-HAX', capacity: 40 })
  });
  assert(pAdminCreateBus.status === 403, 'Blocks Passenger from /api/admin/buses POST (403 Forbidden)');

  // 5c. Driver cannot access Admin APIs
  const dAdminStats = await fetch(`${BASE_URL}/api/admin/stats`, {
    headers: { Authorization: `Bearer ${driverToken}` }
  });
  assert(dAdminStats.status === 403, 'Blocks Driver from /api/admin/stats (403 Forbidden)');

  const dAdminDrivers = await fetch(`${BASE_URL}/api/admin/drivers`, {
    headers: { Authorization: `Bearer ${driverToken}` }
  });
  assert(dAdminDrivers.status === 403, 'Blocks Driver from /api/admin/drivers (403 Forbidden)');

  // 5d. Authorized Driver can access Driver APIs
  const dDriverStatus = await fetch(`${BASE_URL}/api/driver/status`, {
    headers: { Authorization: `Bearer ${driverToken}` }
  });
  assert(dDriverStatus.status === 200, 'Authorizes Driver to access /api/driver/status (200 OK)');

  // 5e. Authorized Admin can access Admin APIs
  const aAdminStats = await fetch(`${BASE_URL}/api/admin/stats`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(aAdminStats.status === 200, 'Authorizes Admin to access /api/admin/stats (200 OK)');

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`TOTAL CHECKS: ${passedCount + failedCount} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
  console.log('===============================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
