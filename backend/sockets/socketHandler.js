const { query } = require('../config/database');
const BotService = require('../services/BotService');

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

        console.log(`Message from ${userName} in channel ${channelId}:`, message);
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

        // Check if message mentions a bot and generate response
        if (BotService.mentionsBot(message)) {
          console.log('Bot mention detected - generating AI response...');
          
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
            }, fileId); // Pass fileId for bot to analyze the file
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

  console.log('✓ Socket.IO handlers initialized');
};