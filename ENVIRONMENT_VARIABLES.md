# 🏗️ Environment Variables Configuration Guide

## Backend (.env)

Create a `.env` file in the `backend/` directory with the following variables:

```env
# Server Configuration
PORT=4000
NODE_ENV=development

# Database
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/database_name

# JWT Authentication
JWT_SECRET=your_super_secret_jwt_key_minimum_32_characters

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

# Google OAuth (Optional)
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Email Domain Restriction (Optional - for institutional deployment)
# Leave empty to allow any Google account
# Use comma-separated list to restrict to specific domains
ALLOWED_EMAIL_DOMAINS=college.edu,university.edu

# Email Service (Optional - for reports)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=noreply@college.edu
```

---

## Frontend (.env)

Create a `.env` file in the `frontend/` directory:

```env
# Google OAuth Client ID (must match backend)
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com

# API URL (optional - defaults to proxy)
# VITE_API_URL=http://localhost:4000
```

---

## Environment Variable Details

### **Required Variables**

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Backend server port | `4000` |
| `MONGO_URI` | MongoDB connection string | `mongodb+srv://...` |
| `JWT_SECRET` | Secret key for JWT tokens (min 32 chars) | `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:5173` |

### **Optional Variables**

| Variable | Description | Default | Use Case |
|----------|-------------|---------|----------|
| `ALLOWED_EMAIL_DOMAINS` | Restrict Google OAuth to specific domains | (empty - allow all) | Institutional deployment |
| `NODE_ENV` | Environment mode | `development` | Production deployment |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | (empty - OAuth disabled) | Google authentication |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | (empty - OAuth disabled) | Google authentication |
| `EMAIL_*` | SMTP settings for email reports | (empty - no emails) | Daily report notifications |

---

## Security Best Practices

### **1. JWT_SECRET**
- ✅ Use minimum 32 characters
- ✅ Use random alphanumeric characters
- ❌ Never commit to Git
- ❌ Never share publicly

**Generate a secure secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### **2. MongoDB URI**
- ✅ Use MongoDB Atlas for production
- ✅ Whitelist specific IPs only
- ❌ Never expose connection string

### **3. Google OAuth**
- ✅ Use separate client IDs for dev/production
- ✅ Configure authorized redirect URIs properly
- ✅ Enable domain restriction for institutions
- ❌ Never commit credentials to Git

---

## Domain Restriction Setup (Institutional Use)

For campus-wide deployment, restrict Google OAuth to your institution's email domain:

### **Step 1: Configure Backend**
```env
# backend/.env
ALLOWED_EMAIL_DOMAINS=college.edu,university.edu
```

### **Step 2: Test Domain Restriction**

**✅ Allowed:**
- `student@college.edu`
- `faculty@university.edu`

**❌ Blocked:**
- `personal@gmail.com`
- `student@othercollege.edu`

### **Step 3: Error Message**
Users with non-allowed domains will see:
> "Access restricted. Only college.edu, university.edu email addresses are allowed."

---

## Development vs Production

### **Development (.env)**
```env
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
ALLOWED_EMAIL_DOMAINS=
```

### **Production (.env.production)**
```env
NODE_ENV=production
FRONTEND_URL=https://ecomonitor.college.edu
ALLOWED_EMAIL_DOMAINS=college.edu
```

---

## Checklist Before Deployment

- [ ] All required variables set
- [ ] JWT_SECRET is strong (32+ chars)
- [ ] MongoDB URI has proper access controls
- [ ] FRONTEND_URL matches actual domain
- [ ] ALLOWED_EMAIL_DOMAINS configured for institution
- [ ] Google OAuth credentials valid
- [ ] `.env` file in `.gitignore`
- [ ] Environment variables documented for team

---

## Troubleshooting

### **Issue: "Cannot connect to database"**
**Solution:** Check `MONGO_URI` format and network access

### **Issue: "Invalid token"**
**Solution:** Verify `JWT_SECRET` matches between restarts

### **Issue: "CORS error"**
**Solution:** Ensure `FRONTEND_URL` matches your frontend domain

### **Issue: "Google OAuth fails"**
**Solution:** Verify `GOOGLE_CLIENT_ID` and check authorized redirect URIs

### **Issue: "Domain restriction not working"**
**Solution:** Check `ALLOWED_EMAIL_DOMAINS` format (comma-separated, no spaces)

---

**Need help?** See `README.md` for full setup guide.
