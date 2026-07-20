const express = require('express');
const router  = express.Router();
const authMiddleware       = require('../middleware/auth');
const PaperSearchOrchestrator = require('../services/PaperSearchOrchestrator');
const SearchHistory        = require('../models/SearchHistory');
const User                 = require('../models/User');
const { publishEvent }     = require('../config/kafka');

// GET /api/search?q=...
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { q, sources, limit } = req.query;

    if (!q || !q.trim()) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    if (!User.hasApiCallsRemaining(req.user.id)) {
      return res.status(429).json({ error: 'Monthly API limit reached — upgrade to Pro for more' });
    }

    const sourceList  = sources ? sources.split(',').map(s => s.trim()) : null;
    const maxResults  = Math.min(parseInt(limit) || 10, 50);
    const papers      = await PaperSearchOrchestrator.search(q.trim(), sourceList, maxResults);

    SearchHistory.create({
      userId: req.user.id,
      query: q.trim(),
      resultsCount: papers.length,
      sources: sourceList ? sourceList.join(',') : 'all',
    });

    User.incrementApiCalls(req.user.id);

    // Publish search-queries event to Kafka
    publishEvent('search-queries', { event: 'search', userId: req.user.id, query: q.trim(), resultsCount: papers.length }).catch(err => {
      console.warn('Failed to publish search-queries search event:', err.message);
    });

    res.json({ query: q.trim(), total: papers.length, papers });
  } catch (err) {
    console.error('search error:', err.message);
    res.status(500).json({ error: 'Search failed. Please try again.' });
  }
});

router.get('/history', authMiddleware, (req, res) => {
  try {
    const limit   = parseInt(req.query.limit) || 10;
    const searches = SearchHistory.findByUser(req.user.id, limit);
    res.json({ searches: searches.map(s => s.toJSON()) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
