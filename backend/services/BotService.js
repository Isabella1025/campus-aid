const { query, queryOne } = require('../config/database');
const { createChatCompletion, createStreamingCompletion } = require('../config/openai');
const VectorStoreService = require('./VectorStoreService');

/**
 * Bot Service
 * Handles AI bot responses and intelligent interactions
 */

class BotService {
  /**
   * Check if a message mentions a bot
   * @param {string} message - The message text
   * @returns {boolean} - True if bot is mentioned
   */
  static mentionsBot(message) {
    const botMentions = ['@CareerBot', '@AdvisingBot', '@ODIPBot', '@bot'];
    return botMentions.some(mention => 
      message.toLowerCase().includes(mention.toLowerCase())
    );
  }

  /**
   * Extract bot name from mention
   * @param {string} message - The message text
   * @returns {string|null} - Bot name or null
   */
  static extractBotMention(message) {
    const mentions = ['@CareerBot', '@AdvisingBot', '@ODIPBot'];
    for (const mention of mentions) {
      if (message.toLowerCase().includes(mention.toLowerCase())) {
        return mention.substring(1); // Remove @ symbol
      }
    }
    return null;
  }

  /**
   * Get bot by name
   * @param {string} botName - Bot name (e.g., 'CareerBot')
   * @param {number} channelId - Channel ID
   * @returns {Promise<Object|null>} - Bot object or null
   */
  static async getBotByName(botName, channelId) {
    try {
      const bot = await queryOne(`
        SELECT 
          sb.*,
          s.service_name,
          s.service_code
        FROM service_bots sb
        JOIN bot_channel_assignments bca ON sb.id = bca.bot_id
        JOIN services s ON sb.service_id = s.id
        WHERE bca.channel_id = ? 
          AND sb.bot_name = ?
          AND sb.is_active = TRUE
        LIMIT 1
      `, [channelId, botName]);

      return bot;
    } catch (error) {
      console.error('Error getting bot by name:', error);
      return null;
    }
  }

  /**
   * Get bots assigned to a channel
   * @param {number} channelId - Channel ID
   * @returns {Promise<Array>} - Array of bots
   */
  static async getChannelBots(channelId) {
    try {
      const bots = await query(`
        SELECT 
          sb.*,
          s.service_name,
          s.service_code
        FROM service_bots sb
        JOIN bot_channel_assignments bca ON sb.id = bca.bot_id
        JOIN services s ON sb.service_id = s.id
        WHERE bca.channel_id = ?
          AND sb.is_active = TRUE
        ORDER BY sb.bot_name
      `, [channelId]);

      return bots;
    } catch (error) {
      console.error('Error getting channel bots:', error);
      return [];
    }
  }

  /**
   * Generate system prompt for a bot
   * @param {Object} bot - Bot object
   * @param {string} context - Optional context from vector stores
   * @returns {string} - System prompt
   */
  static generateSystemPrompt(bot, context = '', hasFileContent = false) {
    let prompt = `You are ${bot.bot_name}, a helpful AI assistant for ${bot.service_name} at Ashesi University.

Your role and responsibilities:
${bot.instructions || 'Provide helpful guidance and support to students'}

Your personality: ${bot.personality || 'Friendly, professional, and supportive'}

Important guidelines:
- Be friendly, professional, and supportive
- Provide accurate information based on university policies and procedures
- If you're unsure about something, admit it and suggest contacting ${bot.service_name} staff
- Keep responses concise but informative (2-4 paragraphs max)
- Use bullet points for lists when appropriate
- Be empathetic to student concerns
${hasFileContent ? '- IMPORTANT: When a user uploads a file, the file content is included in the conversation. You CAN see and analyze the file content. Do NOT say you cannot view files!' : ''}

`;

    if (context) {
      prompt += `\nRelevant information from our knowledge base:
${context}

Use this information to answer questions accurately. If the question cannot be answered with the provided information, let the student know and suggest they contact ${bot.service_name} staff directly.

`;
    }

    prompt += `Remember: You are here to assist and guide, but human staff are always available for personalized support.`;

    return prompt;
  }

