const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

// Helper function since we don't have queryOne
async function queryOne(sql, params) {
  const results = await query(sql, params);
  return results && results.length > 0 ? results[0] : null;
}

/**
 * @route   GET /api/channels/service/:serviceId
 * @desc    Get channels for a service (public + student's private bot chats)
 * @access  Private
 */
router.get('/service/:serviceId', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { serviceId } = req.params;
    const userId = req.session.user.id;
    const userRole = req.session.user.role;

    let channels;

    if (userRole === 'student') {
      // Students see: 
      // 1. Public channels (general discussions)
      // 2. Their own private bot chats
      channels = await query(`
        SELECT DISTINCT
          sc.id,
          sc.channel_name,
          sc.service_id,
          sc.is_private,
          sc.channel_type,
          sc.created_at,
          sc.bot_id,
          sb.bot_name,
          (SELECT COUNT(*) FROM messages m WHERE m.channel_id = sc.id AND m.is_bot_message = FALSE) as my_message_count
        FROM service_channels sc
        LEFT JOIN service_bots sb ON sc.bot_id = sb.id
        LEFT JOIN channel_participants cp ON sc.id = cp.channel_id
        WHERE sc.service_id = ? 
          AND sc.is_active = TRUE
          AND (
            sc.is_private = FALSE 
            OR (sc.is_private = TRUE AND cp.user_id = ?)
          )
        ORDER BY sc.is_private ASC, sc.created_at ASC
      `, [serviceId, userId]);

    } else if (userRole === 'staff' || userRole === 'service_admin') {
      // Staff see: 
      // 1. Public channels (to monitor)
      // 2. All private bot chats (to see student conversations if needed)
      channels = await query(`
        SELECT DISTINCT
          sc.id,
          sc.channel_name,
          sc.service_id,
          sc.is_private,
          sc.channel_type,
          sc.created_at,
          sc.bot_id,
          sb.bot_name,
          student.full_name as student_name,
          (SELECT COUNT(*) FROM messages m WHERE m.channel_id = sc.id) as message_count
        FROM service_channels sc
        LEFT JOIN service_bots sb ON sc.bot_id = sb.id
        LEFT JOIN users student ON sc.created_by = student.id
        WHERE sc.service_id = ? 
          AND sc.is_active = TRUE
        ORDER BY sc.is_private ASC, sc.created_at DESC
      `, [serviceId]);

    } else {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: channels
    });

  } catch (error) {
    console.error('Error fetching channels:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch channels'
    });
  }
});

/**
 * @route   POST /api/channels/create-bot-chat
 * @desc    Create/get a private chat with a service bot
 * @access  Student
 */
router.post('/create-bot-chat', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (req.session.user.role !== 'student') {
      return res.status(403).json({
        success: false,
        error: 'Only students can create bot chats'
      });
    }

    const { service_id, bot_id } = req.body;
    const student_id = req.session.user.id;

    // Validate inputs
    if (!service_id || !bot_id) {
      return res.status(400).json({
        success: false,
        error: 'Service and bot are required'
      });
    }

    // Check if private bot chat already exists for this student
    const existingChannel = await queryOne(`
      SELECT id, channel_name 
      FROM service_channels 
      WHERE service_id = ? 
        AND bot_id = ?
        AND is_private = TRUE 
        AND created_by = ?
    `, [service_id, bot_id, student_id]);

    if (existingChannel) {
      // Return existing channel
      return res.json({
        success: true,
        message: 'Bot chat already exists',
        data: { 
          channel_id: existingChannel.id, 
          channel_name: existingChannel.channel_name,
          is_new: false
        }
      });
    }

    // Get bot and service names
    const bot = await queryOne('SELECT bot_name FROM service_bots WHERE id = ?', [bot_id]);
    const service = await queryOne('SELECT service_name FROM services WHERE id = ?', [service_id]);

    if (!bot || !service) {
      return res.status(404).json({
        success: false,
        error: 'Bot or service not found'
      });
    }

    // Create private bot chat channel
    const channelName = `Your Chat with ${bot.bot_name}`;
    
    const result = await query(`
      INSERT INTO service_channels 
        (channel_name, service_id, bot_id, is_private, channel_type, created_by, is_active, created_at)
      VALUES (?, ?, ?, TRUE, 'private', ?, TRUE, NOW())
    `, [channelName, service_id, bot_id, student_id]);

    const channelId = result.insertId;

    // Add student as sole participant
    await query(`
      INSERT INTO channel_participants (channel_id, user_id, role)
      VALUES (?, ?, 'student')
    `, [channelId, student_id]);

    console.log(`✓ Private bot chat created: ${channelName} (ID: ${channelId}) for student ${student_id}`);

    res.json({
      success: true,
      message: 'Bot chat created',
      data: { 
        channel_id: channelId, 
        channel_name: channelName,
        bot_name: bot.bot_name,
        service_name: service.service_name,
        is_new: true
      }
    });

  } catch (error) {
    console.error('Error creating bot chat:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create bot chat'
    });
  }
});

