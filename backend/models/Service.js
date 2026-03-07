const { query, queryOne } = require('../config/database');

/**
 * Service Model
 * Manages student services (Career Services, Academic Advising, ODIP)
 */
class Service {
  /**
   * Get all active services
   * @returns {Promise<Array>} Array of service objects
   */
  static async getAll() {
    return await query(
      'SELECT * FROM services WHERE is_active = TRUE ORDER BY service_name'
    );
  }

  /**
   * Get service by ID
   * @param {number} id - Service ID
   * @returns {Promise<Object|null>} Service object or null
   */
  static async getById(id) {
    return await queryOne(
      'SELECT * FROM services WHERE id = ? AND is_active = TRUE',
      [id]
    );
  }

  /**
   * Get service by service code
   * @param {string} serviceCode - Service code (e.g., 'CAREER', 'ADVISING', 'ODIP')
   * @returns {Promise<Object|null>} Service object or null
   */
  static async getByCode(serviceCode) {
    return await queryOne(
      'SELECT * FROM services WHERE service_code = ? AND is_active = TRUE',
      [serviceCode]
    );
  }

  /**
   * Get services administered by a specific user
   * @param {number} adminId - Administrator user ID
   * @returns {Promise<Array>} Array of services
   */
  static async getByAdmin(adminId) {
    return await query(
      'SELECT * FROM services WHERE admin_id = ? AND is_active = TRUE ORDER BY service_name',
      [adminId]
    );
  }

  /**
   * Create a new service
   * @param {Object} serviceData - Service data
   * @returns {Promise<number>} Inserted service ID
   */
  static async create(serviceData) {
    const { service_code, service_name, service_description, admin_id } = serviceData;
    
    const result = await query(
      'INSERT INTO services (service_code, service_name, service_description, admin_id) VALUES (?, ?, ?, ?)',
      [service_code, service_name, service_description, admin_id]
    );
    
    return result.insertId;
  }

  /**
   * Update service information
   * @param {number} id - Service ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<boolean>} Success status
   */
  static async update(id, updateData) {
    const { service_name, service_description, admin_id } = updateData;
    
    const result = await query(
      'UPDATE services SET service_name = ?, service_description = ?, admin_id = ? WHERE id = ?',
      [service_name, service_description, admin_id, id]
    );
    
    return result.affectedRows > 0;
  }

  /**
   * Deactivate a service
   * @param {number} id - Service ID
   * @returns {Promise<boolean>} Success status
   */
  static async deactivate(id) {
    const result = await query(
      'UPDATE services SET is_active = FALSE WHERE id = ?',
      [id]
    );
    
    return result.affectedRows > 0;
  }

  /**
   * Get service statistics
   * @param {number} serviceId - Service ID
   * @returns {Promise<Object>} Service statistics
   */
  static async getStatistics(serviceId) {
    const stats = await queryOne(`
      SELECT 
        s.id,
        s.service_name,
        COUNT(DISTINCT sc.id) as channel_count,
        COUNT(DISTINCT sb.id) as bot_count,
        COUNT(DISTINCT m.id) as message_count,
        COUNT(DISTINCT f.id) as file_count
      FROM services s
      LEFT JOIN service_channels sc ON s.id = sc.service_id AND sc.is_active = TRUE
      LEFT JOIN service_bots sb ON s.id = sb.service_id AND sb.is_active = TRUE
      LEFT JOIN messages m ON sc.id = m.channel_id
      LEFT JOIN files f ON s.id = f.service_id
      WHERE s.id = ?
      GROUP BY s.id, s.service_name
    `, [serviceId]);
    
    return stats;
  }

  /**
   * Check if user is admin of service
   * @param {number} serviceId - Service ID
   * @param {number} userId - User ID
   * @returns {Promise<boolean>} True if user is admin
   */
  static async isAdmin(serviceId, userId) {
    const service = await queryOne(
      'SELECT id FROM services WHERE id = ? AND admin_id = ?',
      [serviceId, userId]
    );
    
    return !!service;
  }
}

module.exports = Service;