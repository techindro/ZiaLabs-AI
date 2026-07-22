const express = require('express');
const router  = express.Router();
const NewsService = require('../services/NewsService');
const RedisService = require('../config/redis');

// GET /api/news?q=...
router.get('/', async (req, res) => {
  try {
    const query = req.query.q || 'MIT OR Berkeley OR IIT Research AI';
    const cacheKey = `news:${query.replace(/\s+/g, '_')}`;

    // Try fetching from cache
    const cachedData = await RedisService.get(cacheKey);
    if (cachedData) {
      return res.json({ news: cachedData, cached: true });
    }

    const news = await NewsService.getLatestNews(query);
    
    // Save to cache for 5 minutes (300 seconds)
    await RedisService.set(cacheKey, news, 300);

    res.json({ news, cached: false });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

module.exports = router;
