# Anytime-Help: AWS Architecture & Developer Handover Guide

> **Target Audience:** Backend Developers, DevOps Engineers, System Architects  
> **Environment:** Production (AWS `ap-southeast-2` - Sydney)  
> **Last Updated:** November 2026  
> **Status:** Production Live (Cutover Complete)

---

## 1. Executive Summary & Architecture Overview

The Anytime-Help platform has transitioned from external third-party managed services (**MongoDB Atlas** and **Cloudinary**) to a unified, high-performance, cost-effective infrastructure hosted natively within **Amazon Web Services (AWS)**.

### Architecture Comparison

| Layer | Legacy Architecture | New AWS Native Architecture | Status |
| :--- | :--- | :--- | :--- |
| **Compute / API Server** | AWS EC2 (`t3.micro`) + PM2 + Nginx | AWS EC2 (`t3.micro`) + PM2 + Nginx | Active (`api.anytimehelp.co.in`) |
| **Database** | MongoDB Atlas (Cloud Replica Set) | **Amazon DocumentDB** (`anytimehelp-db`) | 100% Migrated (4,385 docs) |
| **Media / Asset Storage**| Cloudinary | **Amazon S3** (`anytimehelp-media`) | 100% Migrated (946 images) |
| **Authentication / IAM** | Hardcoded API keys in `.env` | **EC2 IAM Role** (`EC2-S3-Role`) + TLS | Keyless IAM Integration |
| **Backups** | Atlas automated backups | **DocumentDB Automated + S3 Archive** | Secured in S3 bucket |

```mermaid
flowchart TD
    subgraph ClientLayer ["Clients"]
        Mobile["Mobile App (Flutter/React Native)"]
        Admin["Web Admin Dashboard"]
    end

    subgraph AWSCloud ["AWS Cloud (ap-southeast-2)"]
        subgraph VPC ["Default VPC (172.31.0.0/16)"]
            subgraph EC2Host ["EC2 Backend (i-0a648e86ae106bd90)"]
                Nginx["Nginx Reverse Proxy (:443)"]
                PM2["PM2: anytime-backend (Node.js :5000)"]
                Cert["CA Cert: global-bundle.pem"]
                Nginx -->|Proxy Pass| PM2
                PM2 --> Cert
            end

            subgraph DocDBCluster ["Amazon DocumentDB (anytimehelp-db)"]
                PrimaryInstance["db.t3.medium (Primary Node)"]
                DocDBStorage["Cluster Storage (Auto-scaling)"]
                PrimaryInstance --> DocDBStorage
            end
        end

        subgraph S3Storage ["Amazon S3 Object Storage"]
            S3Bucket["Bucket: anytimehelp-media"]
            S3Cat["/categories"]
            S3Comp["/complaints"]
            S3Ban["/banners"]
            S3Backups["/backups"]
            S3Bucket --> S3Cat
            S3Bucket --> S3Comp
            S3Bucket --> S3Ban
            S3Bucket --> S3Backups
        end

        IAMRole["IAM Role: EC2-S3-Role (AmazonS3FullAccess)"]
    end

    Mobile -->|HTTPS REST / WSS| Nginx
    Admin -->|HTTPS REST| Nginx
    PM2 -->|TLS Port 27017 (Mongoose)| PrimaryInstance
    EC2Host -.->|Assumes Keyless Role| IAMRole
    IAMRole -.->|Authorizes Access| S3Bucket
    Mobile -->|Direct CDN/S3 Image Load| S3Bucket
    Admin -->|Direct CDN/S3 Image Load| S3Bucket
```

---

## 2. Infrastructure Inventory & Network Topology

### 2.1 Compute: EC2 Instance
* **Instance ID:** `i-0a648e86ae106bd90`
* **Public IPv4:** `16.178.168.218`
* **Private IPv4:** `172.31.34.31`
* **Instance Type:** `t3.micro`
* **Operating System:** Ubuntu 24.04 LTS
* **Domain Name:** `https://api.anytimehelp.co.in`
* **Web Server:** Nginx 1.28.3 acting as SSL reverse proxy terminating TLS for `api.anytimehelp.co.in` and routing to `localhost:5000`.
* **Process Manager:** PM2 (Service Name: `anytime-backend`, App Directory: `/home/ubuntu/Anytime-help/backend`).

