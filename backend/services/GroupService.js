const Group = require('../models/Group');
const User = require('../models/User');
const Course = require('../models/Course');

class GroupService {
  // Get all groups for user in current course
  static async getUserGroups(userId, courseId) {
    try {
      const groups = await Group.getUserGroupsInCourse(userId, courseId);
      return {
        success: true,
        data: groups
      };
    } catch (error) {
      console.error('Get user groups error:', error);
      return {
        success: false,
        message: 'Failed to retrieve groups'
      };
    }
  }

  // Create new group
  static async createGroup(groupData, creatorId, courseId) {
    try {
      // Validate inputs
      if (!groupData.group_name || !groupData.group_name.trim()) {
        return {
          success: false,
          message: 'Group name is required'
        };
      }

      // Verify course exists
      const course = await Course.findById(courseId);
      if (!course) {
        return {
          success: false,
          message: 'Invalid course'
        };
      }

      // Verify user is enrolled in course
      const isEnrolled = await Course.isUserEnrolled(creatorId, courseId);
      if (!isEnrolled) {
        return {
          success: false,
          message: 'You are not enrolled in this course'
        };
      }

      // Create group
      const groupId = await Group.create({
        group_name: groupData.group_name.trim(),
        service_id: courseId,
        created_by: creatorId
      });

      // Add creator as first member
      await Group.addMember(groupId, creatorId);

      // Add additional members if provided
      if (groupData.members && Array.isArray(groupData.members)) {
        for (const memberId of groupData.members) {
          if (memberId !== creatorId) {
            // Verify member is enrolled in course
            const memberEnrolled = await Course.isUserEnrolled(memberId, courseId);
            if (memberEnrolled) {
              await Group.addMember(groupId, memberId);
            }
          }
        }
      }

      // Get created group with details
      const group = await Group.findById(groupId);
      const members = await Group.getMembers(groupId);

      return {
        success: true,
        message: 'Group created successfully',
        data: {
          group: group,
          members: members
        }
      };
    } catch (error) {
      console.error('Create group error:', error);
      return {
        success: false,
        message: 'Failed to create group'
      };
    }
  }

  // Get group details
  static async getGroupDetails(groupId, userId) {
    try {
      const group = await Group.findById(groupId);
      if (!group) {
        return {
          success: false,
          message: 'Group not found'
        };
      }

      // Check if user is member
      const isMember = await Group.isMember(groupId, userId);
      if (!isMember) {
        return {
          success: false,
          message: 'You are not a member of this group'
        };
      }

      const members = await Group.getMembers(groupId);

      return {
        success: true,
        data: {
          group: group,
          members: members
        }
      };
    } catch (error) {
      console.error('Get group details error:', error);
      return {
        success: false,
        message: 'Failed to retrieve group details'
      };
    }
  }

  // Add member to group
  static async addMemberToGroup(groupId, userIdToAdd, requesterId) {
    try {
      const group = await Group.findById(groupId);
      if (!group) {
        return {
          success: false,
          message: 'Group not found'
        };
      }

      // Check if requester is member (or service_admin)
      const requesterIsMember = await Group.isMember(groupId, requesterId);
      if (!requesterIsMember) {
        return {
          success: false,
          message: 'You do not have permission to add members'
        };
      }

      // Check if user to add is enrolled in course
      const isEnrolled = await Course.isUserEnrolled(userIdToAdd, group.service_id);
      if (!isEnrolled) {
        return {
          success: false,
          message: 'User is not enrolled in this course'
        };
      }

      // Add member
      await Group.addMember(groupId, userIdToAdd);

      return {
        success: true,
        message: 'Member added successfully'
      };
    } catch (error) {
      console.error('Add member error:', error);
      return {
        success: false,
        message: 'Failed to add member'
      };
    }
  }

  // Remove member from group
  static async removeMemberFromGroup(groupId, userIdToRemove, requesterId) {
    try {
      const group = await Group.findById(groupId);
      if (!group) {
        return {
          success: false,
          message: 'Group not found'
        };
      }

      // Only group creator or the member themselves can remove
      if (group.created_by !== requesterId && userIdToRemove !== requesterId) {
        return {
          success: false,
          message: 'You do not have permission to remove this member'
        };
      }

      await Group.removeMember(groupId, userIdToRemove);

      return {
        success: true,
        message: 'Member removed successfully'
      };
    } catch (error) {
      console.error('Remove member error:', error);
      return {
        success: false,
        message: 'Failed to remove member'
      };
    }
  }

  // Delete group
  static async deleteGroup(groupId, requesterId, userRole) {
    try {
      const group = await Group.findById(groupId);
      if (!group) {
        return {
          success: false,
          message: 'Group not found'
        };
      }

      // Only creator or service_admin can delete
      if (group.created_by !== requesterId && userRole !== 'service_admin') {
        return {
          success: false,
          message: 'You do not have permission to delete this group'
        };
      }

      await Group.delete(groupId);

      return {
        success: true,
        message: 'Group deleted successfully'
      };
    } catch (error) {
      console.error('Delete group error:', error);
      return {
        success: false,
        message: 'Failed to delete group'
      };
    }
  }

  // Get course members (for group creation)
  static async getCourseMembers(courseId, userId) {
    try {
      // Verify user is enrolled
      const isEnrolled = await Course.isUserEnrolled(userId, courseId);
      if (!isEnrolled) {
        return {
          success: false,
          message: 'You are not enrolled in this course'
        };
      }

      const sql = `
        SELECT u.id, u.student_id, u.full_name, u.email, u.role
        FROM users u
        INNER JOIN course_enrollments ce ON u.id = ce.user_id
        WHERE ce.service_id = ? AND u.is_active = TRUE
        ORDER BY u.role DESC, u.full_name ASC
      `;
      
      const { query } = require('../config/database');
      const members = await query(sql, [courseId]);

      return {
        success: true,
        data: members
      };
    } catch (error) {
      console.error('Get course members error:', error);
      return {
        success: false,
        message: 'Failed to retrieve course members'
      };
    }
  }
}

module.exports = GroupService;