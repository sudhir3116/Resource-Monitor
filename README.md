# Sustainable Resource Consumption Monitor

A full-stack MERN application to track resource usage, generate alerts based on thresholds, and visualize daily and monthly consumption.

## 🚀 Features
- Google OAuth + Manual Authentication
- Resource Usage Tracking
- Dynamic Dashboard with Charts
- Alert Rules & Alert Logs
- Email Notification System
- Dark/Light Theme Toggle
- Responsive UI

## 🛠 Tech Stack
Frontend: React + Vite  
Backend: Node.js + Express  
Database: MongoDB  
Authentication: JWT + Google OAuth  
Email: Nodemailer  

## 📦 Installation

Backend:
cd backend
npm install
node app.js

Frontend:
cd frontend
npm install
npm run dev

## ⚙️ Environment Variables

Create a .env file in backend:

PORT=5000
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_secret
GOOGLE_CLIENT_ID=your_google_id
GOOGLE_CLIENT_SECRET=your_google_secret
SMTP_USER=your_mail_user
SMTP_PASS=your_mail_password