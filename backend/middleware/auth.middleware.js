const UserService = require('../services/UserService');

// Check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({
    success: false,
    message: 'Authentication required'
  });
};

// Check if user is a service_admin
const isservice_admin = (req, res, next) => {
  if (req.session && req.session.userRole === 'service_admin') {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'service_admin access required'
  });
};

// Check if user is a student
const isStudent = (req, res, next) => {
  if (req.session && req.session.userRole === 'student') {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Student access required'
  });
};

// Verify user has access to specific course
const hasCourseAccess = async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const courseId = req.params.courseId || req.body.courseId || req.query.courseId;

    if (!userId || !courseId) {
      return res.status(400).json({
        success: false,
        message: 'User ID and Course ID are required'
      });
    }

    const verification = await UserService.verifySession(userId, courseId);
    if (!verification.success) {
      return res.status(403).json({
        success: false,
        message: verification.message || 'Access denied'
      });
    }

    next();
  } catch (error) {
    console.error('Course access verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify course access'
    });
  }
};

// Attach user info to request
const attachUserInfo = (req, res, next) => {
  if (req.session && req.session.userId) {
    req.user = {
      id: req.session.userId,
      role: req.session.userRole,
      studentId: req.session.studentId
    };
  }
  next();
};

module.exports = {
  isAuthenticated,
  isservice_admin,
  isStudent,
  hasCourseAccess,
  attachUserInfo
};