# Production Authentication Architecture

## 🔐 Security Overview
This document details the production-grade authentication safeguards implemented in the Sustainable Resource Monitor.

## 1. HTTP-Only Cookie Strategy
**Mechanism:** 
- JWTs are stored **only** in HTTP-only cookies.
- JavaScript cannot access these cookies, preventing XSS token theft.
- `SameSite: Strict` prevents CSRF attacks.
- `Secure: true` (in production) ensures transmission over HTTPS only.

## 2. Server Restart Invalidation (Strict Sessions)
**Requirement:** `If server restarts → user must login again`
**Implementation:**
- A unique `SERVER_INSTANCE_ID` is generated cryptographically on every server start.
- All Access and Refresh tokens are signed with this ID in the payload.
- **Middleware Logic:**
  - Every protected request checks if `token.instanceId === currentServerId`.
  - If mismatch (server restarted), request is rejected (401).
  - Client is forced to re-authenticate.

## 3. Token Lifecycle & Rotation
- **Access Token:** 15 minutes (Short-lived)
- **Refresh Token:** 7 days (Long-lived)
- **Auto-Refresh:** Frontend intercepts 401 errors and silently refreshes the session.
- **Auto-Logout:** If refresh fails (expired or invalid), user is immediately logged out.

## 4. Frontend Resilience
- **AuthContext:** 
  - Centralized session state.
  - Listens for global `auth:unauthorized` events to trigger logout.
  - Prevents "profile flickering" by ensuring loading state completes before rendering.
- **API Interceptor:** 
  - Wraps all fetch requests.
  - Automatically handles credentials inclusion.
  - Dispatches logout events on 401 failures.

## 5. Files Modified
- `backend/config/runtime.js` (System ID generation)
- `backend/controllers/authController.js` (Token signing with ID)
- `backend/middleware/authMiddleware.js` (Token verification)
- `frontend/src/context/AuthContext.jsx` (Global state & listeners)
- `frontend/src/services/api.js` (Error dispatching)

## 🚀 Testing Scenarios (Verified)
1. **Server Restart:** Stop backend -> Start backend -> Refresh frontend -> **User Logged Out** ✅
2. **Token Expiry:** Wait 15m -> Action -> **Silent Refresh Success** ✅
3. **Session Invalid:** Manually clear cookies -> Action -> **Redirect to Login** ✅
