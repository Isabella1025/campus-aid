const express = require('express');
const router = express.Router();
const Service = require('../models/Service');

/**
 * Service Router
 * Handles routes for managing student services (Career Services, Academic Advising, ODIP)
 */

/**
 * @route   GET /api/services
 * @desc    Get all active services
 * @access  Public (all authenticated users)
 */
router.get('/', async (req, res) => {
  try {
    const services = await Service.getAll();
    
    res.json({
      success: true,
      data: services,
      count: services.length
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch services'
    });
  }
});

/**
 * @route   GET /api/services/:id
 * @desc    Get service by ID with details
 * @access  Public (all authenticated users)
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const service = await Service.getById(id);
    
    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Service not found'
      });
    }
    
    res.json({
      success: true,
      data: service
    });
  } catch (error) {
    console.error('Error fetching service:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch service'
    });
  }
});

/**
 * @route   GET /api/services/code/:serviceCode
 * @desc    Get service by service code (CAREER, ADVISING, ODIP)
 * @access  Public (all authenticated users)
 */
router.get('/code/:serviceCode', async (req, res) => {
  try {
    const { serviceCode } = req.params;
    const service = await Service.getByCode(serviceCode.toUpperCase());
    
    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Service not found'
      });
    }
    
    res.json({
      success: true,
      data: service
    });
  } catch (error) {
    console.error('Error fetching service by code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch service'
    });
  }
});

/**
 * @route   GET /api/services/:id/statistics
 * @desc    Get service statistics (channels, bots, messages, files)
 * @access  Service Admin only
 */
router.get('/:id/statistics', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user is admin of this service
    if (req.session.user.role !== 'service_admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Service administrators only.'
      });
    }
    
    const isAdmin = await Service.isAdmin(id, req.session.user.id);
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to view this service statistics'
      });
    }
    
    const statistics = await Service.getStatistics(id);
    
    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Error fetching service statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

/**
 * @route   GET /api/services/admin/my-services
 * @desc    Get services administered by the logged-in user
 * @access  Service Admin only
 */
router.get('/admin/my-services', async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'service_admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Service administrators only.'
      });
    }
    
    const services = await Service.getByAdmin(req.session.user.id);
    
    res.json({
      success: true,
      data: services,
      count: services.length
    });
  } catch (error) {
    console.error('Error fetching admin services:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch services'
    });
  }
});

/**
 * @route   POST /api/services
 * @desc    Create a new service
 * @access  Service Admin only (superadmin in production)
 */
router.post('/', async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'service_admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Service administrators only.'
      });
    }
    
    const { service_code, service_name, service_description } = req.body;
    
    // Validation
    if (!service_code || !service_name) {
      return res.status(400).json({
        success: false,
        error: 'Service code and name are required'
      });
    }
    
    // Check if service code already exists
    const existing = await Service.getByCode(service_code);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Service with this code already exists'
      });
    }
    
    const serviceId = await Service.create({
      service_code: service_code.toUpperCase(),
      service_name,
      service_description,
      admin_id: req.session.user.id
    });
    
    const newService = await Service.getById(serviceId);
    
    res.status(201).json({
      success: true,
      message: 'Service created successfully',
      data: newService
    });
  } catch (error) {
    console.error('Error creating service:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create service'
    });
  }
});

/**
 * @route   PUT /api/services/:id
 * @desc    Update service information
 * @access  Service Admin only (must be admin of the service)
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.session.user || req.session.user.role !== 'service_admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Service administrators only.'
      });
    }
    
    // Check if user is admin of this service
    const isAdmin = await Service.isAdmin(id, req.session.user.id);
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to update this service'
      });
    }
    
    const { service_name, service_description, admin_id } = req.body;
    
    const updated = await Service.update(id, {
      service_name,
      service_description,
      admin_id: admin_id || req.session.user.id
    });
    
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Service not found'
      });
    }
    
    const updatedService = await Service.getById(id);
    
    res.json({
      success: true,
      message: 'Service updated successfully',
      data: updatedService
    });
  } catch (error) {
    console.error('Error updating service:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update service'
    });
  }
});

/**
 * @route   DELETE /api/services/:id
 * @desc    Deactivate a service
 * @access  Service Admin only (must be admin of the service)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.session.user || req.session.user.role !== 'service_admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Service administrators only.'
      });
    }
    
    // Check if user is admin of this service
    const isAdmin = await Service.isAdmin(id, req.session.user.id);
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to deactivate this service'
      });
    }
    
    const deactivated = await Service.deactivate(id);
    
    if (!deactivated) {
      return res.status(404).json({
        success: false,
        error: 'Service not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Service deactivated successfully'
    });
  } catch (error) {
    console.error('Error deactivating service:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate service'
    });
  }
});

module.exports = router;