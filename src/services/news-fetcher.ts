import axios, { AxiosInstance } from 'axios';
import RSSParser from 'rss-parser';
import { config } from '../config.js';
import { secureLogger } from '../utils/logger.js';
import { 
  NewsItem, 
  NewsAPIResponse 
} from '../types/index.js';

/**
 * RSS Feed Sources Configuration
 */
const RSS_FEEDS = {
  business: [
    { name: 'Reuters Business', url: 'https://feeds.reuters.com/reuters/businessNews', category: 'business' },
    { name: 'BBC Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml', category: 'business' },
    { name: 'CNBC', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', category: 'business' },
    { name: 'MarketWatch', url: 'https://feeds.marketwatch.com/marketwatch/realtimeheadlines/', category: 'stocks' }
  ],
  crypto: [
    { name: 'CoinTelegraph', url: 'https://cointelegraph.com/rss', category: 'crypto' },
    { name: 'CoinDesk', url: 'https://coindesk.com/arc/outboundfeeds/rss/', category: 'crypto' },
    { name: 'CryptoNews', url: 'https://cryptonews.com/news/feed/', category: 'crypto' }
  ],
  politics: [
    { name: 'Reuters Politics', url: 'https://feeds.reuters.com/Reuters/PoliticsNews', category: 'politics' },
    { name: 'BBC Politics', url: 'https://feeds.bbci.co.uk/news/politics/rss.xml', category: 'politics' }
  ],
  economics: [
    { name: 'Financial Times', url: 'https://www.ft.com/economics?format=rss', category: 'economics' },
    { name: 'Reuters Economics', url: 'https://feeds.reuters.com/reuters/economicNews', category: 'economics' }
  ]
};

/**
 * News API Manager with smart quota handling
 */
class NewsAPIManager {
  private readonly http: AxiosInstance;
  private readonly quotaUsage: Map<string, { count: number; resetTime: Date }> = new Map();
  
  constructor() {
    this.http = axios.create({
      timeout: 15000
    });
  }
  
  async fetchFromNewsAPI(category: string, maxItems: number = 10): Promise<NewsItem[]> {
    if (!config.newsApis.newsapi.enabled || !config.newsApis.newsapi.key) {
      return [];
    }
    
    // Check quota
    if (!this.checkQuota('newsapi')) {
      secureLogger.warn('NewsAPI quota exhausted');
      return [];
    }
    
    try {
      const categoryMap: Record<string, string> = {
        'all': 'general',
        'stocks': 'business',
        'crypto': 'technology',
        'forex': 'business',
        'commodities': 'business',
        'politics': 'politics',
        'economics': 'business'
      };
      
      const response = await this.http.get<NewsAPIResponse>('https://newsapi.org/v2/top-headlines', {
        params: {
          apiKey: config.newsApis.newsapi.key,
          category: categoryMap[category] || 'business',
          language: 'en',
          pageSize: Math.min(maxItems, 20)
        }
      });
      
      this.updateQuotaUsage('newsapi');
      
      return response.data.articles.map(article => ({
        id: this.generateNewsId(article.url),
        title: article.title,
        content: article.description || article.content || '',
        source: article.source.name,
        url: article.url,
        publishedAt: new Date(article.publishedAt),
        category,
        relevanceScore: this.calculateRelevanceScore(article.title, article.description || '')
      }));
      
    } catch (error: any) {
      secureLogger.error('NewsAPI fetch failed', { error: error.message });
      return [];
    }
  }
  
  async fetchFromGNews(category: string, maxItems: number = 10): Promise<NewsItem[]> {
    if (!config.newsApis.gnews.enabled || !config.newsApis.gnews.key) {
      return [];
    }
    
    if (!this.checkQuota('gnews')) {
      secureLogger.warn('GNews quota exhausted');
      return [];
    }
    
    try {
      const categoryKeywords: Record<string, string> = {
        'all': 'financial OR economic OR market',
        'stocks': 'stock market OR equity OR shares',
        'crypto': 'cryptocurrency OR bitcoin OR blockchain',
        'forex': 'forex OR currency OR exchange rate',
        'commodities': 'commodity OR oil OR gold',
        'politics': 'politics OR government OR policy',
        'economics': 'economy OR GDP OR inflation'
      };
      
      const response = await this.http.get('https://gnews.io/api/v4/search', {
        params: {
          token: config.newsApis.gnews.key,
          q: categoryKeywords[category] || categoryKeywords.all,
          lang: 'en',
          max: Math.min(maxItems, 10),
          sortby: 'publishedAt'
        }
      });
      
      this.updateQuotaUsage('gnews');
      
      return response.data.articles.map((article: any) => ({
        id: this.generateNewsId(article.url),
        title: article.title,
        content: article.description || '',
        source: article.source.name,
        url: article.url,
        publishedAt: new Date(article.publishedAt),
        category,
        relevanceScore: this.calculateRelevanceScore(article.title, article.description || '')
      }));
      
    } catch (error: any) {
      secureLogger.error('GNews fetch failed', { error: error.message });
      return [];
    }
  }
  
  private checkQuota(provider: string): boolean {
    const usage = this.quotaUsage.get(provider);
    if (!usage) return true;
    
    const now = new Date();
    if (now > usage.resetTime) {
      // Reset quota
      this.quotaUsage.delete(provider);
      return true;
    }
    
    const limits = {
      'newsapi': 500, // Free tier daily limit
      'gnews': 100    // Free tier daily limit
    };
    
    return usage.count < (limits[provider as keyof typeof limits] || 100);
  }
  
  private updateQuotaUsage(provider: string): void {
    const usage = this.quotaUsage.get(provider) || { count: 0, resetTime: new Date() };
    usage.count++;
    
    // Set reset time to next day
    if (usage.count === 1) {
      usage.resetTime = new Date();
      usage.resetTime.setDate(usage.resetTime.getDate() + 1);
      usage.resetTime.setHours(0, 0, 0, 0);
    }
    
    this.quotaUsage.set(provider, usage);
  }
  
  private generateNewsId(url: string): string {
    return Buffer.from(url).toString('base64').substring(0, 16);
  }
  
  private calculateRelevanceScore(title: string, content: string): number {
    const highValueKeywords = [
      'market', 'stock', 'trading', 'investment', 'financial',
      'economic', 'policy', 'rate', 'inflation', 'gdp',
      'crypto', 'bitcoin', 'blockchain', 'forex', 'currency'
    ];
    
    const text = `${title} ${content}`.toLowerCase();
    const matches = highValueKeywords.filter(keyword => text.includes(keyword));
    
    return Math.min(1.0, matches.length / 5); // Normalize to 0-1
  }
  
  getQuotaStatus(): Record<string, { remaining: number; resetTime: Date | null }> {
    const status: Record<string, { remaining: number; resetTime: Date | null }> = {};
    
    ['newsapi', 'gnews'].forEach(provider => {
      const usage = this.quotaUsage.get(provider);
      const limits = { newsapi: 500, gnews: 100 };
      
      status[provider] = {
        remaining: usage ? limits[provider as keyof typeof limits] - usage.count : limits[provider as keyof typeof limits],
        resetTime: usage ? usage.resetTime : null
      };
    });
    
    return status;
  }
}

/**
 * RSS Feed Manager
 */
class RSSFeedManager {
  private readonly parser: RSSParser;
  // private readonly _http: AxiosInstance; // Reserved for future HTTP-based RSS fetching
  
  constructor() {
    this.parser = new RSSParser({
      timeout: 10000,
      requestOptions: {
        headers: {
          'User-Agent': 'MCP-NextGen-Financial-Intelligence/1.0 (+https://github.com/your-repo)'
        }
      }
    });
    
    // Reserved for future HTTP-based RSS fetching functionality
  }
  
  async fetchRSSFeeds(category: string, maxItems: number = 10): Promise<NewsItem[]> {
    const categoryFeeds = this.getFeedsForCategory(category);
    const allNews: NewsItem[] = [];
    
    // Fetch from all feeds in parallel
    const feedPromises = categoryFeeds.map(async (feed) => {
      try {
        const parsedFeed = await this.parser.parseURL(feed.url);
        
        return parsedFeed.items.slice(0, Math.ceil(maxItems / categoryFeeds.length)).map(item => ({
          id: this.generateNewsId(item.link || ''),
          title: item.title || 'No Title',
          content: item.contentSnippet || item.content || item.summary || '',
          source: feed.name,
          url: item.link || '',
          publishedAt: new Date(item.pubDate || Date.now()),
          category: feed.category,
          relevanceScore: this.calculateRelevanceScore(item.title || '', item.contentSnippet || '')
        }));
        
      } catch (error: any) {
        secureLogger.warn(`RSS feed failed: ${feed.name}`, { error: error.message });
        return [];
      }
    });
    
    const feedResults = await Promise.all(feedPromises);
    feedResults.forEach(items => allNews.push(...items));
    
    // Sort by publication date and relevance
    allNews.sort((a, b) => {
      const timeWeight = 0.7;
      const relevanceWeight = 0.3;
      
      const timeScore = (b.publishedAt.getTime() - a.publishedAt.getTime()) / (1000 * 60 * 60 * 24); // Days difference
      const aScore = timeWeight * Math.max(0, 1 - timeScore) + relevanceWeight * (a.relevanceScore || 0);
      const bScore = timeWeight * Math.max(0, 1 - timeScore) + relevanceWeight * (b.relevanceScore || 0);
      
      return bScore - aScore;
    });
    
    return allNews.slice(0, maxItems);
  }
  
  private getFeedsForCategory(category: string): Array<{ name: string; url: string; category: string }> {
    switch (category) {
      case 'all':
        return [...RSS_FEEDS.business, ...RSS_FEEDS.crypto, ...RSS_FEEDS.politics, ...RSS_FEEDS.economics];
      case 'stocks':
      case 'forex':
      case 'commodities':
        return RSS_FEEDS.business;
      case 'crypto':
        return RSS_FEEDS.crypto;
      case 'politics':
        return RSS_FEEDS.politics;
      case 'economics':
        return RSS_FEEDS.economics;
      default:
        return RSS_FEEDS.business;
    }
  }
  
  private generateNewsId(url: string): string {
    return Buffer.from(url).toString('base64').substring(0, 16);
  }
  
  private calculateRelevanceScore(title: string, content: string): number {
    const highValueKeywords = [
      'breaking', 'urgent', 'alert', 'market', 'stock', 'trading',
      'investment', 'financial', 'economic', 'policy', 'rate',
      'inflation', 'gdp', 'crypto', 'bitcoin', 'blockchain'
    ];
    
    const text = `${title} ${content}`.toLowerCase();
    let score = 0;
    
    highValueKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        score += 0.2;
        if (title.toLowerCase().includes(keyword)) {
          score += 0.1; // Extra weight for keywords in title
        }
      }
    });
    
    return Math.min(1.0, score);
  }
}

