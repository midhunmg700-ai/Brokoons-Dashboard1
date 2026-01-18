const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// Hardcoded users
const USERS = {
    midhun: "1977",
    akash: "2024",
    sajad: "5550",
    saran: "2244",
    muhammad: "1415"
};

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB connection
let db, client;
let stockCollection, chatCollection, photosCollection, tasksCollection, qualityCollection;

async function connectToMongoDB() {
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
        console.error('❌ MONGODB_URI is not defined in environment variables');
        process.exit(1);
    }

    try {
        client = new MongoClient(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        await client.connect();
        db = client.db('brokoons');
        
        // Initialize collections
        stockCollection = db.collection('stock');
        chatCollection = db.collection('chat');
        photosCollection = db.collection('photos');
        tasksCollection = db.collection('tasks');
        qualityCollection = db.collection('quality');
        
        // Create indexes
        await chatCollection.createIndex({ timestamp: -1 });
        await photosCollection.createIndex({ timestamp: -1 });
        await tasksCollection.createIndex({ completed: 1, createdAt: -1 });
        await qualityCollection.createIndex({ timestamp: -1 });
        
        console.log('✅ MongoDB connected successfully');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
}

// Keep-alive function
async function keepAlive() {
    if (process.env.RENDER_EXTERNAL_URL) {
        try {
            await fetch(`${process.env.RENDER_EXTERNAL_URL}/api/test`);
            console.log('🔄 Keep-alive ping sent');
        } catch (error) {
            console.log('⚠️ Keep-alive ping failed');
        }
    }
}

// Start keep-alive interval
setInterval(keepAlive, 5 * 60 * 1000);

// ========== API ROUTES ==========

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({
        status: 'OK',
        time: new Date().toISOString(),
        database: db ? 'connected' : 'disconnected'
    });
});

