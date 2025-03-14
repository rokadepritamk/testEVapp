import React from "react";
import { useNavigate } from "react-router-dom";

const Profile = () => {
  const navigate = useNavigate();
  
  // ✅ Ensure safe parsing of user data
  const user = localStorage.getItem("user");
  const userData = user && user !== "undefined" ? JSON.parse(user) : null;

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    sessionStorage.removeItem("lastPage"); // Clear last page
    navigate("/");
  };

  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm("Are you sure you want to delete your account? This action is irreversible.");
    if (!confirmDelete) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:5000/api/auth/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        alert("Your account has been deleted.");
        handleLogout(); // Log the user out after deletion
      } else {
        alert("Failed to delete account. Please try again.");
      }
    } catch (error) {
      console.error("Delete Account Error:", error);
      alert("An error occurred. Please try again later.");
    }
  };

  return (
    <div style={styles.container}>
      <h2>Profile</h2>
      {userData ? (
        <>
          <p><strong>Name:</strong> {userData.name}</p>
          <p><strong>Email:</strong> {userData.email}</p>
          <p><strong>Mobile:</strong> {userData.mobile}</p>
          <p><strong>Vehicle Type:</strong> {userData.vehicleType || "Not provided"}</p> {/* ✅ Added Vehicle Type */}
          <button onClick={handleLogout} style={styles.logoutButton}>
            Logout
          </button>
          <button onClick={handleDeleteAccount} style={styles.deleteButton}>
            Delete Account
          </button>
        </>
      ) : (
        <p>No user data found</p>
      )}
    </div>
  );
};

const styles = {
  container: {
    textAlign: "center",
    padding: "20px",
  },
  logoutButton: {
    marginTop: "20px",
    padding: "10px 20px",
    fontSize: "16px",
    backgroundColor: "red",
    color: "white",
    border: "none",
    cursor: "pointer",
  },
  deleteButton: {
    marginTop: "10px",
    padding: "10px 20px",
    fontSize: "16px",
    backgroundColor: "darkred",
    color: "white",
    border: "none",
    cursor: "pointer",
  },
};

export default Profile;