### 2.2 Database: Amazon DocumentDB
* **Cluster Identifier:** `anytimehelp-db`
* **Cluster Endpoint:** `anytimehelp-db.cluster-c5iso4g2mcoq.ap-southeast-2.docdb.amazonaws.com:27017`
* **Engine Version:** `8.0.3` (MongoDB 5.0 wire-protocol compatible)
* **Instance Class:** `db.t3.medium` (Single instance regional cluster)
* **Status:** `Available`
* **Master Username:** `anytimehelpadmin`
* **Master Password:** `anytimehelpdb2026`
* **Authentication Database:** `admin`
* **Application Database:** `anytime_help`
* **Security Group:** `sg-02149aaacb1143902` (Inbound Port `27017` enabled for VPC traffic).
* **TLS Encryption:** **Enforced**. Requires Amazon RDS Global Root CA certificate (`global-bundle.pem`).

### 2.3 Storage: Amazon S3
* **Bucket Name:** `anytimehelp-media`
* **Region:** `ap-southeast-2` (Sydney)
* **Public Access:** Enabled with granular `PublicReadGetObject` policy for static assets.
* **CORS Configuration:** Enabled (`GET`, `HEAD` methods permitted from `*`).
* **Base URL Format:** `https://anytimehelp-media.s3.ap-southeast-2.amazonaws.com/<key>`
* **Directory Structure:**
  * `categories/` - Category icons and thumbnail images.
  * `banners/` - Top and home screen promotional banners.
  * `staffbanners/` - Staff and employee banners.
  * `bottombanners/` - Bottom navigation and footer banners.
  * `complaints/` - User-submitted complaint photos (before/after).
  * `stories/` - Community and story images.
  * `backups/` - Database archive snapshots (`atlas_backup_YYYYMMDD.gz`).

### 2.4 IAM (Identity & Access Management)
* **Attached Role:** `EC2-S3-Role`
* **Target Entity:** Attached directly to EC2 instance `i-0a648e86ae106bd90`.
* **Policies:** `AmazonS3FullAccess`
* **Advantage:** Backend code running on EC2 automatically authenticates with AWS S3 via AWS SDK v3 without needing hardcoded `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` in `.env`.

---

## 3. Database Architecture & Developer Specifications

Amazon DocumentDB is a fully managed, MongoDB-compatible document database. While it implements the MongoDB API, developers must adhere to several specific configuration requirements.

### 3.1 Connection String Format

```env
MONGODB_URI=mongodb://anytimehelpadmin:anytimehelpdb2026@anytimehelp-db.cluster-c5iso4g2mcoq.ap-southeast-2.docdb.amazonaws.com:27017/anytime_help?tls=true&tlsCAFile=/home/ubuntu/Anytime-help/backend/global-bundle.pem&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false
```

#### Query Parameter Breakdown:
| Parameter | Value | Critical Purpose |
| :--- | :--- | :--- |
| `tls=true` | `true` | Enforces TLS encryption in transit. |
| `tlsCAFile` | Path to `global-bundle.pem` | Tells the MongoDB Node driver which certificate authority validates DocumentDB. |
| `replicaSet` | `rs0` | DocumentDB clusters identify themselves as replica set `rs0`. |
| `readPreference` | `secondaryPreferred` | Routes read traffic to replica instances when read scaling is added. |
| `retryWrites` | `false` | **MANDATORY**: DocumentDB does not support client-side retryable writes in the same manner as Atlas. Setting to `false` prevents driver initialization crashes. |

### 3.2 Obtaining the CA Certificate
The certificate is stored locally at:
`/home/ubuntu/Anytime-help/backend/global-bundle.pem`

If setting up a new server or local staging, fetch it with:
```bash
wget https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
```

### 3.3 Database Collections Inventory (Migrated from Atlas)

| Collection | Total Documents | Purpose |
| :--- | :--- | :--- |
| `users` | **2,159** | User authentication, profile info, roles |
| `complaints` | **948** | Civic complaints, locations, before/after images |
| `chatreadstates` | **486** | Read/unread message tracking |
| `announcements` | **406** | System & community announcements |
| `chatmessages` | **262** | Community and group chat messages |
| `categories` | **36** | Service & complaint categories |
| `staffbanners` | **33** | Staff promotion banners |
| `directories` | **16** | Local public services directory |
| `chatgroups` | **10** | Chat rooms and channels |
| `bottombanners` | **6** | Footer marketing banners |
| `areas` | **4** | Geographical service boundaries |
| `communities` | **4** | Neighborhood communities |
| `communitysections` | **4** | Sections within community groups |
| `paidservices` | **3** | Premium service offerings |
| `officials` | **2** | Official government/authority accounts |
| `officialposts` | **2** | Posts published by verified officials |
| `appsettings` | **1** | Global mobile application configuration |
| `banners` | **1** | Main hero banners |
| `counters` | **1** | Auto-increment sequence generators |
| **Total** | **4,385** | **Zero Data Loss Verified** |

