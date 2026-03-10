const { query, queryOne } = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const emailService = require('./EmailService');

/**
 * Authentication Service
 * Handles user signup, login, email verification, and password management
 */

class AuthService {
  /**
   * Generate a 6-digit OTP
   */
  static generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Check if email is staff email
   */
  static async isStaffEmail(email) {
    const result = await queryOne(
      'SELECT id FROM staff_emails WHERE email = ? AND is_active = TRUE',
      [email]
    );
    return !!result;
  }

  /**
   * Determine user role based on email
   */
  static async determineRole(email) {
    const isStaff = await this.isStaffEmail(email);
    return isStaff ? 'service_admin' : 'student';
  }

  /**
   * Validate Ashesi email
   */
  static validateAshesiEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@ashesi\.edu\.gh$/;
    return emailRegex.test(email);
  }

  /**
   * Sign up a new user
   */
  static async signup(email, studentId, password, isStaff = false, serviceId = null, position = null, reason = null) {
    try {
      // Validate email
      if (!this.validateAshesiEmail(email)) {
        throw new Error('Email must be a valid Ashesi email (@ashesi.edu.gh)');
      }

      // Check if email already exists
      const existingUser = await queryOne(
        'SELECT id, is_verified FROM users WHERE email = ?',
        [email]
      );

      if (existingUser && existingUser.is_verified) {
        throw new Error('Email already registered');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Generate OTP
      const otp = this.generateOTP();
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Determine role and status
      let role = 'student';
      let accountStatus = 'active';
      let assignedServiceId = null;

      if (isStaff) {
        if (!serviceId) {
          throw new Error('Service selection is required for staff signup');
        }
        role = 'staff';
        accountStatus = 'pending_approval'; // Staff need approval
        assignedServiceId = serviceId;
      } else {
        // Check if email is in staff_emails (for auto-approval of service admins)
        const isStaffEmail = await this.isStaffEmail(email);
        if (isStaffEmail) {
          role = 'service_admin';
          accountStatus = 'active';
        }
      }

      let userId;

      if (existingUser && !existingUser.is_verified) {
        // Update existing unverified user
        await query(
          `UPDATE users 
           SET student_id = ?, password_hash = ?, verification_code = ?, 
               verification_code_expires = ?, role = ?, account_status = ?,
               assigned_service_id = ?, staff_position = ?, updated_at = NOW()
           WHERE id = ?`,
          [studentId, passwordHash, otp, otpExpires, role, accountStatus, assignedServiceId, position, existingUser.id]
        );
        userId = existingUser.id;
      } else {
        // Create new user
        const result = await query(
          `INSERT INTO users (email, student_id, password_hash, role, account_status, assigned_service_id, 
                              staff_position, verification_code, verification_code_expires, is_verified, is_active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, TRUE, NOW())`,
          [email, studentId, passwordHash, role, accountStatus, assignedServiceId, position, otp, otpExpires]
        );
        userId = result.insertId;
      }

      // If staff signup, create staff application
      if (isStaff) {
        await query(
          `INSERT INTO staff_applications (user_id, service_id, position, reason, status, created_at)
           VALUES (?, ?, ?, ?, 'pending', NOW())
           ON DUPLICATE KEY UPDATE 
           position = VALUES(position), reason = VALUES(reason), status = 'pending', updated_at = NOW()`,
          [userId, serviceId, position, reason]
        );

        // Also add to service_staff table as inactive (will be activated on approval)
        await query(
          `INSERT IGNORE INTO service_staff (service_id, staff_id, staff_role, is_active)
           VALUES (?, ?, ?, FALSE)`,
          [serviceId, userId, position]
        );
      }

      // Send OTP email
      try {
        await emailService.sendOTP(email, otp);
        console.log(`✓ OTP email sent to ${email}`);
      } catch (emailError) {
        console.error('Email sending failed, but OTP is:', otp);
      }

      return {
        userId,
        email,
        role,
        accountStatus,
        message: isStaff 
          ? 'Verification code sent. After verification, your staff application will be reviewed by the service administrator.'
          : 'Verification code sent to your email'
      };

    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  }

  /**
   * Verify email with OTP
   */
  static async verifyEmail(email, otp) {
    try {
      const user = await queryOne(
        `SELECT id, verification_code, verification_code_expires, is_verified 
         FROM users 
         WHERE email = ?`,
        [email]
      );

      if (!user) {
        throw new Error('User not found');
      }

      if (user.is_verified) {
        throw new Error('Email already verified');
      }

      if (!user.verification_code) {
        throw new Error('No verification code found. Please request a new one.');
      }

      if (new Date() > new Date(user.verification_code_expires)) {
        throw new Error('Verification code expired. Please request a new one.');
      }

      if (user.verification_code !== otp) {
        throw new Error('Invalid verification code');
      }

      // Mark as verified
      await query(
        `UPDATE users 
         SET is_verified = TRUE, verification_code = NULL, verification_code_expires = NULL
         WHERE id = ?`,
        [user.id]
      );

      return { success: true, message: 'Email verified successfully!' };

    } catch (error) {
      console.error('Verification error:', error);
      throw error;
    }
  }

  /**
   * Resend OTP
   */
  static async resendOTP(email) {
    try {
      const user = await queryOne(
        'SELECT id, is_verified FROM users WHERE email = ?',
        [email]
      );

      if (!user) {
        throw new Error('User not found');
      }

      if (user.is_verified) {
        throw new Error('Email already verified');
      }

      const otp = this.generateOTP();
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

      await query(
        `UPDATE users 
         SET verification_code = ?, verification_code_expires = ?
         WHERE id = ?`,
        [otp, otpExpires, user.id]
      );

      // TODO: Send OTP email
      console.log(`New OTP for ${email}: ${otp}`);

      // Send OTP email
      try {
        await emailService.sendOTP(email, otp);
        console.log(`✓ New OTP email sent to ${email}`);
      } catch (emailError) {
        console.error('Email sending failed, but OTP is:', otp);
      }

      return { success: true, message: 'New verification code sent' };

    } catch (error) {
      console.error('Resend OTP error:', error);
      throw error;
    }
  }

  /**
   * Login user
   */
  static async login(email, password) {
    try {
      const user = await queryOne(
        `SELECT id, email, student_id, full_name, password_hash, role, is_verified, is_active, 
                account_status, assigned_service_id, staff_position
         FROM users 
         WHERE email = ?`,
        [email]
      );

      if (!user) {
        throw new Error('Invalid email or password');
      }

      if (!user.is_verified) {
        throw new Error('Email not verified. Please verify your email first.');
      }

      if (!user.is_active) {
        throw new Error('Account is inactive. Please contact support.');
      }

      // Check account status
      if (user.account_status === 'pending_approval') {
        throw new Error('Your account is pending approval. Please wait for administrator approval.');
      }

      if (user.account_status === 'rejected') {
        throw new Error('Your application was rejected. Please contact support for more information.');
      }

      if (user.account_status === 'suspended') {
        throw new Error('Your account has been suspended. Please contact support.');
      }

      if (!user.password_hash) {
        throw new Error('Please complete signup process');
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);

      if (!isValidPassword) {
        throw new Error('Invalid email or password');
      }

      // Update last login
      await query(
        'UPDATE users SET last_login = NOW() WHERE id = ?',
        [user.id]
      );

      // Return user data (without password)
      return {
        id: user.id,
        email: user.email,
        student_id: user.student_id,
        full_name: user.full_name,
        role: user.role,
        account_status: user.account_status,
        assigned_service_id: user.assigned_service_id,
        staff_position: user.staff_position
      };

    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Request password reset
   */
  static async requestPasswordReset(email) {
    try {
      const user = await queryOne(
        'SELECT id FROM users WHERE email = ? AND is_verified = TRUE',
        [email]
      );

      if (!user) {
        // Don't reveal if email exists
        return { success: true, message: 'If email exists, reset link sent' };
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await query(
        `UPDATE users 
         SET password_reset_token = ?, password_reset_expires = ?
         WHERE id = ?`,
        [resetToken, resetExpires, user.id]
      );

      // TODO: Send reset email with token
      console.log(`Reset token for ${email}: ${resetToken}`);

      // Send password reset email
      try {
        await emailService.sendPasswordReset(email, resetToken);
        console.log(`✓ Password reset email sent to ${email}`);
      } catch (emailError) {
        console.error('Email sending failed, but token is:', resetToken);
      }

      return { success: true, message: 'Password reset link sent to your email' };

    } catch (error) {
      console.error('Password reset request error:', error);
      throw error;
    }
  }

  /**
   * Reset password with token
   */
  static async resetPassword(token, newPassword) {
    try {
      const user = await queryOne(
        `SELECT id FROM users 
         WHERE password_reset_token = ? 
         AND password_reset_expires > NOW()`,
        [token]
      );

      if (!user) {
        throw new Error('Invalid or expired reset token');
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);

      await query(
        `UPDATE users 
         SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL
         WHERE id = ?`,
        [passwordHash, user.id]
      );

      return { success: true, message: 'Password reset successfully' };

    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  }

  /**
   * Get current logged-in user info
   */
  static async getCurrentUser(userId) {
    try {
      const user = await queryOne(
        `SELECT id, email, student_id, full_name, role, is_verified, is_active, 
                account_status, assigned_service_id, staff_position, created_at, last_login
         FROM users 
         WHERE id = ?`,
        [userId]
      );

      if (!user) {
        throw new Error('User not found');
      }

      return user;

    } catch (error) {
      console.error('Get current user error:', error);
      throw error;
    }
  }

  /**
   * Get pending staff applications (for service admin)
   */
  static async getPendingStaffApplications(serviceId = null) {
    try {
      let sql = `
        SELECT sa.*, u.email, u.student_id, u.full_name, s.service_name
        FROM staff_applications sa
        JOIN users u ON sa.user_id = u.id
        JOIN services s ON sa.service_id = s.id
        WHERE sa.status = 'pending'
      `;

      const params = [];

      if (serviceId) {
        sql += ' AND sa.service_id = ?';
        params.push(serviceId);
      }

      sql += ' ORDER BY sa.created_at DESC';

      const applications = await query(sql, params);
      return applications;

    } catch (error) {
      console.error('Get applications error:', error);
      throw error;
    }
  }

  /**
   * Approve staff application
   */
  static async approveStaffApplication(applicationId, reviewerId, notes = null) {
    try {
      // Get application details
      const application = await queryOne(
        'SELECT * FROM staff_applications WHERE id = ?',
        [applicationId]
      );

      if (!application) {
        throw new Error('Application not found');
      }

      if (application.status !== 'pending') {
        throw new Error('Application has already been reviewed');
      }

      // Update application status
      await query(
        `UPDATE staff_applications 
         SET status = 'approved', reviewed_by = ?, reviewed_at = NOW(), review_notes = ?
         WHERE id = ?`,
        [reviewerId, notes, applicationId]
      );

      // Update user account status and activate
      await query(
        `UPDATE users 
         SET account_status = 'active'
         WHERE id = ?`,
        [application.user_id]
      );

      // Activate staff in service_staff table
      await query(
        `UPDATE service_staff 
         SET is_active = TRUE 
         WHERE service_id = ? AND staff_id = ?`,
        [application.service_id, application.user_id]
      );

      return { success: true, message: 'Staff application approved' };

    } catch (error) {
      console.error('Approve application error:', error);
      throw error;
    }
  }

  /**
   * Reject staff application
   */
  static async rejectStaffApplication(applicationId, reviewerId, notes = null) {
    try {
      // Get application details
      const application = await queryOne(
        'SELECT * FROM staff_applications WHERE id = ?',
        [applicationId]
      );

      if (!application) {
        throw new Error('Application not found');
      }

      if (application.status !== 'pending') {
        throw new Error('Application has already been reviewed');
      }

      // Update application status
      await query(
        `UPDATE staff_applications 
         SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW(), review_notes = ?
         WHERE id = ?`,
        [reviewerId, notes, applicationId]
      );

      // Update user account status
      await query(
        `UPDATE users 
         SET account_status = 'rejected'
         WHERE id = ?`,
        [application.user_id]
      );

      return { success: true, message: 'Staff application rejected' };

    } catch (error) {
      console.error('Reject application error:', error);
      throw error;
    }
  }
}

module.exports = AuthService;
