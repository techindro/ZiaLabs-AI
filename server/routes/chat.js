const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const AIAgent = require('../services/AIAgent');
const ChatMessage = require('../models/ChatMessage');

// Single AI agent instance shared across requests
const agent = new AIAgent();

/**
 * POST /api/chat/message
 * Send a message to the AI agent (protected)
 */
router.post('/message', authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const response = await agent.chat(req.user.id, message.trim());
    res.json({ response });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'AI agent error. Please try again.' });
  }
});

/**
 * GET /api/chat/history
 * Get conversation history (protected)
 */
router.get('/history', authMiddleware, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const messages = ChatMessage.findByUser(req.user.id, limit);
    res.json({ messages: messages.map(m => m.toJSON()) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/chat/clear
 * Clear chat history (protected)
 */
router.delete('/clear', authMiddleware, (req, res) => {
  try {
    ChatMessage.clearByUser(req.user.id);
    res.json({ success: true, message: 'Chat history cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/chat/summarize
 * Summarize a paper abstract (protected)
 */
router.post('/summarize', authMiddleware, async (req, res) => {
  try {
    const { abstract } = req.body;
    if (!abstract) return res.status(400).json({ error: 'Abstract is required' });

    const summary = await agent.summarizePaper(abstract);
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/chat/generate-code
 * Generate code from paper context (protected)
 */
router.post('/generate-code', authMiddleware, async (req, res) => {
  try {
    const { context, language = 'python' } = req.body;
    if (!context) return res.status(400).json({ error: 'Paper context is required' });

    const code = await agent.generateCode(context, language);
    res.json({ code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
