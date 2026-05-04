const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const Paper = require('../models/Paper');
const SearchHistory = require('../models/SearchHistory');
const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');

/**
 * POST /api/papers/save
 * Save a paper to user's library (protected)
 */
router.post('/save', authMiddleware, (req, res) => {
  try {
    const { title, authors, abstract, source, sourceUrl, published, citations } = req.body;
    if (!title) return res.status(400).json({ error: 'Paper title is required' });

    const paper = Paper.save({
      userId: req.user.id,
      title, authors, abstract, source, sourceUrl, published,
      citations: citations || 0,
    });

    res.status(201).json({ paper: paper.toJSON() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/papers
 * Get user's saved papers (protected)
 */
router.get('/', authMiddleware, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const papers = Paper.findByUser(req.user.id, limit);
    res.json({ papers: papers.map(p => p.toJSON()) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/papers/:id
 * Remove a saved paper (protected)
 */
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const deleted = Paper.delete(parseInt(req.params.id), req.user.id);
    if (!deleted) return res.status(404).json({ error: 'Paper not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/papers/stats
 * Get dashboard metrics for user (protected)
 */
router.get('/stats', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const user = User.findById(userId);

    const stats = {
      searches: SearchHistory.countByUser(userId),
      searchesThisWeek: SearchHistory.countThisWeek(userId),
      papersSaved: Paper.count(userId),
      insightsGenerated: ChatMessage.countByUser(userId),
      apiCallsUsed: user.apiCallsUsed,
      apiCallsLimit: user.apiCallsLimit,
      plan: user.plan,
    };

    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
