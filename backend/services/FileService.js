const File = require('../models/File');
const Message = require('../models/Message');
const Group = require('../models/Group');
const Course = require('../models/Course');
const { deleteFile } = require('../middleware/upload.middleware');

class FileService {
  // Upload file
  static async uploadFile(fileData, uploaderId, courseId, groupId = null) {
    try {
      // Verify user is enrolled in course
      const isEnrolled = await Course.isUserEnrolled(uploaderId, courseId);
      if (!isEnrolled) {
        // Delete uploaded file if not authorized
        if (fileData.path) {
          deleteFile(fileData.path);
        }
        return {
          success: false,
          message: 'You are not enrolled in this course'
        };
      }

      // If group specified, verify user is member
      if (groupId) {
        const isMember = await Group.isMember(groupId, uploaderId);
        if (!isMember) {
          if (fileData.path) {
            deleteFile(fileData.path);
          }
          return {
            success: false,
            message: 'You are not a member of this group'
          };
        }
      }

      // Create file record
      const fileId = await File.create({
        file_name: fileData.filename,
        original_name: fileData.originalname,
        file_path: fileData.path,
        file_type: fileData.mimetype,
        file_size: fileData.size,
        uploaded_by: uploaderId,
        service_id: courseId,
        group_id: groupId
      });

      // Get created file with details
      const file = await File.findById(fileId);

      return {
        success: true,
        message: 'File uploaded successfully',
        data: file
      };
    } catch (error) {
      console.error('Upload file error:', error);
      // Cleanup file if error
      if (fileData.path) {
        deleteFile(fileData.path);
      }
      return {
        success: false,
        message: 'Failed to upload file'
      };
    }
  }

  // Share file in chat (create message with file)
  static async shareFileInChat(fileData, uploaderId, groupId) {
    try {
      // Verify user is member
      const isMember = await Group.isMember(groupId, uploaderId);
      if (!isMember) {
        if (fileData.path) {
          deleteFile(fileData.path);
        }
        return {
          success: false,
          message: 'You are not a member of this group'
        };
      }

      // Get group to find course
      const group = await Group.findById(groupId);
      if (!group) {
        if (fileData.path) {
          deleteFile(fileData.path);
        }
        return {
          success: false,
          message: 'Group not found'
        };
      }

      // Create message
      const messageId = await Message.create({
        group_id: groupId,
        sender_id: uploaderId,
        message_text: `Shared a file: ${fileData.originalname}`,
        message_type: 'file',
        is_bot_message: false
      });

      // Create file record linked to message
      const fileId = await File.create({
        file_name: fileData.filename,
        original_name: fileData.originalname,
        file_path: fileData.path,
        file_type: fileData.mimetype,
        file_size: fileData.size,
        uploaded_by: uploaderId,
        service_id: group.service_id,
        group_id: groupId,
        message_id: messageId
      });

      // Get created message with file
      const message = await Message.findById(messageId);
      const file = await File.findById(fileId);

      return {
        success: true,
        message: 'File shared successfully',
        data: {
          message: message,
          file: file
        }
      };
    } catch (error) {
      console.error('Share file error:', error);
      if (fileData.path) {
        deleteFile(fileData.path);
      }
      return {
        success: false,
        message: 'Failed to share file'
      };
    }
  }

  // Get file details
  static async getFileDetails(fileId, userId) {
    try {
      const file = await File.findById(fileId);
      if (!file) {
        return {
          success: false,
          message: 'File not found'
        };
      }

      // Verify user has access (enrolled in course)
      const isEnrolled = await Course.isUserEnrolled(userId, file.service_id);
      if (!isEnrolled) {
        return {
          success: false,
          message: 'You do not have access to this file'
        };
      }

      return {
        success: true,
        data: file
      };
    } catch (error) {
      console.error('Get file details error:', error);
      return {
        success: false,
        message: 'Failed to retrieve file details'
      };
    }
  }

  // Get files for a group
  static async getGroupFiles(groupId, userId) {
    try {
      // Verify user is member
      const isMember = await Group.isMember(groupId, userId);
      if (!isMember) {
        return {
          success: false,
          message: 'You are not a member of this group'
        };
      }

      const files = await File.getByGroup(groupId);

      return {
        success: true,
        data: files
      };
    } catch (error) {
      console.error('Get group files error:', error);
      return {
        success: false,
        message: 'Failed to retrieve files'
      };
    }
  }

  // Delete file
  static async deleteFile(fileId, userId, userRole) {
    try {
      const file = await File.findById(fileId);
      if (!file) {
        return {
          success: false,
          message: 'File not found'
        };
      }

      // Only uploader or service_admin can delete
      if (file.uploaded_by !== userId && userRole !== 'service_admin') {
        return {
          success: false,
          message: 'You do not have permission to delete this file'
        };
      }

      // Delete physical file
      const deleted = deleteFile(file.file_path);
      if (!deleted) {
        console.warn('Physical file not found or already deleted:', file.file_path);
      }

      // Delete database record
      await File.delete(fileId);

      return {
        success: true,
        message: 'File deleted successfully'
      };
    } catch (error) {
      console.error('Delete file error:', error);
      return {
        success: false,
        message: 'Failed to delete file'
      };
    }
  }

  // Get user's upload statistics
  static async getUserStats(userId) {
    try {
      const totalSize = await File.getUserTotalSize(userId);
      const fileCount = await File.getUserFileCount(userId);

      return {
        success: true,
        data: {
          totalFiles: fileCount,
          totalSize: totalSize,
          totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2)
        }
      };
    } catch (error) {
      console.error('Get user stats error:', error);
      return {
        success: false,
        message: 'Failed to retrieve statistics'
      };
    }
  }
}

module.exports = FileService;