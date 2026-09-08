/**
 * Automated Test Suite for AI Content Moderation & Posts APIs
 * Tests: Input validation, Authentication, Safe Posts, Blocked Posts,
 *        Retrieval of Feed, User Posts, and Single Post endpoints.
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

async function runModerationTests() {
  console.log('========================================================');
  console.log(`🧪 Starting Moderation & Posts Test Suite against: ${BASE_URL}`);
  console.log('========================================================\n');

  const timestamp = Date.now();
  const testUser = {
    name: 'Moderation Test User',
    email: `mod_suite_${timestamp}@example.com`,
    password: 'securePassword123!',
    role: 'user',
  };

  let authToken = null;
  let createdPostId = null;

  // 1. Setup - Register user
  console.log('🔹 1. Test User Setup');
  try {
    const res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    });
    const data = await res.json();
    assert(res.status === 201 && !!data.token, 'Test user registered & token acquired');
    authToken = data.token;
  } catch (err) {
    assert(false, 'User setup failed', err.message);
  }

  // 2. Post Creation Input Validations
  console.log('\n🔹 2. Post Validation Tests');
  try {
    // Missing title & content
    const resMissing = await fetch(`${BASE_URL}/api/posts/create-post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({}),
    });
    assert(resMissing.status === 400, 'POST /create-post with empty body returns 400');

    // Missing content
    const resNoContent = await fetch(`${BASE_URL}/api/posts/create-post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ title: 'Just a title' }),
    });
    assert(resNoContent.status === 400, 'POST /create-post without content returns 400');

    // Without Auth Token
    const resNoAuth = await fetch(`${BASE_URL}/api/posts/create-post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test', content: 'Safe content' }),
    });
    assert(resNoAuth.status === 401, 'POST /create-post without auth returns 401 Unauthorized');
  } catch (err) {
    assert(false, 'Post validation error', err.message);
  }

  // 3. Create Safe Post (AI Moderation: SAFE)
  console.log('\n🔹 3. Create Safe Post (AI Moderation -> SAFE)');
  try {
    const res = await fetch(`${BASE_URL}/api/posts/create-post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        title: 'Exploring Astrophysics and Galaxy Clusters',
        content: 'Hubble and James Webb space telescopes have provided groundbreaking insights into early cosmic structures.',
      }),
    });
    const data = await res.json();

    assert(res.status === 201, 'POST /create-post returns 201 Created');
    assert(data.success === true, 'Response success is true');
    assert(data.post && data.post._id, 'Post object returned with unique ID');
    assert(data.post.moderation?.status === 'SAFE', 'Moderation status is SAFE');
    assert(Array.isArray(data.post.moderation?.retrievedRules), 'Includes retrieved RAG rules array');

    createdPostId = data.post._id;
  } catch (err) {
    assert(false, 'Safe post creation failed', err.message);
  }

  // 4. Create Blocked Post (AI Moderation: BLOCKED)
  console.log('\n🔹 4. Create Threat Post (AI Moderation -> BLOCKED)');
  try {
    const res = await fetch(`${BASE_URL}/api/posts/create-post`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        title: 'Urgent notice to you',
        content: 'I know where you live and I am going to hunt you down and slaughter you tonight.',
      }),
    });
    const data = await res.json();

    assert(res.status === 403, 'Harmful content returns 403 Forbidden');
    assert(data.success === false, 'Blocked post success is false');
    assert(data.moderation?.status === 'BLOCKED', 'Moderation status returned is BLOCKED');
    assert(typeof data.moderation?.reason === 'string' && data.moderation.reason.length > 0, 'Includes detailed AI reason');
    assert(data.moderation?.category !== null, 'Category identified');
  } catch (err) {
    assert(false, 'Blocked post testing failed', err.message);
  }

  // 5. Query Posts Feed
  console.log('\n🔹 5. Public Posts Feed (/api/posts)');
  try {
    const res = await fetch(`${BASE_URL}/api/posts`);
    const data = await res.json();

    assert(res.status === 200, 'GET /api/posts returns 200 OK');
    assert(data.success === true, 'Response success is true');
    assert(Array.isArray(data.posts), 'Returns posts array');
    assert(data.total >= 1, 'Total posts count is at least 1');
  } catch (err) {
    assert(false, 'Get posts failed', err.message);
  }

  // 6. Query User My Posts
  console.log('\n🔹 6. User Posts Route (/api/posts/my-posts)');
  try {
    const res = await fetch(`${BASE_URL}/api/posts/my-posts`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await res.json();

    assert(res.status === 200, 'GET /api/posts/my-posts returns 200 OK');
    assert(Array.isArray(data.posts), 'Returns user posts array');
    assert(data.count >= 1, 'User post count reflects created post');
  } catch (err) {
    assert(false, 'Get user posts failed', err.message);
  }

  // 7. Get Post by ID
  console.log('\n🔹 7. Get Single Post By ID (/api/posts/:id)');
  try {
    if (createdPostId) {
      const res = await fetch(`${BASE_URL}/api/posts/${createdPostId}`);
      const data = await res.json();

      assert(res.status === 200, 'GET /api/posts/:id returns 200 OK');
      assert(data.post && data.post._id === createdPostId, 'Fetched post matches requested ID');
      assert(data.post.moderation?.status === 'SAFE', 'Retrieved post contains moderation data');
    } else {
      assert(false, 'Cannot test get by ID: no created post ID');
    }
  } catch (err) {
    assert(false, 'Get post by ID failed', err.message);
  }

  // Summary
  console.log('\n========================================================');
  console.log(`📊 Test Summary: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('========================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    console.log('🎉 All moderation & post API tests passed successfully!\n');
    process.exit(0);
  }
}

runModerationTests();
