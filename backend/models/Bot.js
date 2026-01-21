const { query, queryOne } = require('../config/database');

class Bot {
  // Find bot by ID
  static async findById(id) {
    const sql = `
      SELECT b.*, u.full_name as creator_name
      FROM bots b
      LEFT JOIN users u ON b.created_by = u.id
      WHERE b.id = ? AND b.is_active = TRUE
    `;
    return await queryOne(sql, [id]);
  }

  // Find bot by name in course
  static async findByNameInCourse(botName, courseId) {
    const sql = `
      SELECT * FROM bots
      WHERE LOWER(bot_name) = LOWER(?) AND course_id = ? AND is_active = TRUE
    `;
    return await queryOne(sql, [botName, courseId]);
  }

  // Get all bots for a course
  static async getByCourse(courseId) {
    const sql = `
      SELECT b.*, 
        u.full_name as creator_name,
        (SELECT COUNT(*) FROM bot_group_assignments WHERE bot_id = b.id) as group_count
      FROM bots b
      LEFT JOIN users u ON b.created_by = u.id
      WHERE b.course_id = ? AND b.is_active = TRUE
      ORDER BY b.created_at DESC
    `;
    return await query(sql, [courseId]);
  }

  // Get bots assigned to a group
  static async getByGroup(groupId) {
    const sql = `
      SELECT b.*, u.full_name as creator_name
      FROM bots b
      INNER JOIN bot_group_assignments bga ON b.id = bga.bot_id
      LEFT JOIN users u ON b.created_by = u.id
      WHERE bga.group_id = ? AND b.is_active = TRUE
      ORDER BY b.bot_name ASC
    `;
    return await query(sql, [groupId]);
  }

  // Create new bot
  static async create(botData) {
    const sql = `
      INSERT INTO bots (bot_name, course_id, created_by, instructions, 
                        personality, model, is_join_bot)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await query(sql, [
      botData.bot_name,
      botData.course_id,
      botData.created_by,
      botData.instructions || null,
      botData.personality || null,
      botData.model || 'gpt-4',
      botData.is_join_bot || false
    ]);
    return result.insertId;
  }

  // Update bot
  static async update(botId, updateData) {
    const fields = [];
    const values = [];

    if (updateData.bot_name !== undefined) {
      fields.push('bot_name = ?');
      values.push(updateData.bot_name);
    }
    if (updateData.instructions !== undefined) {
      fields.push('instructions = ?');
      values.push(updateData.instructions);
    }
    if (updateData.personality !== undefined) {
      fields.push('personality = ?');
      values.push(updateData.personality);
    }
    if (updateData.model !== undefined) {
      fields.push('model = ?');
      values.push(updateData.model);
    }
    if (updateData.is_join_bot !== undefined) {
      fields.push('is_join_bot = ?');
      values.push(updateData.is_join_bot);
    }

    if (fields.length === 0) return;

    const sql = `UPDATE bots SET ${fields.join(', ')} WHERE id = ?`;
    values.push(botId);
    
    return await query(sql, values);
  }

  // Delete bot (soft delete)
  static async delete(botId) {
    const sql = 'UPDATE bots SET is_active = FALSE WHERE id = ?';
    return await query(sql, [botId]);
  }

  // Assign bot to group
  static async assignToGroup(botId, groupId) {
    const sql = `
      INSERT IGNORE INTO bot_group_assignments (bot_id, group_id)
      VALUES (?, ?)
    `;
    return await query(sql, [botId, groupId]);
  }

  // Remove bot from group
  static async removeFromGroup(botId, groupId) {
    const sql = 'DELETE FROM bot_group_assignments WHERE bot_id = ? AND group_id = ?';
    return await query(sql, [botId, groupId]);
  }

  // Check if bot is assigned to group
  static async isAssignedToGroup(botId, groupId) {
    const sql = 'SELECT * FROM bot_group_assignments WHERE bot_id = ? AND group_id = ?';
    const result = await queryOne(sql, [botId, groupId]);
    return result !== null;
  }

  // Get groups where bot is assigned
  static async getAssignedGroups(botId) {
    const sql = `
      SELECT g.* FROM \`groups\` g
      INNER JOIN bot_group_assignments bga ON g.id = bga.group_id
      WHERE bga.bot_id = ? AND g.is_active = TRUE
    `;
    return await query(sql, [botId]);
  }

  // Link bot to vector store
  static async linkVectorStore(botId, vectorStoreId) {
    const sql = `
      INSERT IGNORE INTO bot_vector_stores (bot_id, vector_store_id)
      VALUES (?, ?)
    `;
    return await query(sql, [botId, vectorStoreId]);
  }

  // Unlink bot from vector store
  static async unlinkVectorStore(botId, vectorStoreId) {
    const sql = 'DELETE FROM bot_vector_stores WHERE bot_id = ? AND vector_store_id = ?';
    return await query(sql, [botId, vectorStoreId]);
  }

  // Get vector stores for bot
  static async getVectorStores(botId) {
    const sql = `
      SELECT vs.* FROM vector_stores vs
      INNER JOIN bot_vector_stores bvs ON vs.id = bvs.vector_store_id
      WHERE bvs.bot_id = ? AND vs.is_active = TRUE
    `;
    return await query(sql, [botId]);
  }
}

module.exports = Bot;