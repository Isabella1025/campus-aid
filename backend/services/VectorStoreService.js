const { query: dbQuery, queryOne } = require('../config/database');
const { createEmbeddings } = require('../config/openai');

/**
 * Vector Store Service
 * Handles document embeddings, vector storage, and semantic search
 */

class VectorStoreService {
  /**
   * Chunk text into smaller pieces for embedding
   * @param {string} text - Full text to chunk
   * @param {number} chunkSize - Size of each chunk (default 500)
   * @param {number} overlap - Overlap between chunks (default 50)
   * @returns {Array<string>} - Array of text chunks
   */
  static chunkText(text, chunkSize = 500, overlap = 50) {
    const words = text.split(/\s+/);
    const chunks = [];
    
    for (let i = 0; i < words.length; i += (chunkSize - overlap)) {
      const chunk = words.slice(i, i + chunkSize).join(' ');
      if (chunk.trim()) {
        chunks.push(chunk.trim());
      }
    }
    
    return chunks;
  }

  /**
   * Generate embeddings for a document
   * @param {number} fileId - File ID
   * @returns {Promise<Object>} - Result with embedding count
   */
  static async generateEmbeddings(fileId) {
    try {
      console.log(`Generating embeddings for file ${fileId}...`);
      
      // Get file
      const file = await queryOne(
        'SELECT * FROM files WHERE id = ?',
        [fileId]
      );
      
      if (!file || !file.extracted_text) {
        throw new Error('File not found or has no extracted text');
      }
      
      // Chunk the text
      const chunks = this.chunkText(file.extracted_text, 500, 50);
      console.log(`✓ Created ${chunks.length} chunks`);
      
      if (chunks.length === 0) {
        throw new Error('No chunks created from text');
      }
      
      // Generate embeddings using OpenAI
      console.log('Generating embeddings with OpenAI...');
      const embeddings = await createEmbeddings(chunks);
      console.log(`✓ Generated ${embeddings.length} embeddings`);
      
      // Delete old embeddings for this file
      await dbQuery('DELETE FROM document_embeddings WHERE file_id = ?', [fileId]);
      
      // Store embeddings in database
      for (let i = 0; i < chunks.length; i++) {
        await dbQuery(
          `INSERT INTO document_embeddings (
            file_id,
            chunk_index,
            chunk_text,
            embedding,
            created_at
          ) VALUES (?, ?, ?, ?, NOW())`,
          [
            fileId,
            i,
            chunks[i],
            JSON.stringify(embeddings[i]) // Store as JSON
          ]
        );
      }
      
      console.log(`✓ Saved ${chunks.length} embeddings to database`);
      
      return {
        success: true,
        file_id: fileId,
        chunks_created: chunks.length,
        embeddings_generated: embeddings.length
      };
      
    } catch (error) {
      console.error('Error generating embeddings:', error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param {Array<number>} a - First vector
   * @param {Array<number>} b - Second vector
   * @returns {number} - Cosine similarity (0 to 1)
   */
  static cosineSimilarity(a, b) {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }
    
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }
    
    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);
    
    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }
    
    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Semantic search for relevant context
   * @param {string} query - Search query
   * @param {number} serviceId - Service ID to limit search
   * @param {number} topK - Number of results to return (default 3)
   * @returns {Promise<Array>} - Array of relevant chunks with similarity scores
   */
  static async semanticSearch(query, serviceId, topK = 3) {
    try {
      console.log(`Semantic search: "${query}" in service ${serviceId}`);
      
      // Generate embedding for the query
      const [queryEmbedding] = await createEmbeddings([query]);
      
      // Get all embeddings for this service
      const embeddings = await dbQuery(
        `SELECT 
          de.*,
          f.original_name,
          f.service_id
        FROM document_embeddings de
        JOIN files f ON de.file_id = f.id
        WHERE f.service_id = ?`,
        [serviceId]
      );
      
      if (embeddings.length === 0) {
        console.log('No embeddings found for this service');
        return [];
      }
      
      console.log(`Comparing against ${embeddings.length} embeddings...`);
      
      // Calculate similarity for each embedding
      const results = embeddings.map(emb => {
        const embVector = JSON.parse(emb.embedding);
        const similarity = this.cosineSimilarity(queryEmbedding, embVector);
        
        return {
          file_id: emb.file_id,
          file_name: emb.original_name,
          chunk_index: emb.chunk_index,
          chunk_text: emb.chunk_text,
          similarity: similarity
        };
      });
      
      // Sort by similarity and return top K
      results.sort((a, b) => b.similarity - a.similarity);
      const topResults = results.slice(0, topK);
      
      console.log(`✓ Found ${topResults.length} relevant chunks (top similarity: ${topResults[0]?.similarity.toFixed(3)})`);
      
      return topResults;
      
    } catch (error) {
      console.error('Error in semantic search:', error);
      return [];
    }
  }

  /**
   * Get all embeddings for a file
   * @param {number} fileId - File ID
   * @returns {Promise<Array>} - Array of embeddings
   */
  static async getFileEmbeddings(fileId) {
    try {
      const embeddings = await dbQuery(
        `SELECT * FROM document_embeddings 
         WHERE file_id = ? 
         ORDER BY chunk_index`,
        [fileId]
      );
      
      return embeddings;
    } catch (error) {
      console.error('Error getting file embeddings:', error);
      return [];
    }
  }

  /**
   * Delete embeddings for a file
   * @param {number} fileId - File ID
   * @returns {Promise<boolean>} - Success status
   */
  static async deleteFileEmbeddings(fileId) {
    try {
      await dbQuery('DELETE FROM document_embeddings WHERE file_id = ?', [fileId]);
      console.log(`✓ Deleted embeddings for file ${fileId}`);
      return true;
    } catch (error) {
      console.error('Error deleting embeddings:', error);
      return false;
    }
  }

  /**
   * Get embedding statistics for a service
   * @param {number} serviceId - Service ID
   * @returns {Promise<Object>} - Statistics object
   */
  static async getServiceStats(serviceId) {
    try {
      const [stats] = await dbQuery(
        `SELECT 
          COUNT(DISTINCT f.id) as total_files,
          COUNT(de.id) as total_embeddings,
          SUM(LENGTH(f.extracted_text)) as total_text_length
        FROM files f
        LEFT JOIN document_embeddings de ON f.id = de.file_id
        WHERE f.service_id = ?`,
        [serviceId]
      );
      
      return stats;
    } catch (error) {
      console.error('Error getting service stats:', error);
      return {
        total_files: 0,
        total_embeddings: 0,
        total_text_length: 0
      };
    }
  }
}

module.exports = VectorStoreService;