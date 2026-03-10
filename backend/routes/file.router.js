const express = require('express');
const router = express.Router();
const multer = require('multer');
const { query } = require('../config/database');
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
      'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint',
      'text/plain'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOCX, DOC, XLSX, XLS, PPTX, PPT, and TXT files are allowed.'));
    }
  }
});

/**
 * @route   POST /api/files/upload
 * @desc    Upload one or multiple documents (Admin dashboard)
 * @access  Admin only
 */
router.post('/upload', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    const { service_id } = req.body;

    if (!service_id) {
      return res.status(400).json({
        success: false,
        error: 'Service ID is required'
      });
    }

    // Upload and process all documents
    const uploadResults = [];
    const errors = [];

    for (const file of req.files) {
      try {
        const document = await DocumentService.uploadDocument(
          file,
          parseInt(service_id),
          req.session.user.id
        );
        uploadResults.push(document);
      } catch (error) {
        console.error(`Error uploading ${file.originalname}:`, error);
        errors.push({
          filename: file.originalname,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `${uploadResults.length} file(s) uploaded successfully`,
      data: {
        uploaded: uploadResults,
        failed: errors
      }
    });

  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload documents'
    });
  }
});

/**
 * @route   POST /api/files/upload-chat
 * @desc    Upload single file in chat
 * @access  Authenticated users
 */
router.post('/upload-chat', upload.single('file'), async (req, res) => {
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

    const { channel_id } = req.body;

    if (!channel_id) {
      return res.status(400).json({
        success: false,
        error: 'Channel ID is required'
      });
    }

    // Get service_id from channel
    const channel = await query(
      'SELECT service_id FROM service_channels WHERE id = ?',
      [parseInt(channel_id)]
    );

    if (!channel || channel.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }

    const serviceId = channel[0].service_id;

    // Upload and process document
    const document = await DocumentService.uploadDocument(
      req.file,
      serviceId,
      req.session.user.id
    );

    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: document
    });

  } catch (error) {
    console.error('Error uploading chat file:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload file'
    });
  }
});

/**
 * @route   GET /api/files
 * @desc    Get all files (optionally filter by service_id)
 * @access  Private
 */
router.get('/', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { service_id } = req.query;

    if (service_id) {
      // Get files for specific service
      const documents = await DocumentService.getServiceDocuments(parseInt(service_id));
      return res.json({
        success: true,
        data: documents
      });
    }

    // Get all files (for admin)
    const documents = await DocumentService.getAllDocuments();
    res.json({
      success: true,
      data: documents
    });

  } catch (error) {
    console.error('Error getting files:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get files'
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
