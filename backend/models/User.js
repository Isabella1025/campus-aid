const { query, queryOne } = require('../config/database');

class User {
  // Find user by student ID
  static async findByStudentId(studentId) {
    const sql = 'SELECT * FROM users WHERE student_id = ? AND is_active = TRUE';
    return await queryOne(sql, [studentId]);
  }

  // Find user by email
  static async findByEmail(email) {
    const sql = 'SELECT * FROM users WHERE email = ? AND is_active = TRUE';
    return await queryOne(sql, [email]);
  }

  // Find user by ID
  static async findById(id) {
    const sql = 'SELECT * FROM users WHERE id = ? AND is_active = TRUE';
    return await queryOne(sql, [id]);
  }

  // Create new user
  static async create(userData) {
    const sql = `
      INSERT INTO users (student_id, email, full_name, role)
      VALUES (?, ?, ?, ?)
    `;
    const result = await query(sql, [
      userData.student_id,
      userData.email,
      userData.full_name || null,
      userData.role || 'student'
    ]);
    return result.insertId;
  }

  // Update last login timestamp
  static async updateLastLogin(userId) {
    const sql = 'UPDATE users SET last_login = NOW() WHERE id = ?';
    return await query(sql, [userId]);
  }

  // Check if user is enrolled in course
  static async isEnrolledInCourse(userId, courseId) {
    const sql = `
      SELECT * FROM course_enrollments 
      WHERE user_id = ? AND service_id = ?
    `;
    const result = await queryOne(sql, [userId, courseId]);
    return result !== null;
  }

  // Get user's enrolled services
  static async getEnrolledservices(userId) {
    const sql = `
      SELECT c.* FROM services c
      INNER JOIN course_enrollments ce ON c.id = ce.service_id
      WHERE ce.user_id = ? AND c.is_active = TRUE
    `;
    return await query(sql, [userId]);
  }

  // Get user's groups in a course
  static async getGroupsInCourse(userId, courseId) {
    const sql = `
      SELECT g.*, 
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
        (SELECT message_text FROM messages WHERE group_id = g.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages WHERE group_id = g.id ORDER BY created_at DESC LIMIT 1) as last_message_time
      FROM \`groups\` g
      INNER JOIN group_members gm ON g.id = gm.group_id
      WHERE gm.user_id = ? AND g.service_id = ? AND g.is_active = TRUE
      ORDER BY last_message_time DESC
    `;
    return await query(sql, [userId, courseId]);
  }
}

module.exports = User;