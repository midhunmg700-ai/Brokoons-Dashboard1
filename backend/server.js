const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();

// ========================
// MIDDLEWARE
// ========================
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// ========================
// USERS
// ========================
const TEAM_USERS = {
    midhun: "1977",
    akash: "2024",
    sajad: "5550",
    saran: "2244",
    muhammad: "1415"
};

// ========================
// SHARED DATA (FOR EVERYONE)
// ========================
let stockItems = [];

// ========================
// ROUTES
// ========================
app.get('/api/test', (req, res) => {
    res.json({
        status: '✅ Backend Working!',
        time: new Date().toISOString()
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (TEAM_USERS[username] && TEAM_USERS[username] === password) {
        res.json({
            success: true,
            user: {
                name: username,
                role: username === 'midhun' ? 'admin' : 'user'
            }
        });
    } else {
        res.status(401).json({
            success: false,
            message: 'Invalid credentials'
        });
    }
});

// ===== STOCK (SHARED) =====
app.get('/api/stock', (req, res) => {
    res.json(stockItems);
});

app.post('/api/stock', (req, res) => {
    const item = {
        ...req.body,
        lastUpdated: new Date().toISOString()
    };
    stockItems.unshift(item);
    res.json({ success: true, stockItems });
});

app.put('/api/stock/:name', (req, res) => {
    const { name } = req.params;
    const { quantity, status } = req.body;

    const item = stockItems.find(i => i.name === name);
    if (item) {
        item.quantity = quantity;
        item.status = status;
        item.lastUpdated = new Date().toISOString();
    }

    res.json({ success: true, stockItems });
});

app.delete('/api/stock/:name', (req, res) => {
    stockItems = stockItems.filter(i => i.name !== req.params.name);
    res.json({ success: true, stockItems });
});

// ========================
// START SERVER
// ========================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);

    setInterval(() => {
        fetch('https://brokoons-backend-11yn.onrender.com/api/test')
            .then(() => console.log('🔄 Keep-alive ping'))
            .catch(() => {});
    }, 300000);
});
