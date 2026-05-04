const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');
const path = require('path');
const fs = require('fs');
const authMiddleware = require('../middleware/auth');
const AuthService = require('../services/AuthService');
const Paper = require('../models/Paper');

// Setup multer for PDF uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', '..', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
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
        const pdfData = await pdfParse(dataBuffer);
        abstract = pdfData.text.substring(0, 1000) + '...';
      } catch (err) {
        console.warn('PDF parse failed, using fallback empty abstract', err);
        abstract = 'Uploaded PDF could not be parsed automatically.';
      }
    } else {
      // Treat as plain text
      abstract = dataBuffer.toString('utf-8').substring(0, 1000) + '...';
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
