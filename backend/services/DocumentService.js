const { query, queryOne } = require('../config/database');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const mammoth = require('mammoth');
const XLSX = require('xlsx'); // For Excel files

/**
 * Document Service
 * Handles file uploads, text extraction, and document management
 */

class DocumentService {
  /**
   * Upload and process a document
   * @param {Object} file - Uploaded file object
   * @param {number} serviceId - Service ID
   * @param {number} uploadedBy - User ID who uploaded
   * @returns {Promise<Object>} - Saved document info
   */
  static async uploadDocument(file, serviceId, uploadedBy) {
    try {
      console.log(`📤 Starting upload: ${file.originalname}`);
      console.log(`   - Size: ${file.size} bytes`);
      console.log(`   - Type: ${file.mimetype}`);
      console.log(`   - Service ID: ${serviceId}`);
      console.log(`   - Uploaded by: ${uploadedBy}`);
      
      // Generate unique filename
      const fileExt = path.extname(file.originalname);
      const uniqueName = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}${fileExt}`;
      const uploadDir = path.join(__dirname, '../../uploads');
      
      // Ensure upload directory exists
      await fs.mkdir(uploadDir, { recursive: true });
      
      const filePath = path.join(uploadDir, uniqueName);
      
      // Save file
      await fs.writeFile(filePath, file.buffer);
      
      console.log(`✓ File saved: ${uniqueName}`);
      
      // Extract text based on file type
      let extractedText = '';
      const mimeType = file.mimetype.toLowerCase();
      
      console.log(`🔍 Attempting text extraction for type: ${mimeType}, ext: ${fileExt}`);
      
      if (mimeType === 'application/pdf' || fileExt === '.pdf') {
        console.log('   → Extracting from PDF...');
        extractedText = await this.extractTextFromPDF(filePath);
      } else if (
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimeType === 'application/msword' ||
        fileExt === '.docx' ||
        fileExt === '.doc'
      ) {
        console.log('   → Extracting from DOCX...');
        extractedText = await this.extractTextFromDOCX(filePath);
      } else if (
        mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        mimeType === 'application/vnd.ms-excel' ||
        fileExt === '.xlsx' ||
        fileExt === '.xls'
      ) {
        console.log('   → Extracting from Excel...');
        extractedText = await this.extractTextFromExcel(filePath);
      } else if (
        mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
        mimeType === 'application/vnd.ms-powerpoint' ||
        fileExt === '.pptx' ||
        fileExt === '.ppt'
      ) {
        console.log('   → Extracting from PowerPoint...');
        extractedText = await this.extractTextFromPPTX(filePath);
      } else if (mimeType === 'text/plain' || fileExt === '.txt') {
        console.log('   → Reading text file...');
        extractedText = await fs.readFile(filePath, 'utf-8');
      } else {
        console.warn(`⚠️ Unsupported file type: ${mimeType}, ext: ${fileExt}`);
      }
      
      console.log(`✓ Text extracted: ${extractedText.length} characters`);
      
      if (extractedText.length === 0) {
        console.warn('⚠️ WARNING: No text was extracted from file!');
      }
      
      // Save to database
      const result = await query(
        `INSERT INTO files (
          file_name, 
          original_name, 
          file_path, 
          file_type, 
          file_size, 
          uploaded_by, 
          service_id,
          extracted_text,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          uniqueName,
          file.originalname,
          filePath,
          file.mimetype,
          file.size,
          uploadedBy,
          serviceId,
          extractedText
        ]
      );
      
      const fileId = result.insertId;
      
      // Fetch complete file record
      const savedFile = await queryOne(
        `SELECT 
          f.*,
          u.full_name as uploader_name,
          s.service_name
        FROM files f
        LEFT JOIN users u ON f.uploaded_by = u.id
        LEFT JOIN services s ON f.service_id = s.id
        WHERE f.id = ?`,
        [fileId]
      );
      
      console.log(`✓ Document saved to database: ID ${fileId}`);
      
