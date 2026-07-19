# FlowMind AI - Production Web Application

FlowMind AI is a full-stack, AI-powered productivity workspace designed for peak performance. It allows users to coordinate tasks, schedule events, generate tone-aligned email drafts, summarize multi-format documents, and chat with a context-aware AI assistant.

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS (v4), Framer Motion
- **Backend & Database**: Firebase Auth, Firestore Database, Firebase Storage
- **Artificial Intelligence**: Google Gemini API (`@google/generative-ai`)
- **Deployment**: Vercel Ready

---

## Key Features

1. **Intelligent Auth**: Seamless Google OAuth and Email Sign-In with robust session persistence.
2. **AI Task Manager**: Full CRUD Kanban Board & List views, native HTML5 drag-and-drop state sync, and Gemini smart task breakdowns.
3. **Smart Scheduler**: Calendar Monthly/Weekly/Daily grids with event coordination and Gemini timing slot recommendations.
4. **Document Summarizer**: File-drop processing that distills executive summaries, key highlights, and action items with text exports.
5. **Meeting Automation**: Automatically parses meeting transcripts to extract action items, create Firestore tasks, schedule review events, and draft follow-up emails.
6. **Email Generator**: Drafts tone-aligned copy (Professional, Casual, Friendly, Formal) from prompts.
7. **A.I. Copilot**: Conversational assistant linked to persistent Firestore history with support for text file context attachment.

---

## Folder Structure

```
app/              # Next.js App Router route segments (landing page, login, dashboard)
components/       # Reusable layout and custom UI primitives
contexts/         # Client providers (AuthContext, ToastContext)
firebase/         # Firebase configuration initializer
hooks/            # Global custom hooks (useAuth, useToast)
services/         # External integrations (Google Gemini API, Firestore db CRUD operations)
types/            # TypeScript interfaces
utils/            # Utility helpers
html_backup/      # Original static prototype HTML pages backup (preserved)
```

---

## Dual Mode Execution (Zero-Setup Run)

To guarantee that the application runs out-of-the-box, FlowMind AI supports **Dual Mode**:
- **Live Mode**: If `.env.local` is present with valid Firebase & Gemini keys, it reads/writes directly to Firestore, performs standard Firebase auth, and queries the live Gemini API.
- **Offline / Demo Mode**: If credentials are missing, the application automatically boots into a Mock Offline mode. Authentication sessions are persisted in `localStorage`, database records are populated with high-fidelity templates matching the mockups, and AI services generate realistic structural completions with local latency simulation.

---

## Local Setup

### 1. Configure Environment Variables
Create a `.env.local` file in the root directory:
```bash
cp .env.example .env.local
```
Fill in your Firebase config keys and your Google Gemini API key.

### 2. Install Packages
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Deployment to Vercel

1. Push your code to a GitHub repository.
2. Import the project into Vercel.
3. Add the keys from `.env.example` to the **Environment Variables** section in the Vercel dashboard.
4. Deploy!
