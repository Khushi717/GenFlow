# GenFlow

## Overview

GenFlow is an AI-powered productivity workspace designed to help individuals and teams work smarter by simplifying daily tasks, automating repetitive workflows, and improving overall productivity.

Built using **Next.js**, **Firebase**, and **Google Gemini AI**, GenFlow combines task management, scheduling, meeting assistance, document summarization, email generation, and an intelligent AI assistant into one unified platform.

---

## Problem Statement

Modern productivity workflows are fragmented across multiple applications for task management, calendars, meetings, emails, and documents. Constant context switching reduces efficiency and increases manual effort.

GenFlow addresses this challenge by bringing these essential productivity tools together into a single AI-powered workspace that automates routine workflows and provides intelligent assistance throughout the user's day.

---

## Features

- AI-powered productivity assistant
- Smart task management with CRUD operations
- Calendar and event scheduling
- AI meeting summarization and action item generation
- AI document summarization
- AI email drafting with multiple writing styles
- Productivity dashboard with personalized insights
- Firebase Authentication and Cloud Storage
- Responsive and modern user interface

---

## Tech Stack

| Category | Technologies |
|----------|--------------|
| Frontend | Next.js 15, React 19, TypeScript |
| Styling | Tailwind CSS v4, Framer Motion |
| Backend | Firebase Authentication, Firestore, Firebase Storage |
| AI | Google Gemini API |
| Deployment | Vercel |

---

## Project Structure

```
GenFlow/
│
├── app/
│   ├── dashboard/
│   ├── assistant/
│   ├── tasks/
│   ├── calendar/
│   ├── meetings/
│   ├── documents/
│   └── emails/
│
├── components/
├── contexts/
├── firebase/
├── hooks/
├── services/
├── types/
├── utils/
├── public/
└── README.md
```

---

## Getting Started

### Clone the repository

```bash
git clone https://github.com/Khushi717/GenFlow.git
cd GenFlow
```

### Install dependencies

```bash
npm install
```

### Configure environment variables

Create a `.env.local` file and add your Firebase configuration along with your Google Gemini API key.

### Run the development server

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## Application Flow

```
User Login
      │
      ▼
Dashboard
      │
      ▼
Select Module
(Task • Calendar • Meeting • Document • Email • AI Assistant)
      │
      ▼
Prompt Engineering Layer
      │
      ▼
Google Gemini AI
      │
      ▼
Generated Response
      │
      ▼
Review • Edit • Save
```

---

## Deployment

GenFlow is deployment-ready on **Vercel**.

```bash
npm run build
```

Configure the required Firebase and Gemini environment variables before deploying.

---

## Future Enhancements

- Voice-enabled AI assistant
- Real-time team collaboration
- Google Calendar integration
- Gmail integration
- Slack and Microsoft Teams integration
- AI workflow automation
- Mobile application
- Productivity analytics
- Personalized AI recommendations