  /**
   * Generate AI response
   * @param {Object} bot - Bot object
   * @param {string} userMessage - User's message
   * @param {Array} conversationHistory - Previous messages for context
   * @returns {Promise<string>} - Bot response
   */
  static async generateResponse(bot, userMessage, conversationHistory = []) {
    try {
      // Perform semantic search to find relevant context
      let context = '';
      try {
        const relevantChunks = await VectorStoreService.semanticSearch(
          userMessage,
          bot.service_id,
          3 // Get top 3 most relevant chunks
        );
        
        if (relevantChunks.length > 0) {
          context = relevantChunks
            .map((chunk, idx) => `[Document ${idx + 1}]: ${chunk.chunk_text}`)
            .join('\n\n');
          console.log(`✓ Found ${relevantChunks.length} relevant context chunks`);
        }
      } catch (searchError) {
        console.warn('Semantic search failed, continuing without context:', searchError.message);
      }
      
      // Generate system prompt with context
      const hasFileContent = userMessage.includes('[User uploaded a file:');
      const systemPrompt = this.generateSystemPrompt(bot, context, hasFileContent);

      // Build conversation context (last 5 messages for context)
      const contextMessages = conversationHistory
        .slice(-5)
        .map(msg => ({
          role: msg.is_bot_message ? 'assistant' : 'user',
          content: msg.message_text
        }));

      // Create messages array
      const messages = [
        { role: 'system', content: systemPrompt },
        ...contextMessages,
        { role: 'user', content: userMessage }
      ];

      console.log(`Generating response for ${bot.bot_name}...`);

      // Call OpenAI - don't pass temperature for GPT-5 compatibility
      const response = await createChatCompletion(messages, {
        model: bot.model || 'gpt-5-mini',
        max_tokens: 500
      });

      console.log('Full OpenAI response:', JSON.stringify(response, null, 2));
      console.log('Choices:', response.choices);
      console.log('First choice:', response.choices[0]);
      console.log('Message:', response.choices[0]?.message);
      console.log('Content:', response.choices[0]?.message?.content);

      const botResponse = response.choices[0]?.message?.content || '';
      console.log(`✓ ${bot.bot_name} response generated:`, botResponse ? `${botResponse.substring(0, 100)}...` : 'EMPTY!');

      if (!botResponse) {
        console.warn('WARNING: OpenAI returned empty response, using fallback');
        return `I apologize, I'm having trouble generating a response right now. Based on Ashesi Career Services guidelines, I recommend setting up an appointment with our office for personalized CV review and formatting guidance.`;
      }

      return botResponse;

    } catch (error) {
      console.error('Error generating bot response:', error);
      
      // Fallback mock response for demo purposes
      const mockResponses = {
        'CareerBot': "Thanks for reaching out! I'd be happy to help with your career-related question. Based on my training, here are some key points:\n\n• Career Services offers resume reviews, interview prep, and job search support\n• We host regular career fairs and networking events\n• You can schedule one-on-one appointments through our website\n\nFor personalized guidance, I recommend booking a session with our career counselors. Would you like me to help you with anything specific?",
        'AdvisingBot': "Hello! I'm here to help with your academic planning. Here's what I can assist with:\n\n• Course selection and registration guidance\n• Degree requirements and graduation planning\n• Major declaration and academic policies\n\nFor detailed academic planning, please schedule an appointment with an academic advisor. What specific question can I help you with today?",
        'ODIPBot': "Greetings! I'm here to support international students and diversity initiatives. I can help with:\n\n• Visa and immigration procedures\n• Study abroad opportunities\n• Cultural integration and campus resources\n• International student support services\n\nFor complex immigration matters, please contact ODIP staff directly. How can I assist you today?"
      };
      
      // Return mock response based on bot name
      const mockResponse = mockResponses[bot.bot_name] || 
        `I'm ${bot.bot_name}, currently in demo mode. I'm here to help with ${bot.service_name} questions. Please contact our office for personalized assistance.`;
      
      return mockResponse;
    }
  }

