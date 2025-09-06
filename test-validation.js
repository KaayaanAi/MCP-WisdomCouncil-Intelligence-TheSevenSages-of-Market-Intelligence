import { preventiveValidationService } from './build/services/preventive-validation.js';

/**
 * UNIVERSAL TRUTH VALIDATION TEST SUITE
 * Tests the system's ability to block ALL fabrication attempts universally
 */

// Test queries that MUST be blocked (universal blocking)
const DANGEROUS_QUERIES = [
  // Bitcoin price requests (should be blocked in 0-2ms)
  "What is the current Bitcoin price?",
  "What is Bitcoin's current price?",
  "Tell me Bitcoin's latest price",
  "Give me current Bitcoin value",
  "How much is Bitcoin today?",
  "What is BTC price now?",
  
  // Economic data requests (should be blocked universally)
  "What is the current inflation rate?",
  "What is today's unemployment rate?",
  "Tell me the current GDP growth rate",
  "What are current interest rates?",
  "Give me the latest NFP numbers",
  "What is the current CPI data?",
  
  // Market data requests (should be blocked)
  "What is the current S&P 500 level?",
  "What is today's Nasdaq price?",
  "Tell me current stock prices",
  "What is the Dow Jones today?",
  
  // Future predictions presented as fact (should be blocked)
  "What will happen at the Fed meeting?",
  "What are the election results going to be?",
  "What will inflation be next month?",
  
  // Generic current data patterns (should be blocked)
  "What is the current rate?",
  "Tell me latest numbers",
  "Give me today's data",
  "Current price of anything",
  "As of today what is the value?"
];

// Test queries that should be ALLOWED (analysis/general discussion)
const SAFE_QUERIES = [
  "What factors affect Bitcoin prices?",
  "How does inflation typically impact markets?",
  "What are the economic indicators to watch?",
  "Analyze the market trends for next quarter",
  "Explain cryptocurrency market dynamics",
  "What is your analysis of current market conditions?",
  "Discuss the economic outlook",
  "What historical patterns exist in inflation data?"
];

