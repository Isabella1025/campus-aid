const express = require('express');
const router = express.Router();
const ServiceChannel = require('../models/ServiceChannel');
const Service = require('../models/Service');

/**
 * Channel Router
 * Handles routes for service communication channels
 */

/**
 * @route   GET /api/channels
 * @desc    Get all accessible channels for the logged-in user
 * @access  Private (authenticated users)
 */
router.get('/', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    const channels = await ServiceChannel.getAccessibleChannels(req.session.user.id);
    
    res.json({
      success: true,
      data: channels,
      count: channels.length
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
 * @route   GET /api/channels/service/:serviceId
 * @desc    Get all channels for a specific service
 * @access  Private (authenticated users)
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
    const channels = await ServiceChannel.getByService(serviceId);
    
    res.json({
      success: true,
      data: channels,
      count: channels.length
    });
  } catch (error) {
    console.error('Error fetching service channels:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch channels'
    });
  }
});

/**
 * @route   GET /api/channels/:id
 * @desc    Get channel details by ID
 * @access  Private (authenticated users)
 */
router.get('/:id', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    const { id } = req.params;
    const channel = await ServiceChannel.getById(id);
    
    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }
    
    res.json({
      success: true,
      data: channel
    });
  } catch (error) {
    console.error('Error fetching channel:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch channel'
    });
  }
});

/**
 * @route   GET /api/channels/:id/members
 * @desc    Get all members of a channel
 * @access  Private (authenticated users)
 */
router.get('/:id/members', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    const { id } = req.params;
    const members = await ServiceChannel.getMembers(id);
    
    res.json({
      success: true,
      data: members,
      count: members.length
    });
  } catch (error) {
    console.error('Error fetching channel members:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch members'
    });
  }
});

/**
 * @route   GET /api/channels/:id/messages
 * @desc    Get recent messages from a channel
 * @access  Private (authenticated users)
 */
router.get('/:id/messages', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    const messages = await ServiceChannel.getRecentMessages(id, limit);
    
    // Reverse to get chronological order (oldest first)
    const chronologicalMessages = messages.reverse();
    
    res.json({
      success: true,
      data: chronologicalMessages,
      count: chronologicalMessages.length
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
 * @route   POST /api/channels
 * @desc    Create a new channel
 * @access  Service Admin only
 */
router.post('/', async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'service_admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Service administrators only.'
      });
    }
    
    const { channel_name, service_id } = req.body;
    
    // Validation
    if (!channel_name || !service_id) {
      return res.status(400).json({
        success: false,
        error: 'Channel name and service ID are required'
      });
    }
    
    // Check if user is admin of the service
    const isAdmin = await Service.isAdmin(service_id, req.session.user.id);
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to create channels in this service'
      });
    }
    
    const channelId = await ServiceChannel.create({
      channel_name,
      service_id,
      created_by: req.session.user.id
    });
    
    const newChannel = await ServiceChannel.getById(channelId);
    
    res.status(201).json({
      success: true,
      message: 'Channel created successfully',
      data: newChannel
    });
  } catch (error) {
    console.error('Error creating channel:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create channel'
    });
  }
});

/**
 * @route   PUT /api/channels/:id
 * @desc    Update channel information
 * @access  Service Admin only (must be admin of the service)
 */
router.put('/:id', async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'service_admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Service administrators only.'
      });
    }
    
    const { id } = req.params;
    const { channel_name } = req.body;
    
    if (!channel_name) {
      return res.status(400).json({
        success: false,
        error: 'Channel name is required'
      });
    }
    
    // Get channel to check service
    const channel = await ServiceChannel.getById(id);
    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }
    
    // Check if user is admin of the service
    const isAdmin = await Service.isAdmin(channel.service_id, req.session.user.id);
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to update this channel'
      });
    }
    
    const updated = await ServiceChannel.update(id, { channel_name });
    
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }
    
    const updatedChannel = await ServiceChannel.getById(id);
    
    res.json({
      success: true,
      message: 'Channel updated successfully',
      data: updatedChannel
    });
  } catch (error) {
    console.error('Error updating channel:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update channel'
    });
  }
});

/**
 * @route   DELETE /api/channels/:id
 * @desc    Delete (deactivate) a channel
 * @access  Service Admin only (must be admin of the service)
 */
router.delete('/:id', async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'service_admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Service administrators only.'
      });
    }
    
    const { id } = req.params;
    
    // Get channel to check service
    const channel = await ServiceChannel.getById(id);
    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }
    
    // Check if user is admin of the service
    const isAdmin = await Service.isAdmin(channel.service_id, req.session.user.id);
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to delete this channel'
      });
    }
    
    const deleted = await ServiceChannel.delete(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Channel deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting channel:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete channel'
    });
  }
});

/**
 * @route   POST /api/channels/:id/join
 * @desc    Join a channel (add user as member)
 * @access  Private (authenticated users)
 */
router.post('/:id/join', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    const { id } = req.params;
    
    // Check if channel exists
    const channel = await ServiceChannel.getById(id);
    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }
    
    const joined = await ServiceChannel.addMember(id, req.session.user.id);
    
    res.json({
      success: true,
      message: 'Successfully joined channel',
      data: { channel_id: id, user_id: req.session.user.id }
    });
  } catch (error) {
    console.error('Error joining channel:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to join channel'
    });
  }
});

/**
 * @route   POST /api/channels/:id/leave
 * @desc    Leave a channel (remove user as member)
 * @access  Private (authenticated users)
 */
router.post('/:id/leave', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    const { id } = req.params;
    
    const left = await ServiceChannel.removeMember(id, req.session.user.id);
    
    if (!left) {
      return res.status(404).json({
        success: false,
        error: 'You are not a member of this channel'
      });
    }
    
    res.json({
      success: true,
      message: 'Successfully left channel'
    });
  } catch (error) {
    console.error('Error leaving channel:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to leave channel'
    });
  }
});

/**
 * @route   POST /api/channels/:id/members
 * @desc    Add member to channel (admin only)
 * @access  Service Admin only
 */
router.post('/:id/members', async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'service_admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Service administrators only.'
      });
    }
    
    const { id } = req.params;
    const { user_id } = req.body;
    
    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    // Get channel to check service
    const channel = await ServiceChannel.getById(id);
    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }
    
    // Check if user is admin of the service
    const isAdmin = await Service.isAdmin(channel.service_id, req.session.user.id);
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to manage members in this channel'
      });
    }
    
    await ServiceChannel.addMember(id, user_id);
    
    res.json({
      success: true,
      message: 'Member added successfully'
    });
  } catch (error) {
    console.error('Error adding member:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add member'
    });
  }
});

/**
 * @route   DELETE /api/channels/:id/members/:userId
 * @desc    Remove member from channel (admin only)
 * @access  Service Admin only
 */
router.delete('/:id/members/:userId', async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'service_admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Service administrators only.'
      });
    }
    
    const { id, userId } = req.params;
    
    // Get channel to check service
    const channel = await ServiceChannel.getById(id);
    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }
    
    // Check if user is admin of the service
    const isAdmin = await Service.isAdmin(channel.service_id, req.session.user.id);
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to manage members in this channel'
      });
    }
    
    const removed = await ServiceChannel.removeMember(id, userId);
    
    if (!removed) {
      return res.status(404).json({
        success: false,
        error: 'Member not found in channel'
      });
    }
    
    res.json({
      success: true,
      message: 'Member removed successfully'
    });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove member'
    });
  }
});

module.exports = router;