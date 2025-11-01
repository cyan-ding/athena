#!/usr/bin/env npx tsx

/**
 * Test script to verify memory logging is working
 * This simulates what happens when the chat endpoint is called
 */

import { getTradingContext } from '../src/lib/hyperspell';
import { routeQuery } from '../src/lib/queryRouter';

async function testMemoryLogs() {
  console.log('🧪 Testing Memory Logging Flow\n');
  console.log('=' .repeat(60));

  const testQueries = [
    { question: 'What is AAPL?', ticker: 'AAPL', expectedIntent: 'external_data_only' },
    { question: 'Should I buy AAPL?', ticker: 'AAPL', expectedIntent: 'hybrid' },
    { question: 'What stocks have I bought?', ticker: undefined, expectedIntent: 'user_memory_only' },
  ];

  for (const test of testQueries) {
    console.log(`\n📝 Testing: "${test.question}"`);
    console.log('-'.repeat(60));

    try {
      // Step 1: Route the query
      console.log('[1] Routing query...');
      const routing = await routeQuery(test.question, test.ticker);
      console.log(`[1] ✅ Intent: ${routing.intent} (confidence: ${routing.confidence})`);
      console.log(`[1] ✅ Requires memory: ${routing.requiresMemory}`);
      console.log(`[1] ✅ Reasoning: ${routing.reasoning}`);

      // Step 2: If memory required, fetch it
      if (routing.requiresMemory) {
        console.log('[2] Memory required! Fetching trading context...');
        const context = await getTradingContext({
          userId: 'demo-user',
          ticker: test.ticker,
          query: `${test.question} ${test.ticker || ''}`,
        });

        console.log('[2] ✅ Context retrieved:');
        console.log('---START CONTEXT---');
        console.log(context);
        console.log('---END CONTEXT---');
      } else {
        console.log('[2] ⏭️  Memory NOT required, skipping fetch');
      }

      // Verify expectation
      if (routing.intent === test.expectedIntent) {
        console.log(`✅ PASS: Intent matches expected (${test.expectedIntent})`);
      } else {
        console.log(`❌ FAIL: Expected ${test.expectedIntent}, got ${routing.intent}`);
      }

    } catch (error) {
      console.error('❌ Error:', error);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Test completed');
  console.log('\n💡 Key Findings:');
  console.log('   - If "Memory NOT required" appears, that\'s why you don\'t see logs');
  console.log('   - Check if the query intent matches what you expect');
  console.log('   - For hybrid/user_memory_only queries, you should see context logs');
}

testMemoryLogs();
