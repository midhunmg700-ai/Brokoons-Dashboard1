const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// ========================
// USERS (LOGIN)
// ========================
const USERS = {
    midhun: "1977",
    akash: "2024",
    sajad: "5550",
    saran: "2244",
    muhammad: "1415"
};

// ========================
// MIDDLEWARE
// ========================
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ========================
// MONGODB
// ========================
let client, db;
let stockCollection,
    chatCollection,
    photosCollection,
    tasksCollection,
    qualityCollection,
    presenceCollection;

async function connectToMongoDB() {
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
        console.error('❌ MONGODB_URI missing');
        process.exit(1);
    }

    try {
        client = new MongoClient(MONGODB_URI);
        await client.connect();

        db = client.db('brokoons');

        stockCollection = db.collection('stock');
        chatCollection = db.collection('chat');
        photosCollection = db.collection('photos');
        tasksCollection = db.collection('tasks');
        qualityCollection = db.collection('quality');
        presenceCollection = db.collection('user_presence');

        await chatCollection.createIndex({ timestamp: 1 });
        await presenceCollection.createIndex({ lastSeen: 1 });

        console.log('✅ MongoDB connected successfully');
    } catch (err) {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1);
    }
}

// ========================
// KEEP ALIVE (RENDER)
// ========================
setInterval(() => {
    if (process.env.RENDER_EXTERNAL_URL) {
        fetch(`${process.env.RENDER_EXTERNAL_URL}/api/test`).catch(() => {});
    }
}, 300000);

// ========================
// ROUTES
// ========================
app.get('/api/test', (req, res) => {
    res.json({
        status: 'OK',
        time: new Date().toISOString(),
        database: db ? 'connected' : 'disconnected'
    });
});

// ===== LOGIN =====
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = username?.toLowerCase();

    if (USERS[user] && USERS[user] === password) {
        res.json({
            success: true,
            user: {
                name: user,
                role: user === 'midhun' ? 'admin' : 'user'
            }
        });
    } else {
        res.status(401).json({ success: false });
    }
});

// ===== USER PRESENCE =====
app.post('/api/presence/ping', async (req, res) => {
    const { username } = req.body;
    if (!username) return res.sendStatus(400);

    await presenceCollection.updateOne(
        { username },
        { $set: { lastSeen: Date.now() } },
        { upsert: true }
    );

    res.sendStatus(200);
});

app.get('/api/presence/online', async (req, res) => {
    const since = Date.now() - 30000; // 30 sec
    const users = await presenceCollection
        .find({ lastSeen: { $gte: since } })
        .project({ _id: 0, username: 1 })
        .toArray();

    res.json(users.map(u => u.username));
});

// ===== STOCK =====
app.get('/api/stock', async (req, res) => {
    res.json(await stockCollection.find({}).toArray());
});

app.post('/api/stock', async (req, res) => {
    await stockCollection.insertOne({
        ...req.body,
        lastUpdated: new Date().toISOString()
    });
    res.json({ success: true });
});

app.put('/api/stock/:name', async (req, res) => {
    await stockCollection.updateOne(
        { name: req.params.name },
        { $set: { ...req.body, lastUpdated: new Date().toISOString() } }
    );
    res.json({ success: true });
});

app.delete('/api/stock/:name', async (req, res) => {
    await stockCollection.deleteOne({ name: req.params.name });
    res.json({ success: true });
});

// ===== CHAT =====
app.get('/api/chat', async (req, res) => {
    const messages = await chatCollection
        .find({})
        .sort({ timestamp: 1 })
        .toArray();
    res.json(messages);
});

app.post('/api/chat', async (req, res) => {
    const { sender, senderId, text } = req.body;
    if (!sender || !senderId || !text) {
        return res.status(400).json({ success: false });
    }

    await chatCollection.insertOne({
        sender,
        senderId,
        text,
        timestamp: Date.now()
    });

    res.json({ success: true });
});

// ===== PHOTOS =====
app.get('/api/photos', async (req, res) => {
    res.json(
        await photosCollection.find({}).sort({ timestamp: -1 }).toArray()
    );
});

app.post('/api/photos', async (req, res) => {
    await photosCollection.insertOne({
        ...req.body,
        timestamp: Date.now()
    });
    res.json({ success: true });
});

app.delete('/api/photos/:id', async (req, res) => {
    await photosCollection.deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true });
});

// ===== TASKS =====
app.get('/api/tasks', async (req, res) => {
    res.json(await tasksCollection.find({}).toArray());
});

app.post('/api/tasks', async (req, res) => {
    await tasksCollection.insertOne({
        ...req.body,
        createdAt: new Date().toISOString()
    });
    res.json({ success: true });
});

app.put('/api/tasks/:id', async (req, res) => {
    await tasksCollection.updateOne(
