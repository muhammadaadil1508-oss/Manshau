const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;
const uri = process.env.MONGODB_URI || "mongodb+srv://Aadil:15082003@fest.jx37gni.mongodb.net/?appName=Fest";
const client = new MongoClient(uri);

let db, stateCollection;

async function connectDB() {
  try {
    await client.connect();
    db = client.db('Fest');
    stateCollection = db.collection('state');
    console.log("=========================================");
    console.log("✅ Successfully connected to MongoDB Atlas!");
    console.log("=========================================");
  } catch (e) {
    console.error("=========================================");
    console.error("❌ Failed to connect to MongoDB Atlas!");
    console.error("Error details:", e.message);
    console.error("Make sure your IP address is whitelisted and password is correct.");
    console.error("=========================================");
  }
}

connectDB();

// Get ERP state from database
app.get('/api/state', async (req, res) => {
  try {
    if (!stateCollection) {
      return res.status(503).json({ error: "Database not connected yet" });
    }
    const doc = await stateCollection.findOne({ type: "global_state" });
    if (doc) {
      res.json(doc.state);
    } else {
      res.json(null);
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update ERP state in database
app.post('/api/state', async (req, res) => {
  try {
    if (!stateCollection) {
      return res.status(503).json({ error: "Database not connected yet" });
    }
    const state = req.body;
    await stateCollection.updateOne(
      { type: "global_state" },
      { $set: { state, updatedAt: new Date() } },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Manshau ERP Backend running at http://localhost:${PORT}`);
});
