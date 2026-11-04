# LeptoWatch Developer Setup Guide

This guide describes how to configure, run, and test the LeptoWatch platform on a local development workstation.

---

## 1. System Requirements

- **Operating System:** Windows 10/11, macOS 12+, or Ubuntu 22.04+
- **Node.js:** v20.x LTS or v22.x LTS (with npm)
- **Python:** v3.10, v3.11, v3.12, or v3.13 (64-bit recommended)
- **Memory:** Minimum 4 GB RAM (8 GB recommended for in-memory spatial caches)

---

## 2. Repository Cloning & Environment Setup

```bash
# Clone the repository
git clone https://github.com/Vidurshanan/leptowatch.git
cd leptowatch
```

---

## 3. Backend Service Setup (`apps/api`)

### Step 1: Create Virtual Environment & Install Dependencies
```bash
# From repository root or apps/api:
cd apps/api

# Create a virtual environment
python -m venv .venv

# Activate virtual environment
# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# Linux/macOS:
source .venv/bin/activate

# Install required packages
pip install -r ../../packages/leptowatch/requirements.txt
pip install fastapi uvicorn pydantic pandas pyarrow pytest httpx
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default configuration:
```env
LEPTOWATCH_ROOT=../..
LEPTOWATCH_HOST=0.0.0.0
LEPTOWATCH_PORT=8000
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
FRESHNESS_POLICY_DAYS=56
```

### Step 3: Run Backend Service
```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
The API documentation is accessible at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

---

## 4. Frontend Application Setup (`apps/web`)

### Step 1: Install Dependencies
```bash
cd apps/web
npm install
```

### Step 2: Configure Environment
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Ensure `NEXT_PUBLIC_API_URL` points to your backend instance:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Step 3: Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 5. Verification & Test Commands

Run the comprehensive test suite to confirm operational readiness:

### Backend Unit & Integration Tests (21 Tests)
```bash
# From repository root:
py -m pytest apps/api/tests/ -v
```

### Frontend Type Validation
```bash
cd apps/web
npx tsc --noEmit
```

### Frontend Linting
```bash
cd apps/web
npm run lint
```

### Next.js Production Build
```bash
cd apps/web
npm run build
```

---

## 6. Configuring Local Research Datasets (Authorized Developers)

Authorized researchers holding the encrypted private handover archive (`LeptoWatch_Private_Development_Handover.zip`) can mount local data files:
1. Extract the archive outside the repository (e.g., `C:/LeptoWatch_Data`).
2. Update `apps/api/.env`:
   ```env
   LEPTOWATCH_ROOT="C:/LeptoWatch_Data"
   ```
3. Restart the FastAPI server. The backend will mount the datasets and transition from `DEGRADED` to `READY` status in `/api/health`.
