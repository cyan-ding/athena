# Athena Browser-Use Service

Python FastAPI microservice for real-time social media scraping using browser-use.

## Setup

1. Install dependencies:
```bash
# Install uv if you don't have it
curl -LsSf https://astral.sh/uv/install.sh | sh

# Create virtual environment and install dependencies
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
uv pip install -e .
```

2. Install Chromium for browser-use:
```bash
uvx browser-use install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env and add your API keys
```

4. Get API keys:
   - Browser-Use: https://browser-use.com (get $10 free credit)
   - OpenAI: https://platform.openai.com/api-keys (if using as fallback)

## Running the Service

```bash
# Development mode (auto-reload)
python main.py

# Or with uvicorn directly
uvicorn main:app --reload --port 8001
```

## Endpoints

### Health Check
```bash
GET http://localhost:8001/health
```

### Scrape Reddit
```bash
POST http://localhost:8001/scrape/reddit
Content-Type: application/json

{
  "ticker": "NVDA",
  "start_date": "2024-01-01",
  "end_date": "2024-01-31",
  "max_results": 5
}
```

### Scrape Twitter/X
```bash
POST http://localhost:8001/scrape/twitter
Content-Type: application/json

{
  "ticker": "NVDA",
  "start_date": "2024-01-01",
  "end_date": "2024-01-31",
  "max_results": 5
}
```

### Scrape Both Platforms
```bash
POST http://localhost:8001/scrape/both
Content-Type: application/json

{
  "ticker": "NVDA",
  "start_date": "2024-01-01",
  "end_date": "2024-01-31",
  "max_results": 5
}
```

## Response Format

```json
{
  "ticker": "NVDA",
  "posts": [
    {
      "platform": "reddit",
      "title": "Post title",
      "content": "Post excerpt...",
      "url": "https://reddit.com/...",
      "score": 1234,
      "date": "2024-01-15",
      "author": "username",
      "comments_count": 56
    }
  ],
  "source": "reddit",
  "timestamp": "2024-01-31T12:00:00"
}
```

## Notes

- Browser-use requires Python 3.11+
- Scraping takes 5-15 seconds per request
- Use sparingly to avoid rate limits
- Results are currently mocked - see TODOs in main.py for parsing actual browser-use output
