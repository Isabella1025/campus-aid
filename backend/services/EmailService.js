const nodemailer = require('nodemailer');
require('dotenv').config();

/**
 * Email Service
 * Handles sending emails (OTP, password reset, etc.)
 */

class EmailService {
  constructor() {
    // Create transporter
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }

  /**
   * Send OTP email
   */
  async sendOTP(toEmail, otp, userName = '') {
    try {
      const mailOptions = {
        from: {
          name: 'CampusAid - Ashesi University',
          address: process.env.EMAIL_USER
        },
        to: toEmail,
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
              .button {
                display: inline-block;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 12px 30px;
                text-decoration: none;
                border-radius: 5px;
                font-weight: bold;
                margin: 20px 0;
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

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✓ OTP email sent:', info.messageId);
      return { success: true, messageId: info.messageId };

    } catch (error) {
      console.error('✗ Email sending failed:', error);
      throw error;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(toEmail, resetToken, userName = '') {
    try {
      const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password.html?token=${resetToken}`;

      const mailOptions = {
        from: {
          name: 'CampusAid - Ashesi University',
          address: process.env.EMAIL_USER
        },
        to: toEmail,
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

      const info = await this.transporter.sendMail(mailOptions);
      console.log('✓ Password reset email sent:', info.messageId);
      return { success: true, messageId: info.messageId };

    } catch (error) {
      console.error('✗ Email sending failed:', error);
      throw error;
    }
  }

  /**
   * Test email connection
   */
  async testConnection() {
    try {
      await this.transporter.verify();
      console.log('✓ Email service is ready');
      return true;
    } catch (error) {
      console.error('✗ Email service connection failed:', error);
      return false;
    }
  }
}

// Export singleton instance
module.exports = new EmailService();
