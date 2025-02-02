const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid"); // Assuming UUID is used for sessionId
const dotenv = require("dotenv");

const deviceRoutes = require("./routes/devices");
const sessionRoutes = require("./routes/sessions");
const Device = require("./models/device"); // Import Device model
const Session = require("./models/session"); // ✅ Import Session model

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/sessions", sessionRoutes);
app.use(cors({
    origin: '*',  // Allow requests only from your frontend URL
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Specify allowed HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization'], // Allow certain headers
  }));

// ✅ MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI || "mongodb+srv://admin:Admin123@cluster0.zajhg.mongodb.net/ev_charging", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB Atlas"))
  .catch((error) => console.error("Error connecting to MongoDB:", error));

// ✅ Routes
app.use("/devices", deviceRoutes);
app.use("/api/sessions", sessionRoutes); // ✅ Use only this once

// ✅ Get all devices
app.get("/api/devices", async (req, res) => {
  try {
    const devices = await Device.find();
    res.json(devices);
  } catch (err) {
    console.error("Error fetching devices:", err);
    res.status(500).json({ message: "Error fetching devices" });
  }
});

// ✅ Get a specific device by device_id
app.get("/api/devices/:device_id", async (req, res) => {
  const { device_id } = req.params;
  try {
    const device = await Device.findOne({ device_id });
    if (device) {
      res.json(device);
    } else {
      res.status(404).json({ error: "Device not found" });
    }
  } catch (error) {
    console.error("Error fetching device details:", error);
    res.status(500).json({ error: "Failed to fetch device details" });
  }
});

// ✅ Fix: Start a session correctly
app.post('/api/sessions/start', async (req, res) => {
    const { transactionId } = req.body;
  
    // Check if a session with the same transactionId already exists
    const existingSession = await Session.findOne({ transactionId });
  
    if (existingSession) {
      return res.status(400).json({ error: "Session already exists with this transaction ID" });
    }
  
    try {
      // Proceed with creating a new session
      const newSession = new Session({
        transactionId,
        deviceId: Device,  // Replace with actual device ID
        sessionId: `session-${transactionId}`,
        startTime: new Date().toLocaleTimeString(),
        startDate: new Date().toLocaleDateString(),
      });
  
      await newSession.save();
      res.json(newSession);
    } catch (error) {
      console.error('Error starting session:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/getDevice", async (req, res) => {
    const { transactionId } = req.query;
  
    if (!transactionId) {
      return res.status(400).json({ error: "Transaction ID is required" });
    }
  
    try {
      const session = await Session.findOne({ transactionId });
  
      if (!session) {
        return res.status(404).json({ error: "Transaction ID not found" });
      }
  
      res.status(200).json(session);
    } catch (error) {
      console.error("Error fetching session:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // ✅ Update energy consumed and amount used
app.post("/api/sessions/update", async (req, res) => {
  const { sessionId, energyConsumed, amountUsed } = req.body;

  if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required" });
  }

  try {
      const session = await Session.findOne({ sessionId });

      if (!session) {
          return res.status(404).json({ error: "Session not found" });
      }

      session.energyConsumed = energyConsumed;
      session.amountUsed = amountUsed;
      await session.save();

      res.status(200).json({ message: "Session data updated successfully" });
  } catch (error) {
      console.error("Error updating session data:", error);
      res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Stop session and save end time & trigger (auto/manual)
app.post("/api/sessions/stop", async (req, res) => {
  const { sessionId, endTime, endTrigger } = req.body;

  if (!sessionId || !endTime || !endTrigger) {
      return res.status(400).json({ error: "Session ID, end time, and trigger type are required" });
  }

  try {
      const session = await Session.findOne({ sessionId });

      if (!session) {
          return res.status(404).json({ error: "Session not found" });
      }

      session.endTime = endTime;
      session.endTrigger = endTrigger; // "auto" or "manual"
      await session.save();

      res.status(200).json({ message: "Session ended successfully" });
  } catch (error) {
      console.error("Error stopping session:", error);
      res.status(500).json({ error: "Internal server error" });
  }
});



// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
