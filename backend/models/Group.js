const { query, queryOne } = require('../config/database');

class Group {
  // Find group by ID
  static async findById(id) {
    const sql = 'SELECT * FROM `groups` WHERE id = ? AND is_active = TRUE';
    return await queryOne(sql, [id]);
  }

  // Get all groups for a course
  static async getByCourse(courseId) {
    const sql = `
      SELECT g.*, 
        u.full_name as creator_name,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
      FROM \`groups\` g
      LEFT JOIN users u ON g.created_by = u.id
      WHERE g.service_id = ? AND g.is_active = TRUE
      ORDER BY g.created_at DESC
    `;
    return await query(sql, [courseId]);
  }

  // Get groups for a specific user in a course
  static async getUserGroupsInCourse(userId, courseId) {
    const sql = `
      SELECT g.*, 
        u.full_name as creator_name,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
        (SELECT message_text FROM messages WHERE group_id = g.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages WHERE group_id = g.id ORDER BY created_at DESC LIMIT 1) as last_message_time
      FROM \`groups\` g
      INNER JOIN group_members gm ON g.id = gm.group_id
      LEFT JOIN users u ON g.created_by = u.id
      WHERE gm.user_id = ? AND g.service_id = ? AND g.is_active = TRUE
      ORDER BY last_message_time DESC, g.created_at DESC
    `;
    return await query(sql, [userId, courseId]);
  }

  // Create new group
  static async create(groupData) {
    const sql = `
      INSERT INTO \`groups\` (group_name, service_id, created_by)
      VALUES (?, ?, ?)
    `;
    const result = await query(sql, [
      groupData.group_name,
      groupData.service_id,
      groupData.created_by
    ]);
    return result.insertId;
  }

  // Add member to group
  static async addMember(groupId, userId) {
    const sql = `
      INSERT IGNORE INTO group_members (group_id, user_id)
      VALUES (?, ?)
    `;
    return await query(sql, [groupId, userId]);
  }

  // Remove member from group
  static async removeMember(groupId, userId) {
    const sql = 'DELETE FROM group_members WHERE group_id = ? AND user_id = ?';
    return await query(sql, [groupId, userId]);
  }

  // Check if user is member
  static async isMember(groupId, userId) {
    const sql = 'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?';
    const result = await queryOne(sql, [groupId, userId]);
    return result !== null;
  }

  // Get group members
  static async getMembers(groupId) {
    const sql = `
      SELECT u.id, u.student_id, u.full_name, u.email, u.role, gm.joined_at
      FROM users u
      INNER JOIN group_members gm ON u.id = gm.user_id
      WHERE gm.group_id = ?
      ORDER BY gm.joined_at ASC
    `;
    return await query(sql, [groupId]);
  }

  // Delete group (soft delete)
  static async delete(groupId) {
    const sql = 'UPDATE `groups` SET is_active = FALSE WHERE id = ?';
    return await query(sql, [groupId]);
  }

  // Update group name
  static async updateName(groupId, newName) {
    const sql = 'UPDATE `groups` SET group_name = ? WHERE id = ?';
    return await query(sql, [newName, groupId]);
  }

  // Get group member count
  static async getMemberCount(groupId) {
    const sql = 'SELECT COUNT(*) as count FROM group_members WHERE group_id = ?';
    const result = await queryOne(sql, [groupId]);
    return result.count;
  }
}

module.exports = Group;