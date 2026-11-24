# Anytime-Help: AWS Architecture, CI/CD & Developer Handover Guide

> **Target Audience:** Backend Developers, DevOps Engineers, System Architects, Mobile/Web Frontend Developers  
> **Environment:** Production (AWS `ap-southeast-2` - Sydney)  
> **Last Updated:** November 2026  
> **Status:** Production Live & Automated (100% AWS Native + CI/CD Active)

---

## 1. Executive Summary & Architecture Overview

The Anytime-Help platform has transitioned from external third-party managed services (**Render.com**, **MongoDB Atlas**, and **Cloudinary**) to a unified, high-performance, cost-effective infrastructure hosted natively within **Amazon Web Services (AWS)** with **Automated GitHub Actions CI/CD**.

### Infrastructure Comparison

| Layer | Legacy Architecture | New AWS Native Architecture | Status |
| :--- | :--- | :--- | :--- |
| **Compute / API Server** | Render.com Web Service | **AWS EC2 (`t3.micro`)** + PM2 + Nginx | Active (`api.anytimehelp.co.in`) |
| **CI/CD Automation** | Manual `git pull` on server | **GitHub Actions CI/CD** (Automated SSH Deploy) | **Active & Live** on push to `main` |
| **Database** | MongoDB Atlas (Cloud Replica Set) | **Amazon DocumentDB** (`anytimehelp-db`) | 100% Migrated (4,385 docs, 0 data loss) |
| **Media / Asset Storage**| Cloudinary | **Amazon S3** (`anytimehelp-media`) | 100% Migrated & Active (`uploadToS3`) |
| **Visual DB Management** | MongoDB Compass via Tunnel | **Anytime Studio UI** (`/orm-db`) | Built-in lightweight web dashboard |
| **Authentication / IAM** | Hardcoded API keys in `.env` | **EC2 IAM Role** (`EC2-S3-Role`) + TLS | Keyless IAM Integration (Zero Secrets on EC2) |
| **Frontend & Mobile Clients**| Pointed to `onrender.com` | **Pointed to `api.anytimehelp.co.in`** | 100% Cutover (Zero Render traffic) |
| **Backups** | Atlas automated backups | **DocumentDB Automated + S3 Archive** | Permanent snapshot in S3 bucket |

```mermaid
flowchart TD
    subgraph DevelopmentWorkflow ["CI/CD & Developer Workflow"]
        Developer["Developer / Team"]
        GitHub["GitHub Repo (main branch)"]
        GHActions["GitHub Actions Runner (.github/workflows/deploy.yml)"]
        Developer -->|git push origin main| GitHub
        GitHub -->|Webhook Trigger| GHActions
    end

    subgraph AWSCloud ["AWS Cloud (ap-southeast-2 - Sydney)"]
        subgraph VPC ["Default VPC (172.31.0.0/16)"]
            subgraph EC2Host ["EC2 Backend Instance (16.178.168.218)"]
                Nginx["Nginx 1.28.3 Reverse Proxy (:443 SSL)"]
                PM2_Backend["PM2: anytime-backend (Node.js :5000)"]
                PM2_Studio["PM2: anytime-studio (Node.js :8080)"]
                Cert["RDS CA Cert: global-bundle.pem"]
                Nginx -->|/api/*| PM2_Backend
                Nginx -->|/orm-db/*| PM2_Studio
                PM2_Backend --> Cert
                PM2_Studio --> Cert
            end

            subgraph DocDBCluster ["Amazon DocumentDB (anytimehelp-db)"]
                PrimaryInstance["db.t3.medium (Primary Node)"]
                DocDBStorage["Cluster Storage (Auto-scaling)"]
                PrimaryInstance --> DocDBStorage
            end
        end

        subgraph S3Storage ["Amazon S3 Object Storage (anytimehelp-media)"]
            S3Cat["/categories"]
            S3Comp["/complaints"]
            S3Ban["/banners"]
            S3Staff["/staff-banners"]
            S3Bottom["/bottom-banners"]
            S3Stories["/stories"]
            S3Backups["/backups"]
        end

        IAMRole["IAM Role: EC2-S3-Role (AmazonS3FullAccess)"]
    end

    subgraph ClientLayer ["Production Clients"]
        Mobile["Mobile App (Expo / React Native)"]
        AdminWeb["Admin Web Dashboard (Vercel)"]
    end

    GHActions -->|Automated SSH (:22) Deploy| EC2Host
    Mobile -->|HTTPS REST / WSS| Nginx
    AdminWeb -->|HTTPS REST| Nginx
    PM2_Backend -->|TLS Port 27017 (Mongoose)| PrimaryInstance
    PM2_Studio -->|TLS Port 27017 (Mongoose)| PrimaryInstance
    EC2Host -.->|Assumes Keyless Role| IAMRole
    IAMRole -.->|Read / Write / Delete| S3Storage
    Mobile -->|Direct CDN Load| S3Storage
    AdminWeb -->|Direct CDN Load| S3Storage
```