/**
 * @route   GET /api/channels/:channelId
 * @desc    Get channel details by ID
 * @access  Private
 */
router.get('/:channelId', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { channelId } = req.params;
    const userId = req.session.user.id;

    // Get channel details
    const results = await query(`
      SELECT 
        sc.*,
        s.service_name,
        sb.bot_name
      FROM service_channels sc
      LEFT JOIN services s ON sc.service_id = s.id
      LEFT JOIN service_bots sb ON sc.bot_id = sb.id
      WHERE sc.id = ?
    `, [channelId]);

    const channel = results && results.length > 0 ? results[0] : null;

    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }

    // Check access for private channels
    if (channel.is_private) {
      const isParticipant = await query(`
        SELECT id FROM channel_participants 
        WHERE channel_id = ? AND user_id = ?
      `, [channelId, userId]);

      if (!isParticipant || isParticipant.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this private channel'
        });
      }
    }

    res.json({
      success: true,
      data: channel
    });

  } catch (error) {
    console.error('Error fetching channel details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch channel details'
    });
  }
});

/**
 * @route   GET /api/channels/:channelId/messages
 * @desc    Get messages for a channel (only if user has access)
 * @access  Private
 */
router.get('/:channelId/messages', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { channelId } = req.params;
    const userId = req.session.user.id;
    const userRole = req.session.user.role;

    // Check if channel exists
    const channel = await queryOne(`
      SELECT is_private, created_by, service_id
      FROM service_channels 
      WHERE id = ?
    `, [channelId]);

    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }

    // Check access for private channels
    if (channel.is_private) {
      // Students can only see their own private chats
      if (userRole === 'student' && channel.created_by !== userId) {
        return res.status(403).json({
          success: false,
          error: 'You do not have access to this private chat'
        });
      }

      // Staff can see all private chats in their service
      if (userRole === 'staff') {
        const user = await queryOne('SELECT assigned_service_id FROM users WHERE id = ?', [userId]);
        if (user && user.assigned_service_id !== channel.service_id) {
          return res.status(403).json({
            success: false,
            error: 'Access denied'
          });
        }
      }
    }

    // Fetch messages
    const messages = await query(`
      SELECT 
        m.*,
        u.full_name as sender_name,
        u.role as sender_role
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      WHERE m.channel_id = ?
      ORDER BY m.created_at ASC
    `, [channelId]);

    res.json({
      success: true,
      data: messages
    });

  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch messages'
    });
  }
});

/**
 * @route   POST /api/channels/:channelId/join
 * @desc    Join a public channel
 * @access  Private
 */
router.post('/:channelId/join', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { channelId } = req.params;
    const userId = req.session.user.id;
    const userRole = req.session.user.role;

    // Check if channel exists and is public
    const channel = await queryOne(`
      SELECT id, channel_name, is_private 
      FROM service_channels 
      WHERE id = ?
    `, [channelId]);

    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }

    if (channel.is_private) {
      return res.status(403).json({
        success: false,
        error: 'Cannot join private bot chats'
      });
    }

    // Add user as participant (ignore if already exists)
    await query(`
      INSERT IGNORE INTO channel_participants (channel_id, user_id, role)
      VALUES (?, ?, ?)
    `, [channelId, userId, userRole === 'student' ? 'student' : 'staff']);

    res.json({
      success: true,
      message: `Joined channel: ${channel.channel_name}`
    });

  } catch (error) {
    console.error('Error joining channel:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to join channel'
    });
  }
});

module.exports = router;