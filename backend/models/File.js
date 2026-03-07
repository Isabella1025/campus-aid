const { query, queryOne } = require('../config/database');

class File {
  // Create new file record
  static async create(fileData) {
    const sql = `
      INSERT INTO files (file_name, original_name, file_path, file_type, file_size, 
                         uploaded_by, service_id, group_id, message_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await query(sql, [
      fileData.file_name,
      fileData.original_name,
      fileData.file_path,
      fileData.file_type,
      fileData.file_size,
      fileData.uploaded_by,
      fileData.service_id || null,
      fileData.group_id || null,
      fileData.message_id || null
    ]);
    return result.insertId;
  }

  // Find file by ID
  static async findById(id) {
    const sql = `
      SELECT 
        f.*,
        u.full_name as uploader_name,
        u.student_id as uploader_student_id
      FROM files f
      LEFT JOIN users u ON f.uploaded_by = u.id
      WHERE f.id = ?
    `;
    return await queryOne(sql, [id]);
  }

  // Get files for a course
  static async getByCourse(courseId) {
    const sql = `
      SELECT 
        f.*,
        u.full_name as uploader_name,
        u.student_id as uploader_student_id
      FROM files f
      LEFT JOIN users u ON f.uploaded_by = u.id
      WHERE f.service_id = ?
      ORDER BY f.created_at DESC
    `;
    return await query(sql, [courseId]);
  }

  // Get files for a group
  static async getByGroup(groupId) {
    const sql = `
      SELECT 
        f.*,
        u.full_name as uploader_name,
        u.student_id as uploader_student_id
      FROM files f
      LEFT JOIN users u ON f.uploaded_by = u.id
      WHERE f.group_id = ?
      ORDER BY f.created_at DESC
    `;
    return await query(sql, [groupId]);
  }

  // Get file by message ID
  static async getByMessage(messageId) {
    const sql = `
      SELECT 
        f.*,
        u.full_name as uploader_name
      FROM files f
      LEFT JOIN users u ON f.uploaded_by = u.id
      WHERE f.message_id = ?
    `;
    return await query(sql, [messageId]);
  }

  // Delete file record
  static async delete(fileId) {
    const sql = 'DELETE FROM files WHERE id = ?';
    return await query(sql, [fileId]);
  }

  // Get total file size for user
  static async getUserTotalSize(userId) {
    const sql = 'SELECT SUM(file_size) as total_size FROM files WHERE uploaded_by = ?';
    const result = await queryOne(sql, [userId]);
    return result.total_size || 0;
  }

  // Get file count for user
  static async getUserFileCount(userId) {
    const sql = 'SELECT COUNT(*) as count FROM files WHERE uploaded_by = ?';
    const result = await queryOne(sql, [userId]);
    return result.count;
  }

  // Search files
  static async search(searchTerm, courseId) {
    const sql = `
      SELECT 
        f.*,
        u.full_name as uploader_name
      FROM files f
      LEFT JOIN users u ON f.uploaded_by = u.id
      WHERE f.service_id = ? AND f.original_name LIKE ?
      ORDER BY f.created_at DESC
    `;
    return await query(sql, [courseId, `%${searchTerm}%`]);
  }
}

module.exports = File;