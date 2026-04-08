export const isTokenValid = () => {
  const token = localStorage.getItem("token");

  if (!token) return false;

  try {
    // JWT structure is header.payload.signature
    const parts = token.split(".");
    if (parts.length !== 3) return false;

    // Decode payload
    const payload = JSON.parse(atob(parts[1]));
    const expiry = payload.exp * 1000;

    return Date.now() < expiry;
  } catch (err) {
    return false;
  }
};
