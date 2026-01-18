const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const { MongoClient } = require('mongodb');

const app = express();

/* ======================
   MIDDLEWARE
====================== */
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

/* ======================
   USERS (LOGIN)
====================== */
const TEAM_USERS = {
  midhun: "1977",
  akash: "2024",
  sajad: "5550",
  saran: "2244",
  muhammad: "1415"
};

/* ======================
   MONGODB CONNECTION
====================== */
const MONGO_URI = process.env.MONGODB_URI;

let db;
let stockCollection;

async function connectDB() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db("brokoons");
  stockCollection = db.collection("stock");
  console.log("✅ MongoDB connected");
}

connectDB().catch(console.error);

/* ======================
   ROUTES
====================== */

// test
app.get('/api/test', (req, res) => {
  res.json({
    status: "✅ Backend Working!",
    time: new Date().toISOString()
  });
});

// login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (TEAM_USERS[username] === password) {
    res.json({
      success: true,
      user: {
        name: username,
        role: username === 'midhun' ? 'admin' : 'user'
      }
    });
  } else {
    res.status(401).json({ success: false });
  }
});

/* ===== STOCK (SHARED FOR EVERYONE) ===== */

// get all stock
app.get('/api/stock', async (req, res) => {
  const items = await stockCollection.find({}).toArray();
  res.json(items);
});

// add stock
app.post('/api/stock', async (req, res) => {
  const item = {
    ...req.body,
    lastUpdated: new Date().toISOString()
  };
  await stockCollection.insertOne(item);
  res.json({ success: true });
});

// update stock
app.put('/api/stock/:name', async (req, res) => {
  const { name } = req.params;
  const { quantity, status } = req.body;

  await stockCollection.updateOne(
    { name },
    { $set: { quantity, status, lastUpdated: new Date().toISOString() } }
  );

  res.json({ success: true });
});

// delete stock
app.delete('/api/stock/:name', async (req, res) => {
  const { name } = req.params;
  await stockCollection.deleteOne({ name });
  res.json({ success: true });
});

/* ======================
   START SERVER
====================== */
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);

  // keep Render awake
  setInterval(() => {
    fetch(`${process.env.RENDER_EXTERNAL_URL}/api/test`).catch(() => {});
  }, 300000);
});
