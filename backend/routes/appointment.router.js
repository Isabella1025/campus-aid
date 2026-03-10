const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const { query } = require('../config/database');
const { requireAuth, requireRole, requireAppointmentAccess } = require('../middleware/permission.middleware');

/**
 * @route   GET /api/appointments/staff/:serviceId
 * @desc    Get staff members for a service
 * @access  Public
 */
router.get('/staff/:serviceId', async (req, res) => {
  try {
    const { serviceId } = req.params;

    const staff = await query(
      `SELECT 
        ss.id,
        ss.staff_role,
        u.id as staff_id,
        u.full_name,
        u.email
      FROM service_staff ss
      LEFT JOIN users u ON ss.staff_id = u.id
      WHERE ss.service_id = ? AND ss.is_active = TRUE
      ORDER BY u.full_name`,
      [serviceId]
    );

    res.json({
      success: true,
      data: staff
    });

  } catch (error) {
    console.error('Error fetching service staff:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch service staff'
    });
  }
});

/**
 * @route   GET /api/appointments/my-assigned
 * @desc    Get appointments assigned to current staff member
 * @access  Staff
 */
router.get('/my-assigned', requireAuth, requireRole('staff', 'service_admin', 'admin'), async (req, res) => {
  try {
    const { status } = req.query;
    const appointments = await Appointment.getByAssignedStaff(req.session.user.id, status);

    res.json({
      success: true,
      data: appointments
    });

  } catch (error) {
    console.error('Error fetching assigned appointments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch appointments'
    });
  }
});

/**
 * @route   POST /api/appointments
 * @desc    Create a new appointment request
 * @access  Student
 */
router.post('/', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { service_id, appointment_date, appointment_time, reason, duration_minutes } = req.body;

    // Validation
    if (!service_id || !appointment_date || !appointment_time) {
      return res.status(400).json({
        success: false,
        error: 'Service, date, and time are required'
      });
    }

    // Check for conflicts
    const hasConflict = await Appointment.checkConflict(service_id, appointment_date, appointment_time);
    
    if (hasConflict) {
      return res.status(409).json({
        success: false,
        error: 'This time slot is already booked. Please choose another time.'
      });
    }

    // Create appointment
    const appointmentId = await Appointment.create({
      student_id: req.session.user.id,
      service_id,
      appointment_date,
      appointment_time,
      reason,
      duration_minutes
    });

    const appointment = await Appointment.getById(appointmentId);

    res.json({
      success: true,
      message: 'Appointment request submitted successfully',
      data: appointment
    });

  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create appointment'
    });
  }
});

/**
 * @route   GET /api/appointments/my
 * @desc    Get current user's appointments
 * @access  Student
 */
router.get('/my', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const appointments = await Appointment.getByStudent(req.session.user.id);

    res.json({
      success: true,
      data: appointments
    });

  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch appointments'
    });
  }
});

/**
 * @route   GET /api/appointments/service/:serviceId
 * @desc    Get appointments for a service (staff only)
 * @access  Staff/Admin
 */
router.get('/service/:serviceId', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Check if user is staff/admin
    if (!['lecturer', 'admin', 'service_admin'].includes(req.session.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Staff only.'
      });
    }

    const { serviceId } = req.params;
    const { status } = req.query;

    const appointments = await Appointment.getByService(serviceId, status);

    res.json({
      success: true,
      data: appointments
    });

  } catch (error) {
    console.error('Error fetching service appointments:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch appointments'
    });
  }
});

/**
 * @route   GET /api/appointments/:id
 * @desc    Get appointment details
 * @access  Authenticated
 */
router.get('/:id', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const appointment = await Appointment.getById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    // Check authorization
    const isStudent = appointment.student_id === req.session.user.id;
    const isStaff = ['lecturer', 'admin', 'service_admin'].includes(req.session.user.role);

    if (!isStudent && !isStaff) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: appointment
    });

  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch appointment'
    });
  }
});

/**
 * @route   PUT /api/appointments/:id/status
 * @desc    Update appointment status (approve/decline)
 * @access  Staff/Admin
 */
router.put('/:id/status', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Check if user is staff/admin
    if (!['lecturer', 'admin', 'service_admin'].includes(req.session.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Staff only.'
      });
    }

    const { status, notes } = req.body;

    if (!['approved', 'declined', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    const appointment = await Appointment.updateStatus(
      req.params.id,
      status,
      req.session.user.id,
      notes
    );

    res.json({
      success: true,
      message: `Appointment ${status} successfully`,
      data: appointment
    });

  } catch (error) {
    console.error('Error updating appointment status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update appointment'
    });
  }
});

/**
 * @route   PUT /api/appointments/:id/reschedule
 * @desc    Reschedule appointment
 * @access  Student or Staff
 */
router.put('/:id/reschedule', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const { appointment_date, appointment_time } = req.body;

    if (!appointment_date || !appointment_time) {
      return res.status(400).json({
        success: false,
        error: 'Date and time are required'
      });
    }

    const existing = await Appointment.getById(req.params.id);
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    // Check for conflicts
    const hasConflict = await Appointment.checkConflict(
      existing.service_id,
      appointment_date,
      appointment_time,
      req.params.id
    );

    if (hasConflict) {
      return res.status(409).json({
        success: false,
        error: 'This time slot is already booked'
      });
    }

    const appointment = await Appointment.updateDateTime(
      req.params.id,
      appointment_date,
      appointment_time
    );

    res.json({
      success: true,
      message: 'Appointment rescheduled successfully',
      data: appointment
    });

  } catch (error) {
    console.error('Error rescheduling appointment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reschedule appointment'
    });
  }
});

/**
 * @route   DELETE /api/appointments/:id
 * @desc    Cancel appointment
 * @access  Student (owner) or Staff
 */
router.delete('/:id', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const appointment = await Appointment.getById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }

    // Check authorization
    const isStudent = appointment.student_id === req.session.user.id;
    const isStaff = ['lecturer', 'admin', 'service_admin'].includes(req.session.user.role);

    if (!isStudent && !isStaff) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    await Appointment.cancel(req.params.id);

    res.json({
      success: true,
      message: 'Appointment cancelled successfully'
    });

  } catch (error) {
    console.error('Error cancelling appointment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel appointment'
    });
  }
});

module.exports = router;
