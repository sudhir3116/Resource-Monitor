# Sustainable Resource Monitor — Frontend

This is a Vite + React frontend for the Sustainable Resource Monitor project.

Quick start

1. cd frontend
2. npm install
3. npm run dev

The app will run at http://localhost:5173 and expects the backend at http://localhost:4000.

Endpoints used:
- POST /api/auth/register — register a new user
- POST /api/auth/login — login and receive a JWT
- GET /api/protected — example protected route (expects Authorization: Bearer <token>)

Notes
- Tokens are stored in sessionStorage under key `token` (cleared when browser/tab is closed).
- The Dashboard route is protected and will redirect to /login when unauthorized.
