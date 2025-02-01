const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
    transactionId: { type: String, required: true, unique: true },
    deviceId: { type: String, required: true },
    sessionId: { type: String, required: true, unique: true },
    startTime: { type: String, required: true },
    startDate: { type: String, required: true },
    energyConsumed: { type: Number, default: 0 },
    amountUsed: { type: Number, default: 0 },
    endTime: { type: String, default: null }, // Store end time
    endTrigger: { type: String, default: null } // "auto" or "manual"
});

module.exports = mongoose.model("Session", sessionSchema);
