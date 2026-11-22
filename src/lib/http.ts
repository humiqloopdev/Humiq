// src/lib/http.ts
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// The backend (Auth.js) keeps the session in an HttpOnly cookie, so requests must carry credentials.
// There are no tokens to attach or refresh; a 401 simply means the session is gone.
const http = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

export default http;
