const express = require('express');
const router  = express.Router();
const authMiddleware = require('../middleware/auth');
const AIAgent    = require('../services/AIAgent');
const ChatMessage = require('../models/ChatMessage');
const PaperSearchOrchestrator = require('../services/PaperSearchOrchestrator');
const { publishEvent } = require('../config/kafka');
const SecurityService = require('../services/SecurityService');
const PaperLinkParser = require('../services/PaperLinkParser');

const agent = new AIAgent();

router.post('/message', authMiddleware, async (req, res) => {
  try {
    const { message, language } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const cleanMessage = SecurityService.sanitizeInput(message.trim());
    const detectedPaper = PaperLinkParser.parse(cleanMessage);
    let searchResults = null;

    // Auto-search real papers when user asks for paper, link, ArXiv, NeurIPS, IEEE, or research query
    if (!detectedPaper && /(paper|arxiv|neurips|ieee|pdf|link|download|journal|article|research|literature|study)/i.test(cleanMessage)) {
      try {
        const searchData = await PaperSearchOrchestrator.search(cleanMessage, 3);
        if (searchData && searchData.papers && searchData.papers.length > 0) {
          searchResults = searchData.papers;
        }
      } catch (err) {
        console.warn('Paper auto-search error:', err.message);
      }
    }

    let response = await agent.chat(req.user.id, cleanMessage, language);

    if (detectedPaper) {
      response += PaperLinkParser.formatWidget(detectedPaper);
    } else if (searchResults && searchResults.length > 0) {
      response += `\n\n---\n### 📄 **Direct Paper & PDF Download Links**\n`;
      searchResults.slice(0, 3).forEach((p, idx) => {
        const pdfUrl = p.pdfUrl || (p.arxivId ? `https://arxiv.org/pdf/${p.arxivId}.pdf` : p.url);
        const pageUrl = p.url || (p.arxivId ? `https://arxiv.org/abs/${p.arxivId}` : pdfUrl);
        response += `**${idx + 1}. ${p.title}** (${p.year || 'Research Paper'})\n`;
        if (p.authors && p.authors.length) response += `*Authors: ${Array.isArray(p.authors) ? p.authors.join(', ') : p.authors}*\n`;
        response += `📥 **[Download PDF](${pdfUrl})** &nbsp;|&nbsp; 🌐 **[View Article Page](${pageUrl})**\n\n`;
      });
      response += `---`;
    }

    // Publish chat message event to Kafka
    publishEvent('ai-synthesis', { event: 'message', userId: req.user.id, query: message.trim() }).catch(err => {
      console.warn('Failed to publish ai-synthesis message event:', err.message);
    });

    res.json({ response, paper: detectedPaper, papers: searchResults });
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
