import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000", // FastAPI backend URL
});

// Set Authorization header
export function setToken(token: string | null) {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }
}

const savedToken = localStorage.getItem("token");
if (savedToken) {
  setToken(savedToken);
}

export default api;
