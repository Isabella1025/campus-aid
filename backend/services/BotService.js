const Bot = require('../models/Bot');
const Message = require('../models/Message');
const Group = require('../models/Group');
const Course = require('../models/Course');
const { createChatCompletion } = require('../config/openai');

class BotService {
  // Create new bot
  static async createBot(botData, creatorId, courseId) {
    try {
      // Validate inputs
      if (!botData.bot_name || !botData.bot_name.trim()) {
        return {
          success: false,
          message: 'Bot name is required'
        };
      }

      // Verify user can create bots (lecturer only)
      const course = await Course.findById(courseId);
      if (!course) {
        return {
          success: false,
          message: 'Course not found'
        };
      }

      // Check if bot name already exists in course
      const existingBot = await Bot.findByNameInCourse(botData.bot_name.trim(), courseId);
      if (existingBot) {
        return {
          success: false,
          message: 'A bot with this name already exists in this course'
        };
      }

      // Create bot
      const botId = await Bot.create({
        bot_name: botData.bot_name.trim(),
        course_id: courseId,
        created_by: creatorId,
        instructions: botData.instructions || null,
        personality: botData.personality || null,
        model: botData.model || 'gpt-4',
        is_join_bot: botData.is_join_bot || false
      });

      // Assign to groups if specified
      if (botData.groups && Array.isArray(botData.groups)) {
        for (const groupId of botData.groups) {
          await Bot.assignToGroup(botId, groupId);
        }
      }

      // Get created bot
      const bot = await Bot.findById(botId);

      return {
        success: true,
        message: 'Bot created successfully',
        data: bot
      };
    } catch (error) {
      console.error('Create bot error:', error);
      return {
        success: false,
        message: 'Failed to create bot'
      };
    }
  }

  // Get bots for course
  static async getCourseBots(courseId, userId) {
    try {
      // Verify user is enrolled
      const isEnrolled = await Course.isUserEnrolled(userId, courseId);
      if (!isEnrolled) {
        return {
          success: false,
          message: 'You are not enrolled in this course'
        };
      }

      const bots = await Bot.getByCourse(courseId);

      return {
        success: true,
        data: bots
      };
    } catch (error) {
      console.error('Get course bots error:', error);
      return {
        success: false,
        message: 'Failed to retrieve bots'
      };
    }
  }

  // Get bot details
  static async getBotDetails(botId, userId) {
    try {
      const bot = await Bot.findById(botId);
      if (!bot) {
        return {
          success: false,
          message: 'Bot not found'
        };
      }

      // Verify user has access to course
      const isEnrolled = await Course.isUserEnrolled(userId, bot.course_id);
      if (!isEnrolled) {
        return {
          success: false,
          message: 'You do not have access to this bot'
        };
      }

      // Get assigned groups
      const groups = await Bot.getAssignedGroups(botId);

      return {
        success: true,
        data: {
          bot: bot,
          groups: groups
        }
      };
    } catch (error) {
      console.error('Get bot details error:', error);
      return {
        success: false,
        message: 'Failed to retrieve bot details'
      };
    }
  }

  // Update bot
  static async updateBot(botId, updateData, userId, userRole) {
    try {
      const bot = await Bot.findById(botId);
      if (!bot) {
        return {
          success: false,
          message: 'Bot not found'
        };
      }

      // Only creator or lecturer can update
      if (bot.created_by !== userId && userRole !== 'lecturer') {
        return {
          success: false,
          message: 'You do not have permission to update this bot'
        };
      }

      await Bot.update(botId, updateData);

      const updatedBot = await Bot.findById(botId);

      return {
        success: true,
        message: 'Bot updated successfully',
        data: updatedBot
      };
    } catch (error) {
      console.error('Update bot error:', error);
      return {
        success: false,
        message: 'Failed to update bot'
      };
    }
  }

  // Delete bot
  static async deleteBot(botId, userId, userRole) {
    try {
      const bot = await Bot.findById(botId);
      if (!bot) {
        return {
          success: false,
          message: 'Bot not found'
        };
      }

      // Only creator or lecturer can delete
      if (bot.created_by !== userId && userRole !== 'lecturer') {
        return {
          success: false,
          message: 'You do not have permission to delete this bot'
        };
      }

      await Bot.delete(botId);

      return {
        success: true,
        message: 'Bot deleted successfully'
      };
    } catch (error) {
      console.error('Delete bot error:', error);
      return {
        success: false,
        message: 'Failed to delete bot'
      };
    }
  }

  // Bot responds to message
  static async generateBotResponse(botId, userMessage, groupId, conversationHistory = []) {
    try {
      const bot = await Bot.findById(botId);
      if (!bot) {
        return {
          success: false,
          message: 'Bot not found'
        };
      }

      // Verify bot is assigned to group
      const isAssigned = await Bot.isAssignedToGroup(botId, groupId);
      if (!isAssigned && !bot.is_join_bot) {
        return {
          success: false,
          message: 'Bot is not available in this group'
        };
      }

      // Build system prompt
      const systemPrompt = this.buildSystemPrompt(bot);

      // Build messages for OpenAI
      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: userMessage }
      ];

      // Get response from OpenAI
      const response = await createChatCompletion(messages, {
        model: bot.model,
        max_tokens: 500,
        temperature: 0.7
      });

      const botResponse = response.choices[0].message.content;

      // Save bot message to database
      const messageId = await Message.create({
        group_id: groupId,
        bot_id: botId,
        message_text: botResponse,
        message_type: 'text',
        is_bot_message: true
      });

      // Get created message
      const message = await Message.findById(messageId);

      return {
        success: true,
        data: {
          message: message,
          botResponse: botResponse
        }
      };
    } catch (error) {
      console.error('Generate bot response error:', error);
      return {
        success: false,
        message: 'Failed to generate response: ' + error.message
      };
    }
  }

  // Build system prompt for bot
  static buildSystemPrompt(bot) {
    let prompt = `You are ${bot.bot_name}, an AI teaching assistant.`;

    if (bot.personality) {
      prompt += `\n\nPersonality: ${bot.personality}`;
    }

    if (bot.instructions) {
      prompt += `\n\nInstructions: ${bot.instructions}`;
    } else {
      prompt += `\n\nYour role is to help students understand course concepts, answer their questions clearly and concisely, and encourage learning. Be helpful, patient, and supportive. If you don't know something, admit it honestly.`;
    }

    prompt += `\n\nGuidelines:
- Keep responses concise (under 200 words unless asked for more detail)
- Use clear, simple language appropriate for students
- Break down complex concepts into understandable parts
- Encourage critical thinking
- If asked about course materials you don't have access to, politely let the student know
- Stay on topic and focused on academic support`;

    return prompt;
  }

  // Detect bot mentions in message
  static detectBotMentions(messageText, bots) {
    const mentions = [];
    
    for (const bot of bots) {
      const mentionPattern = new RegExp(`@${bot.bot_name}\\b`, 'i');
      if (mentionPattern.test(messageText)) {
        mentions.push(bot);
      }
    }

    return mentions;
  }

  // Extract message without mentions
  static extractMessageWithoutMentions(messageText) {
    return messageText.replace(/@\w+/g, '').trim();
  }
}

module.exports = BotService;