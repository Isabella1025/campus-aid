const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // We'll configure this later for production
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'campusaid-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    httpOnly: true,
    maxAge: parseInt(process.env.SESSION_MAX_AGE) || 86400000 // 24 hours
  }
}));

// Serve static files from frontend
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const user = req.session.user ? `User: ${req.session.user.email}` : 'Unauthenticated';
  console.log(`[${timestamp}] ${req.method} ${req.path} - ${user}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'CampusAid',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ============================================
// API Routes
// ============================================

// Import routers
const sessionRouter = require('./routes/session.router');
const serviceRouter = require('./routes/service.router');
const channelRouter = require('./routes/channel.router');
const botRouter = require('./routes/bot.router');
const fileRouter = require('./routes/file.router');
// const userRouter = require('./routes/user.router');
// const vectorStoreRouter = require('./routes/vectorStore.router');
// const transcriptionRouter = require('./routes/transcription.router');

// Register routes
app.use('/api/session', sessionRouter);
app.use('/api/services', serviceRouter);
app.use('/api/channels', channelRouter);
app.use('/api/bots', botRouter);
app.use('/api/files', fileRouter);
app.use('/api/bots', botRouter);
// app.use('/api/users', userRouter);
// app.use('/api/files', fileRouter);
// app.use('/api/vectorstores', vectorStoreRouter);
// app.use('/api/transcription', transcriptionRouter);

// ============================================
// Authentication Middleware (for protected routes)
// ============================================

const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }
  next();
};

const requireServiceAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== 'service_admin') {
    return res.status(403).json({
      success: false,
      error: 'Service administrator access required'
    });
  }
  next();
};

// Export middleware for use in routes
app.set('requireAuth', requireAuth);
app.set('requireServiceAdmin', requireServiceAdmin);

// ============================================
// Frontend Routes
// ============================================

// Serve frontend pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

app.get('/services', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/services.html'));
});

app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/chat.html'));
});

// ============================================
// Error Handling
// ============================================

// 404 handler - must come before error handler
app.use((req, res, next) => {
  // Check if it's an API request
  if (req.path.startsWith('/api/')) {
    res.status(404).json({
      success: false,
      error: 'API endpoint not found',
      path: req.path
    });
  } else {
    // For non-API requests, send 404 page or redirect to home
    res.status(404).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>404 - Page Not Found</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #f5f5f5;
          }
          .error-container {
            text-align: center;
            padding: 2rem;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          h1 {
            color: #e74c3c;
            font-size: 4rem;
            margin: 0;
          }
          p {
            color: #666;
            font-size: 1.2rem;
          }
          a {
            color: #3498db;
            text-decoration: none;
            font-weight: bold;
          }
          a:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="error-container">
          <h1>404</h1>
          <p>Page not found</p>
          <p><a href="/">Return to CampusAid Home</a></p>
        </div>
      </body>
      </html>
    `);
  }
});

// Global error handler - must be last
app.use((err, req, res, next) => {
  console.error('Error occurred:');
  console.error('Message:', err.message);
  console.error('Stack:', err.stack);
  
  // Don't leak error details in production
  const errorMessage = process.env.NODE_ENV === 'production' 
    ? 'An error occurred processing your request'
    : err.message;
  
  const statusCode = err.status || err.statusCode || 500;
  
  res.status(statusCode).json({
    success: false,
    error: errorMessage,
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      details: err
    })
  });
});

module.exports = app;