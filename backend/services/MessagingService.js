const Message = require('../models/Message');
const Group = require('../models/Group');

class MessagingService {
  // Send a message
  static async sendMessage(messageData, senderId) {
    try {
      // Validate group exists and user is member
      const group = await Group.findById(messageData.group_id);
      if (!group) {
        return {
          success: false,
          message: 'Group not found'
        };
      }

      const isMember = await Group.isMember(messageData.group_id, senderId);
      if (!isMember) {
        return {
          success: false,
          message: 'You are not a member of this group'
        };
      }

      // Validate message text
      if (!messageData.message_text || !messageData.message_text.trim()) {
        return {
          success: false,
          message: 'Message text is required'
        };
      }

      // Create message
      const messageId = await Message.create({
        group_id: messageData.group_id,
        sender_id: senderId,
        message_text: messageData.message_text.trim(),
        message_type: messageData.message_type || 'text',
        is_bot_message: false
      });

      // Get created message with sender details
      const message = await Message.findById(messageId);

      return {
        success: true,
        data: message
      };
    } catch (error) {
      console.error('Send message error:', error);
      return {
        success: false,
        message: 'Failed to send message'
      };
    }
  }

  // Get message history
  static async getMessageHistory(groupId, userId, limit = 50, offset = 0) {
    try {
      // Verify user is member of group
      const isMember = await Group.isMember(groupId, userId);
      if (!isMember) {
        return {
          success: false,
          message: 'You are not a member of this group'
        };
      }

      const messages = await Message.getByGroup(groupId, limit, offset);
      const totalCount = await Message.getCount(groupId);

      return {
        success: true,
        data: {
          messages: messages,
          total: totalCount,
          limit: limit,
          offset: offset
        }
      };
    } catch (error) {
      console.error('Get message history error:', error);
      return {
        success: false,
        message: 'Failed to retrieve messages'
      };
    }
  }

  // Get recent messages
  static async getRecentMessages(groupId, userId, limit = 50) {
    try {
      const isMember = await Group.isMember(groupId, userId);
      if (!isMember) {
        return {
          success: false,
          message: 'You are not a member of this group'
        };
      }

      const messages = await Message.getRecent(groupId, limit);

      return {
        success: true,
        data: messages
      };
    } catch (error) {
      console.error('Get recent messages error:', error);
      return {
        success: false,
        message: 'Failed to retrieve messages'
      };
    }
  }

  // Search messages
  static async searchMessages(groupId, userId, searchTerm, limit = 50) {
    try {
      const isMember = await Group.isMember(groupId, userId);
      if (!isMember) {
        return {
          success: false,
          message: 'You are not a member of this group'
        };
      }

      const messages = await Message.search(groupId, searchTerm, limit);

      return {
        success: true,
        data: messages
      };
    } catch (error) {
      console.error('Search messages error:', error);
      return {
        success: false,
        message: 'Failed to search messages'
      };
    }
  }

  // Delete message
  static async deleteMessage(messageId, userId, userRole) {
    try {
      const message = await Message.findById(messageId);
      if (!message) {
        return {
          success: false,
          message: 'Message not found'
        };
      }

      // Only sender or service_admin can delete
      if (message.sender_id !== userId && userRole !== 'service_admin') {
        return {
          success: false,
          message: 'You do not have permission to delete this message'
        };
      }

      await Message.delete(messageId);

      return {
        success: true,
        message: 'Message deleted successfully'
      };
    } catch (error) {
      console.error('Delete message error:', error);
      return {
        success: false,
        message: 'Failed to delete message'
      };
    }
  }

  // Load more messages (pagination)
  static async loadMoreMessages(groupId, userId, lastMessageId, limit = 50) {
    try {
      const isMember = await Group.isMember(groupId, userId);
      if (!isMember) {
        return {
          success: false,
          message: 'You are not a member of this group'
        };
      }

      const messages = await Message.getPaginated(groupId, lastMessageId, limit);

      return {
        success: true,
        data: messages
      };
    } catch (error) {
      console.error('Load more messages error:', error);
      return {
        success: false,
        message: 'Failed to load more messages'
      };
    }
  }
}

module.exports = MessagingService;