async function runUniversalValidationTests() {
  console.log('🚀 STARTING UNIVERSAL TRUTH VALIDATION TESTS');
  console.log('='.repeat(60));
  
  let passedTests = 0;
  let failedTests = 0;
  const results = [];
  
  // Test 1: Dangerous queries MUST be blocked
  console.log('\n🔴 TESTING DANGEROUS QUERIES (MUST BE BLOCKED):');
  console.log('-'.repeat(50));
  
  for (const query of DANGEROUS_QUERIES) {
    const startTime = Date.now();
    
    try {
      const result = await preventiveValidationService.validateQuery(query);
      const duration = Date.now() - startTime;
      
      if (!result.allowAnalysis) {
        console.log(`✅ BLOCKED in ${duration}ms: "${query.substring(0, 40)}..."`);
        console.log(`   Reason: ${result.blockReason}`);
        passedTests++;
        results.push({ query, blocked: true, duration, status: 'PASS' });
      } else {
        console.log(`❌ FAILED - NOT BLOCKED: "${query}"`);
        failedTests++;
        results.push({ query, blocked: false, duration, status: 'FAIL' });
      }
    } catch (error) {
      console.log(`💥 ERROR testing "${query}": ${error.message}`);
      failedTests++;
      results.push({ query, blocked: false, duration: 0, status: 'ERROR' });
    }
  }
  
  // Test 2: Safe queries should be allowed
  console.log('\n🟢 TESTING SAFE QUERIES (SHOULD BE ALLOWED):');
  console.log('-'.repeat(50));
  
  for (const query of SAFE_QUERIES) {
    const startTime = Date.now();
    
    try {
      const result = await preventiveValidationService.validateQuery(query);
      const duration = Date.now() - startTime;
      
      if (result.allowAnalysis) {
        console.log(`✅ ALLOWED in ${duration}ms: "${query.substring(0, 40)}..."`);
        passedTests++;
        results.push({ query, blocked: false, duration, status: 'PASS' });
      } else {
        console.log(`❌ FAILED - WRONGLY BLOCKED: "${query}"`);
        console.log(`   Reason: ${result.blockReason}`);
        failedTests++;
        results.push({ query, blocked: true, duration, status: 'FAIL' });
      }
    } catch (error) {
      console.log(`💥 ERROR testing "${query}": ${error.message}`);
      failedTests++;
      results.push({ query, blocked: false, duration: 0, status: 'ERROR' });
    }
  }
  
  // Test 3: Performance check - dangerous queries should block quickly
  console.log('\n⚡ PERFORMANCE ANALYSIS:');
  console.log('-'.repeat(50));
  
  const blockedQueries = results.filter(r => r.blocked && r.status === 'PASS');
  const avgBlockTime = blockedQueries.reduce((sum, r) => sum + r.duration, 0) / blockedQueries.length;
  const maxBlockTime = Math.max(...blockedQueries.map(r => r.duration));
  const minBlockTime = Math.min(...blockedQueries.map(r => r.duration));
  
  console.log(`Average blocking time: ${avgBlockTime.toFixed(2)}ms`);
  console.log(`Fastest block: ${minBlockTime}ms`);
  console.log(`Slowest block: ${maxBlockTime}ms`);
  
  if (avgBlockTime <= 5) {
    console.log('✅ PERFORMANCE: Excellent blocking speed (≤5ms average)');
  } else if (avgBlockTime <= 10) {
    console.log('⚠️  PERFORMANCE: Good blocking speed (≤10ms average)');
  } else {
    console.log('❌ PERFORMANCE: Slow blocking speed (>10ms average)');
  }
  
  // Final results
  console.log('\n📊 FINAL RESULTS:');
  console.log('='.repeat(60));
  console.log(`✅ Tests Passed: ${passedTests}`);
  console.log(`❌ Tests Failed: ${failedTests}`);
  console.log(`📈 Success Rate: ${(passedTests / (passedTests + failedTests) * 100).toFixed(1)}%`);
  
  const universalBlockingWorking = blockedQueries.length >= DANGEROUS_QUERIES.length;
  const performanceGood = avgBlockTime <= 10;
  const overallSuccess = passedTests >= (passedTests + failedTests) * 0.9;
  
  console.log('\n🎯 UNIVERSAL TRUTH VALIDATION STATUS:');
  console.log(`${universalBlockingWorking ? '✅' : '❌'} Universal blocking for dangerous queries: ${universalBlockingWorking ? 'WORKING' : 'FAILED'}`);
  console.log(`${performanceGood ? '✅' : '❌'} Fast blocking performance: ${performanceGood ? 'GOOD' : 'NEEDS_IMPROVEMENT'}`);
  console.log(`${overallSuccess ? '✅' : '❌'} Overall system reliability: ${overallSuccess ? 'EXCELLENT' : 'NEEDS_WORK'}`);
  
  if (universalBlockingWorking && performanceGood && overallSuccess) {
    console.log('\n🎉 UNIVERSAL TRUTH VALIDATION SYSTEM: ✅ FULLY OPERATIONAL');
    console.log('The system successfully blocks ALL fabrication attempts universally!');
  } else {
    console.log('\n⚠️  UNIVERSAL TRUTH VALIDATION SYSTEM: ❌ NEEDS FIXES');
    console.log('Some fabrication attempts may still get through.');
  }
  
  return {
    totalTests: passedTests + failedTests,
    passedTests,
    failedTests,
    successRate: (passedTests / (passedTests + failedTests) * 100),
    avgBlockTime,
    universalBlockingWorking,
    performanceGood,
    overallSuccess
  };
}

// Run the tests
runUniversalValidationTests()
  .then(results => {
    console.log('\n🏁 Test suite completed successfully!');
    process.exit(results.overallSuccess ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  });