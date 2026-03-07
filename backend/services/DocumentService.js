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
        fileExt === '.docx'
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
      console.error('Error uploading document:', error);
      throw error;
    }
  }

  /**
   * Extract text from PDF
   * @param {string} filePath - Path to PDF file
   * @returns {Promise<string>} - Extracted text
   */
  static async extractTextFromPDF(filePath) {
    try {
      const dataBuffer = await fs.readFile(filePath);
      
      // pdf-parse exports a function directly; require it and verify
      const pdfParse = require('pdf-parse');
      if (typeof pdfParse !== 'function') {
        console.error('pdf-parse import is not a function:', pdfParse);
        return '';
      }
      
      const data = await pdfParse(dataBuffer);
      return (data && data.text) ? data.text : '';
    } catch (error) {
      console.error('Error extracting PDF text:', error);
      return '';
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
}

module.exports = DocumentService;