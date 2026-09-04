/**
 * Automated Test Script for Auth APIs
 * Tests: Register, Login, Token generation, Error handling, and Protected routes.
 */

const dotenv = require('dotenv');
dotenv.config();

const BASE_URL = process.env.TEST_URL || `http://localhost:${process.env.PORT || 5000}`;

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, detail = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${testName} ${detail ? `-> ${detail}` : ''}`);
  }
}

async function runTests() {
  console.log('========================================================');
  console.log(`🧪 Starting Auth API Test Suite against: ${BASE_URL}`);
  console.log('========================================================\n');

  const timestamp = Date.now();
  const testUser = {
    name: 'Jane Doe',
    email: `jane_${timestamp}@example.com`,
    password: 'securePassword123!',
    role: 'moderator',
  };

  let authToken = null;

  // 1. Health check
  try {
    console.log('🔹 1. Health Check Endpoint');
    const res = await fetch(`${BASE_URL}/api/health`);
    const data = await res.json();
    assert(res.status === 200, 'GET /api/health returns 200 OK');
    assert(data.status === 'ok', 'Health status is "ok"');
  } catch (err) {
    assert(false, 'GET /api/health failed to connect', err.message);
  }

  // 2. Register validations
  console.log('\n🔹 2. Registration Input Validation');
  try {
    // Missing fields
    const resEmpty = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Incomplete' }),
    });
    assert(resEmpty.status === 400, 'Register with missing fields returns 400');

    // Invalid email
    const resBadEmail = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bad', email: 'not-an-email', password: 'password123' }),
    });
    assert(resBadEmail.status === 400, 'Register with invalid email format returns 400');

    // Short password
    const resShortPass = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Short', email: 'short@example.com', password: '123' }),
    });
    assert(resShortPass.status === 400, 'Register with password < 6 chars returns 400');
  } catch (err) {
    assert(false, 'Register validation error', err.message);
  }

  // 3. Successful Registration
  console.log('\n🔹 3. User Registration (Happy Path)');
  try {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    });
    const data = await res.json();

    assert(res.status === 201, 'POST /api/auth/register returns 201 Created');
    assert(data.success === true, 'Response success is true');
    assert(typeof data.token === 'string' && data.token.length > 20, 'Returns valid JWT token string');
    assert(data.user && data.user.email === testUser.email.toLowerCase(), 'Returns created user profile');
    assert(data.user.role === 'moderator', 'User assigned requested role (moderator)');
    assert(data.user.password === undefined, 'Password is not leaked in user object');

    authToken = data.token;
  } catch (err) {
    assert(false, 'User registration request failed', err.message);
  }

  // 4. Duplicate Registration
  console.log('\n🔹 4. Duplicate Registration Prevention');
  try {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    });
    const data = await res.json();

    assert(res.status === 400, 'Register with existing email returns 400 Bad Request');
    assert(data.success === false, 'Duplicate response success is false');
  } catch (err) {
    assert(false, 'Duplicate registration check failed', err.message);
  }

  // 5. Login Failures
  console.log('\n🔹 5. Login Error Cases');
  try {
    // Missing email or password
    const resMissing = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email }),
    });
    assert(resMissing.status === 400, 'Login with missing password returns 400');

    // Non-existent email
    const resNoUser = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent_user_999@test.com', password: 'password123' }),
    });
    assert(resNoUser.status === 401, 'Login with non-existent user returns 401 Unauthorized');

    // Wrong password
    const resWrongPass = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, password: 'WrongPassword456!' }),
    });
    assert(resWrongPass.status === 401, 'Login with incorrect password returns 401 Unauthorized');
  } catch (err) {
    assert(false, 'Login error testing failed', err.message);
  }

  // 6. Successful Login
  console.log('\n🔹 6. User Login (Happy Path)');
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, password: testUser.password }),
    });
    const data = await res.json();

    assert(res.status === 200, 'POST /api/auth/login returns 200 OK');
    assert(data.success === true, 'Response success is true');
    assert(typeof data.token === 'string' && data.token.length > 20, 'Returns JWT token on login');
    assert(data.user && data.user.email === testUser.email.toLowerCase(), 'Returns authenticated user info');
    assert(data.user.password === undefined, 'Password is not leaked in response');

    // Update authToken with login token
    authToken = data.token;
  } catch (err) {
    assert(false, 'Login request failed', err.message);
  }

  // 7. Protected Route (/api/auth/me)
  console.log('\n🔹 7. Protected Profile Route (/api/auth/me)');
  try {
    // Without token
    const resNoToken = await fetch(`${BASE_URL}/api/auth/me`);
    assert(resNoToken.status === 401, 'GET /api/auth/me without token returns 401 Unauthorized');

    // With invalid token
    const resBadToken = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: 'Bearer this.is.an.invalid.token' },
    });
    assert(resBadToken.status === 401, 'GET /api/auth/me with invalid token returns 401 Unauthorized');

    // With valid token
    const resValid = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const dataValid = await resValid.json();

    assert(resValid.status === 200, 'GET /api/auth/me with valid Bearer token returns 200 OK');
    assert(dataValid.user && dataValid.user.email === testUser.email.toLowerCase(), 'Profile matches authenticated user');
  } catch (err) {
    assert(false, 'Protected route test failed', err.message);
  }

  // Summary
  console.log('\n========================================================');
  console.log(`📊 Test Summary: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('========================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    console.log('🎉 All authentication API tests passed successfully!\n');
    process.exit(0);
  }
}

runTests();
