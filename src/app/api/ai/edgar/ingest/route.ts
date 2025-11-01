/**
 * API endpoint for ingesting SEC filings into vector database
 * This endpoint:
 * 1. Fetches the SEC filing document
 * 2. Parses and extracts relevant sections
 * 3. Chunks the text
 * 4. Generates embeddings
 * 5. Stores in Convex vector DB
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../../../../convex/_generated/api';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Company ticker to CIK mapping
const TICKER_TO_CIK: Record<string, string> = {
  'AAPL': '0000320193',
  'NVDA': '0001045810',
  'TSLA': '0001318605',
  'MSFT': '0000789019',
  'GOOGL': '0001652044',
  'GOOG': '0001652044',
  'META': '0001326801',
  'AMZN': '0001018724',
};

interface IngestRequest {
  ticker: string;
  accessionNumber?: string; // Specific filing, or latest if not provided
  formType?: '10-K' | '10-Q'; // Default to 10-K
}

/**
 * Parse HTML/XML filing document and extract relevant sections
 */
async function parseSECFiling(html: string, formType: string): Promise<Map<string, string>> {
  const sections = new Map<string, string>();

  // For 10-K, we want these sections:
  if (formType === '10-K') {
    // Item 1A: Risk Factors (most important)
    const riskMatch = html.match(/item\s*1a[\s\S]*?risk factors([\s\S]*?)(?=item\s*1b|item\s*2|$)/i);
    if (riskMatch) {
      const cleanText = stripHTML(riskMatch[1]);
      if (cleanText.length > 100) {
        sections.set('Item 1A - Risk Factors', cleanText);
      }
    }

    // Item 1: Business
    const businessMatch = html.match(/item\s*1[\s\.]*business([\s\S]*?)(?=item\s*1a|item\s*2|$)/i);
    if (businessMatch) {
      const cleanText = stripHTML(businessMatch[1]);
      if (cleanText.length > 100) {
        sections.set('Item 1 - Business', cleanText);
      }
    }

    // Item 7: MD&A
    const mdaMatch = html.match(/item\s*7[\s\S]*?management.*?discussion.*?analysis([\s\S]*?)(?=item\s*7a|item\s*8|$)/i);
    if (mdaMatch) {
      const cleanText = stripHTML(mdaMatch[1]);
      if (cleanText.length > 100) {
        sections.set('Item 7 - MD&A', cleanText);
      }
    }
  }

  // Fallback: if we couldn't extract specific sections, use the whole document
  if (sections.size === 0) {
    const cleanText = stripHTML(html);
    sections.set('Full Document', cleanText);
  }

  return sections;
}

/**
 * Strip HTML tags and clean up text
 */
function stripHTML(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Chunk text using LangChain's RecursiveCharacterTextSplitter
 */
async function chunkText(text: string): Promise<string[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000, // Tokens roughly = characters/4, so ~250 tokens per chunk
    chunkOverlap: 200, // Overlap to maintain context
    separators: ['\n\n', '\n', '. ', ' ', ''],
  });

  const chunks = await splitter.splitText(text);
  return chunks;
}

/**
 * Generate embeddings for text chunks
 */
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
  });

  return response.data.map((item) => item.embedding);
}

