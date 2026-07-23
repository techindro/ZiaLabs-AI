const express = require('express');
const router  = express.Router();
const NewsService = require('../services/NewsService');
const RedisService = require('../config/redis');

// GET /api/news?q=...&tag=...
router.get('/', async (req, res) => {
  try {
    const tag = req.query.tag || req.query.category || '';
    
    const categoryQueries = {
      'AI & ML': 'Google AI OR OpenAI OR Microsoft Research OR IISc Bangalore AI OR DeepMind OR MIT AI',
      'Privacy': 'Privacy AI OR Federated Learning OR Differential Privacy Google OR OpenAI Security OR MIT Privacy',
      'Research Guide': 'AI Research Methodologies OR IISc Research OR Literature Review AI OR Microsoft Research',
      'Education': 'AI Education OR IIT Madras SWAYAM OR IISc Science Education OR OpenAI Learning OR MIT Education'
    };

    const defaultQuery = 'IISc Bangalore OR Google AI OR OpenAI OR Microsoft Research OR MIT OR Stanford OR Berkeley OR IIT Research AI';
    const query = req.query.q || categoryQueries[tag] || defaultQuery;
    const cacheKey = `news:${query.replace(/[^a-zA-Z0-9]/g, '_')}`;

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
