# Portfolio AI Backend

Production-grade Node.js backend powering the AI chatbot on my portfolio site. Lets visitors chat with an AI version of me ("AI Harsh") trained on my bio and experience, optionally upload their resume for a referral, and sends me a daily 9 AM IST email digest of all activity.

**Portfolio frontend:** https://d2oat8oeneh958.cloudfront.net

---

## Features

- AI chat with a persona system prompt (Google Gemini, free tier)
- Multi-turn conversations persisted in MongoDB (one document per visitor session)
- Resume uploads (PDF / DOC / DOCX up to 5 MB) stored privately in AWS S3
- Daily 9 AM IST email digest of new conversations + uploads, with 7-day signed download links
- Pre-signed S3 URLs for secure file sharing in email
- Per-IP rate limiting on chat (20 req/min) and upload (10 req/hr)
- Defense in depth: HTTP-layer validation + Mongoose schema validation + IAM least-privilege
- Idempotent digest job (won't re-email the same activity)
- Lazy singleton clients for Gemini, S3, Mongoose, Resend
- Modular cron pattern — add new scheduled jobs by creating one folder

---

## Tech stack

- **Runtime:** Node.js 20+ (ES modules)
- **HTTP:** Express 5
- **AI:** Google Gemini via OpenAI-compatible endpoint (uses the `openai` SDK)
- **Database:** MongoDB Atlas (free M0 cluster) + Mongoose ODM
- **File storage:** AWS S3 (private bucket, IAM-restricted access)
- **Email:** Resend (free tier)
- **Scheduling:** node-cron
- **File uploads:** multer (memoryStorage)
- **Rate limiting:** express-rate-limit
- **Process manager (dev):** nodemon

---

## Architecture

```
Visitor's browser
       │
       ▼
   Express (this backend)
       │
       ├──► Google Gemini       (chat completions)
       ├──► MongoDB Atlas       (conversations + uploads metadata)
       ├──► AWS S3              (private resume storage)
       └──► Resend              (daily digest email)
                                       │
                                       ▼
                              harshyadav6642@gmail.com
                              (daily 9 AM IST)
```

Boot order:
1. Load `.env` via dotenv
2. Connect to MongoDB
3. Register cron jobs
4. Start HTTP listener

If MongoDB connection fails on boot, the server refuses to start (fail-fast).

---

## Project structure

```
portfolio-ai-backend/
├── src/
│   ├── index.js                       Server entry — boot + middleware + routes
│   ├── config/
│   │   ├── db.js                      MongoDB connection (Mongoose)
│   │   ├── s3.js                      S3 client + bucket helper
│   │   └── email.js                   Resend client + recipient helper
│   ├── routes/
│   │   ├── chat.routes.js             POST /chat
│   │   └── upload.routes.js           POST /upload-resume
│   ├── controllers/
│   │   ├── chat.controller.js         Validate + delegate to chat service
│   │   └── upload.controller.js       Validate + delegate to upload service
│   ├── middleware/
│   │   ├── upload.middleware.js       multer config (5 MB, PDF/DOC/DOCX)
│   │   └── rateLimit.middleware.js    Per-IP rate limiters
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
│       ├── index.js                   Schedules all crons
│       └── digest/
│           └── index.js               digestCron.sendDailyDigest()
├── scripts/
│   ├── send-test-email.js             Manual Resend smoke test
│   ├── test-presigned-url.js          Manual presign smoke test
│   └── run-digest-now.js              Manually trigger the digest (skips cron)
├── .env                               Local secrets (gitignored)
├── .env.example                       Env template (committed)
├── .gitignore
├── package.json
└── README.md
```

---

## API endpoints

### `POST /api/chat`

Send a chat message and get an AI reply. Multi-turn — frontend sends full history each request.

**Body (JSON):**

```json
{
  "sessionId": "<uuid v4>",
  "messages": [
    { "role": "user", "content": "Hi" },
    { "role": "assistant", "content": "Hey!" },
    { "role": "user", "content": "Tell me about your AWS skills" }
  ]
}
```

**Response (200):**

```json
{
  "reply": "I work with S3, CloudFront, EC2...",
  "meta": { "model": "gemini-2.0-flash", "usage": {...}, "conversationId": "..." }
}
```

**Rate limit:** 20 requests / minute / IP.

---

### `POST /api/upload-resume`

Upload a resume file. Multipart form with `sessionId` (text) + `resume` (file).

- Allowed types: `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Max size: 5 MB
- Stored at: `s3://<bucket>/resumes/<sessionId>/<timestamp>-<sanitized-filename>`

**Response (200):**

```json
{
  "ok": true,
  "upload": { "s3Key": "...", "originalName": "...", "size": 12345, "mimeType": "application/pdf" },
  "conversationId": "..."
}
```

**Rate limit:** 10 uploads / hour / IP.

---

### `GET /health`

Returns `{ status, env, uptime, timestamp }`. Used for liveness checks.

---

## External services required

You'll need accounts and credentials for:

| Service | Free tier covers our usage | Get key at |
|---|---|---|
| Google Gemini (AI Studio) | ✓ (15 RPM, 1500 RPD on `gemini-2.0-flash`) | https://aistudio.google.com/apikey |
| MongoDB Atlas | ✓ (M0 cluster, 512 MB) | https://cloud.mongodb.com |
| AWS (S3 + IAM) | ✓ (a few KB of storage costs ~$0) | https://aws.amazon.com |
| Resend | ✓ (3000 emails/month free) | https://resend.com |

**Total monthly cost at portfolio scale: ~$0.**

---

## Local setup

### 1. Clone and install

```bash
git clone <repo-url>
cd portfolio-ai-backend
npm install
```

### 2. Create `.env` from template

```bash
cp .env.example .env
```

Fill in the values:

```
# Server
PORT=5000
NODE_ENV=development
CORS_ORIGINS=http://localhost:3000,https://d2oat8oeneh958.cloudfront.net

# Google Gemini (https://aistudio.google.com/apikey)
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.0-flash

# MongoDB Atlas
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/portfolio_ai_chat?appName=Cluster0

# AWS S3
AWS_REGION=ap-south-1
AWS_S3_BUCKET=portfolio-ai-resumes-<your-name>
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# Resend (https://resend.com/api-keys)
RESEND_API_KEY=re_...
DIGEST_RECIPIENT_EMAIL=your@email.com
```

### 3. Set up AWS S3 (one-time)

- Create a private S3 bucket (block all public access)
- Create an IAM user `portfolio-ai-backend` with a custom policy granting **only** `s3:PutObject` + `s3:GetObject` on `arn:aws:s3:::<bucket>/resumes/*`
- Generate access keys for that user → use them in `.env`

### 4. Run dev server

```bash
npm run dev
```

Expected output:

```
[db] connected: portfolio_ai_chat
[cron] all schedules registered
[server] listening on http://localhost:5000 (development)
```

---

## Scripts

```bash
npm run dev        # Dev server with nodemon (auto-restart on file save)
npm start          # Production: plain node, no auto-restart
```

### Manual maintenance scripts

```bash
node scripts/send-test-email.js          # Send a "hello world" email via Resend
node scripts/test-presigned-url.js <key> # Generate a 7-day download URL for an S3 key
node scripts/run-digest-now.js           # Trigger the daily digest immediately (bypasses cron)
```

`run-digest-now.js` is the most useful one in production — if the 9 AM cron fails, you can re-run it manually.

---

## Daily digest behavior

- **Cron:** `0 9 * * *` in `Asia/Kolkata` (defined in `src/cron/digest/index.js`)
- **Query:** finds conversations where `updatedAt > digestSentAt` (or `digestSentAt` is null)
- **Email body:** summary + each conversation's messages + each upload with a 7-day signed download link
- **Idempotency:** each emailed conversation is marked with `digestSentAt = now` (using `{ timestamps: false }` to avoid Mongoose bumping `updatedAt` and creating an infinite re-send loop)
- **Recipient:** `DIGEST_RECIPIENT_EMAIL` from `.env`
- **Sender:** `onboarding@resend.dev` (Resend's free testing sender; can be customized after verifying a domain)

The cron runs inside the same Node process as the HTTP server. If the server is down at 9 AM, that day's digest is skipped.

---

## Design principles applied

- **Defense in depth** — validation at HTTP layer (controllers), schema layer (Mongoose), and infrastructure layer (IAM least-privilege)
- **Principle of least privilege** — the IAM user can only `PutObject`/`GetObject` under `resumes/*` — nothing else
- **Separation of concerns** — routes → controllers → services → models
- **Singleton clients** — Gemini, S3, Resend, and Mongoose connections each instantiated once
- **Find-or-create** — chat and upload both key off `sessionId`, producing one document per visitor
- **Declarative cron config** — schedules live in code (`src/cron/`), not env. New cron = new folder.
- **Fail-fast on boot** — missing env vars throw immediately, never silently
- **Env hygiene** — `.env` for real secrets (gitignored), `.env.example` for the template (committed)

---

## Adding a new scheduled job (future)

1. Create `src/cron/<jobName>/index.js`:

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

2. Add 2 lines to `src/cron/index.js`:

   ```js
   import { myCron } from "./myJob/index.js";
   // ...
   cron.schedule("0 3 * * 0", () => myCron.runMyJob(), { timezone: IST });
   ```

Boot the server — the new schedule is registered automatically.

---

## Deployment (planned)

- AWS EC2 instance with PM2 process manager
- Nginx reverse proxy + Let's Encrypt HTTPS
- GitHub Actions CI/CD pipeline (mirroring the portfolio frontend's pipeline)

Not yet implemented.

---

## License

Personal project — not licensed for redistribution.
