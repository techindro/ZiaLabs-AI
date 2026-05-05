const express = require('express');
const router  = express.Router();
const NewsService = require('../services/NewsService');

// GET /api/news?q=...
router.get('/', async (req, res) => {
  try {
    const query = req.query.q || 'MIT OR Berkeley OR IIT Research AI';
    const news = await NewsService.getLatestNews(query);
    res.json({ news });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

module.exports = router;
