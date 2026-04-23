# ClockNet Admin Dashboard - Setup & Usage Guide

## 📋 Overview

The Admin Dashboard is a comprehensive monitoring and management interface for the ClockNet attendance system. It provides real-time visibility into all attendance activity, device management, and security audit logs.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

This installs `bcryptjs` which is required for password hashing.

### 2. Run Database Migration

```bash
npm run prisma:migrate
```

This will:
- Create all new tables (AdminUser, enhanced AuditLog)
- Add new columns to existing tables (userAgent, etc.)
- Create indexes for optimal query performance

### 3. Seed the Database with Default Admin User

```bash
npm run prisma:seed
```

This creates a default admin account:
- **Email**: `admin@clocknet.local`
- **Password**: `admin123456`
- **Role**: `SUPER_ADMIN`

⚠️ **Important**: Change the password immediately on first login.

### 4. Start the Development Server

```bash
npm run dev
```

### 5. Access the Admin Dashboard

Navigate to: `http://localhost:3000/admin/login`

Use the default credentials from step 3.

---

## 📊 Dashboard Features

### 1. **Dashboard** (`/admin/dashboard`)
- **Real-time Statistics**:
  - Total registered devices
  - Currently active users
  - Today's check-ins
  - Recent critical security events
- **Live Activity Feed**: Shows all active sessions with real-time updates
- **Check-in Distribution**: Hourly peak times for attendance

### 2. **Devices** (`/admin/devices`)
- View all registered devices
- Device status (checked-in / checked-out)
- Total check-ins per device
- Suspicious activity count
- Pagination support
- Last seen timestamps

### 3. **Attendance Records** (`/admin/attendance`)
- Full check-in/check-out history
- Filter by:
  - Device ID
  - IP address
  - Date range
  - Status (active/closed)
- Calculate session duration
- Pagination (20 records per page)

### 4. **Audit Logs** (`/admin/logs`)
- Security event tracking
- Filter by:
  - Severity (Critical, Warning, Info)
  - Event type
  - Device ID
  - IP address
- Event summary statistics
- View blocked/flagged requests

---

## 🔐 Security Features

### Authentication
- Session-based authentication using httpOnly cookies
- 24-hour session duration
- Automatic logout on session expiry
- Middleware protection on all `/admin/*` routes

### Admin User Roles

```
ADMIN       - Standard admin access to all features
SUPER_ADMIN - Full access including user management
ANALYST     - Read-only analytics and reporting
```

### Audit Logging

Track security events:
- `INVALID_IP` - Request from unexpected IP
- `DUPLICATE_REQUEST` - Duplicate request detected
- `REPLAY_ATTEMPT` - Replay attack detected
- `BLOCKED_REQUEST` - Request blocked due to rules
- `ANOMALOUS_PATTERN` - Unusual attendance pattern
- `RATE_LIMIT_EXCEEDED` - Rate limit triggered
- `DEVICE_FINGERPRINT_MISMATCH` - Device fingerprint changed
- `UNUSUAL_TIME` - Check-in at unusual time

Event Severity Levels:
- `CRITICAL` - Immediate action required
- `WARNING` - Potential issue detected
- `INFO` - Informational event

---

## 🗄️ Database Schema

### New Models

#### `AdminUser`
```typescript
{
  id: String          // Primary key
  email: String       // Unique email
  password: String    // Bcrypt hashed
  name: String        // Admin name
  role: AdminRole     // ADMIN | SUPER_ADMIN | ANALYST
  isActive: Boolean   // Account status
  createdAt: DateTime
  updatedAt: DateTime
  lastLogin: DateTime // Tracks last login time
}
```

#### `AuditLog`
```typescript
{
  id: String
  deviceId: String
  deviceRef: String (Foreign Key to Device)
  eventType: AuditEventType  // See security events above
  severity: AuditSeverity    // CRITICAL | WARNING | INFO
  description: String        // Human-readable description
  ip: String                 // Source IP
  userAgent: String          // Browser/device info
  fingerprint: String        // Device fingerprint
  attemptCount: Int          // Number of attempts
  isBlocked: Boolean         // Whether request was blocked
  metadata: String           // JSON field for additional data
  resolvedAt: DateTime       // When issue was resolved
  createdAt: DateTime
  updatedAt: DateTime
}
```

### Enhanced Existing Models

#### `AttendanceSession`
- Added `checkInUserAgent` and `checkOutUserAgent` fields
- Enhanced indexing on date ranges

#### `Device`
- New relationship to `AuditLog`

---

## 🛠️ API Endpoints

### Authentication

```http
POST /api/admin/auth/login
{
  "email": "admin@clocknet.local",
  "password": "admin123456"
}

POST /api/admin/auth/logout
```

### Dashboard

```http
GET /api/admin/dashboard/stats
Response: {
  stats: {
    totalDevices: 42,
    activeUsers: 15,
    todayCheckIns: 87,
    activeSessions: 15,
    recentCriticalEvents: 2
  },
  peakHours: [
    { hour: 9, count: 23 },
    { hour: 10, count: 18 }
  ]
}
```

