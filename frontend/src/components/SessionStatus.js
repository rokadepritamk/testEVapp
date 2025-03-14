import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import mqtt from "mqtt";
import axios from "axios";
import "../styles4.css";

const MQTT_BROKER_URL = "e38b21403ada425495d156c12c020e20.s1.eu.hivemq.cloud";
const MQTT_PORT = "8884";
const MQTT_USER = "admin";
const MQTT_PASSWORD = "Admin123";

// MQTT Topics
const TOPIC_VOLTAGE = "device/voltage";
const TOPIC_CURRENT = "device/current";
const TOPIC_RELAY_CONTROL = "device/relayControl"; // For starting/stopping charging

function SessionStatus() {
  const { transactionId } = useParams();
  const location = useLocation();
  const { deviceId, amountPaid, energySelected } = location.state || {};

const [sessionData, setSessionData] = useState(() => {
  return JSON.parse(localStorage.getItem("activeSession")) || {
    deviceId: deviceId || "Unknown Device",
    sessionId: "",
    transactionId: "",
    startTime: "",
    startDate: "",
    voltage: 0,
    current: 0,
    energyConsumed: 0,
    amountUsed: 0,
  };
});

const [charging, setCharging] = useState(false);
const [relayStartTime, setRelayStartTime] = useState(null);
const FIXED_RATE_PER_KWH = 20; // ₹20 per kWh
const [mqttClient, setMqttClient] = useState(null);
const [sessionStarted, setSessionStarted] = useState(false);


useEffect(() => {
  const checkActiveSession = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/sessions/active`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data) {
        console.log("✅ Active session found:", response.data);
        setSessionData(response.data);
        localStorage.setItem("activeSession", JSON.stringify(response.data));
        setCharging(true);
        return;
      }
    } catch (error) {
      console.warn("⚠️ No active session found. Proceeding to start a new session.");
    }

    if (transactionId) startSession();
  };

  checkActiveSession();
}, [transactionId, deviceId]);

const startSession = async () => {
  try {
    const token = localStorage.getItem("token");
    
    if (!token) {
      console.error("⚠️ No authentication token found!");
      return;
    }

    console.log("🔹 Checking session data before request:", { deviceId, transactionId, amountPaid, energySelected });

    if (!deviceId || !transactionId) {
      console.error("⚠️ Missing deviceId or transactionId!");
      return;
    }

    let sessionId = "session_" + new Date().getTime(); // ✅ Define first


       // ✅ Convert current time to IST (GMT+5:30)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // ✅ Convert hours to milliseconds
    const istDate = new Date(now.getTime() + istOffset); // ✅ Adjust to IST

    const formattedDate = istDate.toISOString().split("T")[0]; // ✅ Extract YYYY-MM-DD
    const formattedTime = istDate.toISOString(); // ✅ Full ISO time for accuracy

    console.log("📤 Sending session start request:", { sessionId, transactionId, formattedTime, amountPaid, energySelected });
    const requestBody = {
      sessionId,
      deviceId,
      transactionId,
      startTime: formattedTime,
      startDate: formattedDate,
      amountPaid,  // ✅ Send amountPaid
      energySelected,  // ✅ Send energySelected
    };

    const response = await axios.post(
      "http://localhost:5000/api/sessions/start",
      requestBody,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    console.log("🟢 Server Response:", response.data); // ✅ Debug response

    const data = response.data;

    if (!data.sessionId) {
      console.error("⚠️ Server did not return a valid sessionId!");
      return;
    }

    console.log("✅ Session started successfully:", data);

    setSessionData((prev) => ({
      ...prev,
      sessionId: data.sessionId || sessionId,  // ✅ Use sessionId from request if missing in response
      startTime: formattedTime,
      startDate: formattedDate,
      amountPaid,  // ✅ Send amountPaid
      energySelected,  // ✅ Send energySelected
    }));

    setSessionStarted(true);
  } catch (error) {
    console.error("❌ Failed to start session:", error.message);
  }
};

useEffect(() => {
  localStorage.setItem("activeSession", JSON.stringify(sessionData));
}, [sessionData]);
  

  // Establish MQTT Connection
  useEffect(() => {
    const client = mqtt.connect(`wss://${MQTT_BROKER_URL}:${MQTT_PORT}/mqtt`, {
      username: MQTT_USER,
      password: MQTT_PASSWORD,
      rejectUnauthorized: false, // ✅ Fix for secure WebSocket connections
    });

    client.on("connect", () => {
      console.log("✅ Connected to MQTT broker");
      setMqttClient(client);
      client.subscribe([TOPIC_VOLTAGE, TOPIC_CURRENT]);
      if (deviceId) client.subscribe(`ev/device/${deviceId}/status`);
    });

    client.on("message", (topic, message) => {
      const data = parseFloat(message.toString());
      setSessionData((prev) => ({
        ...prev,
        voltage: topic === TOPIC_VOLTAGE ? data : prev.voltage,
        current: topic === TOPIC_CURRENT ? data : prev.current,
      }));
    });

    return () => client.end();
  }, [deviceId]);

  // Prevent page refresh during active session
  useEffect(() => {
    window.onbeforeunload = () => {
      if (charging) {
        return "Are you sure you want to leave? The session is active.";
      }
    };
    return () => {
      window.onbeforeunload = null;
    };
  }, [charging]);

  // Energy Calculation and Updates
  useEffect(() => {
    if (!charging || !relayStartTime) return;

    const interval = setInterval(() => {
      setSessionData((prev) => {
        if (!prev.voltage || !prev.current) return prev; // Avoid NaN calculations
        const durationHours = (Date.now() - relayStartTime) / (1000 * 60 * 60);
        if (durationHours <= 0) return prev;
        const newEnergy = (prev.voltage * prev.current * durationHours) / 1000; // kWh
        const totalEnergyConsumed = prev.energyConsumed + newEnergy;
        const totalAmountUsed = totalEnergyConsumed * FIXED_RATE_PER_KWH;

        console.log("🔋 Energy Debug:", {
          voltage: prev.voltage,
          current: prev.current,
          durationHours,
          newEnergy,
          totalEnergyConsumed,
          totalAmountUsed,
          amountPaid,
        });

        axios
          .post("http://localhost:5000/api/sessions/update", {
            sessionId: prev.sessionId,
            energyConsumed: totalEnergyConsumed,
            amountUsed: totalAmountUsed,
          })
          .catch((error) => console.error("Failed to update session data:", error));

        if (totalAmountUsed >= amountPaid) {
          stopCharging();
          clearInterval(interval);
        }

        return {
          ...prev,
          energyConsumed: totalEnergyConsumed,
          amountUsed: totalAmountUsed,
        };
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [charging, relayStartTime]);

  // Start Charging Function
  const startCharging = () => {
    console.log("🚀 Attempting to Start Charging...");
    if (!mqttClient) {
      console.error("❌ MQTT Client is Not Ready Yet! Retrying in 1s...");
      setTimeout(startCharging, 1000);
      return;
    }

    console.log("📡 Publishing MQTT ON Command...");
    mqttClient.publish(TOPIC_RELAY_CONTROL, "ON", () => {
      console.log("✅ Charging Started via MQTT");
      setRelayStartTime(Date.now());
      setCharging(true);
    });
  }; 
  // Stop Charging Function
  const stopCharging = async (triggerType = "manual") => {
    console.warn("⚠️ stopCharging() Triggered:", triggerType);
    if (!sessionData.sessionId) {
      console.error("No valid session ID found!");
      return;
    }

    console.log("Stopping session with ID:", sessionData.sessionId);

    if (mqttClient) {
      mqttClient.publish(TOPIC_RELAY_CONTROL, "OFF", () => {
        console.log("Charging Stopped via MQTT");
      });
    }

    setCharging(false);
    
    const now = new Date();
    const istDate = new Date(now.getTime()); // ✅ Adjust to IST
    const formattedTime = istDate.toISOString(); // ✅ Full ISO time for accuracy

    const sessionPayload = {
      sessionId: sessionData.sessionId,
      endTime: formattedTime,
      endTrigger: triggerType,
    };
  
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.error("❌ No authentication token found!");
        return;
      }
  
      console.log("📤 Sending stop session request:", sessionPayload);
  
      const response = await axios.post(
        "http://localhost:5000/api/sessions/stop",
        sessionPayload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
  
      console.log("✅ Session stopped successfully:", response.data);
  
      // Optional: Clear session data after stopping
      localStorage.removeItem("activeSession");
      setSessionData(null);
    } catch (error) {
      console.error("❌ Failed to stop session:", error.response?.data || error.message);
    }
  };
  return (
    <div className="session-container">
      {sessionData ? (
        <>
          {/* Debugging UI Rendering */}
          {console.log("🔍 UI Debug: Rendering session data:", sessionData)}

          {/* Top Card: Displays Session Details */}
          <div className="top-card">
            <p><strong>Device ID:</strong> {sessionData?.deviceId || "Unknown"}</p>
            <p><strong>Session ID:</strong> {sessionData?.sessionId || "N/A"}</p>
            <p><strong>Start Date & Time:</strong> {sessionData?.startDate || "N/A"} {sessionData?.startTime || "N/A"}</p>
            <p className={`status ${charging ? "charging" : "stopped"}`}>
              {charging ? "Charging in Progress" : "Charging Stopped"}
            </p>
          </div>

          {/* Charging Progress Section */}
          <div className="charging-progress-card">
            <div className="charging-info">
              <p className="large-text">{amountPaid ?? 0} ₹</p>
              <p className="small-text">Total Amount Paid</p>

              <p className="large-text">{energySelected ?? 0} kWh</p>
              <p className="small-text">Energy Selected</p>

              <p className="large-text">{(sessionData.amountUsed ?? 0).toFixed(2)} ₹</p>
              <p className="small-text">Amount Used</p>

              {/* Progress Bar */}
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${(sessionData.amountUsed / (amountPaid || 1)) * 100}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>

          {/* Live Data Display */}
          <div className="live-data">
            <div className="live-value">
              <p className="large-text">{sessionData.voltage ?? 0} V</p>
              <p className="small-text">Voltage</p>
            </div>
            <div className="live-value">
              <p className="large-text">{sessionData.current ?? 0} A</p>
              <p className="small-text">Current</p>
            </div>
            <div className="live-value">
              <p className="large-text">{(sessionData.energyConsumed ?? 0).toFixed(3)} kWh</p>
              <p className="small-text">Energy Consumed</p>
            </div>
          </div>

          {/* Stop Charging Button */}
            <button className="stop-button" onClick={() => stopCharging("manual")}>
              Stop Charging
            </button>
          
        </>
      ) : (
        <p>Loading session data...</p> // Fallback UI to prevent blank screen
      )}
    </div>
  );
}

export default SessionStatus;
