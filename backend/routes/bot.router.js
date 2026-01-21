const express = require('express');
const router = express.Router();
const BotService = require('../services/BotService');
const { isAuthenticated, isLecturer } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(isAuthenticated);

// GET /api/bots - Get all bots for current course
router.get('/', async (req, res) => {
  try {
    const userId = req.session.userId;
    const courseId = req.session.courseId;

    const result = await BotService.getCourseBots(courseId, userId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Get bots error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve bots'
    });
  }
});

// POST /api/bots - Create new bot (lecturer only)
router.post('/', isLecturer, async (req, res) => {
  try {
    const userId = req.session.userId;
    const courseId = req.session.courseId;
    const botData = req.body;

    const result = await BotService.createBot(botData, userId, courseId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(201).json(result);
  } catch (error) {
    console.error('Create bot error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create bot'
    });
  }
});

// GET /api/bots/:id - Get bot details
router.get('/:id', async (req, res) => {
  try {
    const userId = req.session.userId;
    const botId = parseInt(req.params.id);

    const result = await BotService.getBotDetails(botId, userId);

    if (!result.success) {
      return res.status(404).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Get bot details error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve bot details'
    });
  }
});

// PUT /api/bots/:id - Update bot (lecturer only)
router.put('/:id', isLecturer, async (req, res) => {
  try {
    const userId = req.session.userId;
    const userRole = req.session.userRole;
    const botId = parseInt(req.params.id);
    const updateData = req.body;

    const result = await BotService.updateBot(botId, updateData, userId, userRole);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Update bot error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update bot'
    });
  }
});

// DELETE /api/bots/:id - Delete bot (lecturer only)
router.delete('/:id', isLecturer, async (req, res) => {
  try {
    const userId = req.session.userId;
    const userRole = req.session.userRole;
    const botId = parseInt(req.params.id);

    const result = await BotService.deleteBot(botId, userId, userRole);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Delete bot error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete bot'
    });
  }
});

module.exports = router;