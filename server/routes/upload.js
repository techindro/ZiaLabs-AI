const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/auth');
const AuthService = require('../services/AuthService');
const Paper = require('../models/Paper');
const AIAgent = require('../services/AIAgent');
const ai = new AIAgent();

// Setup multer for PDF uploads with serverless /tmp fallback
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = process.env.VERCEL
      ? path.join('/tmp', 'uploads')
      : path.join(__dirname, '..', '..', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      try {
        fs.mkdirSync(uploadDir, { recursive: true });
      } catch (err) {
        console.warn('⚠️ Could not create upload directory:', err.message);
      }
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_'));
  }
});
const upload = multer({ storage: storage });

/**
 * POST /api/upload
 * Upload a PDF paper, parse its text, and save it to the library.
 */
router.post('/', authMiddleware, upload.single('paper'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Parse PDF or TXT
    const dataBuffer = fs.readFileSync(req.file.path);
    let abstract = '';
    
    if (req.file.mimetype === 'application/pdf' || req.file.originalname.toLowerCase().endsWith('.pdf')) {
      try {
        const pdfParse = require('pdf-parse');
        const pdfData = await pdfParse(dataBuffer);
        const fullText = pdfData.text;
        
        // Use AI to generate a proper abstract if we have an API key
        if (process.env.GEMINI_API_KEY) {
          abstract = await ai.summarizePaper(fullText.substring(0, 10000)); // limit to 10k for now
        } else {
          abstract = fullText.substring(0, 800) + '...';
        }
      } catch (err) {
        console.warn('PDF parsing failed, falling back to basics', err);
        abstract = 'Upload successful, but content extraction failed. View source for details.';
      }
    } else {
      // It's a text file
      abstract = dataBuffer.toString('utf-8').substring(0, 800) + '...';
    }

    const paper = Paper.save({
      userId: req.user.id,
      title: req.file.originalname.replace('.pdf', ''),
      authors: req.user.name || 'Uploaded User',
      abstract: abstract,
      source: 'local_upload',
      sourceUrl: `/api/upload/download/${req.file.filename}`,
      published: new Date().toISOString(),
      citations: 0,
    });

    res.status(201).json({ paper: paper.toJSON() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/upload/download/:filename
 * Download an uploaded paper
 */
router.get('/download/:filename', (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(401).send('Unauthorized: Token required');
  
  try {
    AuthService.verifyToken(token);
  } catch (err) {
    return res.status(401).send('Unauthorized: Invalid token');
  }

  const filename = req.params.filename;
  if (filename.includes('..') || filename.includes('/')) {
    return res.status(400).send('Invalid filename');
  }

  const filePath = path.join(__dirname, '..', '..', 'uploads', filename);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).send('File not found');
  }
});

module.exports = router;
