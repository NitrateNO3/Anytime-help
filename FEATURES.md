# Anytime Help - Features Documentation

This document outlines the core features and architecture of the **Anytime Help** application, including both the mobile app and the admin web dashboard.

---

## 📱 Mobile App (Residents & Staff)

The mobile application is built using **React Native (Expo)** and provides specialized features based on the user's role (Resident, Staff, or Paid Staff).

### 1. Authentication & Security
- **Phone Number Registration & Login:** Users register and log in securely using their phone number.
- **Role-Based Access Control:** The app automatically directs users to their respective dashboards (Resident, Staff, or Paid Staff) based on their assigned role.
- **Global Session Management:** Integrated Socket.io and global Axios interceptors ensure that if an admin deletes a user, they are **instantly and forcefully logged out** from the app.

### 2. Resident Features
- **Real-Time Announcements:** A dedicated announcements section with a notification badge on the home screen. Socket.io is used for instant updates without needing to refresh.
- **Civic Issue Complaints:** Residents can raise complaints with photos, GPS location, and detailed descriptions.
- **Paid Services Booking:** Residents can browse and book verified paid services (e.g., Electrician, Plumber).
- **Community Directory:** A searchable directory of important contacts within the community (e.g., Security, RWA Members).
- **Force Update Mechanism:** The app automatically checks the backend for the minimum required version. If the app is outdated, a non-dismissible popup forces the user to redirect to the Play Store for the latest update.
- **Multi-Language Support (i18n):** Users can switch between English and Hindi/Hinglish translations effortlessly.

### 3. Staff Features
- **Complaint Management:** Staff members receive complaints assigned to their category (e.g., Plumbing, Electrical) and can update the status (In Progress, Resolved).
- **Real-Time Sync:** Socket.io ensures staff members see new complaints the moment they are raised.

### 4. Paid Staff Features
- **Service Bookings:** Paid staff receive service requests directly on their dashboard and can manage appointments and statuses.

---

## 💻 Admin Web Dashboard

The Admin dashboard is built using **React (Vite)** and serves as the centralized control panel for the RWA/Management.

### 1. Announcements & Broadcasts
- Admins can create and broadcast announcements.
- **Targeted Messaging:** Announcements can be sent to all residents globally or filtered by specific phases/blocks.

### 2. Resident Management
- **Directory List:** View, search, and filter all registered residents by phase or relation (Owner/Tenant).
- **Manual Resident Addition:** Admins can manually add new residents by entering their details (Name, Phone Number, Phase, Block, etc.). This allows the resident to bypass registration and simply "Log In" with their phone number on the app.
- **Delete Resident:** Admins can remove residents, instantly revoking their app access via real-time socket events.

### 3. Staff & Paid Services Management
- **Add Staff:** Register new staff members and assign them to specific complaint categories.
- **Service Categories:** Add and manage paid service categories (e.g., Carpentry, Cleaning) with pricing and descriptions.

### 4. Complaints Overview
- Admins have a global view of all complaints raised by residents.
- They can monitor the status and see which staff member is handling the issue.

---

## ⚙️ Backend (Node.js + Express + MongoDB)

- **REST API:** A robust API built with Express to handle authentication, data retrieval, and creation.
- **Socket.io Integration:** Handles real-time events (`user_deleted`, `announcement_changed`, `complaint_changed`) to keep the mobile and web clients perfectly in sync.
- **App Configuration Route:** A dedicated `/api/config` route to manage global app settings like `min_version` for the Force Update mechanism.
- **Security Middleware:** Custom JWT verification middleware that actively checks the MongoDB database to ensure the user still exists before granting access.