---

## 4. Media Storage & Image Upload Guide (Developers)

### 4.1 Current Status
* **Existing Images (946 files):** Migrated to `s3://anytimehelp-media/` and database documents updated with S3 URLs.
* **New Image Uploads:** Currently, backend route handlers (`routes/complaints.js`, `routes/banners.js`, etc.) still import `cloudinary`. To complete the transition for newly created content, developers should replace Cloudinary upload logic with the S3 upload helper provided below.

### 4.2 S3 Upload Utility Implementation

Create a new file at `backend/utils/s3Uploader.js`:

```javascript
/**
 * AWS S3 Upload Helper for Anytime-Help
 * Replaces Cloudinary with keyless AWS S3 storage
 */
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');
const path = require('path');

// Initialize S3 client. In EC2, credentials are automatically inferred from the attached IAM role.
const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-2'
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'anytimehelp-media';

/**
 * Upload a Buffer or DataURI to S3
 * @param {Buffer|string} fileBuffer - Buffer or base64 dataURI
 * @param {string} folder - Destination folder (e.g., 'complaints', 'banners')
 * @param {string} mimeType - e.g. 'image/jpeg', 'image/png'
 * @returns {Promise<{ url: string, key: string }>}
 */
async function uploadToS3(fileBuffer, folder = 'general', mimeType = 'image/jpeg') {
  let buffer = fileBuffer;
  let contentType = mimeType;

  // Handle base64 / Data URI strings if passed
  if (typeof fileBuffer === 'string' && fileBuffer.startsWith('data:')) {
    const matches = fileBuffer.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      contentType = matches[1];
      buffer = Buffer.from(matches[2], 'base64');
    }
  }

  const fileExt = contentType.split('/')[1] || 'jpg';
  const fileName = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}.${fileExt}`;
  const key = `${folder}/${fileName}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType
  });

  await s3.send(command);

  return {
    url: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'ap-southeast-2'}.amazonaws.com/${key}`,
    key: key
  };
}

/**
 * Delete an object from S3
 * @param {string} key - S3 object key (e.g., 'complaints/xyz.jpg')
 */
async function deleteFromS3(key) {
  if (!key) return;
  // If full S3 URL was passed, extract key
  const cleanKey = key.replace(`https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'ap-southeast-2'}.amazonaws.com/`, '');

  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: cleanKey
  });

  return s3.send(command);
}

module.exports = {
  uploadToS3,
  deleteFromS3
};
```

### 4.3 How to Update Route Handlers (Example: Complaints)

In `backend/routes/complaints.js`:

#### Step 1: Replace Import
```javascript
// Remove:
// const cloudinary = require('cloudinary').v2;

// Add:
const { uploadToS3, deleteFromS3 } = require('../utils/s3Uploader');
```

#### Step 2: Replace Upload Call
```javascript
// Old Cloudinary code:
// const result = await cloudinary.uploader.upload(before_image, { folder: 'complaints' });
// complaint.before_image = result.secure_url;
// complaint.public_id = result.public_id;

// New S3 code:
const s3Result = await uploadToS3(before_image, 'complaints', 'image/jpeg');
complaint.before_image = s3Result.url;
complaint.public_id = s3Result.key;
```

---

## 5. Environment Configurations (.env)

### 5.1 Production `.env` (EC2)
Location: `/home/ubuntu/Anytime-help/backend/.env`

```env
PORT=5000
NODE_ENV=production

# AWS DocumentDB
MONGODB_URI=mongodb://anytimehelpadmin:anytimehelpdb2026@anytimehelp-db.cluster-c5iso4g2mcoq.ap-southeast-2.docdb.amazonaws.com:27017/anytime_help?tls=true&tlsCAFile=/home/ubuntu/Anytime-help/backend/global-bundle.pem&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false

# AWS S3
AWS_REGION=ap-southeast-2
AWS_S3_BUCKET=anytimehelp-media

