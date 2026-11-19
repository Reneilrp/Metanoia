# 🚀 Metanoia: Habit & Productivity App with AI Coaching

> A full-stack, offline-first habit tracking ecosystem powered by an empathetic **Gemini AI Coach**, multi-modal **Voice Journaling**, and non-toxic **Accountability Circles**.

---

## 🏗️ Architecture & Phased Implementation Status

| Phase | Description | Status | Verification |
| :--- | :--- | :---: | :--- |
| **Phase 1** | **Cloud & Sync Foundation**: JWT Auth, SQLite/PostgreSQL Prisma schema, LWW offline sync engine, mobile sync badge. | ✅ **Complete** | E2E Tests Passing |
| **Phase 2** | **Gemini AI Coach Engine**: Dual-mode architecture (Live Gemini 1.5 Flash vs Quota-Safe Local CBT Engine), Streak Rescue, Weekly Retrospectives. | ✅ **Complete** | E2E Tests Passing |
| **Phase 3** | **Voice & Multi-Modal Insights**: Audio recording (`expo-av`), automated transcription, psychological sentiment extraction, audio coach briefings. | ✅ **Complete** | E2E Tests Passing |
| **Phase 4** | **Social, Monetization & Store Launch**: Accountability Circles (invite codes, reactions), Pro paywall modal, GDPR data export, health disclaimers, EAS build config. | ✅ **Complete** | E2E Tests Passing |

---

## 📁 Repository Layout

```
metanoia/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma        # User, Habit, Completion, Reflection, Tombstone, Circle, Reaction
│   ├── src/
│   │   ├── auth/                # JWT strategy, guards, register, login, profile
│   │   ├── sync/                # Push/pull offline-first synchronization protocol
│   │   ├── habits/              # Check-in toggling, streak counters, date filters
│   │   ├── ai/                  # Gemini 1.5 Flash + Local CBT Fallback Coach
│   │   ├── voice/               # Multimodal STT, sentiment analysis, audio briefings
│   │   ├── circles/             # Accountability Circles, invite codes, emoji cheers
│   │   └── users/               # Pro subscription gating, GDPR JSON export, self-deletion
│   ├── test/                    # 21 comprehensive E2E integration test suites
│   ├── docker-compose.yml       # PostgreSQL 16 & Redis 7 container orchestration
│   └── .env                     # Database URL, JWT secrets, Gemini toggle
│
└── frontend/
    ├── app/
    │   ├── (tabs)/
    │   │   ├── index.tsx        # Today Dashboard: Habit list, check-in, sync status badge
    │   │   ├── two.tsx          # AI Coach: Interactive chat, streak rescue, audio briefings
    │   │   └── profile.tsx      # Cloud sync, Pro subscription, Circles, GDPR export
    │   └── _layout.tsx          # Root AuthProvider & theme setup
    ├── components/
    │   ├── SyncBadge.tsx        # Real-time online/offline sync status indicator
    │   ├── VoiceRecorderModal.tsx # Voice recording with timer & automatic sentiment extraction
    │   ├── PaywallModal.tsx     # Metanoia Pro upgrade screen (Monthly/Annual billing)
    │   └── CirclesModal.tsx     # Accountability Circles feed & reaction cheering
    ├── services/
    │   ├── apiClient.ts         # Cross-platform HTTP client (Android 10.0.2.2 / iOS / Web)
    │   ├── localStorage.ts      # Offline change-tracking repository (synced/created/updated/deleted)
    │   ├── syncEngine.ts        # NetInfo network-aware bidirectional sync worker
    │   ├── aiService.ts         # AI coach chat, streak rescue, and weekly review API
    │   ├── voiceService.ts      # Voice recording transcription & briefing synthesis
    │   └── socialService.ts     # Circle creation, joining, and emoji reaction API
    ├── eas.json                 # Expo Application Services build & App Store submission config
    └── app.json                 # iOS & Android bundle IDs, microphone permissions, icons
```

---

## 🔑 AI Coach Dual-Mode Configuration

The AI Coach is configured with a **quota-safe dual-mode switch** in `backend/.env`:

```env
# Disabled by default: Zero external API calls, preserves your Gemini quota for other projects
AI_COACH_ENABLED=false
GEMINI_API_KEY=""
GEMINI_MODEL="gemini-1.5-flash"
```

* **When Disabled (`false`)**: Uses the built-in, science-backed **Local CBT & Tiny Habits Engine**. Responses, streak rescues, and weekly reviews are generated locally without consuming any API quota.
* **When Enabled (`true`)**: Connects seamlessly to live **Google Gemini 1.5 Flash** using the `@google/genai` SDK.

---

## ⚡ Quick Start Guide

### 1. Launch Backend API
```powershell
cd "C:\Users\ASUS TUF A5\metanoia\backend"
npm run start:dev
```
API runs on: `http://localhost:3000/api/v1`

### 2. Run Backend E2E Tests (21/21 Passing)
```powershell
cd "C:\Users\ASUS TUF A5\metanoia\backend"
npm run test:e2e
```

### 3. Launch Expo Mobile Frontend
```powershell
cd "C:\Users\ASUS TUF A5\metanoia\frontend"
npm run start
```
* Press `w` to open in browser (Web).
* Scan QR code with Expo Go on iOS or Android.
