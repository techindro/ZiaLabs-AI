const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const PaperSearchOrchestrator = require('../services/PaperSearchOrchestrator');
const SearchHistory = require('../models/SearchHistory');
const User = require('../models/User');

/**
 * GET /api/search?q=...&sources=arxiv,semantic_scholar&limit=10
 * Search papers across multiple sources (protected)
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { q, sources, limit } = req.query;

    if (!q || !q.trim()) {
      return res.status(400).json({ error: 'Search query (q) is required' });
    }

    // Check API limits
    if (!User.hasApiCallsRemaining(req.user.id)) {
      return res.status(429).json({ error: 'API call limit reached for this month' });
    }

    const sourceList = sources ? sources.split(',').map(s => s.trim()) : null;
    const maxResults = Math.min(parseInt(limit) || 10, 50);

    const papers = await PaperSearchOrchestrator.search(q.trim(), sourceList, maxResults);

    // Record search in history
    SearchHistory.create({
      userId: req.user.id,
      query: q.trim(),
      resultsCount: papers.length,
      sources: sourceList ? sourceList.join(',') : 'all',
    });

    // Increment API calls
    User.incrementApiCalls(req.user.id);

    res.json({ query: q.trim(), total: papers.length, papers });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed. Please try again.' });
  }
});

/**
 * GET /api/search/history
 * Get recent search history (protected)
 */
router.get('/history', authMiddleware, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const searches = SearchHistory.findByUser(req.user.id, limit);
    res.json({ searches: searches.map(s => s.toJSON()) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
