# MCP NextGen Financial Intelligence

Advanced MCP (Model Context Protocol) server providing AI-enhanced financial intelligence through 7 specialized analyst personas.

## 🧠 **The Seven Sages of Market Intelligence**

1. **Political Analyst** - Government policies, elections, regulatory changes
2. **Economic Analyst** - GDP, inflation, interest rates, employment data  
3. **Geopolitical Analyst** - International relations, conflicts, trade wars
4. **Financial Analyst** - Traditional markets, stocks, bonds, forex
5. **Crypto Analyst** - Blockchain, DeFi, cryptocurrency markets
6. **Tech Analyst** - AI developments, technological disruption
7. **Behavioral Analyst** - Market psychology, sentiment analysis

## 🚀 **Triple Protocol Support**

- **STDIO MCP** - For Claude Desktop integration
- **HTTP REST API** - For general HTTP clients  
- **HTTP MCP Protocol** - For n8n-nodes-mcp compatibility

## 🛠️ **Quick Start**

### Prerequisites
- Node.js 18+
- OpenAI API key (minimum required)
- Optional: Additional AI provider keys (Gemini, DeepSeek, Groq)

### Installation

1. **Clone and install:**
```bash
git clone <repository-url>
cd mcp-nextgen-financial-intelligence
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your API keys - NEVER commit real keys!
```

⚠️ **SECURITY WARNING**: Never commit real API keys to version control! The `.env` file is already in `.gitignore`.

3. **Build:**
```bash
npm run build
```

### Usage Modes

**STDIO Mode (Claude Desktop):**
```bash
npm start
```

**HTTP Mode (REST API + MCP Protocol):**
```bash
npm run start:http
# Server runs on http://localhost:3001
```

**Development:**
```bash
npm run dev        # STDIO mode
npm run dev:http   # HTTP mode
```

## 🔧 **Available Tools**

### 1. Multi-Analyst Consensus
Get comprehensive analysis from 7 AI specialists with consensus mechanism.

**Usage:**
```json
{
  "news_item": "Federal Reserve announces interest rate decision",
  "analysis_depth": "standard",
  "sage_perspectives": ["economic_analyst", "political_analyst"]
}
```

### 2. Fetch Breaking News
Real-time financial news with AI impact analysis.

**Usage:**
```json
{
  "category": "all",
  "max_items": 10,
  "time_range": "6h",
  "include_analysis": true
}
```

## 📡 **HTTP API Endpoints**

- `GET /health` - Health check
- `POST /tools/multi_analyst_consensus` - REST API for consensus analysis
- `POST /tools/fetch_breaking_news` - REST API for breaking news
- `POST /mcp` - JSON-RPC 2.0 MCP protocol endpoint

## 🔒 **Security Features**

- ✅ IP-based rate limiting (100 requests/15 minutes)
- ✅ Input validation with Zod schemas
- ✅ Secure API key handling (never logged)
- ✅ Request logging with sensitive data redaction
- ✅ CORS protection
- ✅ Triple verification system for analysis accuracy

## 📊 **Data Sources**

**RSS Feeds (Unlimited):**
- Reuters Business, BBC Business, CNBC, MarketWatch
- CoinTelegraph, CoinDesk (Crypto)
- Political and Economic news feeds

**APIs (Quota Limited):**
- NewsAPI.org (500/day free)
- GNews.io (100/day free)
- Smart quota management with fallbacks

## 🐳 **Docker Support**

```bash
docker build -t mcp-financial-intelligence .
docker run -p 3001:3001 --env-file .env mcp-financial-intelligence
```

## 🔍 **Testing**

**MCP Inspector:**
```bash
npm run inspector
```

**HTTP Testing:**
```bash
# Health check
curl http://localhost:3001/health

# Multi-analyst consensus
curl -X POST http://localhost:3001/tools/multi_analyst_consensus \
  -H "Content-Type: application/json" \
  -d '{"news_item": "Market volatility increases", "analysis_depth": "quick"}'

# Breaking news
curl -X POST http://localhost:3001/tools/fetch_breaking_news \
  -H "Content-Type: application/json" \
  -d '{"category": "crypto", "max_items": 5}'
```

## ⚙️ **Environment Variables**

Required:
- `OPENAI_API_KEY` - OpenAI API key

Optional:
- `HTTP_MODE=true` - Enable HTTP server mode
- `HTTP_PORT=3001` - HTTP server port
- `GEMINI_API_KEY` - Google Gemini API key
- `DEEPSEEK_API_KEY` - DeepSeek API key
- `GROQ_API_KEY` - Groq API key
- `MONGODB_URI` - MongoDB connection string
- `REDIS_URL` - Redis connection string
- `NEWSAPI_KEY` - NewsAPI.org key
- `GNEWS_API_KEY` - GNews.io key

## 🤝 **Integration Examples**

**Claude Desktop:**
```json
{
  "mcpServers": {
    "financial-intelligence": {
      "command": "npx",
      "args": ["mcp-nextgen-financial-intelligence"]
    }
  }
}
```

**n8n with n8n-nodes-mcp:**
- Server URL: `http://localhost:3001/mcp`
- Use JSON-RPC 2.0 format

## 📈 **Performance**

- **Response Time**: <30 seconds for multi-analyst consensus
- **Throughput**: 100+ requests/15 minutes per IP
- **Accuracy**: 90%+ with triple verification system
- **Availability**: 99.5% uptime target

## 🛡️ **Production Deployment**

1. Set `NODE_ENV=production`
2. Configure all environment variables
3. Setup MongoDB and Redis (optional)
4. Use process manager (PM2, systemd)
5. Setup reverse proxy (nginx)
6. Enable HTTPS
7. Configure monitoring

## 🌐 **Community & Support**

Join our community for updates, support, and discussions:

- 🟣 **Discord Community**: [Join our Discord](https://discord.com/channels/1413326280518140014/1413326281487155241)
- 📢 **Telegram Channel**: [Follow on Telegram](https://t.me/KaayaanAi)

## 📝 **License**

MIT License - See LICENSE file for details.

---

**By: Kaayaan Ai**

*🔒 Powered by MCP NextGen Financial Intelligence • AI-Enhanced Analysis with Human-Grade Insights*