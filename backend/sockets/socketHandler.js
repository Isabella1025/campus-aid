const { query } = require('../config/database');
const BotService = require('../services/BotService');
const { createChatCompletion } = require('../config/openai');

/**
 * Socket.IO Handler for Real-Time Chat
 * Manages WebSocket connections and real-time messaging
 */

module.exports = (io) => {
  // Store active users per channel
  const channelUsers = new Map();

  io.on('connection', (socket) => {
    console.log('✓ User connected:', socket.id);

    /**
     * Join a channel
     */
    socket.on('join_channel', async (data) => {
      try {
        const { channelId, userId, userName } = data;
        
        console.log(`User ${userName} (${userId}) joining channel ${channelId}`);
        
        // Leave previous channels
        const rooms = Array.from(socket.rooms);
        rooms.forEach(room => {
          if (room !== socket.id) {
            socket.leave(room);
          }
        });

        // Join new channel
        const channelRoom = `channel_${channelId}`;
        socket.join(channelRoom);
        
        // Store user info
        socket.userId = userId;
        socket.userName = userName;
        socket.channelId = channelId;

        // Track users in channel
        if (!channelUsers.has(channelRoom)) {
          channelUsers.set(channelRoom, new Set());
        }
        channelUsers.get(channelRoom).add(socket.id);

        console.log(`✓ User ${userName} joined ${channelRoom}`);
        
        // Notify others in channel
        socket.to(channelRoom).emit('user_joined', {
          userId,
          userName,
          message: `${userName} joined the channel`
        });

      } catch (error) {
        console.error('Error joining channel:', error);
        socket.emit('error', { message: 'Failed to join channel' });
      }
    });

    /**
     * Send a message
     */
    socket.on('send_message', async (data) => {
      try {
        const { channelId, userId, userName, message, fileId, fileName, fileSize } = data;
        
        if (!message || !message.trim()) {
          return;
        }

        console.log(`📨 Message from ${userName} in channel ${channelId}:`, message);
        if (fileId) console.log(`  - Attached file: ${fileName}`);

        // Save message to database
        const result = await query(
          `INSERT INTO messages (channel_id, sender_id, message_text, message_type, is_bot_message, file_id, created_at) 
           VALUES (?, ?, ?, ?, FALSE, ?, NOW())`,
          [channelId, userId, message.trim(), fileId ? 'file' : 'text', fileId || null]
        );

        const messageId = result.insertId;

        // Fetch the complete message with sender and file info
        const [savedMessage] = await query(
          `SELECT 
            m.*,
            u.full_name as sender_name,
            u.student_id as sender_student_id,
            f.original_name as fileName,
            f.file_size as fileSize
          FROM messages m
          LEFT JOIN users u ON m.sender_id = u.id
          LEFT JOIN files f ON m.file_id = f.id
          WHERE m.id = ?`,
          [messageId]
        );

        // Broadcast to all users in the channel
        const channelRoom = `channel_${channelId}`;
        io.to(channelRoom).emit('new_message', savedMessage);

        console.log(`✓ Message ${messageId} broadcasted to ${channelRoom}`);

        // ==========================================
        // AUTO-BOT RESPONSE FOR PRIVATE CHANNELS
        // ==========================================
        
        // Get channel details
        const channelDetails = await query(`
          SELECT 
            sc.id,
            sc.channel_name,
            sc.is_private,
            sc.bot_id,
            sc.service_id,
            sb.bot_name,
            sb.system_prompt,
            s.service_name
          FROM service_channels sc
          LEFT JOIN service_bots sb ON sc.bot_id = sb.id
          LEFT JOIN services s ON sc.service_id = s.id
          WHERE sc.id = ?
        `, [channelId]);

        const channel = channelDetails && channelDetails.length > 0 ? channelDetails[0] : null;

        // Check if this is a private bot channel
        if (channel && channel.is_private && channel.bot_id) {
          console.log(`🤖 Auto-triggering ${channel.bot_name} response...`);

          // Show typing indicator
          io.to(channelRoom).emit('bot_typing', {
            channelId,
            botName: channel.bot_name
          });

          try {
            // Get recent conversation history (last 10 messages)
            const conversationHistory = await query(`
              SELECT sender_id, message_text, is_bot_message
              FROM messages
              WHERE channel_id = ?
              ORDER BY created_at DESC
              LIMIT 10
            `, [channelId]);

            // If a file was attached, load its extracted text and append to message
            let userMessage = message.trim();
            if (fileId) {
              try {
                const [file] = await query('SELECT original_name, extracted_text FROM files WHERE id = ?', [fileId]);
                if (file && file.extracted_text) {
                  userMessage += `\n\n[User uploaded a file: ${file.original_name}]\nFile content:\n${file.extracted_text.substring(0, 3000)}\n\nPlease analyze this file and provide specific feedback based on its actual content.`;
                  console.log(`✓ File content appended to message: ${file.extracted_text.length} characters`);
                } else {
                  userMessage += `\n\n[User uploaded a file: ${file ? file.original_name : 'unknown'} — text could not be extracted. Let the user know you cannot read this file type.]`;
                }
              } catch (fileError) {
                console.warn('Could not load file content for bot:', fileError);
              }
            }

            // Build bot object for BotService
            const bot = {
              id: channel.bot_id,
              bot_name: channel.bot_name,
              system_prompt: channel.system_prompt,
              service_id: channel.service_id || 1,  // Assuming service_id is in channel
              service_name: channel.service_name || 'Student Services'
            };

            console.log(`🔍 Generating RAG-powered response for ${bot.bot_name}...`);

            // Use BotService to generate response (includes RAG/vector store search)
            const botResponseText = await BotService.generateResponse(
              bot,
              userMessage,
              conversationHistory.reverse()  // Chronological order
            );

            console.log(`✓ RAG-powered response generated: ${botResponseText.substring(0, 100)}...`);

            // Save bot's response to database (store bot_id so name can be recovered later)
            const botResult = await query(
              `INSERT INTO messages (channel_id, sender_id, bot_id, message_text, message_type, is_bot_message, created_at)
               VALUES (?, NULL, ?, ?, 'text', TRUE, NOW())`,
              [channelId, channel.bot_id, botResponseText]
            );

            const botMessageId = botResult.insertId;

            // Fetch the complete bot message
            const [botMessage] = await query(
              `SELECT m.*, sb.bot_name as sender_name
               FROM messages m
               LEFT JOIN service_bots sb ON m.bot_id = sb.id
               WHERE m.id = ?`,
              [botMessageId]
            );

            // Broadcast bot response
            io.to(channelRoom).emit('new_message', botMessage);
            io.to(channelRoom).emit('bot_stopped_typing', { channelId });

            console.log(`✓ Bot response sent (ID: ${botMessageId})`);

          } catch (botError) {
            console.error('❌ Bot response error:', botError);
            
            // Send error message
            io.to(channelRoom).emit('bot_stopped_typing', { channelId });
            
            const errorResult = await query(
              `INSERT INTO messages (channel_id, sender_id, message_text, message_type, is_bot_message, created_at) 
               VALUES (?, NULL, ?, 'text', TRUE, NOW())`,
              [channelId, "I'm having trouble responding right now. Please try again in a moment."]
            );

            const [errorMessage] = await query(
              `SELECT m.*, ? as sender_name
               FROM messages m
               WHERE m.id = ?`,
              [channel.bot_name, errorResult.insertId]
            );

            io.to(channelRoom).emit('new_message', errorMessage);
          }
        }
        // For public channels, still check for bot mentions (existing behavior)
        else if (BotService.mentionsBot(message)) {
          console.log('Bot mention detected in public channel - generating AI response...');
          
          // Show typing indicator
          io.to(channelRoom).emit('bot_typing', {
            channelId,
            botName: 'Bot'
          });

          // Process message and generate bot response
          try {
            await BotService.processMessage(channelId, message, (botMessage) => {
              // Broadcast bot response
              io.to(channelRoom).emit('new_message', botMessage);
              console.log(`✓ Bot response sent to ${channelRoom}`);
            }, fileId);
          } catch (botError) {
            console.error('Error generating bot response:', botError);
          }
        }

      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    /**
     * Typing indicator
     */
    socket.on('typing', (data) => {
      const { channelId, userId, userName } = data;
      const channelRoom = `channel_${channelId}`;
      
      socket.to(channelRoom).emit('user_typing', {
        userId,
        userName,
        channelId
      });
    });

    /**
     * Stop typing
     */
    socket.on('stop_typing', (data) => {
      const { channelId, userId } = data;
      const channelRoom = `channel_${channelId}`;
      
      socket.to(channelRoom).emit('user_stopped_typing', {
        userId,
        channelId
      });
    });

    /**
     * Disconnect
     */
    socket.on('disconnect', () => {
      console.log('✗ User disconnected:', socket.id);

      // Remove from channel users tracking
      channelUsers.forEach((users, room) => {
        if (users.has(socket.id)) {
          users.delete(socket.id);
          
          // Notify others
          if (socket.userName) {
            io.to(room).emit('user_left', {
              userId: socket.userId,
              userName: socket.userName,
              message: `${socket.userName} left the channel`
            });
          }
        }
      });
    });

    /**
     * Error handling
     */
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  console.log('✓ Socket.IO handlers initialized with auto-bot response');
};