// Login endpoint
app.post('/api/login', (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }
        
        const lowerUsername = username.toLowerCase();
        
        if (USERS[lowerUsername] && USERS[lowerUsername] === password) {
            return res.json({
                success: true,
                user: {
                    name: lowerUsername,
                    role: lowerUsername === 'midhun' ? 'admin' : 'user'
                }
            });
        }
        
        res.status(401).json({
            success: false,
            message: 'Invalid username or password'
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// ========== STOCK ROUTES ==========

// Get all stock items
app.get('/api/stock', async (req, res) => {
    try {
        const items = await stockCollection.find({}).toArray();
        res.json(items);
    } catch (error) {
        console.error('Error fetching stock:', error);
        res.status(500).json({ error: 'Failed to fetch stock items' });
    }
});

// Add stock item
app.post('/api/stock', async (req, res) => {
    try {
        const { name, category, quantity } = req.body;
        
        if (!name || !category || quantity === undefined) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const status = quantity > 30 ? "In Stock" : quantity > 10 ? "Low Stock" : "Out of Stock";
        const lastUpdated = new Date().toISOString();
        
        const newItem = {
            name,
            category,
            quantity: parseInt(quantity),
            status,
            lastUpdated
        };
        
        const result = await stockCollection.insertOne(newItem);
        
        res.status(201).json({
            _id: result.insertedId,
            ...newItem
        });
    } catch (error) {
        console.error('Error adding stock item:', error);
        res.status(500).json({ error: 'Failed to add stock item' });
    }
});

// Update stock item
app.put('/api/stock/:name', async (req, res) => {
    try {
        const itemName = decodeURIComponent(req.params.name);
        const { quantity } = req.body;
        
        if (quantity === undefined) {
            return res.status(400).json({ error: 'Quantity is required' });
        }
        
        const newQuantity = parseInt(quantity);
        const status = newQuantity > 30 ? "In Stock" : newQuantity > 10 ? "Low Stock" : "Out of Stock";
        const lastUpdated = new Date().toISOString();
        
        const result = await stockCollection.findOneAndUpdate(
            { name: itemName },
            {
                $set: {
                    quantity: newQuantity,
                    status,
                    lastUpdated
                }
            },
            { returnDocument: 'after' }
        );
        
        if (!result.value) {
            return res.status(404).json({ error: 'Item not found' });
        }
        
        res.json(result.value);
    } catch (error) {
        console.error('Error updating stock item:', error);
        res.status(500).json({ error: 'Failed to update stock item' });
    }
});

// Delete stock item
app.delete('/api/stock/:name', async (req, res) => {
    try {
        const itemName = decodeURIComponent(req.params.name);
        
        const result = await stockCollection.deleteOne({ name: itemName });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }
        
        res.json({ message: 'Item deleted successfully' });
    } catch (error) {
        console.error('Error deleting stock item:', error);
        res.status(500).json({ error: 'Failed to delete stock item' });
    }
});

// ========== CHAT ROUTES ==========

// Get all chat messages
app.get('/api/chat', async (req, res) => {
    try {
        const messages = await chatCollection
            .find({})
            .sort({ timestamp: 1 })
            .toArray();
        
        res.json(messages);
    } catch (error) {
        console.error('Error fetching chat messages:', error);
        res.status(500).json({ error: 'Failed to fetch chat messages' });
    }
});

// Add chat message
app.post('/api/chat', async (req, res) => {
    try {
        const { sender, senderId, text } = req.body;
        
        if (!sender || !senderId || !text) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const newMessage = {
            sender,
            senderId,
            text,
            timestamp: Date.now(),
            date: new Date().toLocaleDateString('en-GB')
        };
        
        const result = await chatCollection.insertOne(newMessage);
        
        res.status(201).json({
            _id: result.insertedId,
            ...newMessage
        });
    } catch (error) {
        console.error('Error adding chat message:', error);
        res.status(500).json({ error: 'Failed to add chat message' });
    }
});

// ========== PHOTOS ROUTES ==========

// Get all photos
app.get('/api/photos', async (req, res) => {
    try {
        const photos = await photosCollection
            .find({})
            .sort({ timestamp: -1 })
            .toArray();
        
        res.json(photos);
    } catch (error) {
        console.error('Error fetching photos:', error);
        res.status(500).json({ error: 'Failed to fetch photos' });
    }
});

// Add photo
app.post('/api/photos', async (req, res) => {
    try {
        const { name, data, uploadedBy, date, size } = req.body;
        
        if (!name || !data || !uploadedBy) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const newPhoto = {
            name,
            data,
            uploadedBy,
            date: date || new Date().toLocaleDateString('en-GB'),
            size: size || 0,
            timestamp: Date.now()
        };
        
        const result = await photosCollection.insertOne(newPhoto);
        
        res.status(201).json({
            _id: result.insertedId,
            ...newPhoto
        });
    } catch (error) {
        console.error('Error adding photo:', error);
        res.status(500).json({ error: 'Failed to add photo' });
    }
});

// Delete photo
app.delete('/api/photos/:id', async (req, res) => {
    try {
        const photoId = req.params.id;
        
        if (!ObjectId.isValid(photoId)) {
            return res.status(400).json({ error: 'Invalid photo ID' });
        }
        
        const result = await photosCollection.deleteOne({ _id: new ObjectId(photoId) });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Photo not found' });
        }
        
        res.json({ message: 'Photo deleted successfully' });
    } catch (error) {
        console.error('Error deleting photo:', error);
        res.status(500).json({ error: 'Failed to delete photo' });
    }
});

// ========== TASKS ROUTES ==========

// Get all tasks
app.get('/api/tasks', async (req, res) => {
    try {
        const tasks = await tasksCollection
            .find({})
            .sort({ completed: 1, createdAt: -1 })
            .toArray();
        
        res.json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});

// Add task
app.post('/api/tasks', async (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text || text.trim() === '') {
            return res.status(400).json({ error: 'Task text is required' });
        }
        
        const newTask = {
            text: text.trim(),
            completed: false,
            createdAt: new Date().toISOString(),
            completedAt: null
        };
        
        const result = await tasksCollection.insertOne(newTask);
        
        res.status(201).json({
            _id: result.insertedId,
            ...newTask
        });
    } catch (error) {
        console.error('Error adding task:', error);
        res.status(500).json({ error: 'Failed to add task' });
    }
});