  /**
   * Save bot message to database
   * @param {number} channelId - Channel ID
   * @param {number} botId - Bot ID
   * @param {string} message - Bot's message
   * @returns {Promise<Object>} - Saved message
   */
  static async saveBotMessage(channelId, botId, message) {
    try {
      const result = await query(
        `INSERT INTO messages (channel_id, bot_id, message_text, message_type, is_bot_message, created_at) 
         VALUES (?, ?, ?, 'text', TRUE, NOW())`,
        [channelId, botId, message]
      );

      const messageId = result.insertId;

      // Fetch the complete message
      const [savedMessage] = await query(
        `SELECT 
          m.*,
          sb.bot_name
        FROM messages m
        LEFT JOIN service_bots sb ON m.bot_id = sb.id
        WHERE m.id = ?`,
        [messageId]
      );

      return savedMessage;
    } catch (error) {
      console.error('Error saving bot message:', error);
      throw error;
    }
  }

  /**
   * Get recent conversation history from a channel
   * @param {number} channelId - Channel ID
   * @param {number} limit - Number of messages to retrieve
   * @returns {Promise<Array>} - Array of messages
   */
  static async getConversationHistory(channelId, limit = 10) {
    try {
      const messages = await query(
        `SELECT 
          m.*,
          u.full_name as sender_name,
          sb.bot_name
        FROM messages m
        LEFT JOIN users u ON m.sender_id = u.id
        LEFT JOIN service_bots sb ON m.bot_id = sb.id
        WHERE m.channel_id = ?
        ORDER BY m.created_at DESC
        LIMIT ?`,
        [channelId, limit]
      );

      // Return in chronological order
      return messages.reverse();
    } catch (error) {
      console.error('Error getting conversation history:', error);
      return [];
    }
  }

  /**
   * Process a user message and generate bot response if needed
   * @param {number} channelId - Channel ID
   * @param {string} userMessage - User's message
   * @param {Function} onResponse - Callback when response is ready
   * @param {number} fileId - Optional file ID if user attached a file
   */
  static async processMessage(channelId, userMessage, onResponse, fileId = null) {
    try {
      // Check if message mentions a bot
      if (!this.mentionsBot(userMessage)) {
        return; // No bot mentioned, nothing to do
      }

      console.log('Bot mention detected in message:', userMessage);
      if (fileId) console.log('File attached to message:', fileId);

      // Get channel bots
      const channelBots = await this.getChannelBots(channelId);
      
      if (channelBots.length === 0) {
        console.log('No bots assigned to this channel');
        return;
      }

      // Try to find specific bot mention, or use first available bot
      let targetBot = null;
      const mentionedBotName = this.extractBotMention(userMessage);
      
      if (mentionedBotName) {
        targetBot = channelBots.find(bot => 
          bot.bot_name.toLowerCase() === mentionedBotName.toLowerCase()
        );
      }

      // If no specific bot found, use the first active bot
      if (!targetBot && channelBots.length > 0) {
        targetBot = channelBots[0];
      }

      if (!targetBot) {
        console.log('No suitable bot found');
        return;
      }

      console.log(`Selected bot: ${targetBot.bot_name}`);

      // Get conversation history for context
      const history = await this.getConversationHistory(channelId, 10);

      // If there's an attached file, get its content
      let fileContext = '';
      if (fileId) {
        try {
          const file = await queryOne('SELECT * FROM files WHERE id = ?', [fileId]);
          if (file && file.extracted_text) {
            fileContext = `\n\n[User uploaded a file: ${file.original_name}]\nFile content:\n${file.extracted_text.substring(0, 3000)}...\n\nPlease analyze this file and provide specific feedback based on its actual content.`;
            console.log(`✓ File content loaded: ${file.extracted_text.length} characters`);
          }
        } catch (fileError) {
          console.warn('Could not load file content:', fileError);
        }
      }

      // Generate response (file context will be added to the message)
      const enhancedMessage = userMessage + fileContext;
      const botResponse = await this.generateResponse(targetBot, enhancedMessage, history);

      // Save bot message
      const savedMessage = await this.saveBotMessage(channelId, targetBot.id, botResponse);

      // Call callback with response
      if (onResponse) {
        onResponse(savedMessage);
      }

      return savedMessage;

    } catch (error) {
      console.error('Error processing message for bot:', error);
      throw error;
    }
  }
}

module.exports = BotService;
