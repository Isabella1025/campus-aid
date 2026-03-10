const express = require('express');
const router = express.Router();
const AuthService = require('../services/AuthService');

/**
 * @route   POST /api/auth/signup
 * @desc    Register a new user (student or staff)
 * @access  Public
 */
router.post('/signup', async (req, res) => {
  try {
    const { email, student_id, password, is_staff, service_id, position, reason } = req.body;

    // Validation
    if (!email || !student_id || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email, student ID, and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }

    // If staff signup, validate service selection
    if (is_staff && !service_id) {
      return res.status(400).json({
        success: false,
        error: 'Please select a service to join as staff'
      });
    }

    const result = await AuthService.signup(email, student_id, password, is_staff, service_id, position, reason);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Signup failed'
    });
  }
});

/**
 * @route   POST /api/auth/verify
 * @desc    Verify email with OTP
 * @access  Public
 */
router.post('/verify', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        error: 'Email and verification code are required'
      });
    }

    const result = await AuthService.verifyEmail(email, otp);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Verification error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Verification failed'
    });
  }
});

/**
 * @route   POST /api/auth/resend-otp
 * @desc    Resend verification OTP
 * @access  Public
 */
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const result = await AuthService.resendOTP(email);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to resend OTP'
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    const user = await AuthService.login(email, password);

    // Set session
    req.session.user = user;

    res.json({
      success: true,
      data: user,
      message: 'Login successful'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({
      success: false,
      error: error.message || 'Login failed'
    });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: 'Logout failed'
      });
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  });
});

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const result = await AuthService.requestPasswordReset(email);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to process request'
    });
  }
});

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        error: 'Token and new password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }

    const result = await AuthService.resetPassword(token, password);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to reset password'
    });
  }
});

/**
 * @route   GET /api/auth/current
 * @desc    Get current user
 * @access  Private
 */
router.get('/current', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      error: 'Not authenticated'
    });
  }

  res.json({
    success: true,
    data: req.session.user
  });
});

/**
 * @route   GET /api/auth/staff-applications
 * @desc    Get pending staff applications (for service admin)
 * @access  Private (service_admin only)
 */
router.get('/staff-applications', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    // Only service_admin can view applications
    if (req.session.user.role !== 'service_admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Only service administrators can view applications.'
      });
    }

    // Service admin can filter by their assigned service or view all
    const serviceId = req.query.service_id || null;

    const applications = await AuthService.getPendingStaffApplications(serviceId);

    res.json({
      success: true,
      data: applications
    });

  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get applications'
    });
  }
});

/**
 * @route   POST /api/auth/staff-applications/:id/approve
 * @desc    Approve staff application
 * @access  Private (service_admin only)
 */
router.post('/staff-applications/:id/approve', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    if (req.session.user.role !== 'service_admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const { notes } = req.body;
    const applicationId = req.params.id;

    const result = await AuthService.approveStaffApplication(applicationId, req.session.user.id, notes);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Approve application error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to approve application'
    });
  }
});

/**
 * @route   POST /api/auth/staff-applications/:id/reject
 * @desc    Reject staff application
 * @access  Private (service_admin only)
 */
router.post('/staff-applications/:id/reject', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    if (req.session.user.role !== 'service_admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const { notes } = req.body;
    const applicationId = req.params.id;

    const result = await AuthService.rejectStaffApplication(applicationId, req.session.user.id, notes);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Reject application error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to reject application'
    });
  }
});

module.exports = router;
