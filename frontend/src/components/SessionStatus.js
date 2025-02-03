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

  // Establish MQTT Connection
  useEffect(() => {
    const client = mqtt.connect(`wss://${MQTT_BROKER_URL}:${MQTT_PORT}/mqtt`, {
      username: MQTT_USER,
      password: MQTT_PASSWORD,
    });

    client.on("connect", () => {
      console.log("✅ Connected to MQTT broker");
      setMqttClient(client);

      client.subscribe([TOPIC_VOLTAGE, TOPIC_CURRENT], (err) => {
        if (err) console.error("Failed to subscribe to topics");
      });

      if (deviceId) {
        client.subscribe(`ev/device/${deviceId}/status`, (err) => {
          if (err) console.error("Failed to subscribe to device status:", err);
        });
      }
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
      if (client) client.end();
    };
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

  // Start session when transactionId is available
  useEffect(() => {
    if (!transactionId || sessionStarted) return;

    const fetchISTTime = async () => {
      try {
        const response = await axios.get("https://worldtimeapi.org/api/timezone/Asia/Kolkata");
        const { datetime } = response.data;
        return new Date(datetime); // Convert to JavaScript Date object
      } catch (error) {
        console.error("Failed to fetch IST time:", error);
        return new Date(); // Fallback to system time if API fails
      }
    };

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

        const istDateTime = await fetchISTTime();
        const formattedDate = istDateTime.toLocaleDateString("en-IN"); // DD/MM/YYYY
        const formattedTime = istDateTime.toLocaleTimeString("en-IN", { hour12: true });

        setSessionData((prev) => ({
          ...prev,
          startDate: formattedDate,
          startTime: formattedTime,
        }));

        setSessionStarted(true); // Prevent duplicate session creation
      } catch (error) {
        console.error("Failed to start session:", error.response?.data || error.message);
      }
    };

    startSession();
  }, [transactionId, sessionStarted, amountPaid, deviceId, energySelected]);

  // Start charging when session starts
  useEffect(() => {
    if (sessionStarted) {
      console.log("⚡ Session started, attempting to start charging...");
      startCharging();
    }
  }, [sessionStarted]);

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
          .post("https://testevapp-2.onrender.com/api/sessions/update", {
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
  }, [charging, relayStartTime, amountPaid, deviceId, energySelected]);

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

    const sessionPayload = {
      sessionId: sessionData.sessionId,
      endTime: new Date().toISOString(),
      endTrigger: triggerType,
    };

    try {
      await axios.post("https://testevapp-2.onrender.com/api/sessions/stop", sessionPayload);
      console.log("Session stopped successfully");
    } catch (error) {
      console.error("Failed to stop session:", error);
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
          {charging && (
            <button className="stop-button" onClick={() => stopCharging("manual")}>
              Stop Charging
            </button>
          )}
        </>
      ) : (
        <p>Loading session data...</p> // Fallback UI to prevent blank screen
      )}
    </div>
  );
}

export default SessionStatus;
