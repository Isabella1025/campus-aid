const { query, queryOne } = require('../config/database');

/**
 * Appointment Model
 * Handles appointment data and database operations
 */

class Appointment {
  /**
   * Create a new appointment
   */
  static async create(appointmentData) {
    const { student_id, service_id, assigned_staff_id, appointment_date, appointment_time, reason, duration_minutes } = appointmentData;
    
    const result = await query(
      `INSERT INTO appointments (student_id, service_id, assigned_staff_id, appointment_date, appointment_time, reason, duration_minutes, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [student_id, service_id, assigned_staff_id || null, appointment_date, appointment_time, reason, duration_minutes || 30]
    );
    
    return result.insertId;
  }

  /**
   * Get appointment by ID with full details
   */
  static async getById(appointmentId) {
    return await queryOne(
      `SELECT 
        a.*,
        u.full_name as student_name,
        u.email as student_email,
        s.service_name,
        assigned_staff.full_name as assigned_staff_name,
        assigned_staff.email as assigned_staff_email,
        staff.full_name as staff_name
      FROM appointments a
      LEFT JOIN users u ON a.student_id = u.id
      LEFT JOIN services s ON a.service_id = s.id
      LEFT JOIN users assigned_staff ON a.assigned_staff_id = assigned_staff.id
      LEFT JOIN users staff ON a.staff_id = staff.id
      WHERE a.id = ?`,
      [appointmentId]
    );
  }

  /**
   * Get all appointments for a student
   */
  static async getByStudent(studentId) {
    return await query(
      `SELECT 
        a.*,
        s.service_name,
        assigned_staff.full_name as assigned_staff_name,
        staff.full_name as staff_name
      FROM appointments a
      LEFT JOIN services s ON a.service_id = s.id
      LEFT JOIN users assigned_staff ON a.assigned_staff_id = assigned_staff.id
      LEFT JOIN users staff ON a.staff_id = staff.id
      WHERE a.student_id = ?
      ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
      [studentId]
    );
  }

  /**
   * Get all appointments for a service
   */
  static async getByService(serviceId, status = null) {
    let sql = `
      SELECT 
        a.*,
        u.full_name as student_name,
        u.email as student_email,
        u.student_id as student_number,
        assigned_staff.full_name as assigned_staff_name,
        staff.full_name as staff_name
      FROM appointments a
      LEFT JOIN users u ON a.student_id = u.id
      LEFT JOIN users assigned_staff ON a.assigned_staff_id = assigned_staff.id
      LEFT JOIN users staff ON a.staff_id = staff.id
      WHERE a.service_id = ?
    `;
    
    const params = [serviceId];
    
    if (status) {
      sql += ` AND a.status = ?`;
      params.push(status);
    }
    
    sql += ` ORDER BY a.appointment_date ASC, a.appointment_time ASC`;
    
    return await query(sql, params);
  }

  /**
   * Get all appointments assigned to a specific staff member
   */
  static async getByAssignedStaff(staffId, status = null) {
    let sql = `
      SELECT 
        a.*,
        u.full_name as student_name,
        u.email as student_email,
        u.student_id as student_number,
        s.service_name
      FROM appointments a
      LEFT JOIN users u ON a.student_id = u.id
      LEFT JOIN services s ON a.service_id = s.id
      WHERE a.assigned_staff_id = ?
    `;
    
    const params = [staffId];
    
    if (status) {
      sql += ` AND a.status = ?`;
      params.push(status);
    }
    
    sql += ` ORDER BY a.appointment_date ASC, a.appointment_time ASC`;
    
    return await query(sql, params);
  }

  /**
   * Update appointment status
   */
  static async updateStatus(appointmentId, status, staffId = null, staffNotes = null) {
    let sql = `UPDATE appointments SET status = ?, updated_at = NOW()`;
    const params = [status];
    
    if (staffId) {
      sql += `, staff_id = ?`;
      params.push(staffId);
    }
    
    if (staffNotes) {
      sql += `, staff_notes = ?`;
      params.push(staffNotes);
    }
    
    sql += ` WHERE id = ?`;
    params.push(appointmentId);
    
    await query(sql, params);
    
    return await this.getById(appointmentId);
  }

  /**
   * Update appointment date/time
   */
  static async updateDateTime(appointmentId, date, time) {
    await query(
      `UPDATE appointments 
       SET appointment_date = ?, appointment_time = ?, updated_at = NOW()
       WHERE id = ?`,
      [date, time, appointmentId]
    );
    
    return await this.getById(appointmentId);
  }

  /**
   * Cancel appointment
   */
  static async cancel(appointmentId) {
    return await this.updateStatus(appointmentId, 'cancelled');
  }

  /**
   * Get pending appointments count for a service
   */
  static async getPendingCount(serviceId) {
    const result = await queryOne(
      `SELECT COUNT(*) as count FROM appointments WHERE service_id = ? AND status = 'pending'`,
      [serviceId]
    );
    return result.count;
  }

  /**
   * Check for appointment conflicts
   */
  static async checkConflict(serviceId, date, time, excludeAppointmentId = null) {
    let sql = `
      SELECT COUNT(*) as count 
      FROM appointments 
      WHERE service_id = ? 
        AND appointment_date = ? 
        AND appointment_time = ?
        AND status IN ('pending', 'approved')
    `;
    
    const params = [serviceId, date, time];
    
    if (excludeAppointmentId) {
      sql += ` AND id != ?`;
      params.push(excludeAppointmentId);
    }
    
    const result = await queryOne(sql, params);
    return result.count > 0;
  }
}

module.exports = Appointment;