export async function POST(req: NextRequest) {
  try {
    const body: IngestRequest = await req.json();
    const { ticker, accessionNumber, formType = '10-K' } = body;

    if (!ticker) {
      return NextResponse.json(
        { error: 'Missing required field: ticker' },
        { status: 400 }
      );
    }

    const tickerUpper = ticker.toUpperCase();
    const cik = TICKER_TO_CIK[tickerUpper];

    if (!cik) {
      return NextResponse.json(
        { error: `CIK mapping not found for ticker: ${ticker}` },
        { status: 404 }
      );
    }

    console.log(`[Ingest] Starting ingestion for ${tickerUpper} ${formType}`);

    // Step 1: Get filing metadata
    let filingUrl: string;
    let filingDate: string;
    let accession: string;

    if (accessionNumber) {
      accession = accessionNumber;
      // Build URL from accession number
      // Need to fetch filing metadata to get date and document name
      const metadataResponse = await fetch(
        `https://data.sec.gov/submissions/CIK${cik}.json`,
        {
          headers: {
            'User-Agent': 'Athena AI contact@athena.ai',
            Accept: 'application/json',
          },
        }
      );

      if (!metadataResponse.ok) {
        throw new Error(`SEC API error: ${metadataResponse.status}`);
      }

      const metadata = await metadataResponse.json();
      const filings = metadata.filings?.recent || {};
      const index = filings.accessionNumber.indexOf(accession);

      if (index === -1) {
        return NextResponse.json(
          { error: 'Accession number not found' },
          { status: 404 }
        );
      }

      filingDate = filings.filingDate[index];
      const primaryDoc = filings.primaryDocument[index];
      filingUrl = `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/, '')}/${accession.replace(/-/g, '')}/${primaryDoc}`;
    } else {
      // Fetch latest filing of specified type
      const metadataResponse = await fetch(
        `https://data.sec.gov/submissions/CIK${cik}.json`,
        {
          headers: {
            'User-Agent': 'Athena AI contact@athena.ai',
            Accept: 'application/json',
          },
        }
      );

      if (!metadataResponse.ok) {
        throw new Error(`SEC API error: ${metadataResponse.status}`);
      }

      const metadata = await metadataResponse.json();
      const filings = metadata.filings?.recent || {};

      // Find latest filing of specified type
      const index = filings.form.findIndex((f: string) => f === formType);

      if (index === -1) {
        return NextResponse.json(
          { error: `No ${formType} filing found for ${tickerUpper}` },
          { status: 404 }
        );
      }

      accession = filings.accessionNumber[index];
      filingDate = filings.filingDate[index];
      const primaryDoc = filings.primaryDocument[index];
      filingUrl = `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/, '')}/${accession.replace(/-/g, '')}/${primaryDoc}`;
    }

    // Check if already processed
    const alreadyProcessed = await convex.query(api.secFilings.isFilingProcessed, {
      ticker: tickerUpper,
      accessionNumber: accession,
    });

    if (alreadyProcessed) {
      return NextResponse.json({
        message: 'Filing already processed',
        ticker: tickerUpper,
        accessionNumber: accession,
        filingDate,
      });
    }

    console.log(`[Ingest] Fetching filing from: ${filingUrl}`);

    // Step 2: Fetch the actual filing document
    const filingResponse = await fetch(filingUrl, {
      headers: {
        'User-Agent': 'Athena AI contact@athena.ai',
      },
    });

    if (!filingResponse.ok) {
      throw new Error(`Failed to fetch filing: ${filingResponse.status}`);
    }

    const filingHTML = await filingResponse.text();

    console.log(`[Ingest] Parsing document (${filingHTML.length} characters)`);

    // Step 3: Parse and extract sections
    const sections = await parseSECFiling(filingHTML, formType);

    console.log(`[Ingest] Extracted ${sections.size} sections`);

    // Step 4: Chunk each section
    const allChunks: Array<{
      section: string;
      chunkIndex: number;
      text: string;
    }> = [];

    for (const [sectionName, sectionText] of sections.entries()) {
      const chunks = await chunkText(sectionText);
      chunks.forEach((chunk, index) => {
        allChunks.push({
          section: sectionName,
          chunkIndex: index,
          text: chunk,
        });
      });
    }

    console.log(`[Ingest] Created ${allChunks.length} chunks`);

    // Step 5: Generate embeddings (batch to avoid rate limits)
    const BATCH_SIZE = 100;
    const embeddings: number[][] = [];

    for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
      const batch = allChunks.slice(i, i + BATCH_SIZE);
      const batchTexts = batch.map((c) => c.text);
      const batchEmbeddings = await generateEmbeddings(batchTexts);
      embeddings.push(...batchEmbeddings);

      console.log(`[Ingest] Generated embeddings for chunks ${i}-${i + batch.length}`);
    }

    // Step 6: Store in Convex
    const chunksToStore = allChunks.map((chunk, index) => ({
      ticker: tickerUpper,
      cik,
      formType,
      filingDate,
      accessionNumber: accession,
      section: chunk.section,
      chunkIndex: chunk.chunkIndex,
      text: chunk.text,
      embedding: embeddings[index],
      url: filingUrl,
    }));

    const result = await convex.mutation(api.secFilings.storeFilingChunks, {
      chunks: chunksToStore,
    });

    console.log(`[Ingest] Stored ${result.count} chunks in Convex`);

    return NextResponse.json({
      success: true,
      ticker: tickerUpper,
      formType,
      filingDate,
      accessionNumber: accession,
      sectionsExtracted: sections.size,
      chunksCreated: allChunks.length,
      chunksStored: result.count,
      url: filingUrl,
    });
  } catch (error) {
    console.error('[Ingest] Error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Check server logs for more information',
      },
      { status: 500 }
    );
  }
}
