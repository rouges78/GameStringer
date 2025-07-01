// Script di test per verificare tutti gli endpoint API
// Esegui con: npx tsx scripts/test-api-endpoints.ts

const BASE_URL = 'http://localhost:3001/api';

interface TestResult {
  endpoint: string;
  method: string;
  status: number;
  success: boolean;
  error?: string;
  data?: any;
}

const tests: TestResult[] = [];

async function testEndpoint(
  endpoint: string,
  method: string = 'GET',
  body?: any,
  headers?: Record<string, string>
): Promise<void> {
  try {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json().catch(() => null);

    tests.push({
      endpoint,
      method,
      status: response.status,
      success: response.ok,
      data,
      error: !response.ok ? data?.error || response.statusText : undefined
    });
  } catch (error) {
    tests.push({
      endpoint,
      method,
      status: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

async function runTests() {
  console.log('🧪 Testing GameStringer API Endpoints...\n');

  // Test Games API
  console.log('📦 Testing Games API...');
  await testEndpoint('/games');
  
  // Test Patches API
  console.log('🔧 Testing Patches API...');
  await testEndpoint('/patches');
  await testEndpoint('/patches?gameId=test-game-id');
  
  // Test Translations API
  console.log('🌍 Testing Translations API...');
  await testEndpoint('/translations');
  await testEndpoint('/translations?status=pending');
  
  // Test Auth Session
  console.log('🔐 Testing Auth API...');
  await testEndpoint('/auth/session');
  
  // Test Store Connections
  console.log('🏪 Testing Store Connections...');
  await testEndpoint('/stores/test-connection', 'POST', {
    provider: 'steam-credentials'
  });
  
  // Test Utilities
  console.log('🛠️ Testing Utilities API...');
  await testEndpoint('/utilities/preferences');
  
  // Print results
  console.log('\n📊 Test Results:\n');
  console.log('┌─────────────────────────────────────┬────────┬────────┬─────────┐');
  console.log('│ Endpoint                            │ Method │ Status │ Result  │');
  console.log('├─────────────────────────────────────┼────────┼────────┼─────────┤');
  
  tests.forEach(test => {
    const endpoint = test.endpoint.padEnd(35);
    const method = test.method.padEnd(6);
    const status = test.status.toString().padEnd(6);
    const result = test.success ? '✅ OK' : '❌ FAIL';
    
    console.log(`│ ${endpoint} │ ${method} │ ${status} │ ${result}  │`);
    
    if (!test.success && test.error) {
      console.log(`│   Error: ${test.error.padEnd(58)} │`);
    }
  });
  
  console.log('└─────────────────────────────────────┴────────┴────────┴─────────┘');
  
  const successCount = tests.filter(t => t.success).length;
  const totalCount = tests.length;
  const successRate = ((successCount / totalCount) * 100).toFixed(1);
  
  console.log(`\n✨ Summary: ${successCount}/${totalCount} tests passed (${successRate}%)`);
  
  // Check for critical failures
  const criticalEndpoints = ['/games', '/patches', '/translations'];
  const criticalFailures = tests.filter(
    t => criticalEndpoints.includes(t.endpoint) && !t.success
  );
  
  if (criticalFailures.length > 0) {
    console.log('\n⚠️  Critical endpoints failing:');
    criticalFailures.forEach(f => {
      console.log(`   - ${f.endpoint}: ${f.error}`);
    });
  }
}

// Run tests
runTests().catch(console.error);
