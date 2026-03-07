# Cobot - AI-Powered Academic Collaboration Platform

An intelligent academic collaboration platform that enables service_admins to create course-specific AI bots trained on course materials, facilitating real-time student-bot-service_admin interactions.

## 🎯 Project Overview

**Student:** Isabella Tsikata  
**Supervisor:** Dennis Owusu  
**Institution:** Ashesi University

Cobot addresses the gap in personalized, course-aware AI support for higher education. Unlike generic AI tools, Cobot allows service_admins to train AI bots specifically on their course content, providing students with accurate, contextual assistance 24/7.

## ✨ Key Features

- **Course-Specific AI Bots**: service_admins create and train bots on their course materials
- **Real-Time Communication**: Instant messaging powered by Socket.IO
- **Document Upload & Processing**: Support for PDF, DOCX, PPTX, and TXT files
- **Vector Store Integration**: Semantic search using OpenAI embeddings
- **Group Chat Management**: Organize discussions by course and topic
- **Voice Interaction**: Speech-to-text for audio messages (coming soon)
- **Role-Based Access**: Separate permissions for students and service_admins

## 🛠️ Technology Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MySQL
- **Real-Time**: Socket.IO
- **AI/ML**: OpenAI GPT-4 & Embeddings API

### Frontend
- **Languages**: HTML5, CSS3, JavaScript
- **Styling**: Custom CSS (responsive design)
- **Real-Time**: Socket.IO Client

### Security & Tools
- Helmet.js for security headers
- Express Rate Limiting
- CORS protection
- Session management
- Input validation

## 📋 Prerequisites

- Node.js (v16+)
- MySQL (v8.0+)
- OpenAI API Key
- Modern web browser

## 🚀 Quick Start

1. **Clone the repository**
```bash
git clone <repository-url>
cd cobot-project
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your credentials
```

4. **Create database**
```bash
mysql -u root -p < database/migrations/initial_schema.sql
```

5. **Start the server**
```bash
npm run dev
```

6. **Access the application**
```
http://localhost:3000
```

For detailed setup instructions, see [SETUP.md](SETUP.md)

## 📁 Project Structure

```
cobot-project/
├── backend/              # Server-side code
│   ├── config/          # Database & API configuration
│   ├── routes/          # API endpoints
│   ├── services/        # Business logic
│   ├── sockets/         # Socket.IO handlers
│   ├── middleware/      # Authentication & validation
│   └── models/          # Data models
├── frontend/            # Client-side code
│   └── public/          # Static files (HTML, CSS, JS)
├── database/            # SQL migrations & seeds
├── uploads/             # User-uploaded files
└── logs/                # Application logs
```

## 🎓 Academic Context

This project is part of a capstone research study investigating how personalized AI bots can improve collaboration between students and service_admins in higher education. The research addresses:

1. How personalized AI bots enhance academic cooperation
2. Impact of real-time communication on student engagement
3. Performance and usability trade-offs of AI-based chat systems
4. User perception of course-specific bot utility and trustworthiness

## 📅 Development Timeline

- **Week 1**: Foundation & Core Infrastructure
- **Week 2**: Real-Time Chat & File Management
- **Week 3**: AI Intelligence & Vector Stores
- **Week 4**: Polish, Testing & Documentation

Current Status: **Week 1 - Foundation Complete** ✓

## 🔒 Security Features

- Session-based authentication
- Role-based access control
- Input validation and sanitization
- Rate limiting on API endpoints
- Secure file upload validation
- HTTPS ready for production

## 🧪 Testing

```bash
# Run tests
npm test

# Run in development mode with auto-reload
npm run dev
```

## 📖 Documentation

- [Setup Guide](SETUP.md) - Detailed installation instructions
- [API Documentation](docs/API.md) - Coming soon
- [User Guide](docs/USER_GUIDE.md) - Coming soon

## 🤝 Contributing

This is an academic capstone project. While contributions are not currently accepted, feedback and suggestions are welcome.

## 📄 License

This project is developed as part of an academic capstone at Ashesi University.

## 📧 Contact

**Isabella Tsikata**  
Email: isabella.tsikata@ashesi.edu.gh

**Supervisor: Dennis Owusu**  
Ashesi University

## 🙏 Acknowledgments

- Ashesi University for providing resources and support
- OpenAI for GPT-4 and Embeddings API
- Socket.IO community for real-time communication tools

---

**Note**: This project is currently in active development as part of a capstone research study.