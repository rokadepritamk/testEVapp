import React, { useEffect, useState } from "react";
import axios from "axios";

const SessionPage = () => {
  const [activeSessions, setActiveSessions] = useState([]);
  const [pastSessions, setPastSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get("http://localhost:5000/api/sessions/user-sessions", {
        headers: { Authorization: `Bearer ${token}` },
      });

      setActiveSessions(response.data.activeSessions);
      setPastSessions(response.data.pastSessions);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h2>Charging Sessions</h2>

      {loading ? (
        <p>Loading sessions...</p>
      ) : (
        <>
          {/* Active Sessions */}
          <div style={styles.section}>
            <h3>Active Sessions</h3>
            {activeSessions.length === 0 ? (
              <p>No active sessions</p>
            ) : (
              activeSessions.map((session) => (
                <SessionCard key={session.sessionId} session={session} active />
              ))
            )}
          </div>

          {/* Past Sessions */}
          <div style={styles.section}>
            <h3>Past Sessions</h3>
            {pastSessions.length === 0 ? (
              <p>No past sessions</p>
            ) : (
              pastSessions.map((session) => <SessionCard key={session.sessionId} session={session} />)
            )}
          </div>
        </>
      )}
    </div>
  );
};

// Session Card Component
const SessionCard = ({ session, active }) => {
  return (
    <div style={styles.card}>
      <p><strong>Transaction ID:</strong> {session.transactionId}</p>
      <p><strong>Device ID:</strong> {session.deviceId}</p>
      <p><strong>Session ID:</strong> {session.sessionId}</p>
      <p><strong>Start Time:</strong> {new Date(session.startTime).toLocaleTimeString()}</p>
      <p><strong>Start Date:</strong> {session.startDate}</p>
      <p><strong>Energy Consumed:</strong> {session.energyConsumed} kWh</p>
      <p><strong>Amount Used:</strong> ₹{session.amountUsed}</p>
      {!active && <p><strong>End Time:</strong> {new Date(session.endTime).toLocaleTimeString()}</p>}
    </div>
  );
};

// CSS Styles
const styles = {
  container: {
    padding: "20px",
    textAlign: "center",
  },
  section: {
    marginBottom: "20px",
  },
  card: {
    border: "1px solid #ccc",
    padding: "15px",
    marginBottom: "10px",
    borderRadius: "5px",
    textAlign: "left",
  },
};

export default SessionPage;