// Update task
app.put('/api/tasks/:id', async (req, res) => {
    try {
        const taskId = req.params.id;
        const updates = req.body;
        
        if (!ObjectId.isValid(taskId)) {
            return res.status(400).json({ error: 'Invalid task ID' });
        }
        
        if (updates.completed === true && !updates.completedAt) {
            updates.completedAt = new Date().toISOString();
        } else if (updates.completed === false) {
            updates.completedAt = null;
        }
        
        const result = await tasksCollection.findOneAndUpdate(
            { _id: new ObjectId(taskId) },
            { $set: updates },
            { returnDocument: 'after' }
        );
        
        if (!result.value) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        res.json(result.value);
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ error: 'Failed to update task' });
    }
});

// Delete task
app.delete('/api/tasks/:id', async (req, res) => {
    try {
        const taskId = req.params.id;
        
        if (!ObjectId.isValid(taskId)) {
            return res.status(400).json({ error: 'Invalid task ID' });
        }
        
        const result = await tasksCollection.deleteOne({ _id: new ObjectId(taskId) });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        res.json({ message: 'Task deleted successfully' });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ error: 'Failed to delete task' });
    }
});

// ========== QUALITY METRICS ROUTES ==========

// Get all quality metrics
app.get('/api/quality', async (req, res) => {
    try {
        const metrics = await qualityCollection
            .find({})
            .sort({ timestamp: -1 })
            .toArray();
        
        res.json(metrics);
    } catch (error) {
        console.error('Error fetching quality metrics:', error);
        res.status(500).json({ error: 'Failed to fetch quality metrics' });
    }
});

// Add quality metric
app.post('/api/quality', async (req, res) => {
    try {
        const { size, color, growth, yield: yieldVal, harvest, recordedBy } = req.body;
        
        if (size === undefined || color === undefined || growth === undefined || 
            yieldVal === undefined || harvest === undefined) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const sizePercent = Math.min(100, Math.round((parseFloat(size) / 30) * 100));
        const colorPercent = Math.min(100, Math.round((parseFloat(color) / 10) * 100));
        const growthPercent = Math.min(100, Math.round(parseFloat(growth)));
        const yieldPercent = Math.min(100, Math.round((parseFloat(yieldVal) / 20) * 100));
        const overall = Math.round((sizePercent + colorPercent + growthPercent + yieldPercent) / 4);
        
        const newMetric = {
            size: parseFloat(size),
            color: parseFloat(color),
            growth: parseFloat(growth),
            yield: parseFloat(yieldVal),
            harvest: parseFloat(harvest),
            sizePercent,
            colorPercent,
            growthPercent,
            yieldPercent,
            overall,
            recordedBy: recordedBy || 'unknown',
            date: new Date().toLocaleDateString('en-GB'),
            timestamp: Date.now()
        };
        
        const result = await qualityCollection.insertOne(newMetric);
        
        res.status(201).json({
            _id: result.insertedId,
            ...newMetric
        });
    } catch (error) {
        console.error('Error adding quality metric:', error);
        res.status(500).json({ error: 'Failed to add quality metric' });
    }
});

// ========== STATS ENDPOINT ==========

app.get('/api/stats', async (req, res) => {
    try {
        const [
            stockCount,
            chatCount,
            photosCount,
            tasksCount,
            qualityCount
        ] = await Promise.all([
            stockCollection.countDocuments(),
            chatCollection.countDocuments(),
            photosCollection.countDocuments(),
            tasksCollection.countDocuments(),
            qualityCollection.countDocuments()
        ]);
        
        const activeTasks = await tasksCollection.countDocuments({ completed: false });
        const completedTasks = await tasksCollection.countDocuments({ completed: true });
        
        res.json({
            stock: stockCount,
            chat: chatCount,
            photos: photosCount,
            tasks: {
                total: tasksCount,
                active: activeTasks,
                completed: completedTasks
            },
            quality: qualityCount,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// ========== ERROR HANDLING ==========

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// ========== START SERVER ==========

async function startServer() {
    try {
        await connectToMongoDB();
        
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📊 Database: ${db.databaseName}`);
            console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
            
            // Initial keep-alive ping
            if (process.env.RENDER_EXTERNAL_URL) {
                console.log(`🔗 External URL: ${process.env.RENDER_EXTERNAL_URL}`);
                setTimeout(keepAlive, 5000);
            }
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    if (client) {
        await client.close();
        console.log('MongoDB connection closed');
    }
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...');
    if (client) {
        await client.close();
        console.log('MongoDB connection closed');
    }
    process.exit(0);
});
