const express = require('express');
const cors = require('cors');
const app = express();

// Fix CORS - Allow all origins for production
app.use(cors({
    origin: '*',  // Allow all origins in production
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());

// ========================
// MOCK DATA - NO FIRESTORE
// ========================
const mockData = {
    tasks: [
        { id: 1, text: "Complete dashboard setup", status: "completed", date: "2026-01-17" },
        { id: 2, text: "Fix login system", status: "pending", date: "2026-01-17" },
        { id: 3, text: "Add user profiles", status: "pending", date: "2026-01-16" }
    ],
    chats: [
        { id: 1, user: "John", message: "Hello team!", time: "10:30 AM" },
        { id: 2, user: "Sarah", message: "Meeting at 3 PM", time: "11:45 AM" }
    ],
    photos: [
        { id: 1, url: "https://picsum.photos/200/300", title: "Product Shot 1" },
        { id: 2, url: "https://picsum.photos/200/301", title: "Product Shot 2" }
    ],
    stats: {
        stock: 156,
        chat: 24,
        team: 8,
        tasks: 12
    },
    users: [
        { id: 1, name: "midhun", role: "admin" },
        { id: 2, name: "alex", role: "manager" }
    ]
};

// ========================
// API ENDPOINTS
// ========================
app.get('/api/test', (req, res) => {
    res.json({ 
        status: '✅ Server is WORKING!', 
        message: 'Firestore disabled - Using mock data',
        time: new Date().toISOString()
    });
});

app.get('/api/tasks', (req, res) => {
    console.log('📋 Tasks served (mock data)');
    res.json(mockData.tasks);
});

app.get('/api/chats', (req, res) => {
    console.log('💬 Chats served (mock data)');
    res.json(mockData.chats);
});

app.get('/api/photos', (req, res) => {
    console.log('📸 Photos served (mock data)');
    res.json(mockData.photos);
});

app.get('/api/stats', (req, res) => {
    console.log('📊 Stats served (mock data)');
    res.json(mockData.stats);
});

// Login endpoint - ALL TEAM MEMBERS
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    // Team credentials (same as frontend)
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
                id: 1,
                name: username,
                role: username === 'midhun' ? 'admin' : 'user'
            },
            token: 'mock-jwt-token-12345'
        });
    } else {
        res.status(401).json({ 
            success: false, 
            message: 'Invalid credentials. Try: midhun/1977, akash/2024, etc.' 
        });
    }
});

// Health check (REQUIRED for Render)
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        server: 'Brokoons Backend',
        version: '1.0.0',
        data: 'Using mock data - No Firestore required',
        time: new Date().toISOString()
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'Brokoons Backend API',
        endpoints: {
            test: '/api/test',
            tasks: '/api/tasks',
            stats: '/api/stats',
            chats: '/api/chats',
            photos: '/api/photos',
            login: '/api/login (POST)',
            health: '/health'
        }
    });
});

// ========================
// START SERVER
// ========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('============================================================');
    console.log('🚀 BROKOONS BACKEND SERVER STARTED (MOCK DATA VERSION)');
    console.log('============================================================');
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`✅ Test: http://localhost:${PORT}/api/test`);
    console.log(`💬 Chats: http://localhost:${PORT}/api/chats`);
    console.log(`✅ Tasks: http://localhost:${PORT}/api/tasks`);
    console.log(`❤️  Health: http://localhost:${PORT}/health`);
    console.log('============================================================');
    console.log('🔥 NO FIRESTORE REQUIRED - Using mock data');
    console.log('🔥 READY FOR RENDER DEPLOYMENT');
    console.log('============================================================');
    
    // ====================================
    // KEEP-ALIVE PING - STARTS AFTER SERVER
    // ====================================
    const fetch = require('node-fetch');
    
    // Ping immediately to wake up
    fetch('https://brokoons-backend.onrender.com/api/test')
        .then(() => console.log('✅ Initial keep-alive ping successful'))
        .catch(err => console.log('⚠️ Initial ping failed (normal on first start):', err.message));
    
    // Schedule regular pings
    setInterval(() => {
        fetch('https://brokoons-backend.onrender.com/api/test')
            .then(() => console.log('🔄 Keep-alive ping successful'))
            .catch(err => console.log('⚠️ Keep-alive ping failed:', err.message));
    }, 300000); // Every 5 minutes
});
