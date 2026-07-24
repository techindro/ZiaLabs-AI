const express = require('express');
const router  = express.Router();
const authMiddleware = require('../middleware/auth');
const AIAgent    = require('../services/AIAgent');
const ChatMessage = require('../models/ChatMessage');
const PaperSearchOrchestrator = require('../services/PaperSearchOrchestrator');
const { publishEvent } = require('../config/kafka');

const agent = new AIAgent();

router.post('/message', authMiddleware, async (req, res) => {
  try {
    const { message, language } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const response = await agent.chat(req.user.id, message.trim(), language);

    // Publish chat message event to Kafka
    publishEvent('ai-synthesis', { event: 'message', userId: req.user.id, query: message.trim() }).catch(err => {
      console.warn('Failed to publish ai-synthesis message event:', err.message);
    });

    res.json({ response });
  } catch (err) {
    console.error('chat error:', err.message);
    res.status(500).json({ error: 'AI agent error. Please try again.' });
  }
});

router.get('/history', authMiddleware, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const messages = ChatMessage.findByUser(req.user.id, limit);
    res.json({ messages: messages.map(m => m.toJSON()) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/clear', authMiddleware, (req, res) => {
  try {
    ChatMessage.clearByUser(req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

router.post('/consensus', authMiddleware, async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const papers = await PaperSearchOrchestrator.search(question.trim(), null, 4);
    if (!papers || !papers.length) {
      return res.json({
        consensus: {
          consensusStatement: "No research papers found matching this question.",
          yesCount: 0,
          noCount: 0,
          unclearCount: 0,
          papers: []
        }
      });
    }

    const consensus = await agent.getConsensus(question.trim(), papers);

    // Publish consensus query event to Kafka
    publishEvent('ai-synthesis', { event: 'consensus', userId: req.user.id, query: question.trim() }).catch(err => {
      console.warn('Failed to publish ai-synthesis consensus event:', err.message);
    });

    res.json({ consensus });
  } catch (err) {
    console.error('consensus API error:', err.message);
    res.status(500).json({ error: 'Failed to generate consensus. Please try again.' });
  }
});

router.post('/structured-summary', authMiddleware, async (req, res) => {
  try {
    const { title, abstract } = req.body;
    if (!title || !abstract) {
      return res.status(400).json({ error: 'Title and Abstract are required' });
    }

    const summary = await agent.getStructuredSummary(title, abstract);

    // Publish structured summary event to Kafka
    publishEvent('ai-synthesis', { event: 'structured-summary', userId: req.user.id, title }).catch(err => {
      console.warn('Failed to publish ai-synthesis structured-summary event:', err.message);
    });

    res.json({ summary });
  } catch (err) {
    console.error('structured summary API error:', err.message);
    res.status(500).json({ error: 'Failed to generate structured summary. Please try again.' });
  }
});

module.exports = router;
