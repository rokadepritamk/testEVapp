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
  const navigate = useNavigate();
  const location = useLocation();
  const { deviceId, amountPaid, energySelected } = location.state || {};
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionData, setSessionData] = useState({
    deviceId: deviceId || "Unknown Device",
    sessionId: "",
    startTime: "",
    startDate: "",
    voltage: 0,
    current: 0,
    energyConsumed: 0,
    amountUsed: 0,
  });

  const [charging, setCharging] = useState(false);
  const [relayStartTime, setRelayStartTime] = useState(null);
  const FIXED_RATE_PER_KWH = 20; // ₹20 per kWh
  const [mqttClient, setMqttClient] = useState(null);

  useEffect(() => {
    const client = mqtt.connect(`wss://${MQTT_BROKER_URL}:${MQTT_PORT}/mqtt`, {
      username: MQTT_USER,
      password: MQTT_PASSWORD,
    });
  
    client.on("connect", () => {
      console.log("Connected to MQTT broker");
      client.subscribe([TOPIC_VOLTAGE, TOPIC_CURRENT], (err) => {
        if (err) console.error("Failed to subscribe to topics");
      });
  
      if (deviceId) {
        client.subscribe(`ev/device/${deviceId}/status`, (err) => {
          if (err) console.error("Failed to subscribe to device status:", err);
        });
      }
      setMqttClient(client); // ✅ Set client AFTER connection is confirmed
    });
  
    client.on("message", (topic, message) => {
      const data = parseFloat(message.toString());
      setSessionData((prev) => ({
        ...prev,
        voltage: topic === TOPIC_VOLTAGE ? data : prev.voltage,
        current: topic === TOPIC_CURRENT ? data : prev.current,
      }));
    });
    
    return () => {
      if (client) client.end(); // ✅ Only disconnect if client exists
    };
  }, [deviceId]); // ✅ Only runs when deviceId changes
  

  useEffect(() => {
    if (!transactionId || sessionStarted) return;
  
    const startSession = async () => {
      try {
        const response = await axios.post("https://testevapp-2.onrender.com/api/sessions/start", {
          transactionId,
          deviceId,
          amountPaid,
          energySelected,
        });
        console.log("Session started successfully:", response.data);
  
        const { sessionId, startTime, startDate } = response.data;
        setSessionData((prev) => ({
          ...prev,
          sessionId,
          startTime,
          startDate,
        }));
  
        setSessionStarted(true); // Prevent duplicate session creation
        startCharging(); // Auto-start charging
      } catch (error) {
        console.error("Failed to start session:", error.response?.data || error.message);
      }
    };
  
    startSession();
  }, [transactionId, sessionStarted, amountPaid, deviceId, energySelected]); // Add sessionStarted to prevent re-execution
  useEffect(() => {
    if (!charging || !relayStartTime) return;
  
    const interval = setInterval(() => {
      setSessionData((prev) => {
        if (!prev.voltage || !prev.current) return prev; // Avoid NaN calculations
        const durationHours = (Date.now() - relayStartTime) / (1000 * 60 * 60);
        if (durationHours <= 0) return prev; // Prevent negative values
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
  
        axios.post("https://testevapp-2.onrender.com/api/sessions/update", {
          sessionId: prev.sessionId,
          energyConsumed: totalEnergyConsumed,
          amountUsed: totalAmountUsed,
        }).catch((error) => console.error("Failed to update session data:", error));
  
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
  }, [charging, relayStartTime, amountPaid, deviceId, energySelected]);  // ✅ Add relayStartTime as a dependency
  
  
  
// Function to upload session data
//const uploadSessionData = async (data) => {
 // try {
  //  await axios.post("https://testevapp-2.onrender.com/api/sessions/update", {
   //   sessionId: data.sessionId,
    //  energyConsumed: data.energyConsumed,
    //  amountUsed: data.amountUsed,
   // });
  //  console.log("Session data updated in MongoDB");
 // } catch (error) {
  //  console.error("Failed to update session data:", error);
//  }
// };

const startCharging = () => {
  console.log("🚀 Attempting to Start Charging...");
  if (mqttClient) {
    console.error("❌ MQTT Client is Not Ready Yet! Retrying in 1s...");
    setTimeout(startCharging, 1000); // Retry after 1 second
    return;
  }
    mqttClient.publish(TOPIC_RELAY_CONTROL, "ON", () => {
      console.log("✅ Charging Started via MQTT");
      setRelayStartTime(Date.now());
      setCharging(true);
    });
};

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

  const sessionPayload = {
    sessionId: sessionData.sessionId,
    endTime: new Date().toISOString(),
    endTrigger: triggerType,
  };

  console.log("Sending stop session request:", sessionPayload);

  try {
    await axios.post("https://testevapp-2.onrender.com/api/sessions/stop", sessionPayload);
    console.log("Session stopped successfully");
    navigate("/");
  } catch (error) {
    console.error("Failed to stop session:", error);
  }
};


  return (
    <div className="session-container">
      <div className="top-card">
        <p><strong>Device ID:</strong> {sessionData.deviceId}</p>
        <p><strong>Session ID:</strong> {sessionData.sessionId}</p>
        <p><strong>Start Date & Time:</strong> {sessionData.startDate} {sessionData.startTime}</p>
        <p className={`status ${charging ? "charging" : "stopped"}`}>
          {charging ? "Charging in Progress" : "Charging Stopped"}
        </p>
      </div>

      <div className="charging-progress-card">
        <div className="charging-info">
          <p className="large-text">{amountPaid} ₹</p>
          <p className="small-text">Total Amount Paid</p>

          <p className="large-text">{energySelected} kWh</p>
          <p className="small-text">Energy Selected</p>
          <p className="large-text">{sessionData.amountUsed.toFixed(2)} ₹</p>
          <p className="small-text">Amount Used</p>

          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${(sessionData.amountUsed / amountPaid) * 100}%`,
              }}
            ></div>
          </div>
        </div>
      </div>

      <div className="live-data">
        <div className="live-value">
          <p className="large-text">{sessionData.voltage} V</p>
          <p className="small-text">Voltage</p>
        </div>
        <div className="live-value">
          <p className="large-text">{sessionData.current} A</p>
          <p className="small-text">Current</p>
        </div>
        <div className="live-value">
          <p className="large-text">{sessionData.energyConsumed.toFixed(3)} kWh</p>
          <p className="small-text">Energy Consumed</p>
        </div>
      </div>

      {charging && (
        <button onClick={() => stopCharging("manual")}>
          Stop Charging
        </button>
      )}
    </div>
  );
}

export default SessionStatus;
