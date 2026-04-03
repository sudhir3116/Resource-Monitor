import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    withCredentials: true, // Crucial for session cookies/Passport
    timeout: 30000 // increase timeout to 30 seconds
});

export default api;
