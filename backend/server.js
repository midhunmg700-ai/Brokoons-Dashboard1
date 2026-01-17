const express = require('express');
const cors = require('cors');
const app = express();

// Fix CORS - Allow all origins for production
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());

// ========================
// MOCK DATA
// ========================
const mockData = {
    tasks: [
        { id: 1, text: "Complete dashboard setup", status: "completed", date: "2026-01-17" },
        { id: 2, text: "Fix login system", status: "pending", date: "2026-01-17" }
    ],
    chats: [
        { id: 1, user: "John", message: "Hello team!", time: "10:30 AM" },
        { id: 2, user: "Sarah", message: "Meeting at 3 PM", time: "11:45 AM" }
    ],
    stats: {
        stock: 156,
        chat: 24,
        team: 8,
        tasks: 12
    }
};

// ========================
// API ENDPOINTS
// ========================
app.get('/api/test', (req, res) => {
    res.json({ 
        status: '✅ Backend Working!',
        time: new Date().toISOString()
    });
});

app.get('/api/tasks', (req, res) => {
    res.json(mockData.tasks);
});

app.get('/api/chats', (req, res) => {
    res.json(mockData.chats);
});

app.get('/api/stats', (req, res) => {
    res.json(mockData.stats);
});

// Login endpoint
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    const TEAM_USERS = {
        "midhun": "1977",
        "akash": "2024", 
        "sajad": "5550",
        "saran": "2244",
        "muhammad": "1415"
    };
    
    if (TEAM_USERS[username] && TEAM_USERS[username] === password) {
        res.json({
            success: true,
            user: {
                name: username,
                role: username === 'midhun' ? 'admin' : 'user'
            },
            token: 'mock-jwt-token-12345'
        });
    } else {
        res.status(401).json({ 
            success: false, 
            message: 'Invalid credentials' 
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        time: new Date().toISOString()
    });
});

// Root
app.get('/', (req, res) => {
    res.json({
        message: 'Brokoons Backend API',
        endpoints: ['/api/test', '/api/login', '/health']
    });
});

// ========================
// START SERVER
// ========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    
    // Keep-alive ping
    const fetch = require('node-fetch');
    
    // Initial ping
    fetch('https://brokoons-backend.onrender.com/api/test')
        .then(() => console.log('✅ Keep-alive ping sent'))
        .catch(err => console.log('⚠️ Ping failed:', err.message));
    
    // Regular pings
    setInterval(() => {
        fetch('https://brokoons-backend.onrender.com/api/test')
            .then(() => console.log('🔄 Keep-alive ping'))
            .catch(err => console.log('⚠️ Ping failed:', err.message));
    }, 300000);
});