      return savedFile;
      
    } catch (error) {
      console.error('❌ Error uploading document:', error.message);
      console.error('Stack trace:', error.stack);
      console.error('File details:', {
        name: file?.originalname,
        size: file?.size,
        type: file?.mimetype
      });
      throw error;
    }
  }

  /**
   * Extract text from PDF using pdf2json
   * @param {string} filePath - Path to PDF file
   * @returns {Promise<string>} - Extracted text
   */
  static async extractTextFromPDF(filePath) {
    try {
      // Try pdf2json first (more reliable)
      let PDFParser;
      try {
        PDFParser = require('pdf2json');
      } catch (err) {
        console.warn('⚠️ pdf2json not installed, trying pdf-parse...');
        // Fallback to pdf-parse
        try {
          const pdfParse = require('pdf-parse');
          const dataBuffer = await fs.readFile(filePath);
          const data = await pdfParse(dataBuffer);
          console.log(`✓ PDF parsed with pdf-parse: ${data.numpages} pages`);
          return data.text || '';
        } catch (parseErr) {
          console.error('❌ Both pdf2json and pdf-parse failed');
          return 'PDF file uploaded (install pdf2json or pdf-parse for text extraction)';
        }
      }

      // Use pdf2json
      return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser();
        
        pdfParser.on('pdfParser_dataError', errData => {
          console.error('PDF parse error:', errData.parserError);
          resolve('PDF file (extraction failed)');
        });
        
        pdfParser.on('pdfParser_dataReady', pdfData => {
          try {
            // Extract text from all pages
            let fullText = '';
            
            if (pdfData.Pages) {
              pdfData.Pages.forEach((page, pageIndex) => {
                fullText += `\n--- Page ${pageIndex + 1} ---\n`;
                
                if (page.Texts) {
                  page.Texts.forEach(text => {
                    if (text.R && text.R[0] && text.R[0].T) {
                      // Decode URI component (pdf2json encodes special chars)
                      const decodedText = decodeURIComponent(text.R[0].T);
                      fullText += decodedText + ' ';
                    }
                  });
                }
                fullText += '\n';
              });
            }
            
            console.log(`✓ PDF parsed with pdf2json: ${pdfData.Pages?.length || 0} pages`);
            resolve(fullText.trim());
          } catch (err) {
            console.error('Error processing PDF data:', err);
            resolve('PDF file (data processing failed)');
          }
        });
        
        pdfParser.loadPDF(filePath);
      });
      
    } catch (error) {
      console.error('PDF extraction error:', error.message);
      return 'PDF file uploaded (text extraction unavailable)';
    }
  }

  /**
   * Extract text from DOCX
   * @param {string} filePath - Path to DOCX file
   * @returns {Promise<string>} - Extracted text
   */
  static async extractTextFromDOCX(filePath) {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value || '';
    } catch (error) {
      console.error('Error extracting DOCX text:', error);
      return '';
    }
  }

  /**
   * Extract text from Excel (.xlsx, .xls)
   * @param {string} filePath - Path to Excel file
   * @returns {Promise<string>} - Extracted text
   */
  static async extractTextFromExcel(filePath) {
    try {
      const workbook = XLSX.readFile(filePath);
      let allText = '';
      
      // Loop through each sheet
      workbook.SheetNames.forEach(sheetName => {
        allText += `Sheet: ${sheetName}\n`;
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert sheet to CSV format (preserves structure)
        const csvData = XLSX.utils.sheet_to_csv(worksheet);
        allText += csvData + '\n\n';
      });
      
      return allText;
    } catch (error) {
      console.error('Error extracting Excel text:', error);
      return '';
    }
  }

  /**
   * Extract text from PowerPoint (.pptx, .ppt)
   * @param {string} filePath - Path to PowerPoint file
   * @returns {Promise<string>} - Extracted text
   */
  static async extractTextFromPPTX(filePath) {
    try {
      // Check if adm-zip is available
      let AdmZip;
      try {
        AdmZip = require('adm-zip');
      } catch (err) {
        console.warn('⚠️ adm-zip not installed. PowerPoint text extraction will be skipped.');
        console.warn('   Install it with: npm install adm-zip');
        return 'PowerPoint file uploaded (text extraction requires adm-zip package)';
      }

      const zip = new AdmZip(filePath);
      const zipEntries = zip.getEntries();
      
      let allText = '';
      let slideNumber = 0;
      
      // PPTX files contain slide XML files
      zipEntries.forEach(entry => {
        if (entry.entryName.match(/ppt\/slides\/slide\d+\.xml/)) {
          slideNumber++;
          const content = entry.getData().toString('utf8');
          allText += `\n--- Slide ${slideNumber} ---\n`;
          
          // Extract text between <a:t> tags (text tags in PPTX XML)
          const textMatches = content.match(/<a:t>([^<]+)<\/a:t>/g);
          if (textMatches) {
            textMatches.forEach(match => {
              const text = match.replace(/<\/?a:t>/g, '');
              allText += text + ' ';
            });
          }
          allText += '\n';
        }
      });
      
      return allText.trim() || 'PowerPoint file (no text extracted)';
    } catch (error) {
      console.error('Error extracting PowerPoint text:', error.message);
      console.error('Full error:', error);
      return 'PowerPoint file (extraction failed)';
    }
  }

  /**
   * Get all documents for a service
   * @param {number} serviceId - Service ID
   * @returns {Promise<Array>} - Array of documents
   */
  static async getServiceDocuments(serviceId) {
    try {
      const documents = await query(
        `SELECT 
          f.*,
          u.full_name as uploader_name,
          s.service_name,
          LENGTH(f.extracted_text) as text_length
        FROM files f
        LEFT JOIN users u ON f.uploaded_by = u.id
        LEFT JOIN services s ON f.service_id = s.id
        WHERE f.service_id = ?
        ORDER BY f.created_at DESC`,
        [serviceId]
      );
      
      return documents;
    } catch (error) {
      console.error('Error getting service documents:', error);
      return [];
    }
  }

  /**
   * Get document by ID
   * @param {number} fileId - File ID
   * @returns {Promise<Object|null>} - Document object
   */
  static async getDocumentById(fileId) {
    try {
      const document = await queryOne(
        `SELECT 
          f.*,
          u.full_name as uploader_name,
          s.service_name
        FROM files f
        LEFT JOIN users u ON f.uploaded_by = u.id
        LEFT JOIN services s ON f.service_id = s.id
        WHERE f.id = ?`,
        [fileId]
      );
      
      return document;
    } catch (error) {
      console.error('Error getting document:', error);
      return null;
    }
  }

  /**
   * Delete a document
   * @param {number} fileId - File ID
   * @returns {Promise<boolean>} - Success status
   */
  static async deleteDocument(fileId) {
    try {
      const document = await this.getDocumentById(fileId);
      if (!document) {
        return false;
      }
      
      // Delete physical file
      try {
        await fs.unlink(document.file_path);
        console.log(`✓ Physical file deleted: ${document.file_name}`);
      } catch (error) {
        console.warn('Could not delete physical file:', error.message);
      }
      
      // Delete from database
      await query('DELETE FROM files WHERE id = ?', [fileId]);
      
      console.log(`✓ Document deleted: ID ${fileId}`);
      return true;
      
    } catch (error) {
      console.error('Error deleting document:', error);
      return false;
    }
  }

  /**
   * Search documents by keyword
   * @param {number} serviceId - Service ID
   * @param {string} keyword - Search keyword
   * @returns {Promise<Array>} - Matching documents
   */
  static async searchDocuments(serviceId, keyword) {
    try {
      const documents = await query(
        `SELECT 
          f.*,
          u.full_name as uploader_name,
          s.service_name,
          LENGTH(f.extracted_text) as text_length
        FROM files f
        LEFT JOIN users u ON f.uploaded_by = u.id
        LEFT JOIN services s ON f.service_id = s.id
        WHERE f.service_id = ?
          AND (
            f.original_name LIKE ? 
            OR f.extracted_text LIKE ?
          )
        ORDER BY f.created_at DESC`,
        [serviceId, `%${keyword}%`, `%${keyword}%`]
      );
      
      return documents;
    } catch (error) {
      console.error('Error searching documents:', error);
      return [];
    }
  }

  /**
   * Get documents by vector store
   * @param {number} vectorStoreId - Vector Store ID
   * @returns {Promise<Array>} - Array of documents
   */
  static async getVectorStoreDocuments(vectorStoreId) {
    try {
      const documents = await query(
        `SELECT 
          f.*,
          u.full_name as uploader_name,
          s.service_name,
          LENGTH(f.extracted_text) as text_length
        FROM files f
        JOIN vector_store_files vsf ON f.id = vsf.file_id
        LEFT JOIN users u ON f.uploaded_by = u.id
        LEFT JOIN services s ON f.service_id = s.id
        WHERE vsf.vector_store_id = ?
        ORDER BY vsf.added_at DESC`,
        [vectorStoreId]
      );
      
      return documents;
    } catch (error) {
      console.error('Error getting vector store documents:', error);
      return [];
    }
  }

  /**
   * Get all documents (for admin)
   * @returns {Promise<Array>} - Array of all documents
   */
  static async getAllDocuments() {
    try {
      const documents = await query(
        `SELECT 
          f.*,
          u.full_name as uploader_name,
          s.service_name,
          LENGTH(f.extracted_text) as text_length
        FROM files f
        LEFT JOIN users u ON f.uploaded_by = u.id
        LEFT JOIN services s ON f.service_id = s.id
        ORDER BY f.created_at DESC`
      );
      
      return documents;
    } catch (error) {
      console.error('Error getting all documents:', error);
      return [];
    }
  }
}

module.exports = DocumentService;
