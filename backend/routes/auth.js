const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User"); // Adjust based on your project structure
const { OAuth2Client } = require("google-auth-library");
const authMiddleware = require("../middleware/authMiddleware");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post("/google", async (req, res) => {
  try {
    const { token } = req.body;

    // Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const { email, name, sub } = ticket.getPayload();

    // Check if user exists
    let user = await User.findOne({ email });

    if (!user) {
      // New user - return `isNewUser: true`
      return res.json({
        isNewUser: true,
        email,
        googleId: sub, // Google user ID
      });
    }

    // Existing user - generate token
    const jwtToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      token: jwtToken,
      user,
      isNewUser: false, // Existing user
    });
  } catch (error) {
    console.error("Google Login Error:", error);
    res.status(500).json({ message: "Google login failed" });
  }
});

router.post("/signup", async (req, res) => {
  try {
    console.log("Incoming Signup Request:", req.body);

    const { name, mobile, vehicleType, email, googleId } = req.body;

    // Check if all required fields are present
    if (!name || !mobile || !vehicleType || !email || !googleId) {
      console.log("❌ Missing Fields:", req.body);
      return res.status(400).json({ message: "All fields are required" });
    }

    // Ensure mobile is not null
    if (!mobile) {
      return res.status(400).json({ message: "Mobile number is required" });
    }

    let existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    existingUser = await User.findOne({ mobile });
    if (existingUser) {
      return res.status(400).json({ message: "Mobile number already exists" });
    }

    // Create user
    let user = new User({ name, email, mobile, vehicleType, googleId });

    await user.save();
    console.log("✅ User Created:", user);

    const jwtToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({ token: jwtToken, user });
  } catch (error) {
    console.error("❌ Signup Error:", error);
    res.status(500).json({ message: "Signup failed" });
  }
});

router.delete("/delete", authMiddleware, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user.id);
    res.json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Delete Account Error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/test-auth", authMiddleware, (req, res) => {
  res.json({ message: "Auth Middleware Works!", userId: req.user.id });
});

router.put("/updateProfile", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id; // Extract user ID from JWT
    const { name, phone, vehicleType } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { name, phone, vehicleType },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user: updatedUser });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ error: "Server error" });
    console.log(req.body, req.user.id);
  }
});


module.exports = router;
