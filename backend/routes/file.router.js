const express = require('express');
const router = express.Router();
const multer = require('multer');
const DocumentService = require('../services/DocumentService');
const VectorStoreService = require('../services/VectorStoreService');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/plain'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, XLSX, XLS, and TXT files are allowed.'));
    }
  }
});

/**
 * @route   POST /api/files/upload
 * @desc    Upload a document
 * @access  Admin only
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const { service_id } = req.body;

    if (!service_id) {
      return res.status(400).json({
        success: false,
        error: 'Service ID is required'
      });
    }

    // Upload and process document
    const document = await DocumentService.uploadDocument(
      req.file,
      parseInt(service_id),
      req.session.user.id
    );

    res.json({
      success: true,
      message: 'Document uploaded successfully',
      data: document
    });

  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload document'
    });
  }
});

/**
 * @route   GET /api/files/service/:serviceId
 * @desc    Get all documents for a service
 * @access  Private
 */
router.get('/service/:serviceId', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { serviceId } = req.params;
    const documents = await DocumentService.getServiceDocuments(parseInt(serviceId));

    res.json({
      success: true,
      data: documents
    });

  } catch (error) {
    console.error('Error getting service documents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get documents'
    });
  }
});

/**
 * @route   GET /api/files/:fileId
 * @desc    Get document by ID
 * @access  Private
 */
router.get('/:fileId', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { fileId } = req.params;
    const document = await DocumentService.getDocumentById(parseInt(fileId));

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    res.json({
      success: true,
      data: document
    });

  } catch (error) {
    console.error('Error getting document:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get document'
    });
  }
});

/**
 * @route   DELETE /api/files/:fileId
 * @desc    Delete a document
 * @access  Admin only
 */
router.delete('/:fileId', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { fileId } = req.params;
    const success = await DocumentService.deleteDocument(parseInt(fileId));

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Document not found or could not be deleted'
      });
    }

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete document'
    });
  }
});

/**
 * @route   GET /api/files/search/:serviceId
 * @desc    Search documents by keyword
 * @access  Private
 */
router.get('/search/:serviceId', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { serviceId } = req.params;
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query required'
      });
    }

    const documents = await DocumentService.searchDocuments(
      parseInt(serviceId),
      q
    );

    res.json({
      success: true,
      data: documents
    });

  } catch (error) {
    console.error('Error searching documents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search documents'
    });
  }
});

/**
 * @route   POST /api/files/:fileId/embeddings
 * @desc    Generate embeddings for a document
 * @access  Admin only
 */
router.post('/:fileId/embeddings', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { fileId } = req.params;
    
    // Generate embeddings
    const result = await VectorStoreService.generateEmbeddings(parseInt(fileId));

    res.json({
      success: true,
      message: 'Embeddings generated successfully',
      data: result
    });

  } catch (error) {
    console.error('Error generating embeddings:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate embeddings'
    });
  }
});

/**
 * @route   GET /api/files/:fileId/embeddings
 * @desc    Get embeddings for a document
 * @access  Private
 */
router.get('/:fileId/embeddings', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { fileId } = req.params;
    const embeddings = await VectorStoreService.getFileEmbeddings(parseInt(fileId));

    res.json({
      success: true,
      data: embeddings
    });

  } catch (error) {
    console.error('Error getting embeddings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get embeddings'
    });
  }
});

module.exports = router;