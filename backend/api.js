// api.js

import axios from 'axios';

const API_URL = 'https://testevapp-2.onrender.com'; // Replace with your backend API URL

export const getDevices = () => axios.get(`${API_URL}/devices`);
