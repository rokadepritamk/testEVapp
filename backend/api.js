// api.js

import axios from 'axios';

const API_URL = 'http://localhost:5000'; // Replace with your backend API URL

export const getDevices = () => axios.get(`${API_URL}/devices`);
