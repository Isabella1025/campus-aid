const http = require('http');
const app = require('./app');
const { Server } = require('socket.io');
const { testConnection } = require('./config/database');
const { validateApiKey } = require('./config/openai');
const socketHandler = require('./sockets/socketHandler');
require('dotenv').config();

const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || /\.railway\.app$/,
    credentials: true
  }
});

// Initialize Socket.IO handlers
socketHandler(io);

// Make io accessible to routes
app.set('io', io);

// Startup function
const startServer = async () => {
  try {
    console.log('🚀 Starting CampusAid Server...');
    console.log('Environment:', process.env.NODE_ENV || 'development');
    
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('Failed to connect to database. Please check your configuration.');
      process.exit(1);
    }
    
    // Validate OpenAI API key
    const openaiConnected = await validateApiKey();
    if (!openaiConnected) {
      console.warn('Warning: OpenAI API not configured. Bot features will not work.');
    }
    
    // Start server
    server.listen(PORT, () => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`✓ Server running on http://localhost:${PORT}`);
      console.log(`✓ Socket.IO ready for real-time connections`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Press CTRL+C to stop');
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start the server
startServer();