---

## 2. CI/CD Automated Deployment Pipeline

A fully automated Continuous Deployment (CI/CD) pipeline is configured via **GitHub Actions**.

### 2.1 How it Works

```
Developer pushes code ➔ GitHub Actions triggers ➔ Connects to EC2 via SSH ➔ Pulls latest code ➔ Installs deps ➔ Restarts PM2 ➔ Live on AWS!
```

* **Workflow File:** [`.github/workflows/deploy.yml`](file:///.github/workflows/deploy.yml)
* **Trigger Conditions:**
  1. Any `git push` to `main` branch containing changes in `backend/**`.
  2. Manual trigger from GitHub UI via `workflow_dispatch` ("Run workflow" button).

### 2.2 GitHub Secrets Configured
Under repository **Settings ➔ Secrets and variables ➔ Actions**:

| Secret Name | Purpose | Example / Value |
| :--- | :--- | :--- |
| `EC2_HOST` | Domain or Public IP of EC2 | `api.anytimehelp.co.in` (or `16.178.168.218`) |
| `EC2_USER` | SSH user | `ubuntu` |
| `EC2_SSH_KEY` | Private RSA Key for EC2 access | Contents of `anytime-help-key.pem` |
| `EC2_PORT` | SSH Port (default: 22) | `22` |

### 2.3 Commands Executed on EC2 During Deployment
Every automated deployment runs the following commands on the server:
```bash
cd ~/Anytime-help
git pull origin main
cd backend
npm install --omit=dev
pm2 restart anytime-backend --update-env
pm2 restart anytime-studio || true
pm2 status
```

---

## 3. Infrastructure & Network Inventory

### 3.1 Compute: EC2 Instance
* **Instance ID:** `i-0a648e86ae106bd90`
* **Public IPv4:** `16.178.168.218`
* **Private IPv4:** `172.31.34.31`
* **Region / Zone:** `ap-southeast-2` (Sydney)
* **Instance Type:** `t3.micro`
* **Operating System:** Ubuntu 24.04 LTS
* **Domain Name:** `https://api.anytimehelp.co.in`
* **Web Server:** Nginx 1.28.3 acting as SSL reverse proxy with Let's Encrypt TLS:
  * `/api` ➔ Proxies to `http://localhost:5000` (Node.js API)
  * `/socket.io` ➔ Proxies WebSocket traffic to `http://localhost:5000`
  * `/orm-db` ➔ Proxies to `http://localhost:8080` (Anytime Studio UI)
* **Process Manager:** PM2 (manages `anytime-backend` on port 5000 and `anytime-studio` on port 8080).

### 3.2 Database: Amazon DocumentDB
* **Cluster Identifier:** `anytimehelp-db`
* **Cluster Endpoint:** `anytimehelp-db.cluster-c5iso4g2mcoq.ap-southeast-2.docdb.amazonaws.com:27017`
* **Engine Version:** `8.0.3` (MongoDB wire-protocol compatible)
* **Instance Class:** `db.t3.medium` (Single instance regional cluster)
* **Master Username:** `anytimehelpadmin`
* **Application Database:** `anytime_help`
* **Authentication Database:** `admin`
* **Security Group:** `sg-02149aaacb1143902` (Inbound Port `27017` open to VPC).
* **TLS Encryption:** **Enforced**. Requires Amazon RDS Global Root CA certificate (`global-bundle.pem`).

### 3.3 Storage: Amazon S3
* **Bucket Name:** `anytimehelp-media`
* **Region:** `ap-southeast-2` (Sydney)
* **Public Access Policy:** `PublicReadGetObject` enabled for public images.
* **CORS Configuration:** `GET`, `HEAD` methods allowed for all origins (`*`).
* **Base URL Format:** `https://anytimehelp-media.s3.ap-southeast-2.amazonaws.com/<folder>/<filename>`
* **Folder Structure:**
  * `categories/` - Category icons and thumbnails.
  * `banners/` - Home screen promotional sliders.
  * `staff-banners/` - Notice board & staff banners.
  * `bottom-banners/` - Footer marketing cards.
  * `complaints/` - User-submitted complaint photos (before/after/replies).
  * `stories/` - Channel and community stories.
  * `announcements/` - Community announcements.
  * `backups/` - Database archives (`atlas_backup_YYYYMMDD.gz`).

### 3.4 IAM Security (Keyless S3 Access)
* **Role Name:** `EC2-S3-Role`
* **Target Entity:** Attached directly to EC2 instance `i-0a648e86ae106bd90` via AWS Instance Profile.
* **Policies:** `AmazonS3FullAccess`
* **Why this is important for developers:** The Node.js AWS SDK (`@aws-sdk/client-s3`) automatically fetches temporary security credentials from EC2 metadata. **No access keys or secrets are stored in `.env` files in production.**

---

## 4. Visual Database Browser: Anytime Studio

To allow developers and administrators to browse, search, and manage DocumentDB data visually without needing MongoDB Compass or SSH tunneling, a custom lightweight dashboard is running on EC2.

* **URL:** `https://api.anytimehelp.co.in/orm-db`
* **Port:** `8080` (managed by PM2 as `anytime-studio`)
* **Features:**
  * Displays all 24 collections and real-time document counts.
  * Interactive pagination, column viewer, and JSON inspection.
  * Live regex search across all fields.
  * Consumes under **25MB RAM**, making it extremely lightweight for `t3.micro`.

---

## 5. Media Upload Architecture (`s3Uploader.js`)

All media uploads are processed using AWS S3 through [`backend/utils/s3Uploader.js`](file:///backend/utils/s3Uploader.js).

### 5.1 How to Upload Media in Route Handlers

```javascript
const { uploadToS3, deleteFromS3 } = require('../utils/s3Uploader');

// 1. Uploading from Multer (req.file) or base64 Data URI string:
const result = await uploadToS3(req.file, 'banners');
// result.secure_url => "https://anytimehelp-media.s3.ap-southeast-2.amazonaws.com/banners/1732...jpg"
// result.public_id  => "banners/1732...jpg"

// 2. Deleting an image from S3:
await deleteFromS3(banner.public_id);
```

### 5.2 Automatic Folder Normalization
To prevent duplicate folder creation in S3, `s3Uploader.js` automatically maps legacy folder names:
* `bottombanners` / `bottom_banners` ➔ `bottom-banners/`
* `staffbanners` / `staff_banners` ➔ `staff-banners/`
* `complaints_resolved` ➔ `complaints/`

---

## 6. DocumentDB Developer Guidelines (Mongoose & Node.js)

### 6.1 Production Connection String
In `/home/ubuntu/Anytime-help/backend/.env`:

```env
MONGODB_URI=mongodb://anytimehelpadmin:anytimehelpdb2026@anytimehelp-db.cluster-c5iso4g2mcoq.ap-southeast-2.docdb.amazonaws.com:27017/anytime_help?tls=true&tlsCAFile=/home/ubuntu/Anytime-help/backend/global-bundle.pem&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false
```

### 6.2 Critical Connection Parameters for DocumentDB

| Parameter | Value | Critical Reason |
| :--- | :--- | :--- |
| `tls=true` | `true` | Required. DocumentDB enforces TLS in transit. |
| `tlsCAFile` | Path to `global-bundle.pem` | Tells the driver to trust the Amazon RDS CA certificate. |
| `replicaSet` | `rs0` | DocumentDB identifies itself as replica set `rs0`. |
| `readPreference` | `secondaryPreferred` | Balances read workload across cluster instances. |
| `retryWrites` | `false` | **MANDATORY**: DocumentDB does not support client-side retryable writes. Setting to `false` prevents driver initialization errors. |

### 6.3 Local Development Options

#### Option A: Local MongoDB (Recommended for quick frontend/backend work)
Run a local MongoDB instance on your development computer:
```env
MONGODB_URI=mongodb://localhost:27017/anytime_help
AWS_REGION=ap-southeast-2
AWS_S3_BUCKET=anytimehelp-media
AWS_ACCESS_KEY_ID=<your-iam-key>
AWS_SECRET_ACCESS_KEY=<your-iam-secret>
```

#### Option B: Direct Connection to DocumentDB via SSH Tunnel
Because DocumentDB is private inside AWS VPC, forward port 27017 through EC2:
```bash
ssh -i /path/to/anytime-help-key.pem -L 27017:anytimehelp-db.cluster-c5iso4g2mcoq.ap-southeast-2.docdb.amazonaws.com:27017 ubuntu@16.178.168.218 -N
```
Then connect locally using:
```env
MONGODB_URI=mongodb://anytimehelpadmin:anytimehelpdb2026@localhost:27017/anytime_help?tls=true&tlsCAFile=./global-bundle.pem&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false
```

---

## 7. Useful Server Commands for Engineers

### 7.1 PM2 Process Management
```bash
# View running services and memory usage
pm2 status

# Stream live API backend logs
pm2 logs anytime-backend

# Stream Studio logs
pm2 logs anytime-studio

# Restart backend with new environment variables
pm2 restart anytime-backend --update-env

# Save process list across reboots
pm2 save
```

### 7.2 Nginx Management
```bash
# Test configuration syntax
sudo nginx -t

# Reload configuration gracefully
sudo systemctl reload nginx

# Check error logs
sudo tail -f /var/log/nginx/error.log
```

---

## 8. Database Collections Inventory

All 4,385 documents were successfully migrated from MongoDB Atlas into DocumentDB with **zero data loss**:

| Collection | Total Documents | Purpose |
| :--- | :--- | :--- |
| `users` | **2,159** | User authentication, profile info, roles, flats, phone numbers |
| `complaints` | **948** | Civic complaints, locations, before/after S3 images, replies |
| `chatreadstates` | **486** | Unread message badge counts per user |
| `announcements` | **406** | System notices and community announcements |
| `chatmessages` | **262** | Community chat messages and attachments |
| `categories` | **36** | Service & complaint categories |
| `staffbanners` | **33** | Staff promotion and service banners |
| `directories` | **16** | Local public utilities and services directory |
| `chatgroups` | **10** | Public and private chat channels |
| `bottombanners` | **6** | Footer marketing banners |
| `areas` | **4** | Geographical service boundaries (Sushant Lok, etc.) |
| `communities` | **4** | Neighborhood communities |
| `communitysections` | **4** | Subdivisions within community groups |
| `paidservices` | **3** | Premium service offerings |
| `officials` | **2** | Official government/authority accounts |
| `officialposts` | **2** | Posts published by verified officials |
| `appsettings` | **1** | Global mobile application configuration |
| `banners` | **1** | Main hero banners |
| `counters` | **1** | Auto-increment sequence generators |
| **Total** | **4,385** | **100% Migrated & Verified** |

---

## 9. Developer Handover Summary Checklist

When a new engineer joins the project, here is what they need to know:
1. **Repository:** Pushing backend code to `main` triggers **GitHub Actions**, which automatically updates the live EC2 backend.
2. **Backend API:** Hosted at `https://api.anytimehelp.co.in/api`.
3. **Database:** Amazon DocumentDB in Sydney. Browse data at `https://api.anytimehelp.co.in/orm-db`.
4. **Images:** Uploaded directly to Amazon S3 (`anytimehelp-media`). Use `uploadToS3(input, folder)`.
5. **No Render or Cloudinary:** Render and Cloudinary are completely decommissioned. Do not add code pointing to Render or Cloudinary.

---
*Document prepared for the Anytime-Help Engineering & DevOps Team.*
