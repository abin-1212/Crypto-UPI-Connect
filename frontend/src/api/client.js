import axios from "axios";
import { showToast } from "../utils/toast";

const api = axios.create({
  baseURL: "http://localhost:5000",
  timeout: 15000,
});

// Request interceptor - add JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If the caller wants to handle toasts itself, skip interceptor toasts
    const suppressToast = error.config?._suppressToast;

    const message = error.response?.data?.message || error.message || "Something went wrong";

    // Handle authentication errors — clear tokens silently,
    // let React auth state handle the redirect (no full page reload!)
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      return Promise.reject(error);
    }

    // Handle network errors
    if (!error.response) {
      if (!suppressToast) {
        showToast.error("Network error. Please check your connection.");
      }
      return Promise.reject(error);
    }

    // Handle client errors (400-499) except 401
    if (error.response.status >= 400 && error.response.status < 500) {
      if (!suppressToast) {
        showToast.error(message);
      }
      return Promise.reject(error);
    }

    // Handle server errors (500+)
    if (error.response.status >= 500) {
      if (!suppressToast) {
        showToast.error("Server error. Please try again later.");
      }
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

export default api;
