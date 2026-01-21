const MessagingService = require('../services/MessagingService');
const BotService = require('../services/BotService');
const Bot = require('../models/Bot');
const Group = require('../models/Group');

// Store active users and their socket connections
const activeUsers = new Map(); // userId -> { socketId, groupId, userName }

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Handle user join
    socket.on('user:join', async (data) => {
      const { userId, userName, groupId } = data;

      // Store user info
      activeUsers.set(userId, {
        socketId: socket.id,
        groupId: groupId,
        userName: userName
      });

      // Join the group room
      socket.join(`group:${groupId}`);

      console.log(`User ${userName} (${userId}) joined group ${groupId}`);

      // Notify other users in the group
      socket.to(`group:${groupId}`).emit('user:joined', {
        userId: userId,
        userName: userName,
        timestamp: new Date().toISOString()
      });

      // Send list of online users in this group
      const onlineUsers = getOnlineUsersInGroup(groupId);
      io.to(`group:${groupId}`).emit('users:online', onlineUsers);
    });

    // Handle sending message
    socket.on('message:send', async (data) => {
      console.log('Received message:send event:', data);
      
      try {
        const { userId, groupId, message, userName } = data;

        if (!userId || !groupId || !message) {
          console.error('Missing required fields:', { userId, groupId, message });
          socket.emit('message:error', {
            message: 'Missing required fields'
          });
          return;
        }

        console.log('Saving message to database...');
        
        // Save message to database
        const result = await MessagingService.sendMessage({
          group_id: groupId,
          message_text: message,
          message_type: 'text'
        }, userId);

        console.log('Save result:', result);

        if (result.success) {
          console.log('Broadcasting message to group:', groupId);
          
          // Broadcast message to all users in the group
          io.to(`group:${groupId}`).emit('message:new', {
            ...result.data,
            sender_name: userName
          });
          
          console.log('Message broadcasted successfully');
        } else {
          console.error('Failed to save message:', result.message);
          // Send error back to sender
          socket.emit('message:error', {
            message: result.message
          });
        }

        // === Bot mention detection & trigger ===
        try {
          const messageText = (result.data && result.data.message_text) || message;
          const mentionRegex = /@([A-Za-z0-9_]+)/g;
          const mentions = [];
          let m;
          while ((m = mentionRegex.exec(messageText)) !== null) mentions.push(m[1].toLowerCase());

          if (mentions.length > 0) {
            console.log('Bot mentions detected:', mentions);
            // Get group to obtain course_id (used by Bot.findByNameInCourse)
            const group = await Group.findById(groupId);
            const courseId = group && group.course_id;

            for (const name of mentions) {
              const bot = courseId ? await Bot.findByNameInCourse(name, courseId) : null;
              if (!bot) continue;

              const assigned = bot.is_join_bot ? true : await Bot.isAssignedToGroup(bot.id, groupId);
              if (!assigned) continue;

              console.log('Triggering bot:', bot.bot_name);
              // If your BotService exposes a handler to process mentions, call it.
              if (typeof BotService.handleMention === 'function') {
                // pass bot and the saved message (result.data) to the service
                BotService.handleMention({
                  bot,
                  message: result.data,
                  groupId,
                  userId,
                  userName
                }).catch(err => console.error('BotService.handleMention error:', err));
              } else {
                console.warn('BotService.handleMention not implemented — implement to generate bot responses.');
              }
            }
          }
        } catch (err) {
          console.error('Error detecting/triggering bot mentions:', err);
        }
        // === end bot mention detection ===
      } catch (error) {
        console.error('Socket message send error:', error);
        socket.emit('message:error', {
          message: 'Failed to send message'
        });
      }
    });

    // Handle typing indicator
    socket.on('typing:start', (data) => {
      const { userId, userName, groupId } = data;
      socket.to(`group:${groupId}`).emit('user:typing', {
        userId: userId,
        userName: userName
      });
    });

    socket.on('typing:stop', (data) => {
      const { userId, groupId } = data;
      socket.to(`group:${groupId}`).emit('user:stopped-typing', {
        userId: userId
      });
    });

    // Handle user leaving group
    socket.on('user:leave', (data) => {
      const { userId, groupId, userName } = data;
      
      socket.leave(`group:${groupId}`);
      
      // Notify others
      socket.to(`group:${groupId}`).emit('user:left', {
        userId: userId,
        userName: userName,
        timestamp: new Date().toISOString()
      });

      // Update online users
      const onlineUsers = getOnlineUsersInGroup(groupId);
      io.to(`group:${groupId}`).emit('users:online', onlineUsers);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);

      // Find and remove user from active users
      for (const [userId, userData] of activeUsers.entries()) {
        if (userData.socketId === socket.id) {
          const groupId = userData.groupId;
          const userName = userData.userName;

          activeUsers.delete(userId);

          // Notify group members
          socket.to(`group:${groupId}`).emit('user:left', {
            userId: userId,
            userName: userName,
            timestamp: new Date().toISOString()
          });

          // Update online users
          const onlineUsers = getOnlineUsersInGroup(groupId);
          io.to(`group:${groupId}`).emit('users:online', onlineUsers);

          break;
        }
      }
    });
  });
}

// Helper function to get online users in a group
function getOnlineUsersInGroup(groupId) {
  const users = [];
  for (const [userId, userData] of activeUsers.entries()) {
    if (userData.groupId === groupId) {
      users.push({
        userId: userId,
        userName: userData.userName
      });
    }
  }
  return users;
}

module.exports = { setupSocketHandlers };