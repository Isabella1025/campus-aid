const { query, queryOne } = require('../config/database');

/**
 * ServiceBot Model
 * Manages AI assistants for student services
 */
class ServiceBot {
  /**
   * Get all bots for a service
   * @param {number} serviceId - Service ID
   * @returns {Promise<Array>} Array of bot objects
   */
  static async getByService(serviceId) {
    return await query(`
      SELECT 
        sb.*,
        s.service_name,
        u.full_name as creator_name
      FROM service_bots sb
      JOIN services s ON sb.service_id = s.id
      JOIN users u ON sb.created_by = u.id
      WHERE sb.service_id = ? AND sb.is_active = TRUE
      ORDER BY sb.created_at DESC
    `, [serviceId]);
  }

  /**
   * Get bot by ID with details
   * @param {number} botId - Bot ID
   * @returns {Promise<Object|null>} Bot object or null
   */
  static async getById(botId) {
    return await queryOne(`
      SELECT 
        sb.*,
        s.service_name,
        s.service_code,
        u.full_name as creator_name
      FROM service_bots sb
      JOIN services s ON sb.service_id = s.id
      JOIN users u ON sb.created_by = u.id
      WHERE sb.id = ? AND sb.is_active = TRUE
    `, [botId]);
  }

  /**
   * Get bots assigned to a channel
   * @param {number} channelId - Channel ID
   * @returns {Promise<Array>} Array of bots
   */
  static async getByChannel(channelId) {
    return await query(`
      SELECT 
        sb.*,
        s.service_name,
        bca.assigned_at
      FROM service_bots sb
      JOIN bot_channel_assignments bca ON sb.id = bca.bot_id
      JOIN services s ON sb.service_id = s.id
      WHERE bca.channel_id = ? AND sb.is_active = TRUE
      ORDER BY sb.bot_name
    `, [channelId]);
  }

