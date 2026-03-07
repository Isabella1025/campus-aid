const User = require('../models/User');
const Course = require('../models/Course');

class UserService {
  // Authenticate user with course code and student ID
  static async authenticateUser(courseCode, studentId) {
    try {
      // Validate inputs
      if (!courseCode || !studentId) {
        return {
          success: false,
          message: 'Course code and student ID are required'
        };
      }

      // Check if course exists
      const course = await Course.findByCourseCode(courseCode);
      if (!course) {
        return {
          success: false,
          message: 'Invalid course code'
        };
      }

      // Check if user exists
      const user = await User.findByStudentId(studentId);
      if (!user) {
        return {
          success: false,
          message: 'Invalid student ID'
        };
      }

      // Check if user is enrolled in the course
      const isEnrolled = await Course.isUserEnrolled(user.id, course.id);
      if (!isEnrolled) {
        return {
          success: false,
          message: 'You are not enrolled in this course'
        };
      }

      // Update last login
      await User.updateLastLogin(user.id);

      // Get user's groups in this course
      const groups = await User.getGroupsInCourse(user.id, course.id);

      return {
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            student_id: user.student_id,
            email: user.email,
            full_name: user.full_name,
            role: user.role
          },
          course: {
            id: course.id,
            course_code: course.course_code,
            course_name: course.course_name,
            course_description: course.course_description
          },
          groups: groups
        }
      };
    } catch (error) {
      console.error('Authentication error:', error);
      return {
        success: false,
        message: 'An error occurred during authentication'
      };
    }
  }

  // Get user profile
  static async getUserProfile(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      // Get enrolled services
      const services = await User.getEnrolledservices(userId);

      return {
        success: true,
        data: {
          user: {
            id: user.id,
            student_id: user.student_id,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
            last_login: user.last_login
          },
          services: services
        }
      };
    } catch (error) {
      console.error('Get profile error:', error);
      return {
        success: false,
        message: 'Failed to retrieve user profile'
      };
    }
  }

  // Verify session
  static async verifySession(userId, courseId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return { success: false, message: 'Invalid session' };
      }

      const course = await Course.findById(courseId);
      if (!course) {
        return { success: false, message: 'Invalid course' };
      }

      const isEnrolled = await Course.isUserEnrolled(userId, courseId);
      if (!isEnrolled) {
        return { success: false, message: 'Access denied' };
      }

      return { success: true };
    } catch (error) {
      console.error('Session verification error:', error);
      return { success: false, message: 'Session verification failed' };
    }
  }
}

module.exports = UserService;