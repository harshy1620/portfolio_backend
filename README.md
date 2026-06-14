# Portfolio AI Backend

Production-grade Node.js backend powering the AI chatbot on my portfolio site. Visitors chat with an AI version of me ("AI Harsh") trained on my bio and experience, optionally upload their resume for a referral, and I get a daily 9 AM IST email digest of all activity.

- **Frontend (live):** https://d2oat8oeneh958.cloudfront.net
- **Backend API (live):** https://harshdev.duckdns.org
- **Health check:** https://harshdev.duckdns.org/health

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [API endpoints](#api-endpoints)
- [Local development](#local-development)
- [Running with Docker](#running-with-docker)
- [External services setup](#external-services-setup)
- [Production deployment](#production-deployment)
- [CI/CD pipeline](#cicd-pipeline)
- [Daily digest behavior](#daily-digest-behavior)
- [Maintenance scripts](#maintenance-scripts)
- [Adding a new cron job](#adding-a-new-cron-job)
- [Design principles](#design-principles)
- [Cost monitoring](#cost-monitoring)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Features

- AI chat with a persona system prompt (Google Gemini, free tier via OpenAI-compatible endpoint)
- Multi-turn conversations persisted in MongoDB (one document per visitor session)
- Resume uploads (PDF / DOC / DOCX up to 5 MB) stored privately in AWS S3 with IAM least-privilege
- Pre-signed S3 download URLs (7-day expiry) for secure file sharing in email
- Daily 9 AM IST email digest of new conversations + uploads, sent via Resend
- Per-IP rate limiting on chat (20/minute) and upload (10/hour)
- Idempotent digest job (won't re-email the same activity twice)
- Defense in depth: validation at HTTP layer + Mongoose schema + IAM policy
- Lazy singleton clients for Gemini, S3, Mongoose, Resend
- Modular cron architecture — add new scheduled jobs by creating one folder
- GitHub Actions CI/CD — auto-deploys to EC2 on push to `main`
- HTTPS via Let's Encrypt (auto-renewing every 60 days)
- Containerized with Docker for reproducible local builds (EC2 migration planned)
- Free-tier hosting (t3.micro EC2) at ~$0/month at portfolio scale

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js 20 (ES modules) | Modern, stable, long-term support |
| HTTP | Express 5 | Familiar, minimal, large middleware ecosystem |
| AI | Google Gemini via OpenAI-compatible endpoint | Free tier (15 req/min, 1500 req/day), no card |
| Database | MongoDB Atlas (M0 free) + Mongoose | Document model fits chat structure |
| File storage | AWS S3 (private bucket, IAM-restricted) | Industry standard, free tier covers KB-scale usage |
| Email | Resend (free tier 3000/month) | Modern API, no SMTP config |
| Scheduling | node-cron | Simple, in-process, perfect for one-server setups |
| File uploads | multer (memoryStorage) | Standard for Express |
| Rate limiting | express-rate-limit | Per-IP, in-memory |
| Process manager | PM2 | Keeps Node app alive + auto-restart on crash |
| Reverse proxy | Nginx | Production-standard, handles HTTPS + port forwarding |
| Cert authority | Let's Encrypt via Certbot | Free, auto-renewing, world-trusted |
| Domain | DuckDNS subdomain | Free dynamic DNS |
| Hosting | AWS EC2 (Ubuntu 24.04, t3.micro) | Free tier 750 hrs/month for 12 months |
| Containerization | Docker (Dockerfile, alpine-style layers) | Reproducible builds, environment parity, interview-relevant |
| CI/CD | GitHub Actions | Free for public repos, native to GitHub |

---

## Architecture

```
                          Visitor's browser
                                 │
                                 │ HTTPS
                                 ▼
                      https://harshdev.duckdns.org
                                 │
                                 ▼
   ┌──────────────────────────────────────────────────────────┐
   │  EC2 instance (Mumbai, t3.micro, Ubuntu 24.04)           │
   │                                                          │
   │  Nginx (ports 80/443)                                    │
   │     │ Let's Encrypt TLS, port 80 → 443 redirect          │
   │     ▼                                                    │
   │  Node.js app (port 5000, managed by PM2)                 │
   │     │                                                    │
   │     ├─ POST /api/chat                                    │
   │     ├─ POST /api/upload-resume                           │
   │     ├─ GET  /health                                      │
   │     └─ cron @ 9 AM IST → daily digest                    │
   │                                                          │
   └─────┬────────────────────┬──────────────┬─────────┬──────┘
         │                    │              │         │
         ▼                    ▼              ▼         ▼
    Google Gemini       MongoDB Atlas      AWS S3    Resend
    (chat replies)      (conversations    (resumes,  (email
                         + uploads          private    digest)
                         metadata)          + IAM)
```

**Boot order:** dotenv → MongoDB connection → cron registration → HTTP listener.
If MongoDB fails to connect, the server refuses to start (fail-fast).

---

## Project structure

```
portfolio-ai-backend/
├── src/
│   ├── index.js                       Server entry — boot + middleware + routes
│   ├── config/
│   │   ├── db.js                      MongoDB connection (Mongoose)
│   │   ├── s3.js                      S3 client + bucket helper (singleton)
│   │   └── email.js                   Resend client + recipient helper
│   ├── routes/
│   │   ├── chat.routes.js             POST /chat (rate-limited)
│   │   └── upload.routes.js           POST /upload-resume (multer + rate-limited)
│   ├── controllers/
│   │   ├── chat.controller.js         Validate + delegate to chat service
│   │   └── upload.controller.js       Validate + delegate to upload service
│   ├── middleware/
│   │   ├── upload.middleware.js       multer (5 MB cap, PDF/DOC/DOCX only)
│   │   └── rateLimit.middleware.js    Chat + upload limiters
│   ├── services/
│   │   ├── chat.service.js            Gemini call + DB save (find-or-create)
│   │   ├── upload.service.js          S3 upload + DB save
│   │   └── digest.service.js          Query, sign URLs, render, send, mark digested
│   ├── models/
│   │   └── Conversation.js            Mongoose schema (embedded messages + uploads)
│   ├── data/
│   │   └── persona.js                 HARSH_PERSONA system prompt
│   ├── templates/
│   │   └── digestEmail.js             HTML email renderer
│   ├── utils/
│   │   └── signedUrl.js               createPresignedDownloadUrl(s3Key)
│   └── cron/
│       ├── index.js                   Cron schedule registry
│       └── digest/
│           └── index.js               digestCron.sendDailyDigest()
├── scripts/
│   ├── send-test-email.js             Manual Resend smoke test
│   ├── test-presigned-url.js          Manual presigned URL test
│   └── run-digest-now.js              Manually trigger the digest (bypasses cron)
├── .github/
│   └── workflows/
│       └── ci.yml                     Validate + deploy GitHub Actions pipeline
├── Dockerfile                          Container build recipe (Node 20 + app)
├── .dockerignore                       Excludes node_modules, .env, .git from image
├── .env                                Local secrets (gitignored)
├── .env.example                        Env template (committed)
├── .gitignore
├── package.json
└── README.md
```

---

## API endpoints

### `POST /api/chat`

Send a chat message and get an AI reply. Multi-turn — frontend sends full history each request.

**Headers:** `Content-Type: application/json`

**Body:**

```json
{
  "sessionId": "<uuid v4>",
  "messages": [
    { "role": "user",      "content": "Hi" },
    { "role": "assistant", "content": "Hey!" },
    { "role": "user",      "content": "Tell me about your AWS skills" }
  ]
}
```

**Validation rules:**

- `sessionId` required, 1–100 chars
- `messages` required array, 1–30 items
- Each message: `role` only `"user"` or `"assistant"` (`"system"` is rejected as a prompt-injection defense)
- `content` is a non-empty string up to 2000 chars
- The last message MUST have `role: "user"`

**Response 200:**

```json
{
  "reply": "I work with S3, CloudFront, EC2...",
  "meta": {
    "model": "gemini-2.0-flash",
    "usage": { "prompt_tokens": 412, "completion_tokens": 78, "total_tokens": 490 },
    "conversationId": "65e1234567890abcdef12345"
  }
}
```

**Rate limit:** 20 requests / minute / IP. Exceeded → HTTP 429.

---

### `POST /api/upload-resume`

Upload a resume file (multipart form).

**Body (multipart):**

- `sessionId` (text) — same UUID used for chat
- `resume` (file) — PDF / DOC / DOCX, max 5 MB

**Constraints:**

- Allowed MIME types: `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Files stored at S3 key: `resumes/<sessionId>/<timestamp>-<sanitized-filename>`
- Each upload appended to the conversation's `resumeUploads` array in MongoDB

**Response 200:**

```json
{
  "ok": true,
  "upload": {
    "s3Key": "resumes/<sessionId>/<timestamp>-resume.pdf",
    "originalName": "resume.pdf",
    "size": 245678,
    "mimeType": "application/pdf"
  },
  "conversationId": "<MongoDB ObjectId>"
}
```

**Rate limit:** 10 uploads / hour / IP.

---

### `GET /health`

Liveness probe.

**Response 200:**

```json
{
  "status": "ok",
  "env": "production",
  "uptime": 24447.82,
  "timestamp": "2026-06-13T14:56:50.393Z"
}
```

---

## Local development

### Prerequisites

- Node.js 20+ (`node -v`)
- npm 10+
- Active accounts: Google AI Studio (Gemini), MongoDB Atlas, AWS, Resend (instructions below)

### Setup

```bash
git clone https://github.com/<your-github-user>/portfolio-ai-backend.git
cd portfolio-ai-backend
npm install
cp .env.example .env
# Fill in .env with your real values (see next section)
npm run dev
```

You should see:

```
[db] connected: portfolio_ai_chat
[cron] all schedules registered
[server] listening on http://localhost:5000 (development)
```

### Environment variables

Edit `.env`:

```
# Server
PORT=5000
NODE_ENV=development
CORS_ORIGINS=http://localhost:3000,https://your-frontend-domain.com

# Google Gemini  https://aistudio.google.com/apikey
GEMINI_API_KEY=AIza...your-key-here
GEMINI_MODEL=gemini-2.0-flash

# MongoDB Atlas
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/<dbname>?appName=Cluster0

# AWS S3 (for resume uploads)
AWS_REGION=ap-south-1
AWS_S3_BUCKET=your-bucket-name
AWS_ACCESS_KEY_ID=AKIA...your-key-here
AWS_SECRET_ACCESS_KEY=your-secret-here

# Resend  https://resend.com/api-keys
RESEND_API_KEY=re_...your-key-here
DIGEST_RECIPIENT_EMAIL=your-email@example.com
```

> **Never commit `.env`.** It's in `.gitignore`. Use `.env.example` as the committed template.
> **Never paste real keys into chat/screenshots/issue threads.** Treat any leaked key as compromised and rotate immediately.

### Test endpoints (Bruno / Postman / curl)

**Chat:**

```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "local-test-001",
    "messages": [{"role":"user","content":"Hi"}]
  }'
```

**Upload (replace with a real PDF path):**

```bash
curl -X POST http://localhost:5000/api/upload-resume \
  -F "sessionId=local-test-001" \
  -F "resume=@/path/to/resume.pdf"
```

---

## Running with Docker

The repo ships with a `Dockerfile` + `.dockerignore` so the backend can be built and run as a container locally. EC2 currently still runs the app via PM2 — migrating EC2 to Docker is planned but not yet done.

### Why we added Docker

- **Reproducibility** — the image bundles Node 20 + dependencies + source code in one immutable artifact. Same behavior on every machine.
- **"Works on my laptop" elimination** — anyone (including future-you on a fresh machine) gets a working backend with one command, no manual Node install.
- **Foundation for portable deploys** — the same image can run on EC2, ECS, Kubernetes, or anyone's laptop without changes.
- **Easy rollbacks** — each build is tagged. Want yesterday's version? Run `docker run portfolio-ai-backend:v23`.
- **Interview-relevant** — Docker is industry-standard for modern backend deploys. Hands-on experience > textbook knowledge.

### Prerequisites (Windows)

- **Docker Desktop** for Windows — https://www.docker.com/products/docker-desktop/
- **WSL 2** (Windows Subsystem for Linux) — Docker Desktop on Windows runs the engine inside WSL 2. The installer auto-enables it if missing. Verify with `wsl --status` in PowerShell.

After installation:

```powershell
docker --version          # confirms Docker is installed
docker run hello-world    # smoke test — should print "Hello from Docker!"
```

For Linux/macOS, just install Docker Engine — no WSL needed.

### Build the image

From the project root:

```bash
docker build -t portfolio-ai-backend:local .
```

| Flag | Meaning |
|---|---|
| `-t portfolio-ai-backend:local` | Tag the image as `name:version`. `local` indicates this isn't pushed to a registry. |
| `.` | Build context — the current directory (Docker reads `Dockerfile` + respects `.dockerignore`) |

First build takes ~30-60 seconds (downloads base image + runs `npm ci`). Subsequent builds are near-instant if only source code changes (thanks to layer caching).

### Run the container

```bash
docker run -d \
  --name portfolio-backend \
  -p 5000:5000 \
  --env-file .env \
  portfolio-ai-backend:local
```

| Flag | Meaning |
|---|---|
| `-d` | Detached mode (background) |
| `--name portfolio-backend` | Friendly container name (otherwise auto-generated) |
| `-p 5000:5000` | Map host port 5000 → container port 5000 |
| `--env-file .env` | Inject env vars at runtime (never bake secrets into the image) |

Verify:

```bash
docker ps                                # should show container as "Up"
docker logs portfolio-backend            # see startup output
curl http://localhost:5000/health        # should return JSON
```

### Useful Docker commands

```bash
docker ps                                  # list running containers
docker ps -a                               # list ALL containers (including stopped)
docker logs portfolio-backend              # see stdout
docker logs -f portfolio-backend           # follow logs live (Ctrl+C to exit)
docker stop portfolio-backend              # stop the container
docker start portfolio-backend             # restart a stopped container
docker rm portfolio-backend                # delete the container (must be stopped)
docker images                              # list all local images
docker rmi portfolio-ai-backend:local      # delete an image
docker exec -it portfolio-backend sh       # open a shell INSIDE the container (debug)
```

`docker exec -it ... sh` is the most useful — gives you a shell inside the running container as if you SSH'd in.

### What's in the Dockerfile

```dockerfile
FROM node:20                # Base: official Node 20 (Debian-based)
WORKDIR /app                # Set working directory inside image
COPY package*.json ./       # Copy deps manifest first (caching trick)
RUN npm ci --omit=dev       # Install prod deps only (no nodemon)
COPY src ./src              # Copy source code
COPY scripts ./scripts      # Copy maintenance scripts
EXPOSE 5000                 # Document listening port (informational)
USER node                   # Run as non-root user (security)
CMD ["node", "src/index.js"] # Default command on container start
```

**Layer caching:** dependencies (`package*.json` → `npm ci`) are at the top because they change rarely. Source code copy comes after, so editing a file in `src/` doesn't trigger a full `npm ci` reinstall — saves ~20 seconds per rebuild.

### Benefits achieved so far

✓ Single command to spin up the backend locally on any OS with Docker
✓ Identical Node version + deps as production (no "but it works locally")
✓ No manual `npm install` / nodemon / PM2 dance for new contributors
✓ Hands-on Docker experience for interview answers

### Future migrations (not yet done)

- **Multi-stage build** — reduce image from ~400 MB to ~150 MB (use `node:20-alpine` as final stage)
- **Push to Docker Hub** — `docker push <username>/portfolio-ai-backend:<version>` so EC2 can pull
- **Migrate EC2 from PM2 to Docker** — install Docker on EC2, swap `pm2 start` with `docker run`, update GitHub Actions to `docker pull` + `docker restart`
- **`docker-compose.yml`** — if/when we add Redis or a local MongoDB for tests

These are documented as TODOs in this repo — pick up when ready.

---

## External services setup

You'll need accounts and credentials for 4 services. All have generous free tiers.

### 1. Google Gemini (AI Studio)

1. Go to https://aistudio.google.com/apikey
2. Sign in with a Google account
3. Click **"Create API key"** → generate in a new or existing project
4. Copy the key (starts with `AIza...`)
5. Use as `GEMINI_API_KEY` in `.env`

**Free tier:** 15 RPM, 1500 RPD on `gemini-2.0-flash`. More than enough for a portfolio chatbot.

### 2. MongoDB Atlas

1. Sign up at https://cloud.mongodb.com (no card needed for M0 free cluster)
2. Create a new **M0** cluster (512 MB storage, free forever)
3. Pick a region close to your server (Mumbai for India)
4. Create a database user under **Database Access**
5. Under **Network Access**, add an IP allowlist:
   - For local dev: your current IP
   - For production: EC2's public IP (or `0.0.0.0/0` if you accept the trade-off)
6. Click **Connect** → **Drivers** → copy the connection string
7. Use as `MONGODB_URI` in `.env` (substitute `<password>` and add `/<dbname>`)

### 3. AWS S3 (with IAM least-privilege)

#### Create the bucket

1. AWS Console → S3 → **Create bucket**
2. Region: `ap-south-1` (Mumbai) or your nearest
3. Bucket name: globally unique (e.g. `portfolio-ai-resumes-<your-handle>-<year>`)
4. **Block all public access:** ENABLED (resumes are private)
5. Versioning, encryption: defaults

#### Create the IAM user

1. AWS Console → IAM → Users → **Create user**
2. Username: `portfolio-ai-backend`
3. **UNCHECK** "Provide user access to the AWS Management Console"
4. **Permissions:** "Attach policies directly" → "Create policy"
5. Create policy with JSON (replace `your-bucket-name` with your actual bucket):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowResumeReadWrite",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::your-bucket-name/resumes/*"
    }
  ]
}
```

6. Policy name: `portfolio-ai-resumes-rw`
7. Back in user creation → attach this policy
8. Create user
9. Open the user → **Security credentials** → **Create access key** → choose "Application running outside AWS"
10. Save **both** Access Key ID + Secret Access Key (secret is only shown ONCE)

Use as `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in `.env`.

> Only the `resumes/*` prefix is accessible. The IAM user cannot list the bucket, delete anything, or touch other AWS resources. **Principle of least privilege.**

### 4. Resend

1. Sign up at https://resend.com (no card needed)
2. Settings → **API Keys** → **Create API key**
3. Permission: **Sending access** (NOT Full access — least privilege)
4. Domain: "All domains" (we use `onboarding@resend.dev` for sending until a custom domain is verified)
5. Save the key (starts with `re_...`)

Use as `RESEND_API_KEY` in `.env`. Set `DIGEST_RECIPIENT_EMAIL` to the address you signed up with (free tier restriction — can only send to your own email).

**Free tier:** 3,000 emails/month. At 1 daily digest = ~30/month. Won't hit the cap.

---

## Production deployment

The backend is currently deployed on AWS EC2 (Ubuntu 24.04, t3.micro, Mumbai region) with Nginx + Let's Encrypt for HTTPS.

### High-level deployment journey

```
1. AWS cost guardrails (Budgets + Anomaly Detection)
2. Provision EC2 instance (t3.micro, free tier)
3. SSH in, install Node + PM2 + Git
4. Clone repo, install deps, create .env
5. Start app with PM2 + persist across reboots
6. Install Nginx + reverse proxy port 80 → 5000
7. Get a domain (DuckDNS subdomain, free)
8. Install Certbot, run HTTPS setup
9. Set up GitHub Actions CI/CD for auto-deploy
```

### Step 1 — AWS cost guardrails (BEFORE anything else)

AWS has no hard spending cap, but it has free alerts. Set these up FIRST so you can't accidentally rack up charges.

1. **Billing Console** → **Budgets** → **Create budget** (template: "Monthly cost budget")
   - Budget amount: `$5`
   - Email recipient: your email
   - Add a $1 actual-cost alert (canary in the coal mine)
2. **Cost Anomaly Detection** → create monitor for "AWS services" → alert subscription at $1 threshold
3. Bookmark the **Free Tier dashboard**: https://us-east-1.console.aws.amazon.com/billing/home#/freetier
4. Check the billing dashboard weekly. Should stay near $0.

### Step 2 — Provision the EC2 instance

1. EC2 Console → switch region to **Asia Pacific (Mumbai) ap-south-1**
2. **Launch instance**
   - Name: `portfolio-ai-backend`
   - AMI: **Ubuntu Server 24.04 LTS** (Free tier eligible)
   - Architecture: 64-bit (x86)
   - Instance type: **t2.micro** (or `t3.micro` if 2 isn't available) — must say "Free tier eligible"
   - Key pair: **Create new** → name `portfolio-backend-key` → RSA → `.pem`
     - **Save the .pem file** — only chance to download it. Recommended location: `~/.ssh/portfolio-backend-key.pem`
   - Network: auto-assign public IP **enabled**
   - Security group: create new (`portfolio-backend-sg`) with inbound rules:
     - SSH (22) — source `0.0.0.0/0` (needed for GitHub Actions deploys; key auth keeps it secure)
     - HTTP (80) — source `0.0.0.0/0`
     - HTTPS (443) — source `0.0.0.0/0`
   - Storage: default 8 GiB gp3
3. Launch. Wait for "2/2 checks passed".
4. Copy the **Public IPv4 address**.

### Step 3 — Lock down the .pem and SSH in

On Windows PowerShell:

```powershell
$key = "$env:USERPROFILE\.ssh\portfolio-backend-key.pem"
icacls $key /inheritance:r
icacls $key /grant:r "$($env:USERNAME):(R)"

ssh -i $key ubuntu@<EC2_PUBLIC_IP>
```

Once you see `ubuntu@ip-...:~$` you're in.

### Step 4 — Install Node, Git, PM2 on the server

```bash
sudo apt update && sudo apt upgrade -y

# Node 20 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

# PM2 globally
sudo npm install -g pm2

# Verify
node -v && npm -v && git --version && pm2 --version
```

### Step 5 — Clone repo and run

```bash
cd ~
git clone https://github.com/<your-user>/portfolio-ai-backend.git
cd portfolio-ai-backend
npm ci

# Create .env on the server (use a real editor, paste values directly)
nano .env
# Paste the same shape as .env.example with REAL values
# Save: Ctrl+O, Enter, Ctrl+X

# Manually verify it boots
node src/index.js
# Should see: [db] connected ... [server] listening
# Ctrl+C to stop

# Start with PM2
pm2 start src/index.js --name portfolio-ai-backend
pm2 startup
# Copy/paste the sudo command PM2 prints
pm2 save
```

Verify:

```bash
curl http://localhost:5000/health
```

### Step 6 — Nginx reverse proxy

```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/portfolio-backend
```

Paste:

```nginx
server {
    listen 80;
    server_name your-domain-here;

    client_max_body_size 6M;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "upgrade";
    }
}
```

Enable + reload:

```bash
sudo ln -s /etc/nginx/sites-available/portfolio-backend /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Now `curl http://<EC2_PUBLIC_IP>/health` from your laptop should work. Port 5000 is hidden behind Nginx.

### Step 7 — Free domain via DuckDNS

1. Sign up at https://www.duckdns.org with a Google/GitHub account
2. Pick a subdomain (e.g. `your-handle.duckdns.org`)
3. Set the IP to your EC2 public IPv4
4. Verify DNS propagated: `nslookup your-handle.duckdns.org` should return the EC2 IP

Update Nginx config's `server_name` to match (`your-handle.duckdns.org`), reload Nginx.

### Step 8 — HTTPS with Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-handle.duckdns.org
```

Follow prompts:

- Email: your email (for renewal warnings)
- Terms: `A` (agree)
- EFF newsletter: optional
- HTTPS redirect: **`2`** (force HTTPS)

Certbot edits Nginx config automatically. Test:

```bash
curl https://your-handle.duckdns.org/health
sudo certbot renew --dry-run  # verify auto-renewal works
```

Done — backend is now live on HTTPS with a valid Let's Encrypt cert.

---

## CI/CD pipeline

GitHub Actions runs on every push and PR to `main`. Two jobs:

### `validate` (runs always)

- Checkout code
- Install Node 20
- `npm ci`
- Syntax-check every `.js` in `src/` and `scripts/` via `node --check`
- Verify `package.json` has required scripts

Catches "I broke the build" issues at PR time, before merge.

### `deploy` (runs only on push to `main`)

- Connects to EC2 via SSH (using a dedicated deploy key)
- `git pull origin main`
- `npm ci --omit=dev`
- `pm2 restart portfolio-ai-backend`

So every merge to `main` deploys automatically within ~30 seconds.

### Required GitHub secrets

In **Repo → Settings → Secrets and variables → Actions**, add:

| Secret | Value |
|---|---|
| `EC2_HOST` | Your DuckDNS domain (e.g. `your-handle.duckdns.org`) |
| `EC2_USER` | `ubuntu` |
| `EC2_SSH_KEY` | Private key (the entire BEGIN/END PEM block of a dedicated GitHub Actions key) |

### Generating the dedicated deploy key

On the EC2 instance (via SSH):

```bash
# Generate a key pair JUST for GitHub Actions (separate from your personal SSH key)
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy -N ""

# Authorize the public half on this server
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Print the private half (this goes to GitHub as EC2_SSH_KEY secret)
cat ~/.ssh/github_deploy
```

Copy the entire output INCLUDING the `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----` lines into the GitHub secret.

### Workflow file

See [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

---

## Daily digest behavior

- **Cron:** `0 9 * * *` in `Asia/Kolkata` (defined declaratively in [`src/cron/digest/index.js`](src/cron/digest/index.js))
- **Query:** finds conversations where `updatedAt > digestSentAt` (or `digestSentAt` is null)
- **Email content:** summary + each conversation's messages + each upload with a 7-day pre-signed download link
- **Idempotency:** after sending, each emailed conversation is marked with `digestSentAt = now` using `{ timestamps: false }` to prevent Mongoose from bumping `updatedAt` (which would cause infinite re-sending)
- **Recipient:** `DIGEST_RECIPIENT_EMAIL` env var
- **Sender:** `onboarding@resend.dev` (Resend's free testing sender)

The cron runs inside the same Node process as the HTTP server. If the server is down at 9 AM, that day's digest is skipped — picked up next day instead.

---

## Maintenance scripts

```bash
npm run dev       # nodemon (auto-restart on file save)
npm start         # production: plain node, no auto-restart
```

Manual scripts (run with `node scripts/<name>.js`):

```bash
node scripts/send-test-email.js                 # Send "hello world" via Resend
node scripts/test-presigned-url.js <s3-key>     # Generate 7-day download URL for an S3 key
node scripts/run-digest-now.js                  # Trigger the digest immediately (bypass cron)
```

`run-digest-now.js` is production-useful — if the 9 AM cron fails for any reason, you can re-run it manually after fixing.

---

## Adding a new cron job

The cron architecture is declarative — adding a job is two changes:

### 1. Create the job module

`src/cron/<jobName>/index.js`:

```js
import { runMyJob } from "../../services/myJob.service.js";

export const myCron = {
  async runMyJob() {
    console.log(`[cron:myJob] triggered at ${new Date().toISOString()}`);
    try {
      const result = await runMyJob();
      console.log("[cron:myJob] finished:", JSON.stringify(result));
    } catch (err) {
      console.error("[cron:myJob] failed:", err);
    }
  },
};
```

### 2. Register the schedule

Add 2 lines to [`src/cron/index.js`](src/cron/index.js):

```js
import { myCron } from "./myJob/index.js";

// inside registerAllCrons()
cron.schedule("0 3 * * 0", () => myCron.runMyJob(), { timezone: IST });
```

Restart the server — new schedule registers automatically.

---

## Design principles

- **Defense in depth** — validation at HTTP layer (controllers), Mongoose schema layer, AWS IAM (least-privilege)
- **Principle of least privilege** — IAM user can ONLY `PutObject`/`GetObject` on `resumes/*`. No list, no delete, no other services
- **Separation of concerns** — routes → controllers → services → models. Each layer has one job
- **Singleton clients** — Gemini, S3, Resend, Mongoose all instantiated once and reused
- **Find-or-create** — chat and upload both key off `sessionId`, producing one document per visitor (chats + uploads in the same doc)
- **Idempotency** — `digestSentAt` ensures the same conversation isn't emailed twice
- **Declarative config** — cron schedules live in code (not env). New cron = new folder, no config sprawl
- **Fail-fast on boot** — missing env vars throw immediately with a clear message
- **Env hygiene** — `.env` for real secrets (gitignored), `.env.example` for the template (committed). Never paste secrets in chat/screenshots
- **Vendor-portable AI** — using OpenAI SDK but pointed at Gemini's compatible endpoint means provider swap is 2 lines

---

## Cost monitoring

Everything in this project sits on free tiers:

| Service | Free tier coverage | Current cost |
|---|---|---|
| AWS EC2 (t3.micro) | 750 hrs/month (24/7 = ~720 hrs) for 12 months | $0 |
| AWS S3 | 5 GB storage + 20K GET + 2K PUT / month | $0 |
| MongoDB Atlas M0 | 512 MB storage, shared cluster | $0 |
| Google Gemini | 15 RPM, 1500 RPD on `gemini-2.0-flash` | $0 |
| Resend | 3000 emails/month | $0 |
| DuckDNS | Forever free | $0 |
| Let's Encrypt | Forever free | $0 |
| GitHub Actions | 2000 min/month for public repos | $0 |

**Total: ~$0/month at portfolio scale.**

**Things that WOULD cost money (avoid these):**

- EC2 instance type larger than `t3.micro` (e.g. `t3.medium`)
- Elastic IPs not attached to a running instance
- NAT Gateways (~$30/month for nothing)
- CloudFront for the backend (not needed — Nginx + Let's Encrypt is enough)
- Forgetting to terminate test instances

Set up the **Cost guardrails** (Step 1 of deployment) BEFORE provisioning anything. AWS doesn't allow hard caps, but alerts fire reliably at the thresholds you set.

---

## Troubleshooting

### `[error] MongoServerSelectionError` on boot

Atlas IP allowlist doesn't include your current IP. Either add your IP under **Atlas → Network Access**, or temporarily allow `0.0.0.0/0` (less secure).

### `429 status code (no body)` from chat endpoint

Gemini returning 429 when the OpenAI SDK can't decode the gzipped error body. Common causes:

- Invalid model name (try `gemini-2.0-flash`)
- API key tied to a project that hasn't enabled the Gemini API
- Brand-new key throttled by Google's safety system

Test directly via curl against `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` to see Google's actual error response.

### S3 upload → "AccessDenied" / "s3:ListBucket"

Three likely causes:

1. **Policy has placeholder bucket name** — open IAM → policy JSON → ensure `Resource` matches your actual bucket
2. **Policy not attached to the user** — IAM → user → Permissions tab → confirm `portfolio-ai-resumes-rw` is listed
3. **File doesn't exist at that S3 key** — AWS hides "file not found" as `AccessDenied: s3:ListBucket` when you lack list permission. Use a verified existing key.

### GitHub Actions deploy: `i/o timeout` on port 22

EC2 security group's SSH rule is locked to "My IP" — GitHub Actions can't reach. Change SSH inbound source to `0.0.0.0/0`. Key-based auth (no password) keeps it secure.

### GitHub Actions deploy: `cd: No such file or directory`

The deploy script's path doesn't match the actual folder name on EC2. Either rename the folder (`mv ~/old-name ~/new-name`) or update the `cd` line in `.github/workflows/ci.yml`.

### `[NODE-CRON] [WARN] missed execution`

The Node event loop was briefly blocked when the cron tried to fire. Common on Windows during dev. Irrelevant for a daily cron — if 9 AM is missed, the next day's run picks up everything.

### Certbot renewal failing

```bash
sudo certbot renew --dry-run  # diagnose
sudo certbot certificates       # see expiry dates
```

If DuckDNS DNS isn't resolving (e.g. domain expired), renewal fails. Update the DuckDNS IP and retry.

### `pm2 status` shows app `errored` after deploy

```bash
pm2 logs portfolio-ai-backend --lines 50   # see the actual error
```

Most likely: missing/invalid env var. Edit `.env` on EC2, then `pm2 restart portfolio-ai-backend`.

---

## License

Personal project — not licensed for redistribution.
