# Admin Authentication System

## Overview
Secure cookie-based authentication system for admin panel access with JWT tokens, brute-force protection, and 24-hour session management.

## Core Functionality
- Username/password authentication via environment variables
- HTTP-only cookie-based sessions with JWT tokens
- Brute-force protection (10 attempts, 30-minute lockout per IP)
- 24-hour session expiry with automatic cleanup
- Cross-domain cookie support for production environments

## Key Features
- **Login**: `/api/admin/login` - Validates credentials and sets secure cookie
- **Logout**: `/api/admin/logout` - Clears authentication cookie
- **Auth Check**: `/api/admin/auth/check` - Validates current session without requiring auth
- **Middleware**: `authenticateAdmin` - Protects all admin routes
- **Rate Limiting**: IP-based failed attempt tracking

## Files Involved
- `backend/server.js` (lines 95-233): Complete auth implementation
- `admin-panel/src/components/AdminInterface.jsx`: Frontend login forms and auth state management

## Configuration
```javascript
// Environment variables required
ADMIN_USERNAME=your_username
ADMIN_PASSWORD=your_secure_password
JWT_SECRET=your_jwt_secret
```

## Security Features
- JWT tokens with `type: 'admin'` verification
- HTTP-only cookies (prevents XSS attacks)
- Secure flag in production (HTTPS only)
- sameSite: 'none' for cross-domain support
- Automatic session expiry and cleanup
- IP-based brute-force protection with temporary lockouts

## API Endpoints
```
POST /api/admin/login
POST /api/admin/logout  
GET /api/admin/auth/check
```

## Database Dependencies
None - uses in-memory storage for failed attempts (Redis recommended for production scaling)

## Error Handling
- Invalid credentials: 401 with remaining attempts counter
- Too many failures: 429 with lockout expiry time
- Expired tokens: 401 with session expired message
- Missing credentials: 401 with authentication required message