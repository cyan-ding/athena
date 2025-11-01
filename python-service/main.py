"""
FastAPI service for browser-use social media scraping.
Provides endpoints for scraping Reddit and Twitter/X for financial sentiment.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import os
from dotenv import load_dotenv
import asyncio
import logging

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Athena Browser-Use Service",
    description="Real-time social media scraping for financial sentiment analysis",
    version="0.1.0"
)

# CORS middleware to allow requests from Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response models
class ScrapeRequest(BaseModel):
    ticker: str
    start_date: str  # YYYY-MM-DD
    end_date: str    # YYYY-MM-DD
    max_results: int = 5

class SocialPost(BaseModel):
    platform: str  # "reddit" or "twitter"
    title: str
    content: str
    url: str
    score: Optional[int] = None  # upvotes for Reddit, likes for Twitter
    date: str
    author: Optional[str] = None
    comments_count: Optional[int] = None

class ScrapeResponse(BaseModel):
    ticker: str
    posts: List[SocialPost]
    source: str
    timestamp: str

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "Athena Browser-Use Service",
        "status": "running",
        "version": "0.1.0"
    }

@app.get("/health")
async def health_check():
    """Detailed health check"""
    browser_use_key = os.getenv("BROWSER_USE_API_KEY")
    return {
        "status": "healthy",
        "browser_use_configured": bool(browser_use_key),
        "python_version": "3.11+",
    }

@app.post("/scrape/reddit", response_model=ScrapeResponse)
async def scrape_reddit(request: ScrapeRequest):
    """
    Scrape Reddit for posts about a ticker in a date range.
    Focuses on r/wallstreetbets, r/stocks, and r/investing.
    """
    try:
        logger.info(f"Scraping Reddit for {request.ticker} from {request.start_date} to {request.end_date}")

        # Import browser-use components
        try:
            from browser_use import Agent, Browser, ChatBrowserUse
        except ImportError:
            raise HTTPException(
                status_code=500,
                detail="browser-use library not installed. Run: uv add browser-use"
            )

        # Create browser and LLM instances
        browser = Browser()

        # Use ChatBrowserUse or fallback to OpenAI
        api_key = os.getenv("BROWSER_USE_API_KEY")
        if not api_key:
            raise HTTPException(
                status_code=500,
                detail="BROWSER_USE_API_KEY not configured in .env"
            )

        llm = ChatBrowserUse(api_key=api_key)

        # Create scraping task
        task = f"""
        Search Google for: site:reddit.com "{request.ticker}" after:{request.start_date} before:{request.end_date}

        Find the top {request.max_results} Reddit posts about ${request.ticker} from subreddits like:
        - r/wallstreetbets
        - r/stocks
        - r/investing

        For each post, extract:
        1. Post title
        2. Post URL
        3. Upvote score (if visible)
        4. Post date
        5. Author username
        6. Number of comments
        7. Key excerpt from post body (1-2 sentences)

        Return the data in this exact JSON format:
        {{
            "posts": [
                {{
                    "title": "Post title here",
                    "url": "https://reddit.com/...",
                    "score": 1234,
                    "date": "2024-01-15",
                    "author": "username",
                    "comments_count": 56,
                    "content": "Excerpt from post..."
                }}
            ]
        }}
        """

        # Run the agent
        agent = Agent(
            task=task,
            llm=llm,
            browser=browser,
        )

        await agent.run()

        # Parse the result
        # Note: browser-use returns history of actions, we need to extract the final result
        # For now, return a mock response - in production, parse history for extracted data

        from datetime import datetime

        # Mock response for demonstration
        # TODO: Parse actual data from agent history
        mock_posts = [
            SocialPost(
                platform="reddit",
                title=f"Discussion about {request.ticker}",
                content="This is extracted content from the Reddit post...",
                url="https://reddit.com/r/wallstreetbets/...",
                score=500,
                date=request.start_date,
                author="reddit_user",
                comments_count=50
            )
        ]

        return ScrapeResponse(
            ticker=request.ticker,
            posts=mock_posts,
            source="reddit",
            timestamp=datetime.now().isoformat()
        )

    except Exception as e:
        logger.error(f"Error scraping Reddit: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/scrape/twitter", response_model=ScrapeResponse)
async def scrape_twitter(request: ScrapeRequest):
    """
    Scrape Twitter/X for posts about a ticker in a date range.
    Focuses on high-engagement tweets from finance community.
    """
    try:
        logger.info(f"Scraping Twitter for {request.ticker} from {request.start_date} to {request.end_date}")

        # Import browser-use components
        try:
            from browser_use import Agent, Browser, ChatBrowserUse
        except ImportError:
            raise HTTPException(
                status_code=500,
                detail="browser-use library not installed. Run: uv add browser-use"
            )

        browser = Browser()

        api_key = os.getenv("BROWSER_USE_API_KEY")
        if not api_key:
            raise HTTPException(
                status_code=500,
                detail="BROWSER_USE_API_KEY not configured in .env"
            )

        llm = ChatBrowserUse(api_key=api_key)

        task = f"""
        Search Google for: site:x.com "{request.ticker}" after:{request.start_date} before:{request.end_date}

        Find the top {request.max_results} tweets about ${request.ticker} with high engagement (many likes/retweets).

        For each tweet, extract:
        1. Tweet text
        2. Tweet URL
        3. Number of likes (if visible)
        4. Tweet date
        5. Author handle
        6. Number of retweets (if visible)

        Return the data in this exact JSON format:
        {{
            "posts": [
                {{
                    "title": "@username",
                    "content": "Tweet text here",
                    "url": "https://twitter.com/...",
                    "score": 5678,
                    "date": "2024-01-15",
                    "author": "@username",
                    "comments_count": 123
                }}
            ]
        }}
        """

        agent = Agent(
            task=task,
            llm=llm,
            browser=browser,
        )

        await agent.run()

        from datetime import datetime

        # Mock response for demonstration
        mock_posts = [
            SocialPost(
                platform="twitter",
                title=f"@financeuser on {request.ticker}",
                content=f"Tweet content about {request.ticker}...",
                url="https://twitter.com/...",
                score=1000,
                date=request.start_date,
                author="@financeuser",
                comments_count=25
            )
        ]

        return ScrapeResponse(
            ticker=request.ticker,
            posts=mock_posts,
            source="twitter",
            timestamp=datetime.now().isoformat()
        )

    except Exception as e:
        logger.error(f"Error scraping Twitter: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/scrape/both")
async def scrape_both(request: ScrapeRequest):
    """
    Scrape both Reddit and Twitter in parallel.
    Returns combined results.
    """
    try:
        # Run both scrapers in parallel
        reddit_task = scrape_reddit(request)
        twitter_task = scrape_twitter(request)

        reddit_result, twitter_result = await asyncio.gather(
            reddit_task,
            twitter_task,
            return_exceptions=True
        )

        # Combine results
        all_posts = []

        if not isinstance(reddit_result, Exception):
            all_posts.extend(reddit_result.posts)
        else:
            logger.error(f"Reddit scraping failed: {reddit_result}")

        if not isinstance(twitter_result, Exception):
            all_posts.extend(twitter_result.posts)
        else:
            logger.error(f"Twitter scraping failed: {twitter_result}")

        from datetime import datetime

        return {
            "ticker": request.ticker,
            "posts": all_posts,
            "source": "reddit+twitter",
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Error scraping both platforms: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8001))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
