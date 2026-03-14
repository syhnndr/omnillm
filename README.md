# OmniLLM

A full-stack mobile application that lets you manage multiple LLM API keys, create chat sessions with selected models, assign roles and system prompts per LLM, and chat with all of them simultaneously.

---

## ✨ Features

- **Multi-LLM API Key Management** — add, edit, and delete any number of LLM configurations directly from the app; API keys are stored securely on-device using `expo-secure-store` and are *never* sent to or stored on the backend.
- **Flexible Session Creation** — name each session and choose which LLMs participate.
- **Per-LLM Roles & System Prompts** — assign a role (Analyst, Devil's Advocate, Summarizer, Creative, …) and a custom system prompt to every participant.
- **Simultaneous Multi-LLM Chat** — one message goes to *all* LLMs at once; responses appear in parallel in their own colour-coded cards.
- **Persistent Chat History** — sessions and messages are persisted locally via Zustand + AsyncStorage.
- **Dark Theme** — modern dark UI throughout.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native + Expo (SDK 54) |
| Navigation | Expo Router v6 |
| State | Zustand with AsyncStorage persistence |
| Secure storage | expo-secure-store |
| UI components | Custom + @expo/vector-icons |
| Backend | Node.js + Express + TypeScript |
| LLM SDKs | openai, @anthropic-ai/sdk, @google/generative-ai |

### Supported LLM Providers

| Provider | Example Models |
|---|---|
| OpenAI | gpt-4o, gpt-4-turbo, gpt-3.5-turbo |
| Anthropic | claude-3-5-sonnet, claude-3-opus, claude-3-haiku |
| Google Gemini | gemini-1.5-pro, gemini-1.5-flash |
| Mistral AI | mistral-large-latest, mistral-medium-latest |
| Cohere | command-r-plus, command-r |
| Custom | Any OpenAI-compatible endpoint |

---

## 📁 Project Structure

```
omnillm/
├── frontend/                  # React Native + Expo
│   ├── app/
│   │   ├── _layout.tsx                # Root navigator (Stack)
│   │   ├── index.tsx                  # Home / session list
│   │   ├── settings.tsx               # API key management
│   │   ├── new-session.tsx            # Create session (LLM selection + roles)
│   │   └── session/
│   │       └── [id].tsx               # Active chat screen
│   ├── components/
│   │   ├── ChatMessage.tsx            # Message bubble
│   │   ├── LLMCard.tsx                # LLM role/prompt config card
│   │   └── ApiKeyForm.tsx             # Add/edit API key form
│   ├── store/
│   │   └── index.ts                   # Zustand global state
│   ├── types/
│   │   └── index.ts                   # Shared TypeScript types
│   ├── constants/
│   │   └── providers.ts               # Provider list & accent colours
│   ├── app.json
│   ├── babel.config.js
│   ├── tsconfig.json
│   └── package.json
│
├── backend/                   # Node.js + Express
│   ├── src/
│   │   ├── index.ts                   # Express entry point
│   │   ├── routes/
│   │   │   └── chat.ts                # POST /chat
│   │   └── services/
│   │       └── llm.ts                 # Provider call logic
│   ├── .env.example
│   ├── tsconfig.json
│   └── package.json
│
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- iOS Simulator / Android Emulator **or** the [Expo Go](https://expo.dev/client) app on a physical device (**version 54** is required to match the SDK)

---

### 1. Clone the repository

```bash
git clone https://github.com/syhnndr/omnillm.git
cd omnillm
```

---

### 2. Start the backend

```bash
cd backend
npm install
cp .env.example .env   # edit PORT if needed (default: 3001)
npm run dev
```

The backend will start on `http://localhost:3001`.

> **Note:** The backend does *not* require any API keys of its own. Keys are passed per-request from the mobile app.

---

### 3. Start the frontend

```bash
cd frontend
npm install
npx expo start          # launches Expo Dev Server
```

Then:
- Press **`i`** to open in iOS Simulator
- Press **`a`** to open in Android Emulator
- Scan the QR code with **Expo Go** (physical device)

---

### 4. Add API Keys in the app

1. Open the app and tap **"API Keys"** (bottom-left FAB on the home screen).
2. Tap **"Add New LLM"**.
3. Select a provider, pick or type a model name, enter a display name, and paste your API key.
4. Tap **"Add LLM"** to save. Repeat for as many LLMs as you like.

> API keys are encrypted and stored locally using `expo-secure-store`. They are sent directly to the respective LLM provider via the backend proxy and are **never stored server-side**.

---

### 5. Create a session and start chatting

1. On the home screen tap **"New Session"**.
2. Enter a session name.
3. Select which LLMs should participate.
4. For each selected LLM, optionally assign a **Role** (preset or custom) and a **System Prompt**.
5. Tap **"Start Session"**.
6. Type a message and tap **Send** — all LLMs receive the same message simultaneously and respond in parallel.

---

## 🔧 Backend API

### `GET /health`
Returns server status.

### `POST /chat`

**Request body:**
```json
{
  "message": "What is quantum computing?",
  "history": [
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "Hi there!" }
  ],
  "llms": [
    {
      "provider": "openai",
      "model": "gpt-4o",
      "apiKey": "sk-...",
      "systemPrompt": "You are a concise explainer.",
      "role": "Analyst",
      "displayName": "My GPT-4o"
    }
  ]
}
```

**Response:**
```json
{
  "responses": [
    {
      "displayName": "My GPT-4o",
      "role": "Analyst",
      "content": "Quantum computing uses...",
      "provider": "openai"
    }
  ]
}
```

All LLMs are called in parallel via `Promise.allSettled`. If one fails, the others still return successfully.

---

## 🌐 Environment Variables (backend)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Port the Express server listens on |

---

## 📸 Screenshots

> *(Add screenshots here once the app is running)*

---

## 📄 License

MIT