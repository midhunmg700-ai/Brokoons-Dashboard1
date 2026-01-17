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

// Login endpoint
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === 'midhun' && password === '1977') {
        res.json({
            success: true,
            user: { id: 1, name: 'midhun', role: 'admin' },
            token: 'mock-jwt-token-12345'
        });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
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
});