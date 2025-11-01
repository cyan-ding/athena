/**
 * Debug script to see exactly what Hyperspell stores and returns
 */

import { addMemory } from '../src/lib/hyperspell';
import Hyperspell from 'hyperspell';

const hyperspell = new Hyperspell({
  apiKey: process.env.HYPERSPELL_API_KEY || '',
});

async function debugStorage() {
  console.log('🔍 Debugging Hyperspell Storage\n');

  const testUserId = `debug-${Date.now()}`;

  // 1. Add a trade with specific data
  console.log('📝 Step 1: Adding a trade decision...');
  const trade = await addMemory({
    userId: testUserId,
    type: 'trade_decision',
    content: {
      ticker: 'BYND',
      action: 'buy',
      quantity: 200,
      price: 1.66,
      rationale: 'Testing exact price preservation',
      timestamp: Date.now(),
    },
  });

  console.log('✅ Trade added with ID:', trade.id);
  console.log('   Original content:', JSON.stringify(trade.content, null, 2));

  // Wait for indexing
  console.log('\n⏳ Waiting 3 seconds for indexing...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 2. Retrieve the raw document
  console.log('\n🔍 Step 2: Retrieving raw document...');
  const response = await hyperspell.memories.search({
    query: 'BYND trade',
    sources: ['vault'],
    options: {
      max_results: 1,
      vault: {
        collection: testUserId,
      },
    } as any,
  });

  if (response.documents && response.documents.length > 0) {
    const doc = response.documents[0] as any;
    console.log('\n📄 Raw Hyperspell Document:');
    console.log('   Resource ID:', doc.resource_id);
    console.log('   Full doc keys:', Object.keys(doc));
    console.log('\n   doc.text:', doc.text);
    console.log('\n   doc.summary:', doc.summary);
    console.log('\n   doc.highlights:', JSON.stringify(doc.highlights, null, 2));
    console.log('\n   Full doc:', JSON.stringify(doc, null, 2));
  } else {
    console.log('❌ No documents found!');
  }

  // 3. Try with answer=true
  console.log('\n🔍 Step 3: Trying with answer=true...');
  const answerResponse: any = await hyperspell.memories.search({
    query: 'What BYND trades did I make and at what price?',
    sources: ['vault'],
    answer: true,
    answer_model: 'gemma2',
    options: {
      max_results: 5,
      vault: {
        collection: testUserId,
      },
    },
  } as any);

  console.log('\n💬 Hyperspell Answer:');
  console.log(answerResponse.answer || '(no answer)');
  console.log('\n📄 Documents used for answer:');
  answerResponse.documents?.forEach((doc: any, i: number) => {
    console.log(`\n   Document ${i + 1}:`);
    console.log('   Summary:', doc.summary);
    console.log('   Highlights:', doc.highlights?.[0]?.text);
  });
}

debugStorage().catch(console.error);
