const express = require('express');
const router = express.Router();
const ServiceBot = require('../models/ServiceBot');
const Service = require('../models/Service');
const { createChatCompletion } = require('../config/openai');

/**
 * Bot Router
 * Handles routes for AI assistant management and interaction
 */

/**
 * @route   GET /api/bots/service/:serviceId
 * @desc    Get all bots for a specific service
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
    const bots = await ServiceBot.getByService(serviceId);
    
    res.json({
      success: true,
      data: bots,
      count: bots.length
    });
  } catch (error) {
    console.error('Error fetching service bots:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bots'
    });
  }
});

/**
 * @route   GET /api/bots/channel/:channelId
 * @desc    Get all bots assigned to a channel
 * @access  Private (authenticated users)
 */
router.get('/channel/:channelId', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    const { channelId } = req.params;
    const bots = await ServiceBot.getByChannel(channelId);
    
    res.json({
      success: true,
      data: bots,
      count: bots.length
    });
  } catch (error) {
    console.error('Error fetching channel bots:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bots'
    });
  }
});

/**
 * @route   GET /api/bots/:id
 * @desc    Get bot by ID with details
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
    const bot = await ServiceBot.getById(id);
    
    if (!bot) {
      return res.status(404).json({
        success: false,
        error: 'Bot not found'
      });
    }
    
    res.json({
      success: true,
      data: bot
    });
  } catch (error) {
    console.error('Error fetching bot:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bot'
    });
  }
});

/**
 * @route   GET /api/bots/:id/statistics
 * @desc    Get bot usage statistics
 * @access  Service Admin only
 */
router.get('/:id/statistics', async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'service_admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Service administrators only.'
      });
    }
    
    const { id } = req.params;
    
    // Get bot to check service
    const bot = await ServiceBot.getById(id);
    if (!bot) {
      return res.status(404).json({
        success: false,
        error: 'Bot not found'
      });
    }
    
    // Check if user is admin of the service
    const isAdmin = await Service.isAdmin(bot.service_id, req.session.user.id);
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to view this bot statistics'
      });
    }
    
    const statistics = await ServiceBot.getStatistics(id);
    
    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Error fetching bot statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

/**
 * @route   GET /api/bots/:id/vector-stores
 * @desc    Get vector stores associated with a bot
 * @access  Service Admin only
 */
router.get('/:id/vector-stores', async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'service_admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Service administrators only.'
      });
    }
    
    const { id } = req.params;
    
    // Get bot to check service
    const bot = await ServiceBot.getById(id);
    if (!bot) {
      return res.status(404).json({
        success: false,
        error: 'Bot not found'
      });
    }
    
    // Check if user is admin of the service
    const isAdmin = await Service.isAdmin(bot.service_id, req.session.user.id);
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to view this bot configuration'
      });
    }
    
    const vectorStores = await ServiceBot.getVectorStores(id);
    
    res.json({
      success: true,
      data: vectorStores,
      count: vectorStores.length
    });
  } catch (error) {
    console.error('Error fetching bot vector stores:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch vector stores'
    });
  }
});

/**
 * @route   POST /api/bots
 * @desc    Create a new service bot
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
    
    const { 
      bot_name, 
      service_id, 
      instructions, 
      personality,
      model,
      is_active_participant
    } = req.body;
    
    // Validation
    if (!bot_name || !service_id || !instructions) {
      return res.status(400).json({
        success: false,
        error: 'Bot name, service ID, and instructions are required'
      });
    }
    
    // Check if user is admin of the service
    const isAdmin = await Service.isAdmin(service_id, req.session.user.id);
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to create bots for this service'
      });
    }
    
    const botId = await ServiceBot.create({
      bot_name,
      service_id,
      created_by: req.session.user.id,
      instructions,
      personality: personality || 'Helpful and professional',
      model: model || 'gpt-4',
      is_active_participant: is_active_participant || false
    });
    
    const newBot = await ServiceBot.getById(botId);
    
    res.status(201).json({
      success: true,
      message: 'Bot created successfully',
      data: newBot
    });
  } catch (error) {
    console.error('Error creating bot:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create bot'
    });
  }
});

/**
 * @route   PUT /api/bots/:id
 * @desc    Update bot configuration
 * @access  Service Admin only
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
    const { bot_name, instructions, personality, model, is_active_participant } = req.body;
    
    // Get bot to check service
    const bot = await ServiceBot.getById(id);
    if (!bot) {
      return res.status(404).json({
        success: false,
        error: 'Bot not found'
      });
    }
    
    // Check if user is admin of the service
    const isAdmin = await Service.isAdmin(bot.service_id, req.session.user.id);
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to update this bot'
      });
    }
    
    const updated = await ServiceBot.update(id, {
      bot_name: bot_name || bot.bot_name,
      instructions: instructions || bot.instructions,
      personality: personality || bot.personality,
      model: model || bot.model,
      is_active_participant: is_active_participant !== undefined ? is_active_participant : bot.is_active_participant
    });
    
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Bot not found'
      });
    }
    
    const updatedBot = await ServiceBot.getById(id);
    
    res.json({
      success: true,
      message: 'Bot updated successfully',
      data: updatedBot
    });
  } catch (error) {
    console.error('Error updating bot:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update bot'
    });
  }
});

/**
 * @route   DELETE /api/bots/:id
 * @desc    Delete (deactivate) a bot
 * @access  Service Admin only
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
    
    // Get bot to check service
    const bot = await ServiceBot.getById(id);
    if (!bot) {
      return res.status(404).json({
        success: false,
        error: 'Bot not found'
      });
    }
    
    // Check if user is admin of the service
    const isAdmin = await Service.isAdmin(bot.service_id, req.session.user.id);
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to delete this bot'
      });
    }
    
    const deleted = await ServiceBot.delete(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Bot not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Bot deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting bot:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete bot'
    });
  }
});

/**
 * @route   POST /api/bots/:id/channels
 * @desc    Assign bot to a channel
 * @access  Service Admin only
 */
