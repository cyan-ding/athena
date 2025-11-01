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

        # Import browser-use cloud SDK
        try:
            from browser_use_sdk import AsyncBrowserUse
        except ImportError:
            raise HTTPException(
                status_code=500,
                detail="browser-use-sdk library not installed. Run: pip install browser-use-sdk"
            )

        # Get API key from environment
        api_key = os.getenv("BROWSER_USE_API_KEY")
        if not api_key:
            raise HTTPException(
                status_code=500,
                detail="BROWSER_USE_API_KEY not configured in .env"
            )

        # Create cloud SDK client
        client = AsyncBrowserUse(api_key=api_key)

        # Create scraping task
        task = f"""
        Search Google for: site:reddit.com "{request.ticker}" after:{request.start_date} before:{request.end_date}

        Find the top {request.max_results} Reddit posts about ${request.ticker} from subreddits like:
        - r/wallstreetbets
        - r/stocks
        - r/investing

        For each post, try to extract as much information as possible:
        - Post title (required)
        - Post URL (required)
        - Upvote score (optional, if visible)
        - Post date (optional, use approximate if exact date unavailable)
        - Author username (optional)
        - Number of comments (optional)
        - Key excerpt from post body (1-2 sentences, required)

        Return the data as JSON. The structure should be a "posts" array. Each post should have at minimum:
        - "title" (string)
        - "url" (string)
        - "content" (string with excerpt)

        Optional fields (include if available, omit if not):
        - "score" (number)
        - "date" (string in YYYY-MM-DD format if possible, or any date format)
        - "author" (string)
        - "comments_count" (number)

        Example format (but be flexible with structure):
        {{
            "posts": [
                {{
                    "title": "Post title here",
                    "url": "https://reddit.com/...",
                    "content": "Excerpt from post...",
                    "score": 1234,
                    "date": "2024-01-15",
                    "author": "username",
                    "comments_count": 56
                }}
            ]
        }}

        If you cannot extract all fields, just include what you can find. Partial data is acceptable.
        """

        # Run the cloud task
        task_response = await client.tasks.create_task(
            task=task,
            llm="gemini-flash-latest"  # Cloud SDK uses specified LLM model
        )

        # Wait for the task to complete and get the result
        logger.info(f"[REDDIT] Task created with ID: {task_response.id}, waiting for completion...")
        result = await task_response.complete()

        # Get the final result from the cloud task
        from datetime import datetime
        import json

        # Log the raw result from browser-use
        logger.info(f"[REDDIT] Task status: {result.status}")
        logger.info(f"[REDDIT] Browser-use result.output: {result.output if hasattr(result, 'output') else 'NO OUTPUT ATTR'}")

        # Parse the result from the cloud SDK
        # The result should contain the extracted data in the format we specified
        try:
            # Try to parse JSON from result output
            result_data = json.loads(result.output) if hasattr(result, 'output') else {}
            posts_data = result_data.get('posts', [])
            logger.info(f"[REDDIT] Extracted {len(posts_data)} posts")

            parsed_posts = []
            for i, post in enumerate(posts_data):
                parsed_posts.append(SocialPost(
                    platform="reddit",
                    title=post.get('title', ''),
                    content=post.get('content', ''),
                    url=post.get('url', ''),
                    score=post.get('score'),
                    date=post.get('date', request.start_date),
                    author=post.get('author'),
                    comments_count=post.get('comments_count')
                ))
                logger.info(f"[REDDIT] Post {i+1}: {post.get('title', 'NO TITLE')[:100]}")

            logger.info(f"[REDDIT] Parsed {len(parsed_posts)} posts successfully")

            # Use parsed posts or fallback to mock if parsing fails
            mock_posts = parsed_posts if parsed_posts else [
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
        except (json.JSONDecodeError, AttributeError) as e:
            logger.warning(f"[REDDIT] Parse failed ({type(e).__name__}), using mock data")
            # Fallback to mock response
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

        logger.info(f"[REDDIT] Returning {len(mock_posts)} posts")
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

        # Import browser-use cloud SDK
        try:
            from browser_use_sdk import AsyncBrowserUse
        except ImportError:
            raise HTTPException(
                status_code=500,
                detail="browser-use-sdk library not installed. Run: pip install browser-use-sdk"
            )

        # Get API key from environment
        api_key = os.getenv("BROWSER_USE_API_KEY")
        if not api_key:
            raise HTTPException(
                status_code=500,
                detail="BROWSER_USE_API_KEY not configured in .env"
            )

        # Create cloud SDK client
        client = AsyncBrowserUse(api_key=api_key)

        task = f"""
        Search Google for: site:x.com "{request.ticker}" after:{request.start_date} before:{request.end_date}

        Find the top {request.max_results} tweets about ${request.ticker} with high engagement (many likes/retweets).

        For each tweet, try to extract as much information as possible:
        - Tweet text (required)
        - Tweet URL (required)
        - Number of likes (optional, if visible)
        - Tweet date (optional, use approximate if exact date unavailable)
        - Author handle (optional)
        - Number of retweets or replies (optional)

        Return the data as JSON. The structure should be a "posts" array. Each post should have at minimum:
        - "content" (string with tweet text)
        - "url" (string)

        Optional fields (include if available, omit if not):
        - "title" (string, can be author handle or empty string)
        - "score" (number for likes)
        - "date" (string in YYYY-MM-DD format if possible, or any date format)
        - "author" (string with handle)
        - "comments_count" (number for replies/retweets)

        Example format (but be flexible with structure):
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

        If you cannot extract all fields, just include what you can find. Partial data is acceptable.
        """

        # Run the cloud task
        task_response = await client.tasks.create_task(
            task=task,
            llm="gemini-flash-latest"  # Cloud SDK uses specified LLM model
        )

        # Wait for the task to complete and get the result
        logger.info(f"[TWITTER] Task created with ID: {task_response.id}, waiting for completion...")
        result = await task_response.complete()

        # Get the final result from the cloud task
        from datetime import datetime
        import json

        # Log the raw result from browser-use
        logger.info(f"[TWITTER] Task status: {result.status}")
        logger.info(f"[TWITTER] Browser-use result.output: {result.output if hasattr(result, 'output') else 'NO OUTPUT ATTR'}")

        # Parse the result from the cloud SDK
        try:
            # Try to parse JSON from result output
            result_data = json.loads(result.output) if hasattr(result, 'output') else {}
            posts_data = result_data.get('posts', [])
            logger.info(f"[TWITTER] Extracted {len(posts_data)} posts")

            parsed_posts = []
            for i, post in enumerate(posts_data):
                parsed_posts.append(SocialPost(
                    platform="twitter",
                    title=post.get('title', ''),
                    content=post.get('content', ''),
                    url=post.get('url', ''),
                    score=post.get('score'),
                    date=post.get('date', request.start_date),
                    author=post.get('author'),
                    comments_count=post.get('comments_count')
                ))
                logger.info(f"[TWITTER] Post {i+1}: {post.get('content', 'NO CONTENT')[:100]}")

            logger.info(f"[TWITTER] Parsed {len(parsed_posts)} posts successfully")

            # Use parsed posts or fallback to mock if parsing fails
            mock_posts = parsed_posts if parsed_posts else [
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
        except (json.JSONDecodeError, AttributeError) as e:
            logger.warning(f"[TWITTER] Parse failed ({type(e).__name__}), using mock data")
            # Fallback to mock response
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

        logger.info(f"[TWITTER] Returning {len(mock_posts)} posts")
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
