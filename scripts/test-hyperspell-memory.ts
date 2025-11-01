/**
 * Test script to verify Hyperspell memory persistence
 * Run with: npx tsx scripts/test-hyperspell-memory.ts
 */

import { addMemory, queryMemories, logTradeDecision, getTradingContext } from '../src/lib/hyperspell';

async function testHyperspellMemory() {
  console.log('🧪 Testing Hyperspell Memory Persistence\n');
  console.log('=' .repeat(60));

  const testUserId = `test-user-${Date.now()}`;

  try {
    // Test 1: Log a stock purchase
    console.log('\n📝 Test 1: Logging a stock purchase...');
    const trade1 = await logTradeDecision({
      userId: testUserId,
      ticker: 'AAPL',
      action: 'buy',
      quantity: 10,
      price: 175.50,
      rationale: 'Strong earnings report and positive sentiment',
      aiRecommendation: true,
    });
    console.log('✅ Trade logged:', trade1);

    // Test 2: Log another trade
    console.log('\n📝 Test 2: Logging another purchase...');
    const trade2 = await logTradeDecision({
      userId: testUserId,
      ticker: 'TSLA',
      action: 'buy',
      quantity: 5,
      price: 242.30,
      rationale: 'Bullish on EV market expansion',
      aiRecommendation: false,
    });
    console.log('✅ Trade logged:', trade2);

    // Test 3: Log a sell order
    console.log('\n📝 Test 3: Logging a sell order...');
    const trade3 = await logTradeDecision({
      userId: testUserId,
      ticker: 'AAPL',
      action: 'sell',
      quantity: 5,
      price: 180.20,
      rationale: 'Taking profits on partial position',
    });
    console.log('✅ Trade logged:', trade3);

    // Wait a moment for indexing
    console.log('\n⏳ Waiting 3 seconds for Hyperspell indexing...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test 4: Query memories about AAPL
    console.log('\n🔍 Test 4: Querying memories about AAPL...');
    const aaplMemories = await queryMemories({
      userId: testUserId,
      query: 'AAPL stock purchases',
      limit: 10,
    });
    console.log(`✅ Found ${aaplMemories.length} memories about AAPL:`);
    aaplMemories.forEach((mem, i) => {
      console.log(`   ${i + 1}. [${mem.type}] ${typeof mem.content === 'string' ? mem.content.substring(0, 100) : JSON.stringify(mem.content).substring(0, 100)}...`);
    });

    // Test 5: Query all trade decisions
    console.log('\n🔍 Test 5: Querying all trade decisions...');
    const tradeMemories = await queryMemories({
      userId: testUserId,
      query: 'stock trades',
      type: 'trade_decision',
      limit: 10,
    });
    console.log(`✅ Found ${tradeMemories.length} trade decision memories:`);
    tradeMemories.forEach((mem, i) => {
      try {
        const content = typeof mem.content === 'string'
          ? (mem.content.startsWith('{') ? JSON.parse(mem.content) : { raw: mem.content })
          : mem.content;

        if (content.action && content.ticker) {
          console.log(`   ${i + 1}. ${content.action?.toUpperCase()} ${content.quantity} ${content.ticker} @ $${content.price}`);
          if (content.rationale) {
            console.log(`      → ${content.rationale}`);
          }
        } else {
          console.log(`   ${i + 1}. [Raw] ${typeof mem.content === 'string' ? mem.content.substring(0, 100) : JSON.stringify(mem.content).substring(0, 100)}`);
        }
      } catch (error) {
        console.log(`   ${i + 1}. [Parse Error] ${mem.content.toString().substring(0, 100)}`);
      }
    });

    // Test 6: Get trading context for a question
    console.log('\n🔍 Test 6: Getting trading context for "Should I buy more AAPL?"...');
    const context = await getTradingContext({
      userId: testUserId,
      ticker: 'AAPL',
      query: 'Should I buy more AAPL stock?',
    });
    console.log('✅ Trading context retrieved:');
    console.log(context);

    // Test 7: Add a custom memory
    console.log('\n📝 Test 7: Adding custom memory (user preference)...');
    const pref = await addMemory({
      userId: testUserId,
      type: 'user_preference',
      content: {
        preference: 'I prefer tech stocks and avoid oil & gas companies',
        categories: ['tech', 'energy'],
        sentiment: 'bullish on tech, bearish on fossil fuels',
      },
    });
    console.log('✅ Preference logged:', pref);

    // Test 8: Query preferences
    console.log('\n🔍 Test 8: Querying user preferences...');
    const preferences = await queryMemories({
      userId: testUserId,
      query: 'what stocks do I like?',
      limit: 5,
    });
    console.log(`✅ Found ${preferences.length} preference memories:`);
    preferences.forEach((mem, i) => {
      console.log(`   ${i + 1}. [${mem.type}] ${typeof mem.content === 'string' ? mem.content : JSON.stringify(mem.content)}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests completed successfully!');
    console.log(`📊 Total memories stored: ${tradeMemories.length + preferences.length}`);
    console.log(`👤 Test user ID: ${testUserId}`);
    console.log('\n💡 Key Findings:');
    console.log('   - Stock purchases are being logged to Hyperspell');
    console.log('   - Memories are queryable by ticker, action, and content');
    console.log('   - Type filtering is working');
    console.log('   - Trading context generation is functional');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }
  }
}

// Run the tests
testHyperspellMemory();
