/**
 * Authorization Middleware
 * Handles role-based access control and service-specific permissions
 */

/**
 * Check if user is authenticated
 */
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please log in.'
    });
  }
  next();
};

/**
 * Check if user has one of the required roles
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.session.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Insufficient permissions.'
      });
    }

    next();
  };
};

/**
 * Check if user can access a specific service
 * Service admin can access all services
 * Staff can only access their assigned service
 */
const requireServiceAccess = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  const user = req.session.user;
  const serviceId = parseInt(req.params.serviceId || req.query.service_id || req.body.service_id);

  // Service admin can access all services
  if (user.role === 'service_admin' || user.role === 'admin') {
    return next();
  }

  // Staff can only access their assigned service
  if (user.role === 'staff') {
    if (!user.assigned_service_id) {
      return res.status(403).json({
        success: false,
        error: 'No service assigned to your account'
      });
    }

    if (user.assigned_service_id !== serviceId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only manage your assigned service.'
      });
    }

    return next();
  }

  // Students and others don't have service management access
  return res.status(403).json({
    success: false,
    error: 'Access denied. Staff privileges required.'
  });
};

/**
 * Check if user can manage appointments for a service
 */
const requireAppointmentAccess = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  const user = req.session.user;

  // Service admin can manage all appointments
  if (user.role === 'service_admin' || user.role === 'admin') {
    return next();
  }

  // Staff can only manage appointments for their service
  if (user.role === 'staff') {
    if (!user.assigned_service_id) {
      return res.status(403).json({
        success: false,
        error: 'No service assigned to your account'
      });
    }
    // Further filtering will be done in the route handler
    return next();
  }

  return res.status(403).json({
    success: false,
    error: 'Access denied. Staff privileges required.'
  });
};

/**
 * Get user's accessible service IDs
 * Returns array of service IDs the user can access
 */
const getAccessibleServices = (user) => {
  if (!user) return [];

  // Service admin can access all services
  if (user.role === 'service_admin' || user.role === 'admin') {
    return null; // null means all services
  }

  // Staff can only access their assigned service
  if (user.role === 'staff' && user.assigned_service_id) {
    return [user.assigned_service_id];
  }

  // Students have no service management access
  return [];
};

/**
 * Attach accessible services to request object
 */
const attachAccessibleServices = (req, res, next) => {
  if (req.session.user) {
    req.accessibleServices = getAccessibleServices(req.session.user);
  }
  next();
};

module.exports = {
  requireAuth,
  requireRole,
  requireServiceAccess,
  requireAppointmentAccess,
  getAccessibleServices,
  attachAccessibleServices
};
