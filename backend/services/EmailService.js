const sgMail = require('@sendgrid/mail');
require('dotenv').config();

/**
 * Email Service using SendGrid
 * Handles sending emails (OTP, password reset, etc.)
 */

class EmailService {
  constructor() {
    // Set SendGrid API key
    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      console.log('✓ SendGrid initialized');
    } else {
      console.warn('⚠️ SENDGRID_API_KEY not set');
    }
  }

  /**
   * Send OTP email
   */
  async sendOTP(toEmail, otp, userName = '') {
    try {
      const msg = {
        to: toEmail,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || 'isabella.tsikata@ashesi.edu.gh',
          name: 'CampusAid - Ashesi University'
        },
        subject: 'Verify Your CampusAid Account',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: #f4f4f4;
                margin: 0;
                padding: 0;
              }
              .email-container {
                max-width: 600px;
                margin: 40px auto;
                background: white;
                border-radius: 10px;
                overflow: hidden;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              }
              .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px;
                text-align: center;
              }
              .header h1 {
                margin: 0;
                font-size: 28px;
              }
              .content {
                padding: 40px 30px;
              }
              .otp-box {
                background: #f8f9fa;
                border: 2px dashed #667eea;
                border-radius: 10px;
                padding: 20px;
                text-align: center;
                margin: 30px 0;
              }
              .otp-code {
                font-size: 36px;
                font-weight: bold;
                color: #667eea;
                letter-spacing: 8px;
                font-family: 'Courier New', monospace;
              }
              .footer {
                background: #f8f9fa;
                padding: 20px;
                text-align: center;
                font-size: 12px;
                color: #7f8c8d;
              }
            </style>
          </head>
          <body>
            <div class="email-container">
              <div class="header">
                <h1>🎓 CampusAid</h1>
                <p>Ashesi University Student Services</p>
              </div>
              
              <div class="content">
                <h2>Verify Your Email Address</h2>
                <p>Hello${userName ? ' ' + userName : ''},</p>
                <p>Thank you for signing up for CampusAid! To complete your registration, please use the verification code below:</p>
                
                <div class="otp-box">
                  <div style="color: #7f8c8d; font-size: 14px; margin-bottom: 10px;">Your Verification Code</div>
                  <div class="otp-code">${otp}</div>
                </div>
                
                <p>This code will expire in <strong>10 minutes</strong>.</p>
                
                <p>If you didn't request this code, please ignore this email.</p>
                
                <p style="margin-top: 30px;">
                  Best regards,<br>
                  <strong>The CampusAid Team</strong>
                </p>
              </div>
              
              <div class="footer">
                <p>© ${new Date().getFullYear()} CampusAid - Ashesi University</p>
                <p>This is an automated email. Please do not reply.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      await sgMail.send(msg);
      console.log('✓ OTP email sent via SendGrid to:', toEmail);
      return { success: true };

    } catch (error) {
      console.error('✗ SendGrid email failed:', error);
      if (error.response) {
        console.error('SendGrid error details:', error.response.body);
      }
      throw error;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(toEmail, resetToken, userName = '') {
    try {
      const resetUrl = `${process.env.APP_URL || 'https://campus-aid-production.up.railway.app'}/reset-password.html?token=${resetToken}`;

      const msg = {
        to: toEmail,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || 'isabella.tsikata@ashesi.edu.gh',
          name: 'CampusAid - Ashesi University'
        },
        subject: 'Reset Your CampusAid Password',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: #f4f4f4;
                margin: 0;
                padding: 0;
              }
              .email-container {
                max-width: 600px;
                margin: 40px auto;
                background: white;
                border-radius: 10px;
                overflow: hidden;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              }
              .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px;
                text-align: center;
              }
              .header h1 {
                margin: 0;
                font-size: 28px;
              }
              .content {
                padding: 40px 30px;
              }
              .button {
                display: inline-block;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white !important;
                padding: 12px 30px;
                text-decoration: none;
                border-radius: 5px;
                font-weight: bold;
                margin: 20px 0;
              }
              .footer {
                background: #f8f9fa;
                padding: 20px;
                text-align: center;
                font-size: 12px;
                color: #7f8c8d;
              }
            </style>
          </head>
          <body>
            <div class="email-container">
              <div class="header">
                <h1>🎓 CampusAid</h1>
                <p>Ashesi University Student Services</p>
              </div>
              
              <div class="content">
                <h2>Reset Your Password</h2>
                <p>Hello${userName ? ' ' + userName : ''},</p>
                <p>We received a request to reset your CampusAid password. Click the button below to create a new password:</p>
                
                <div style="text-align: center;">
                  <a href="${resetUrl}" class="button">Reset Password</a>
                </div>
                
                <p>This link will expire in <strong>1 hour</strong>.</p>
                
                <p style="color: #7f8c8d; font-size: 13px;">
                  If the button doesn't work, copy and paste this link into your browser:<br>
                  <a href="${resetUrl}" style="color: #667eea;">${resetUrl}</a>
                </p>
                
                <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
                
                <p style="margin-top: 30px;">
                  Best regards,<br>
                  <strong>The CampusAid Team</strong>
                </p>
              </div>
              
              <div class="footer">
                <p>© ${new Date().getFullYear()} CampusAid - Ashesi University</p>
                <p>This is an automated email. Please do not reply.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      await sgMail.send(msg);
      console.log('✓ Password reset email sent via SendGrid to:', toEmail);
      return { success: true };

    } catch (error) {
      console.error('✗ SendGrid email failed:', error);
      if (error.response) {
        console.error('SendGrid error details:', error.response.body);
      }
      throw error;
    }
  }

  /**
   * Send password reset confirmation email
   */
  async sendPasswordResetConfirmation(toEmail, userName = '') {
    try {
      const greeting = userName ? `Hi ${userName}` : 'Hello';
      
      const msg = {
        to: toEmail,
        from: {
          email: process.env.SENDGRID_FROM_EMAIL || 'isabella.tsikata@ashesi.edu.gh',
          name: 'CampusAid - Ashesi University'
        },
        subject: 'Password Reset Successful - CampusAid',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: #f4f4f4;
                margin: 0;
                padding: 0;
              }
              .email-container {
                max-width: 600px;
                margin: 40px auto;
                background: white;
                border-radius: 10px;
                overflow: hidden;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              }
              .header {
                background: linear-gradient(135deg, #4E0000 0%, #6B1E1E 100%);
                padding: 30px;
                text-align: center;
              }
              .header h1 {
                color: #F5E6D3;
                margin: 0;
                font-size: 24px;
              }
              .content {
                padding: 40px 30px;
              }
              .success-icon {
                text-align: center;
                font-size: 60px;
                margin-bottom: 20px;
              }
              .message {
                color: #2c3e50;
                font-size: 16px;
                line-height: 1.6;
                margin-bottom: 20px;
              }
              .info-box {
                background: #f8f9fa;
                border-left: 4px solid #27ae60;
                padding: 15px;
                margin: 20px 0;
                border-radius: 5px;
              }
              .footer {
                background: #f8f9fa;
                padding: 20px;
                text-align: center;
                color: #7f8c8d;
                font-size: 13px;
              }
              .button {
                display: inline-block;
                padding: 12px 30px;
                background: linear-gradient(135deg, #4E0000 0%, #6B1E1E 100%);
                color: white;
                text-decoration: none;
                border-radius: 8px;
                margin: 20px 0;
                font-weight: 600;
              }
            </style>
          </head>
          <body>
            <div class="email-container">
              <div class="header">
                <h1>🎓 CampusAid</h1>
              </div>
              <div class="content">
                <div class="success-icon">✅</div>
                
                <p class="message"><strong>${greeting},</strong></p>
                
                <p class="message">
                  Your password has been successfully reset. You can now log in to CampusAid with your new password.
                </p>
                
                <div class="info-box">
                  <p style="margin: 0; color: #27ae60; font-weight: 600;">
                    ✓ Password Reset Successful
                  </p>
                  <p style="margin: 5px 0 0 0; color: #555; font-size: 14px;">
                    Your account is now secure with your new password.
                  </p>
                </div>
                
                <div style="text-align: center;">
                  <a href="${process.env.APP_URL || 'https://campus-aid-production.up.railway.app'}" class="button">
                    Go to Login
                  </a>
                </div>
                
                <p class="message" style="margin-top: 30px; font-size: 14px; color: #e74c3c;">
                  <strong>Important:</strong> If you didn't make this change, please contact support immediately.
                </p>
              </div>
              <div class="footer">
                <p>This is an automated message from CampusAid - Ashesi University.</p>
                <p>For support, contact: support@campusaid.ashesi.edu.gh</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      await sgMail.send(msg);
      console.log('✓ Password reset confirmation sent via SendGrid to:', toEmail);
      return { success: true };

    } catch (error) {
      console.error('✗ SendGrid email failed:', error);
      if (error.response) {
        console.error('SendGrid error details:', error.response.body);
      }
      throw error;
    }
  }

  /**
   * Test email connection
   */
  async testConnection() {
    if (!process.env.SENDGRID_API_KEY) {
      console.error('✗ SENDGRID_API_KEY not configured');
      return false;
    }
    console.log('✓ SendGrid service is ready');
    return true;
  }
}

// Export singleton instance
module.exports = new EmailService();