### Devices

```http
GET /api/admin/devices?page=1&pageSize=20
```

### Attendance Records

```http
GET /api/admin/attendance?page=1&pageSize=50&status=ACTIVE&deviceId=device-123&ip=192.168.1.1&startDate=2026-04-01&endDate=2026-04-30
```

### Audit Logs

```http
GET /api/admin/audit-logs?page=1&pageSize=50&severity=CRITICAL&eventType=INVALID_IP&deviceId=device-123&ip=192.168.1.1&isBlocked=true&startDate=2026-04-01
```

---

## 📡 Real-time Updates

The dashboard implements polling-based real-time updates:
- Dashboard stats refresh every **10 seconds**
- Activity feed updates every **5 seconds**
- Manual refresh available via browser refresh

For WebSocket support, consider implementing Socket.io or use Server-Sent Events (SSE).

---

## 🎨 UI Styling

The Admin Dashboard uses:
- **CSS Modules** for scoped styling
- **CSS Variables** for theming (dark mode optimized)
- **Responsive Design** for mobile support
- **Custom Icons** using unicode characters

Color Scheme:
- Primary: `#4f8cff` (Blue)
- Success: `#22c55e` (Green)
- Warning: `#f59e0b` (Amber)
- Error: `#ef4444` (Red)
- Background: `#09111f` (Dark Blue)

---

## 📁 File Structure

```
app/admin/
├── login/
│   ├── page.tsx          # Login page
│   └── login.module.css   # Login styles
├── dashboard/
│   ├── page.tsx          # Dashboard page
│   └── dashboard.module.css
├── devices/
│   ├── page.tsx          # Devices list
│   └── devices.module.css
├── attendance/
│   ├── page.tsx          # Attendance records
│   └── attendance.module.css
├── logs/
│   ├── page.tsx          # Audit logs
│   └── logs.module.css
├── layout.tsx            # Admin layout with nav
└── layout.module.css

app/api/admin/
├── auth/
│   ├── login/route.ts
│   └── logout/route.ts
├── dashboard/
│   └── stats/route.ts
├── devices/route.ts
├── attendance/route.ts
└── audit-logs/route.ts

components/admin/
├── admin-nav.tsx         # Navigation sidebar
├── admin-nav.module.css
├── stat-card.tsx         # Dashboard stat cards
├── stat-card.module.css
├── activity-feed.tsx     # Live activity feed
└── activity-feed.module.css

lib/
├── auth.ts               # Authentication utilities
├── session.ts            # Session management
├── ...existing files

prisma/
├── schema.prisma         # Updated schema
├── seed.ts               # Database seed script
└── migrations/           # Auto-generated migrations
```

---

## 🔄 Data Flow

```
User Login
    ↓
[POST /api/admin/auth/login]
    ↓
Authenticate Admin (bcrypt verify)
    ↓
Create Session (httpOnly cookie)
    ↓
Redirect to Dashboard
    ↓
Middleware checks session cookie
    ↓
Access granted to /admin routes
    ↓
Fetch data from API endpoints
    ↓
Update UI with real-time data
```

---

## 🛡️ Security Best Practices

1. **Password Management**
   - Passwords hashed with bcryptjs (10 salt rounds)
   - Never log passwords
   - Enforce password changes on first login

2. **Session Security**
   - HttpOnly cookies prevent XSS attacks
   - Secure flag set in production
   - SameSite: Strict prevents CSRF

3. **API Protection**
   - All admin endpoints require valid session
   - Middleware validates session before processing
   - Input validation on all endpoints

4. **Audit Trail**
   - All security events logged to AuditLog
   - IP addresses tracked
   - Device fingerprints stored
   - Attempt counts for suspicious patterns

---

## 🐛 Troubleshooting

### Login not working
- Verify database migration ran: `npm run prisma:migrate`
- Verify seed script executed: `npm run prisma:seed`
- Check DATABASE_URL environment variable

### Session expires too quickly
- Default: 24 hours (configurable in `lib/session.ts`)
- Check browser cookie settings
- Clear cookies and retry

### Data not loading
- Verify API endpoints are accessible
- Check browser console for fetch errors
- Verify database has attendance data

### Styling issues
- Verify CSS variables defined in `app/globals.css`
- Check that CSS modules are in same directory as components
- Verify Next.js version supports CSS modules

---

## 📈 Future Enhancements

- [ ] Export reports (PDF/CSV)
- [ ] WebSocket real-time updates
- [ ] Advanced analytics with charts
- [ ] User management interface
- [ ] Email notifications for critical events
- [ ] Bulk operations on devices
- [ ] Advanced filtering and search
- [ ] Automated remediation workflows
- [ ] Integration with external systems

---

## 📞 Support

For issues or questions:
1. Check this guide first
2. Review error messages in browser console
3. Check server logs: `npm run db:logs`
4. Verify all migrations ran successfully

---

## 📝 License

Part of ClockNet Attendance System
