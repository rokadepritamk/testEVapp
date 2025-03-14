import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { QrReader } from "react-qr-reader"; // ✅ Use correct import
import axios from "axios";

const QRScanner = () => {
  const navigate = useNavigate();
  const [device_id, setDeviceId] = useState("");
  const [error, setError] = useState("");

  // API URL to check if the device exists
  const API_URL = "http://localhost:5000/api/devices/check-device";

  const handleScan = async (data) => {
    if (data?.text) { // ✅ Ensure `data.text` exists
      setDeviceId(data.text);
      await verifyDevice(data.text);
    }
  };

  const handleError = (err) => {
    console.error(err);
    setError("QR scanner failed. Please enter the device ID manually.");
  };

  // Function to verify if the device exists in the database
  const verifyDevice = async (id) => {
    try {
      const response = await axios.get(`${API_URL}/${id}`);

      if (response.data.exists) {
        navigate(`/charging-options/${id}`);
      } else {
        setError("Device not found. Please check the ID.");
      }
    } catch (err) {
      console.error(err);
      setError("Error verifying device. Try again.");
    }
  };

  // Handle manual entry
  const handleManualEntry = async () => {
    if (device_id.trim() !== "") {
      await verifyDevice(device_id);
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Scan QR Code</h2>
      <div style={styles.scannerContainer}>
        <QrReader
          constraints={{ facingMode: "environment" }} // ✅ Use back camera
          scanDelay={300}
          onResult={handleScan} // ✅ Updated event handler
          onError={handleError}
          style={styles.qrScanner}
        />
      </div>

      {error && <p style={styles.error}>{error}</p>}

      {/* Manual Entry */}
      <input
        type="text"
        placeholder="Enter Device ID"
        value={device_id}
        onChange={(e) => setDeviceId(e.target.value)}
        style={styles.input}
      />
      <button onClick={handleManualEntry} style={styles.enterButton}>
        Enter
      </button>

      <button onClick={() => navigate("/home")} style={styles.backButton}>
        Back
      </button>
    </div>
  );
};

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: "100vw", // Full width
    height: "100vh", // Full height
    backgroundColor: "#121212",
    color: "white",
    padding: "10px", // Ensures no content touches screen edges
    boxSizing: "border-box", // Prevents unwanted scroll
  },
  heading: {
    fontSize: "20px",
    textAlign: "center",
    marginBottom: "15px",
  },
  scannerContainer: {
    width: "90vw", // Responsive width
    maxWidth: "320px", // Limits max size
    height: "auto",
    aspectRatio: "1", // Ensures square size
    border: "2px solid white",
    marginBottom: "20px",
    borderRadius: "10px", // Soft edges
    overflow: "hidden",
  },
  qrScanner: {
    width: "100%",
    height: "100%",
  },
  error: {
    color: "red",
    fontSize: "14px",
    textAlign: "center",
    marginBottom: "10px",
  },
  input: {
    width: "90%", // Adjusts to screen width
    maxWidth: "300px",
    padding: "10px",
    fontSize: "16px",
    borderRadius: "5px",
    border: "1px solid #ccc",
    marginBottom: "10px",
  },
  enterButton: {
    width: "90%", // Adjusts to screen width
    maxWidth: "300px",
    padding: "12px",
    fontSize: "16px",
    borderRadius: "5px",
    border: "none",
    backgroundColor: "#007bff",
    color: "white",
    cursor: "pointer",
    marginBottom: "10px",
  },
  backButton: {
    width: "90%", // Adjusts to screen width
    maxWidth: "300px",
    padding: "12px",
    fontSize: "16px",
    borderRadius: "5px",
    border: "none",
    backgroundColor: "#ff5722",
    color: "white",
    cursor: "pointer",
  },
};

export default QRScanner;
