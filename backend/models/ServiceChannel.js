const { query, queryOne } = require('../config/database');

/**
 * ServiceChannel Model
 * Manages communication channels within student services
 */
class ServiceChannel {
  /**
   * Get all channels for a service
   * @param {number} serviceId - Service ID
   * @returns {Promise<Array>} Array of channel objects
   */
  static async getByService(serviceId) {
    return await query(`
      SELECT 
        sc.*,
        s.service_name,
        u.full_name as creator_name,
        COUNT(DISTINCT cm.user_id) as member_count
      FROM service_channels sc
      JOIN services s ON sc.service_id = s.id
      JOIN users u ON sc.created_by = u.id
      LEFT JOIN channel_members cm ON sc.id = cm.channel_id
      WHERE sc.service_id = ? AND sc.is_active = TRUE
      GROUP BY sc.id
      ORDER BY sc.created_at DESC
    `, [serviceId]);
  }

  /**
   * Get channel by ID with details
   * @param {number} channelId - Channel ID
   * @returns {Promise<Object|null>} Channel object or null
   */
  static async getById(channelId) {
    return await queryOne(`
      SELECT 
        sc.*,
        s.service_name,
        s.service_code,
        u.full_name as creator_name
      FROM service_channels sc
      JOIN services s ON sc.service_id = s.id
      JOIN users u ON sc.created_by = u.id
      WHERE sc.id = ? AND sc.is_active = TRUE
    `, [channelId]);
  }

  /**
   * Get all channels accessible to a user
   * All students can access all service channels
   * @param {number} userId - User ID
   * @returns {Promise<Array>} Array of accessible channels
   */
  static async getAccessibleChannels(userId) {
    // For now, all active channels are accessible to all students
    return await query(`
      SELECT 
        sc.*,
        s.service_name,
        s.service_code,
        u.full_name as creator_name,
        COUNT(DISTINCT m.id) as message_count,
        MAX(m.created_at) as last_message_at
      FROM service_channels sc
      JOIN services s ON sc.service_id = s.id
      JOIN users u ON sc.created_by = u.id
      LEFT JOIN messages m ON sc.id = m.channel_id
      WHERE sc.is_active = TRUE AND s.is_active = TRUE
      GROUP BY sc.id
      ORDER BY 
        CASE WHEN MAX(m.created_at) IS NULL THEN 1 ELSE 0 END,
        MAX(m.created_at) DESC,
        sc.created_at DESC
    `);
  }

  /**
   * Create a new service channel
   * @param {Object} channelData - Channel data
   * @returns {Promise<number>} Inserted channel ID
   */
  static async create(channelData) {
    const { channel_name, service_id, created_by } = channelData;
    
    const result = await query(
      'INSERT INTO service_channels (channel_name, service_id, created_by) VALUES (?, ?, ?)',
      [channel_name, service_id, created_by]
    );
    
    return result.insertId;
  }

  /**
   * Update channel information
   * @param {number} channelId - Channel ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<boolean>} Success status
   */
  static async update(channelId, updateData) {
    const { channel_name } = updateData;
    
    const result = await query(
      'UPDATE service_channels SET channel_name = ? WHERE id = ?',
      [channel_name, channelId]
    );
    
    return result.affectedRows > 0;
  }

  /**
   * Delete (deactivate) a channel
   * @param {number} channelId - Channel ID
   * @returns {Promise<boolean>} Success status
   */
  static async delete(channelId) {
    const result = await query(
      'UPDATE service_channels SET is_active = FALSE WHERE id = ?',
      [channelId]
    );
    
    return result.affectedRows > 0;
  }

  /**
   * Add user to channel
   * @param {number} channelId - Channel ID
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  static async addMember(channelId, userId) {
    try {
      await query(
        'INSERT INTO channel_members (channel_id, user_id) VALUES (?, ?)',
        [channelId, userId]
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
   * Remove user from channel
   * @param {number} channelId - Channel ID
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  static async removeMember(channelId, userId) {
    const result = await query(
      'DELETE FROM channel_members WHERE channel_id = ? AND user_id = ?',
      [channelId, userId]
    );
    
    return result.affectedRows > 0;
  }

  /**
   * Get all members of a channel
   * @param {number} channelId - Channel ID
   * @returns {Promise<Array>} Array of member objects
   */
  static async getMembers(channelId) {
    return await query(`
      SELECT 
        u.id,
        u.student_id,
        u.full_name,
        u.email,
        u.role,
        cm.joined_at
      FROM channel_members cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.channel_id = ?
      ORDER BY cm.joined_at DESC
    `, [channelId]);
  }

  /**
   * Check if user is member of channel
   * @param {number} channelId - Channel ID
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} True if user is member
   */
  static async isMember(channelId, userId) {
    const member = await queryOne(
      'SELECT id FROM channel_members WHERE channel_id = ? AND user_id = ?',
      [channelId, userId]
    );
    
    return !!member;
  }

  /**
   * Get recent messages in channel
   * @param {number} channelId - Channel ID
   * @param {number} limit - Number of messages to retrieve
   * @returns {Promise<Array>} Array of message objects
   */
  static async getRecentMessages(channelId, limit = 50) {
    return await query(`
      SELECT 
        m.*,
        u.full_name as sender_name,
        u.student_id as sender_student_id,
        sb.bot_name
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      LEFT JOIN service_bots sb ON m.bot_id = sb.id
      WHERE m.channel_id = ?
      ORDER BY m.created_at DESC
      LIMIT ?
    `, [channelId, limit]);
  }
}

module.exports = ServiceChannel;