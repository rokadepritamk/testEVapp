const express = require("express");
const Session = require("../models/session"); // Import Mongoose schema
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware"); // Authentication Middleware

// ✅ Get all sessions for a user
router.get("/user-sessions", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id; // Extract user ID from token

    // Fetch sessions from DB, sorting by latest first
    const sessions = await Session.find({ userId }).sort({ startTime: -1 });

    // Categorize sessions
    const activeSessions = sessions.filter((session) => !session.endTime);
    const pastSessions = sessions.filter((session) => session.endTime);

    res.json({ activeSessions, pastSessions });
  } catch (error) {
    console.error("Error fetching sessions:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Fetch session by Transaction ID
router.get("/:transactionId", async (req, res) => {
  try {
    const { transactionId } = req.params;
    const session = await Session.findOne({ transactionId });

    if (!session) {
      return res.status(404).json({ error: "Transaction ID not found." });
    }

    res.json(session);
  } catch (err) {
    console.error("Error fetching session:", err.message);
    res.status(500).json({ error: "Internal server error." });
  }
});

// ✅ Start Session (Triggered after payment success)
router.post("/start", authMiddleware, async (req, res) => {
  const { sessionId, deviceId, transactionId, startTime, startDate, amountPaid, energySelected } = req.body; // ✅ Ensure startDate is included

  const userId = req.user ? req.user.userId : null; // ✅ Ensure userId is extracted properly
  console.log("🔹 Received session start request:", req.body);  // ✅ Print received data
    console.log("🔹 Checking transactionId in DB:", transactionId);
    console.log("🔹 Extracted User ID:", userId);
    console.log("🔹 Received request data:", req.body); // ✅ Debug request data
  try {
    if (!sessionId || !deviceId || !transactionId || !startTime || !userId || !amountPaid || !energySelected) { // ✅ Remove startDate from required check if not used
      console.error("❌ Missing required fields:", { sessionId, deviceId, transactionId, startTime, startDate, userId, amountPaid, energySelected });
      return res.status(400).json({ error: "Missing required fields." });
  }

          // Convert startTime to a Date object
          const parsedStartTime = new Date(startTime);
          if (isNaN(parsedStartTime.getTime())) {
              console.error("❌ Invalid startTime format:", startTime);
              return res.status(400).json({ error: "Invalid startTime format. Expected ISO format." });
          }

           // ✅ Convert stored time to IST (GMT+5:30)
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istStartTime = new Date(parsedStartTime.getTime() + istOffset);

    // Ensure the transaction ID is unique
    const existingSession = await Session.findOne({ transactionId });
    console.log("🔹 Existing session found:", existingSession);
    if (existingSession) {
      console.error("❌ Transaction ID already exists:", transactionId);
      return res.status(400).json({ error: "Transaction ID already exists." });
    }

    // Create the new session
    const newSession = await Session.create({
      sessionId,
      deviceId,
      transactionId,
      startTime: istStartTime, // ✅ Save in IST
      startDate, // ✅ Ensure startDate is stored
      status: "active",
      userId,  // ✅ Save userId
      amountPaid,  // ✅ Send amountPaid
      energySelected,  // ✅ Send energySelected
    });

    console.log("✅ Session created successfully:", newSession);
    res.status(200).json({ message: "Session started successfully.", sessionId: newSession.sessionId });  // ✅ Return sessionId

  } catch (err) {
    console.error("Error starting session:", err.message);
    res.status(500).json({ error: "Failed to start session." });
  }
});

// ✅ End Session
router.post("/stop", authMiddleware, async (req, res) => {
  try {
    const { sessionId, endTime, endTrigger } = req.body;
    console.log("🔹 Received stop session request:", req.body);

    if (!sessionId || !endTime) {
      return res.status(400).json({ error: "Missing sessionId or endTime" });
    }

    const session = await Session.findOneAndUpdate(
      { sessionId },
      { $set: { status: "completed", endTime, endTrigger } },
      { new: true }
    );

    if (!session) {
      console.error("❌ Session not found:", sessionId);
      return res.status(404).json({ error: "Session not found" });
    }

    console.log("✅ Session updated successfully:", session);
    res.json({ message: "Session ended successfully", session });
  } catch (error) {
    console.error("❌ Error stopping session:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


// ✅ Handle Payment Success Webhook or Callback
router.post("/payment-success", async (req, res) => {
  const { transactionId, deviceId, sessionId, startTime } = req.body;

  try {
    // Validate incoming data
    if (!transactionId || !deviceId || !sessionId || !startTime) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    // Check if a session already exists for the transaction ID
    const existingSession = await Session.findOne({ transactionId });
    if (existingSession) {
       // Instead of throwing an error, return the existing session details
  return res.status(200).json({ message: "Session already exists", session: existingSession });
    }

    // Create the session
    await Session.create({
      sessionId,
      deviceId,
      transactionId,
      startTime,
      status: "active",
      amountPaid, 
      energySelected,
    });

    res.status(200).json({ message: "Session created successfully after payment." });
  } catch (err) {
    console.error("Error handling payment success:", err.message);
    res.status(500).json({ error: "Failed to process payment success." });
  }
});

// ✅ Update session data every 5 seconds
router.post("/update", async (req, res) => {
  const { sessionId, energyConsumed, amountUsed } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: "Session ID is required" });
  }

  try {
    const updatedSession = await Session.findOneAndUpdate(
      { sessionId },
      { $set: { energyConsumed, amountUsed } }, // ✅ Use `$set` to update only specific fields
      { new: true }
    );

    if (!updatedSession) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.status(200).json({ message: "Session updated successfully", updatedSession });
  } catch (error) {
    console.error("Error updating session:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


router.get("/:sessionId", authMiddleware, async (req, res) => {
  try {
    const session = await Session.findOne(
      { sessionId: req.params.sessionId },
      { sessionId: 1, endTime: 1, _id: 0 }
    );

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.json(session);
  } catch (error) {
    console.error("❌ Error fetching session:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


module.exports = router;