/**
 * Main News Fetcher Service
 */
export class NewsFetcherService {
  private readonly rssManager: RSSFeedManager;
  private readonly apiManager: NewsAPIManager;
  private readonly cache: Map<string, { data: NewsItem[]; timestamp: Date }> = new Map();
  
  constructor() {
    this.rssManager = new RSSFeedManager();
    this.apiManager = new NewsAPIManager();
  }
  
  async fetchNews(
    category: string = 'all',
    maxItems: number = 10,
    timeRange: string = '6h',
    useCache: boolean = true
  ): Promise<NewsItem[]> {
    const cacheKey = `${category}-${maxItems}-${timeRange}`;
    
    // Check cache first
    if (useCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (!cached) {
        // This shouldn't happen since we checked has() above, but for type safety
        return [];
      }
      const cacheAge = Date.now() - cached.timestamp.getTime();
      const cacheMaxAge = 30 * 60 * 1000; // 30 minutes
      
      if (cacheAge < cacheMaxAge) {
        secureLogger.info('Returning cached news', { category, cacheAge });
        return this.filterByTimeRange(cached.data, timeRange);
      }
    }
    
    secureLogger.info('Fetching fresh news', { category, maxItems, timeRange });
    
    try {
      // Fetch from both RSS feeds and APIs in parallel
      const [rssNews, apiNews] = await Promise.all([
        this.rssManager.fetchRSSFeeds(category, Math.ceil(maxItems * 0.7)), // 70% from RSS
        this.apiManager.fetchFromNewsAPI(category, Math.ceil(maxItems * 0.3))  // 30% from APIs
      ]);
      
      // Combine and deduplicate
      const allNews = this.deduplicateNews([...rssNews, ...apiNews]);
      
      // Filter by time range
      const filteredNews = this.filterByTimeRange(allNews, timeRange);
      
      // Cache the results
      this.cache.set(cacheKey, { data: allNews, timestamp: new Date() });
      
      // Clean old cache entries
      this.cleanCache();
      
      secureLogger.info('News fetch completed', {
        category,
        totalFetched: allNews.length,
        afterTimeFilter: filteredNews.length,
        sources: [...new Set(allNews.map(item => item.source))]
      });
      
      return filteredNews.slice(0, maxItems);
      
    } catch (error) {
      secureLogger.error('News fetch failed', { error, category });
      return [];
    }
  }
  
