/**
 * Test script for query routing logic
 * Run with: npx tsx scripts/test-query-router.ts
 */

import { routeQuery } from '../src/lib/queryRouter';

async function testRouter() {
  console.log('🧪 Testing LLM-Based Query Router\n');
  console.log('=' .repeat(80));

  const testCases = [
    // User memory only queries
    { question: "What stocks have I bought?", ticker: undefined, expectedIntent: 'user_memory_only' },
    { question: "Show me my trading history", ticker: undefined, expectedIntent: 'user_memory_only' },
    { question: "What do I usually invest in?", ticker: undefined, expectedIntent: 'user_memory_only' },
    { question: "Did I ever buy AAPL?", ticker: 'AAPL', expectedIntent: 'user_memory_only' },
    { question: "What's my portfolio?", ticker: undefined, expectedIntent: 'user_memory_only' },
    { question: "When did I last buy Tesla?", ticker: 'TSLA', expectedIntent: 'user_memory_only' },

    // External data only queries
    { question: "What is AAPL's market cap?", ticker: 'AAPL', expectedIntent: 'external_data_only' },
    { question: "Tell me about Tesla's latest 10-K", ticker: 'TSLA', expectedIntent: 'external_data_only' },
    { question: "What is the market outlook for tech stocks?", ticker: undefined, expectedIntent: 'external_data_only' },
    { question: "Latest news about NVDA", ticker: 'NVDA', expectedIntent: 'external_data_only' },
    { question: "What are MSFT's earnings?", ticker: 'MSFT', expectedIntent: 'external_data_only' },
    { question: "Tell me about Amazon's business model", ticker: 'AMZN', expectedIntent: 'external_data_only' },

    // Hybrid queries (personalized recommendations)
    { question: "Should I buy more AAPL?", ticker: 'AAPL', expectedIntent: 'hybrid' },
    { question: "Is TSLA a good fit for my portfolio?", ticker: 'TSLA', expectedIntent: 'hybrid' },
    { question: "What do you think about NVDA for me?", ticker: 'NVDA', expectedIntent: 'hybrid' },
    { question: "Would you recommend buying META?", ticker: 'META', expectedIntent: 'hybrid' },
    { question: "Should I sell my Google shares?", ticker: 'GOOGL', expectedIntent: 'hybrid' },
    { question: "Is it a good time to buy Bitcoin stocks?", ticker: undefined, expectedIntent: 'hybrid' },
  ];

  let passed = 0;
  let failed = 0;

  console.log('\n📝 Running test cases (using LLM classification)...\n');

  for (const testCase of testCases) {
    const result = await routeQuery(testCase.question, testCase.ticker);
    const isCorrect = result.intent === testCase.expectedIntent;

    if (isCorrect) {
      passed++;
      console.log(`✅ PASS: "${testCase.question}"`);
    } else {
      failed++;
      console.log(`❌ FAIL: "${testCase.question}"`);
      console.log(`   Expected: ${testCase.expectedIntent}, Got: ${result.intent}`);
    }

    console.log(`   Intent: ${result.intent} (${(result.confidence * 100).toFixed(0)}% confidence)`);
    console.log(`   Sources: Memory=${result.requiresMemory}, Perplexity=${result.requiresPerplexity}, EDGAR=${result.requiresEdgar}`);
    console.log(`   Reasoning: ${result.reasoning}`);
    console.log('');
  }

  console.log('=' .repeat(80));
  console.log(`\n📊 Results: ${passed}/${testCases.length} tests passed`);

  if (failed > 0) {
    console.log(`⚠️  ${failed} tests failed`);
  } else {
    console.log('✅ All tests passed!');
  }

  console.log('\n💡 Key Insights:');
  console.log('   - User memory-only queries skip external API calls (faster + cheaper)');
  console.log('   - External data queries skip memory retrieval when not needed');
  console.log('   - Hybrid queries combine both for personalized recommendations');
}

testRouter();