  /**
   * Create a new service bot
   * @param {Object} botData - Bot data
   * @returns {Promise<number>} Inserted bot ID
   */
  static async create(botData) {
    const { 
      bot_name, 
      service_id, 
      created_by, 
      instructions, 
      personality,
      model = 'gpt-4',
      is_active_participant = false
    } = botData;
    
    const result = await query(
      `INSERT INTO service_bots 
       (bot_name, service_id, created_by, instructions, personality, model, is_active_participant) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [bot_name, service_id, created_by, instructions, personality, model, is_active_participant]
    );
    
    return result.insertId;
  }

  /**
   * Update bot configuration
   * @param {number} botId - Bot ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<boolean>} Success status
   */
  static async update(botId, updateData) {
    const { 
      bot_name, 
      instructions, 
      personality, 
      model,
      is_active_participant
    } = updateData;
    
    const result = await query(
      `UPDATE service_bots 
       SET bot_name = ?, instructions = ?, personality = ?, model = ?, is_active_participant = ?
       WHERE id = ?`,
      [bot_name, instructions, personality, model, is_active_participant, botId]
    );
    
    return result.affectedRows > 0;
  }

  /**
   * Delete (deactivate) a bot
   * @param {number} botId - Bot ID
   * @returns {Promise<boolean>} Success status
   */
  static async delete(botId) {
    const result = await query(
      'UPDATE service_bots SET is_active = FALSE WHERE id = ?',
      [botId]
    );
    
    return result.affectedRows > 0;
  }

  /**
   * Assign bot to a channel
   * @param {number} botId - Bot ID
   * @param {number} channelId - Channel ID
   * @returns {Promise<boolean>} Success status
   */
  static async assignToChannel(botId, channelId) {
    try {
      await query(
        'INSERT INTO bot_channel_assignments (bot_id, channel_id) VALUES (?, ?)',
        [botId, channelId]
      );
      return true;
    } catch (error) {
      // If duplicate entry, consider it success
      if (error.code === 'ER_DUP_ENTRY') {
        return true;
      }
      throw error;
    }
  }

  /**
   * Remove bot from channel
   * @param {number} botId - Bot ID
   * @param {number} channelId - Channel ID
   * @returns {Promise<boolean>} Success status
   */
  static async removeFromChannel(botId, channelId) {
    const result = await query(
      'DELETE FROM bot_channel_assignments WHERE bot_id = ? AND channel_id = ?',
      [botId, channelId]
    );
    
    return result.affectedRows > 0;
  }

  /**
   * Get vector stores associated with bot
   * @param {number} botId - Bot ID
   * @returns {Promise<Array>} Array of vector store objects
   */
  static async getVectorStores(botId) {
    return await query(`
      SELECT 
        vs.*,
        bvs.assigned_at
      FROM vector_stores vs
      JOIN bot_vector_stores bvs ON vs.id = bvs.vector_store_id
      WHERE bvs.bot_id = ? AND vs.is_active = TRUE
      ORDER BY bvs.assigned_at DESC
    `, [botId]);
  }

  /**
   * Associate bot with vector store
   * @param {number} botId - Bot ID
   * @param {number} vectorStoreId - Vector Store ID
   * @returns {Promise<boolean>} Success status
   */
  static async addVectorStore(botId, vectorStoreId) {
    try {
      await query(
        'INSERT INTO bot_vector_stores (bot_id, vector_store_id) VALUES (?, ?)',
        [botId, vectorStoreId]
      );
      return true;
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return true;
      }
      throw error;
    }
  }

  /**
   * Remove vector store from bot
   * @param {number} botId - Bot ID
   * @param {number} vectorStoreId - Vector Store ID
   * @returns {Promise<boolean>} Success status
   */
  static async removeVectorStore(botId, vectorStoreId) {
    const result = await query(
      'DELETE FROM bot_vector_stores WHERE bot_id = ? AND vector_store_id = ?',
      [botId, vectorStoreId]
    );
    
    return result.affectedRows > 0;
  }

  /**
   * Get bot usage statistics
   * @param {number} botId - Bot ID
   * @returns {Promise<Object>} Bot statistics
   */
  static async getStatistics(botId) {
    const stats = await queryOne(`
      SELECT 
        sb.id,
        sb.bot_name,
        COUNT(DISTINCT bca.channel_id) as channel_count,
        COUNT(DISTINCT m.id) as message_count,
        COUNT(DISTINCT bvs.vector_store_id) as vector_store_count,
        MAX(m.created_at) as last_message_at
      FROM service_bots sb
      LEFT JOIN bot_channel_assignments bca ON sb.id = bca.bot_id
      LEFT JOIN messages m ON sb.id = m.bot_id
      LEFT JOIN bot_vector_stores bvs ON sb.id = bvs.bot_id
      WHERE sb.id = ?
      GROUP BY sb.id, sb.bot_name
    `, [botId]);
    
    return stats;
  }

  /**
   * Generate system prompt for bot
   * @param {number} botId - Bot ID
   * @param {string} retrievedContext - Retrieved context from vector stores
   * @returns {Promise<string>} System prompt
   */
  static async generateSystemPrompt(botId, retrievedContext = '') {
    const bot = await this.getById(botId);
    if (!bot) {
      throw new Error('Bot not found');
    }

    const basePrompt = `You are ${bot.bot_name}, a helpful AI assistant for ${bot.service_name} at Ashesi University.

Your role and responsibilities:
${bot.instructions}

Your personality: ${bot.personality}

${retrievedContext ? `Relevant information from our knowledge base:
${retrievedContext}

Use this information to answer questions accurately. If the question cannot be answered with the provided information, let the student know and suggest they contact ${bot.service_name} staff directly.` : ''}

Important guidelines:
- Be friendly, professional, and supportive
- Provide accurate information based on university policies and procedures
- If you're unsure about something, admit it and direct students to appropriate staff
- Respect student privacy and confidentiality
- Encourage students to reach out to human staff for complex or sensitive matters

Remember: You are here to assist and guide, but human staff are always available for personalized support.`;

    return basePrompt;
  }
}

module.exports = ServiceBot;