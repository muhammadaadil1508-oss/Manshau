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

// Get ERP state from database (individual partitioned documents merged)
app.get('/api/state', async (req, res) => {
  try {
    if (!stateCollection) {
      return res.status(503).json({ error: "Database not connected yet" });
    }
    
    // 1. Fetch announcements
    const annDoc = await stateCollection.findOne({ type: "announcements" });
    const announcements = annDoc ? annDoc.announcements : [];
    
    // 2. Fetch all individual student documents
    const studentsCol = db.collection('students');
    const students = await studentsCol.find({}).toArray();
    
    if (students.length > 0) {
      // Remove mongodb internal _id field to prevent serialization bugs
      const cleanedStudents = students.map(({ _id, ...rest }) => rest);
      res.json({
        students: cleanedStudents,
        announcements
      });
    } else {
      res.json(null);
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update ERP state in database (partitioned with optimistic concurrency timestamp validation)
app.post('/api/state', async (req, res) => {
  try {
    if (!stateCollection) {
      return res.status(503).json({ error: "Database not connected yet" });
    }
    const { students, announcements } = req.body;
    
    // 1. Update global announcements
    await stateCollection.updateOne(
      { type: "announcements" },
      { $set: { announcements, updatedAt: new Date() } },
      { upsert: true }
    );
    
    // 2. Process each student as an individual document
    const studentsCol = db.collection('students');
    for (const student of students) {
      const existing = await studentsCol.findOne({ id: student.id });
      
      const incomingTime = Number(student.lastUpdated) || 0;
      const existingTime = existing ? (Number(existing.lastUpdated) || 0) : -1;
      
      // Save if student doesn't exist yet, or client's incoming change is newer
      if (!existing || incomingTime > existingTime) {
        await studentsCol.updateOne(
          { id: student.id },
          { $set: { ...student, lastUpdated: incomingTime, updatedAt: new Date() } },
          { upsert: true }
        );
      }
    }
    
    // 3. Remove any students from the database that are no longer in the client's list (deleted students)
    const incomingIds = students.map(s => s.id);
    await studentsCol.deleteMany({ id: { $nin: incomingIds } });
    
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Manshau ERP Backend running at http://localhost:${PORT}`);
});
