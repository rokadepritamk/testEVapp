import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const Home = () => {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [devices, setDevices] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [platform, setPlatform] = useState(null);
  const [ui, setUi] = useState(null);

  const HERE_API_KEY = "UV-_hV7ccZE4V0eSC-lva1uToSfKYksP-yCATEO-XN0";
  const API_URL = "http://localhost:5000/api/devices";

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const response = await axios.get(API_URL);
        console.log("Full Axios Response:", response); // ✅ Log full response
        console.log("Devices Data:", response.data);  // ✅ Log only data array
    
        setDevices(response.data); // ✅ Ensure correct data assignment
      } catch (error) {
        console.error("Error fetching devices:", error);
      }
    };
    
    
    

    fetchDevices();

    const loadScript = (url, callback) => {
      const script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.onload = callback;
      document.body.appendChild(script);
    };

    loadScript("https://js.api.here.com/v3/3.1/mapsjs-core.js", () => {
      loadScript("https://js.api.here.com/v3/3.1/mapsjs-service.js", () => {
        loadScript("https://js.api.here.com/v3/3.1/mapsjs-ui.js", () => {
          loadScript("https://js.api.here.com/v3/3.1/mapsjs-mapevents.js", initMap);
        });
      });
    });

    return () => {
      document.querySelectorAll("script[src*='here.com']").forEach((s) => s.remove());
    };
  }, []);

  const initMap = () => {
    const platformInstance = new window.H.service.Platform({ apikey: HERE_API_KEY });
    setPlatform(platformInstance);

    const defaultLayers = platformInstance.createDefaultLayers();
    const isDark = darkMode ? defaultLayers.raster.terrain.map : defaultLayers.vector.normal.map;

    const mapInstance = new window.H.Map(mapRef.current, isDark, {
      zoom: 12,
      center: { lat: 18.5204, lng: 73.8567 },
    });

    new window.H.mapevents.Behavior(new window.H.mapevents.MapEvents(mapInstance));

    const uiInstance = window.H.ui.UI.createDefault(mapInstance, defaultLayers);
    
    // ✅ Remove extra UI elements
    uiInstance.removeControl("mapsettings");
    uiInstance.removeControl("zoom");
    uiInstance.removeControl("scalebar");

    setUi(uiInstance);
    setMap(mapInstance);
  };

  useEffect(() => {
    if (map && devices.length > 0) {
      devices.forEach((device) => {
        console.log("Checking Device:", device); // ✅ Log each device
  
        if (device.lat !== undefined && device.lng !== undefined) {  // Ensure lat/lng exist
          const location = new window.H.geo.Point(device.lat, device.lng);
          const marker = new window.H.map.Marker(location);
          marker.setData(device);
  
          marker.addEventListener("tap", (event) => {
            const clickedDevice = event.target.getData();
            showDevicePopup(clickedDevice, marker);
          });
  
          map.addObject(marker);
        } else {
          console.warn("Skipping device due to missing lat/lng:", device);
        }
      });
    }
  }, [map, devices]);
  
  
  


  // Show device popup with details
  const showDevicePopup = (device, marker) => {
    if (!map || !ui) return;
  
    document.getElementById("custom-popup")?.remove();
  
    const popupDiv = document.createElement("div");
    popupDiv.id = "custom-popup";
    popupDiv.innerHTML = `
      <div id="popup-content" style="
        width: 250px;
        padding: 12px;
        font-size: 14px;
        text-align: center;
        background: white;
        border-radius: 8px;
        box-shadow: 0px 4px 10px rgba(0,0,0,0.2);
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 1000;
      ">
        <strong>${device.location}</strong><br/>
        Status: <span style="color: ${device.status === "Available" ? "green" : "red"};">
          ${device.status}
        </span><br/>
        Charger Type: ${device.chargerType}<br/>
        <button id="get-directions" style="
          margin-top: 8px;
          padding: 6px 12px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 5px;
          cursor: pointer;
        ">
          Get Directions
        </button>
        <button id="connect-device" style="
          margin-top: 8px;
          padding: 6px 12px;
          background: #28a745;
          color: white;
          border: none;
          border-radius: 5px;
          cursor: pointer;
        ">
          Connect to Device
        </button>
        <button id="close-popup" style="
          position: absolute;
          top: 5px;
          right: 5px;
          background: transparent;
          border: none;
          font-size: 16px;
          cursor: pointer;
          color: #333;
        ">✖</button>
      </div>
    `;
  
    document.body.appendChild(popupDiv);
  
    setTimeout(() => {
      const closePopup = () => document.getElementById("custom-popup")?.remove();
  
      document.getElementById("close-popup")?.addEventListener("click", closePopup);
  
      document.getElementById("connect-device")?.addEventListener("click", () => {
        closePopup();
        window.location.href = "/qr-scanner";
      });
  
      document.getElementById("get-directions")?.addEventListener("click", () => {
        closePopup();
        getDirections(device.lat, device.lng);
      });
  
      // Close popup when clicking outside
      document.addEventListener(
        "click",
        (event) => {
          const popup = document.getElementById("custom-popup");
          if (popup && !popup.contains(event.target)) {
            popup.remove();
          }
        },
        { once: true }
      );
    }, 100);
  
  
    // 🔹 Adjust map if popup is out of view
    setTimeout(() => {
      const lookAtData = map.getViewModel().getLookAtData();
      const bubblePos = marker.getGeometry();
  
      if (bubblePos.lat > lookAtData.position.lat + 0.01) {
        map.setCenter({ lat: bubblePos.lat - 0.005, lng: bubblePos.lng }, true);
      }
    }, 200);
  };
  
  
  const getDirections = (lat, lng) => {
    if (!map || !platform) return;
  
    navigator.geolocation.getCurrentPosition((position) => {
      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;
  
      const apiKey = HERE_API_KEY;
  
      const routeUrl = `https://router.hereapi.com/v8/routes?transportMode=car&origin=${userLat},${userLng}&destination=${lat},${lng}&return=polyline,summary&apiKey=${apiKey}`;
  
      fetch(routeUrl)
        .then((response) => {
          if (!response.ok) throw new Error("Failed to fetch route");
          return response.json();
        })
        .then((data) => {
          if (!data.routes || data.routes.length === 0) {
            alert("No route found!");
            return;
          }
  
          const route = data.routes[0];
  
          // Remove previous routes
          map.getObjects().forEach((obj) => {
            if (obj instanceof window.H.map.Polyline) {
              map.removeObject(obj);
            }
          });
  
          // Create a new LineString
          const lineString = new window.H.geo.LineString();
  
          // Decode polyline and add points
          route.sections.forEach((section) => {
            const decodedPolyline = window.H.geo.LineString.fromFlexiblePolyline(section.polyline);
            for (let i = 0; i < decodedPolyline.getPointCount(); i++) {
              const point = decodedPolyline.extractPoint(i);
              lineString.pushPoint(point);
            }
          });
  
          // Create and add the polyline
          const routePolyline = new window.H.map.Polyline(lineString, {
            style: { strokeColor: "blue", lineWidth: 4 },
          });
  
          map.addObject(routePolyline);
          map.getViewModel().setLookAtData({ bounds: routePolyline.getBoundingBox() });
  
          setTimeout(() => {
            if (window.confirm("Open Google Maps for navigation?")) {
              window.open(`https://www.google.com/maps/dir/${userLat},${userLng}/${lat},${lng}/`, "_blank");
            }
          }, 500);
        })
        .catch((error) => console.error("Error fetching route:", error));
    });
  };
  

  return (
    <div style={styles.container(darkMode)}>
      <div style={styles.darkModeContainer}>
        <span style={{ color: darkMode ? "#fff" : "#000" }}>Dark Mode</span>
        <label className="switch">
          <input type="checkbox" checked={darkMode} onChange={() => setDarkMode(!darkMode)} />
          <span className="slider round"></span>
        </label>
      </div>

      <div ref={mapRef} style={styles.mapContainer}></div>

      <div style={styles.buttonContainer}>
      <button onClick={() => navigate("/sessions")}style={styles.button}>Sessions</button>
        <button style={styles.scanButton} onClick={() => navigate("/qr-scanner")}>Scan QR</button>
        <button onClick={() => navigate("/profile")} style={styles.button}>Profile</button>
        

      </div>
    </div>
  );
};

const styles = {
  container: (darkMode) => ({
    width: "100%",
    maxWidth: "400px",
    height: "100vh",
    backgroundColor: darkMode ? "#121212" : "#f0f0f0",
    color: darkMode ? "white" : "black",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    margin: "auto",
  }),
  mapContainer: {
    width: "100%",
    height: "70vh",
    borderRadius: "10px",
    overflow: "hidden",
  },
  buttonContainer: {
    position: "absolute",
    bottom: "20px",
    left: "50%",
    transform: "translateX(-50%)",
    width: "90%",
    maxWidth: "400px",
    display: "flex",
    justifyContent: "space-between",
  },
  button: {
    flex: 1,
    padding: "12px",
    fontSize: "16px",
    margin: "0 5px",
    borderRadius: "5px",
    border: "none",
    backgroundColor: "#007bff",
    color: "white",
    cursor: "pointer",
  },
  scanButton: {
    flex: 1.5,
    padding: "12px",
    fontSize: "16px",
    margin: "0 5px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#ff5722",
    color: "white",
    fontWeight: "bold",
    cursor: "pointer",
  },
};

export default Home;
