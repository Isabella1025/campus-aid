const express = require('express');
const router = express.Router();
const { query, queryOne } = require('../config/database');
const Service = require('../models/Service');
const ServiceChannel = require('../models/ServiceChannel');

/**
 * Session Router
 * Handles user authentication and session management
 */

/**
 * @route   POST /api/session/start
 * @desc    Initialize user session (login)
 * @access  Public
 */
router.post('/start', async (req, res) => {
  try {
    const { student_id, email } = req.body;
    
    // Validation
    if (!student_id && !email) {
      return res.status(400).json({
        success: false,
        error: 'Student ID or email is required'
      });
    }
    
    // Find user by student_id or email
    let user;
    if (student_id) {
      user = await queryOne(
        'SELECT * FROM users WHERE student_id = ? AND is_active = TRUE',
        [student_id]
      );
    } else {
      user = await queryOne(
        'SELECT * FROM users WHERE email = ? AND is_active = TRUE',
        [email]
      );
    }
    
    // If user doesn't exist and it's a student email, create account
    if (!user && email && email.includes('@ashesi.edu.gh')) {
      // Auto-create student account
      const result = await query(
        'INSERT INTO users (student_id, email, full_name, role) VALUES (?, ?, ?, ?)',
        [student_id || email.split('@')[0].toUpperCase(), email, '', 'student']
      );
      
      user = await queryOne(
        'SELECT * FROM users WHERE id = ?',
        [result.insertId]
      );
    }
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
    
    // Update last login
    await query(
      'UPDATE users SET last_login = NOW() WHERE id = ?',
      [user.id]
    );
    
    // Store user in session
    req.session.user = {
      id: user.id,
      student_id: user.student_id,
      email: user.email,
      full_name: user.full_name,
      role: user.role
    };
    
    // Get accessible services and channels
    const services = await Service.getAll();
    const channels = await ServiceChannel.getAccessibleChannels(user.id);
    
    // Group channels by service for easier frontend handling
    const channelsByService = channels.reduce((acc, channel) => {
      if (!acc[channel.service_id]) {
        acc[channel.service_id] = [];
      }
      acc[channel.service_id].push(channel);
      return acc;
    }, {});
    
    res.json({
      success: true,
      message: 'Session started successfully',
      data: {
        user: req.session.user,
        services,
        channels,
        channelsByService
      }
    });
  } catch (error) {
    console.error('Error starting session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start session'
    });
  }
});

/**
 * @route   POST /api/session/logout
 * @desc    End user session (logout)
 * @access  Private
 */
router.post('/logout', (req, res) => {
  try {
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying session:', err);
          return res.status(500).json({
            success: false,
            error: 'Failed to logout'
          });
        }
        
        res.json({
          success: true,
          message: 'Logged out successfully'
        });
      });
    } else {
      res.json({
        success: true,
        message: 'No active session'
      });
    }
  } catch (error) {
    console.error('Error logging out:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to logout'
    });
  }
});

/**
 * @route   GET /api/session/current
 * @desc    Get current session information
 * @access  Private
 */
router.get('/current', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'No active session'
      });
    }
    
    // Refresh user data from database
    const user = await queryOne(
      'SELECT id, student_id, email, full_name, role, last_login FROM users WHERE id = ? AND is_active = TRUE',
      [req.session.user.id]
    );
    
    if (!user) {
      req.session.destroy();
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Get accessible services and channels
    const services = await Service.getAll();
    const channels = await ServiceChannel.getAccessibleChannels(user.id);
    
    res.json({
      success: true,
      data: {
        user,
        services,
        channels
      }
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch session'
    });
  }
});

/**
 * @route   POST /api/session/validate
 * @desc    Validate if user has access to a specific service
 * @access  Private
 */
router.post('/validate', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    const { service_id, channel_id } = req.body;
    
    // Check service access (all students can access all services in CampusAid)
    if (service_id) {
      const service = await Service.getById(service_id);
      if (!service) {
        return res.status(404).json({
          success: false,
          error: 'Service not found'
        });
      }
      
      // Check if user is admin of the service
      const isAdmin = await Service.isAdmin(service_id, req.session.user.id);
      
      return res.json({
        success: true,
        data: {
          has_access: true,
          is_admin: isAdmin,
          service
        }
      });
    }
    
    // Check channel access
    if (channel_id) {
      const channel = await ServiceChannel.getById(channel_id);
      if (!channel) {
        return res.status(404).json({
          success: false,
          error: 'Channel not found'
        });
      }
      
      const isMember = await ServiceChannel.isMember(channel_id, req.session.user.id);
      const isServiceAdmin = await Service.isAdmin(channel.service_id, req.session.user.id);
      
      return res.json({
        success: true,
        data: {
          has_access: true, // All students can access all channels
          is_member: isMember,
          is_admin: isServiceAdmin,
          channel
        }
      });
    }
    
    res.status(400).json({
      success: false,
      error: 'service_id or channel_id is required'
    });
  } catch (error) {
    console.error('Error validating access:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate access'
    });
  }
});

/**
 * @route   GET /api/session/profile
 * @desc    Get user profile information
 * @access  Private
 */
router.get('/profile', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    const user = await queryOne(
      `SELECT 
        u.id,
        u.student_id,
        u.email,
        u.full_name,
        u.role,
        u.last_login,
        u.created_at,
        COUNT(DISTINCT cm.channel_id) as joined_channels_count
      FROM users u
      LEFT JOIN channel_members cm ON u.id = cm.user_id
      WHERE u.id = ?
      GROUP BY u.id`,
      [req.session.user.id]
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // If user is service admin, get their administered services
    let administeredServices = [];
    if (user.role === 'service_admin') {
      administeredServices = await Service.getByAdmin(user.id);
    }
    
    res.json({
      success: true,
      data: {
        ...user,
        administered_services: administeredServices
      }
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile'
    });
  }
});

/**
 * @route   PUT /api/session/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    const { full_name } = req.body;
    
    if (!full_name) {
      return res.status(400).json({
        success: false,
        error: 'Full name is required'
      });
    }
    
    await query(
      'UPDATE users SET full_name = ? WHERE id = ?',
      [full_name, req.session.user.id]
    );
    
    // Update session
    req.session.user.full_name = full_name;
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: req.session.user
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
});

/**
 * @route   GET /api/session/verify
 * @desc    Verify if session is valid (alias for checking authentication)
 * @access  Private
 */
router.get('/verify', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'No active session'
      });
    }
    
    // Refresh user data from database
    const user = await queryOne(
      'SELECT id, student_id, email, full_name, role, last_login FROM users WHERE id = ? AND is_active = TRUE',
      [req.session.user.id]
    );
    
    if (!user) {
      req.session.destroy();
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        user,
        authenticated: true
      }
    });
  } catch (error) {
    console.error('Error verifying session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify session'
    });
  }
});

module.exports = router;