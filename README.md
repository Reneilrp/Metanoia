# 🚀 Metanoia: Habit & Productivity App with AI Coaching

> A thoughtful, offline-first habit tracking ecosystem powered by an empathetic **Gemini AI Coach**, multi-modal **Voice Journaling**, and non-toxic **Accountability Circles**.

Welcome to **Metanoia**! Metanoia is designed to help you build sustainable daily habits without guilt or burnout. Grounded in Cognitive Behavioral Therapy (CBT) and BJ Fogg's *Tiny Habits* methodology, Metanoia treats skipped days as valuable data points rather than moral failures.

---

## ✨ What You Can Do with Metanoia

* 📱 **Frictionless Daily Tracking**: Check off habits with instant offline support. Whether you are on an airplane or deep in the subway, your progress is tracked locally and automatically syncs when you reconnect.
* 🧠 **Empathetic AI Coach**: Chat with an AI mentor trained to eliminate guilt. If you break a streak, the AI Coach generates a **Streak Rescue**—a bite-sized, 2-minute version of your habit to get you back on track without stress.
* 🎙️ **Voice Journaling & Audio Briefings**: Speak your mind instead of typing. Record daily reflections, automatically analyze emotional sentiment, and listen to spoken coach briefings.
* 👥 **Accountability Circles**: Share your journey with trusted friends using invite codes. Send and receive supportive emoji cheers without toxic competition or vanity metrics.
* 🔒 **Privacy-First & Data Ownership**: Export your complete data footprint at any time with a single tap (GDPR-compliant) or delete your account whenever you choose.

---

## ⚡ Quick Start: Running Metanoia

### Prerequisites
* [Node.js](https://nodejs.org/) (v18+ recommended)
* npm, yarn, or pnpm
* [Expo Go](https://expo.dev/go) app on your iOS or Android device (or run directly in your web browser)

---

### 1. Start the Backend API
The backend provides user authentication, cross-device sync, and AI coaching services:

```bash
cd backend
npm install
npm run start:dev
```
The API server will start on `http://localhost:3000/api/v1`.

---

### 2. Start the Mobile / Web App
Launch the Expo development server:

```bash
cd frontend
npm install
npm start
```

* **To run on your phone**: Open the **Expo Go** app on your phone and scan the QR code displayed in your terminal.
* **To run in your web browser**: Press <kbd>w</kbd> in the terminal.
* **To run on an emulator**: Press <kbd>a</kbd> for Android or <kbd>i</kbd> for iOS simulator.

---

## 🔑 AI Coach Configuration

Metanoia comes with a **quota-safe dual-mode switch** in `backend/.env`:

```env
# Set to 'true' to enable live Google Gemini, or 'false' for local offline engine
AI_COACH_ENABLED=false
GEMINI_API_KEY="your-gemini-api-key-here"
GEMINI_MODEL="gemini-1.5-flash"
```

* **Local Fallback Mode (`false`)**: Zero external API calls. Uses a built-in, science-backed CBT engine to provide instant advice, streak rescues, and weekly reviews completely free without an API key.
* **Live Gemini Mode (`true`)**: Connects to **Google Gemini 1.5 Flash** for real-time conversational streaming and deep psychological reflections.