  private deduplicateNews(newsItems: NewsItem[]): NewsItem[] {
    const seen = new Set<string>();
    const deduplicated: NewsItem[] = [];
    
    for (const item of newsItems) {
      // Create a fingerprint based on title similarity
      const fingerprint = this.createFingerprint(item.title);
      
      if (!seen.has(fingerprint)) {
        seen.add(fingerprint);
        deduplicated.push(item);
      }
    }
    
    return deduplicated;
  }
  
  private createFingerprint(title: string): string {
    // Remove common words and create a normalized fingerprint
    const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const words = title.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !commonWords.includes(word))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 5); // Take first 5 significant words
    
    return words.join('-');
  }
  
  private filterByTimeRange(newsItems: NewsItem[], timeRange: string): NewsItem[] {
    const now = new Date();
    let cutoffTime: Date;
    
    switch (timeRange) {
      case '1h':
        cutoffTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '6h':
        cutoffTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        break;
      case '12h':
        cutoffTime = new Date(now.getTime() - 12 * 60 * 60 * 1000);
        break;
      case '24h':
        cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      default:
        cutoffTime = new Date(now.getTime() - 6 * 60 * 60 * 1000); // Default 6h
    }
    
    return newsItems.filter(item => item.publishedAt >= cutoffTime);
  }
  
  private cleanCache(): void {
    const maxCacheAge = 2 * 60 * 60 * 1000; // 2 hours
    const now = Date.now();
    
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp.getTime() > maxCacheAge) {
        this.cache.delete(key);
      }
    }
  }
  
  getSourceStatus(): Record<string, any> {
    return {
      rss_feeds: {
        business: RSS_FEEDS.business.length,
        crypto: RSS_FEEDS.crypto.length,
        politics: RSS_FEEDS.politics.length,
        economics: RSS_FEEDS.economics.length
      },
      api_quotas: this.apiManager.getQuotaStatus(),
      cache_size: this.cache.size
    };
  }
}

// Export singleton instance
export const newsFetcherService = new NewsFetcherService();