# Application Secrets
JWT_SECRET=your_jwt_secret_here
ADMIN_SECRET=your_admin_secret_here
```

> [!NOTE]
> On the production EC2 instance, no `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` is required because the instance has the `EC2-S3-Role` attached directly via AWS Instance Profile.

### 5.2 Local Developer `.env.example`
Because Amazon DocumentDB is deployed inside a private AWS VPC, local developer machines outside AWS cannot connect directly without an SSH tunnel.

#### Option A: Local Development with Local MongoDB (Recommended for feature work)
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/anytime_help
AWS_REGION=ap-southeast-2
AWS_S3_BUCKET=anytimehelp-media
AWS_ACCESS_KEY_ID=<your-developer-access-key>
AWS_SECRET_ACCESS_KEY=<your-developer-secret-key>
```

#### Option B: Connecting Local Machine to DocumentDB via SSH Tunnel
To debug or run queries against the staging/production DocumentDB from your local machine:
1. Open an SSH tunnel through the EC2 instance:
   ```bash
   ssh -i ~/.ssh/your-key.pem -L 27017:anytimehelp-db.cluster-c5iso4g2mcoq.ap-southeast-2.docdb.amazonaws.com:27017 ubuntu@16.178.168.218 -N
   ```
2. Connect your local app using:
   ```env
   MONGODB_URI=mongodb://anytimehelpadmin:anytimehelpdb2026@localhost:27017/anytime_help?tls=true&tlsCAFile=./global-bundle.pem&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false
   ```

---

## 6. PM2 Process Operations & Server Maintenance

### Common PM2 Commands on EC2

```bash
# Check status
pm2 status

# Tail real-time logs
pm2 logs anytime-backend

# Check last 50 lines without streaming
pm2 logs anytime-backend --lines 50 --nostream

# Restart with updated environment variables
pm2 restart anytime-backend --update-env

# Save process list so it survives instance reboots
pm2 save
```

### Checking Nginx Logs
```bash
sudo tail -n 50 /var/log/nginx/error.log
sudo tail -n 50 /var/log/nginx/access.log
sudo nginx -t
sudo systemctl reload nginx
```

---

## 7. Disaster Recovery & Backup Strategy

### 7.1 Automated DocumentDB Backups
* DocumentDB automatically takes daily snapshots and retains transaction logs for 1 day by default (configurable up to 35 days in AWS Console).
* Point-in-time recovery (PITR) is enabled across the retention window.

### 7.2 Off-Server S3 Archiving
* A compressed, immutable backup of the initial migration is stored in Amazon S3:
  `s3://anytimehelp-media/backups/atlas_backup_20261119.gz`
* A local copy is stored on EC2 at:
  `/home/ubuntu/Anytime-help/backend/atlas_backup.gz`

### 7.3 Manual Backup / Restore Commands

#### To create a new on-demand database snapshot:
```bash
mongodump --host="anytimehelp-db.cluster-c5iso4g2mcoq.ap-southeast-2.docdb.amazonaws.com:27017" \
  --ssl --sslCAFile=global-bundle.pem \
  --username="anytimehelpadmin" \
  --password="anytimehelpdb2026" \
  --authenticationDatabase="admin" \
  --db="anytime_help" \
  --archive="docdb_backup_$(date +%Y%m%d).gz" --gzip
```

#### To restore from a snapshot:
```bash
mongorestore --host="anytimehelp-db.cluster-c5iso4g2mcoq.ap-southeast-2.docdb.amazonaws.com:27017" \
  --ssl --sslCAFile=global-bundle.pem \
  --username="anytimehelpadmin" \
  --password="anytimehelpdb2026" \
  --authenticationDatabase="admin" \
  --archive="docdb_backup_YYYYMMDD.gz" --gzip
```

---

## 8. Decommissioning Checklist for Legacy Services

| Task | Recommended Timeline | Action |
| :--- | :--- | :--- |
| **Verify App & Admin Traffic** | Days 1–3 | Monitor error logs, user complaint flow, and image rendering. |
| **Keep Atlas in Standby** | Days 1–7 | Leave MongoDB Atlas running in read-only mode as an emergency fallback. |
| **Pause Cloudinary Billing** | Days 5–7 | Downgrade Cloudinary to free plan or cancel subscription. |
| **Terminate Atlas Cluster** | Day 7+ | Delete MongoDB Atlas database cluster to stop monthly recurring charges. |

---

*Document prepared by Antigravity DevOps for the Anytime-Help Engineering Team.*