router.post('/:id/channels', async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'service_admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Service administrators only.'
      });
    }
    
    const { id } = req.params;
    const { channel_id } = req.body;
    
    if (!channel_id) {
      return res.status(400).json({
        success: false,
        error: 'Channel ID is required'
      });
    }
    
    // Get bot to check service
    const bot = await ServiceBot.getById(id);
    if (!bot) {
      return res.status(404).json({
        success: false,
        error: 'Bot not found'
      });
    }
    
    // Check if user is admin of the service
    const isAdmin = await Service.isAdmin(bot.service_id, req.session.user.id);
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to manage this bot'
      });
    }
    
    await ServiceBot.assignToChannel(id, channel_id);
    
    res.json({
      success: true,
      message: 'Bot assigned to channel successfully'
    });
  } catch (error) {
    console.error('Error assigning bot to channel:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign bot to channel'
    });
  }
});

/**
 * @route   DELETE /api/bots/:id/channels/:channelId
 * @desc    Remove bot from a channel
 * @access  Service Admin only
 */
router.delete('/:id/channels/:channelId', async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'service_admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Service administrators only.'
      });
    }
    
    const { id, channelId } = req.params;
    
    // Get bot to check service
    const bot = await ServiceBot.getById(id);
    if (!bot) {
      return res.status(404).json({
        success: false,
        error: 'Bot not found'
      });
    }
    
    // Check if user is admin of the service
    const isAdmin = await Service.isAdmin(bot.service_id, req.session.user.id);
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to manage this bot'
      });
    }
    
    const removed = await ServiceBot.removeFromChannel(id, channelId);
    
    if (!removed) {
      return res.status(404).json({
        success: false,
        error: 'Bot not assigned to this channel'
      });
    }
    
    res.json({
      success: true,
      message: 'Bot removed from channel successfully'
    });
  } catch (error) {
    console.error('Error removing bot from channel:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove bot from channel'
    });
  }
});

/**
 * @route   POST /api/bots/:id/vector-stores
 * @desc    Associate bot with a vector store
 * @access  Service Admin only
 */
router.post('/:id/vector-stores', async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'service_admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Service administrators only.'
      });
    }
    
    const { id } = req.params;
    const { vector_store_id } = req.body;
    
    if (!vector_store_id) {
      return res.status(400).json({
        success: false,
        error: 'Vector store ID is required'
      });
    }
    
    // Get bot to check service
    const bot = await ServiceBot.getById(id);
    if (!bot) {
      return res.status(404).json({
        success: false,
        error: 'Bot not found'
      });
    }
    
    // Check if user is admin of the service
    const isAdmin = await Service.isAdmin(bot.service_id, req.session.user.id);
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to manage this bot'
      });
    }
    
    await ServiceBot.addVectorStore(id, vector_store_id);
    
    res.json({
      success: true,
      message: 'Vector store associated with bot successfully'
    });
  } catch (error) {
    console.error('Error associating vector store:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to associate vector store'
    });
  }
});

/**
 * @route   DELETE /api/bots/:id/vector-stores/:vectorStoreId
 * @desc    Remove vector store from bot
 * @access  Service Admin only
 */
router.delete('/:id/vector-stores/:vectorStoreId', async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'service_admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Service administrators only.'
      });
    }
    
    const { id, vectorStoreId } = req.params;
    
    // Get bot to check service
    const bot = await ServiceBot.getById(id);
    if (!bot) {
      return res.status(404).json({
        success: false,
        error: 'Bot not found'
      });
    }
    
    // Check if user is admin of the service
    const isAdmin = await Service.isAdmin(bot.service_id, req.session.user.id);
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to manage this bot'
      });
    }
    
    const removed = await ServiceBot.removeVectorStore(id, vectorStoreId);
    
    if (!removed) {
      return res.status(404).json({
        success: false,
        error: 'Vector store not associated with this bot'
      });
    }
    
    res.json({
      success: true,
      message: 'Vector store removed from bot successfully'
    });
  } catch (error) {
    console.error('Error removing vector store:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove vector store'
    });
  }
});

/**
 * @route   POST /api/bots/:id/query
 * @desc    Query a bot (for testing or direct interaction)
 * @access  Private (authenticated users)
 */
router.post('/:id/query', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    const { id } = req.params;
    const { message, context } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }
    
    const bot = await ServiceBot.getById(id);
    if (!bot) {
      return res.status(404).json({
        success: false,
        error: 'Bot not found'
      });
    }
    
    // Generate system prompt (in production, include vector store retrieval)
    const systemPrompt = await ServiceBot.generateSystemPrompt(id, context || '');
    
    // Call OpenAI
    const response = await createChatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ]);
    
    res.json({
      success: true,
      data: {
        bot_name: bot.bot_name,
        response: response.choices[0].message.content
      }
    });
  } catch (error) {
    console.error('Error querying bot:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get bot response'
    });
  }
});

module.exports = router;