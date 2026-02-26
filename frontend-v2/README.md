# 🚀 XAI Governance Platform - Next.js Frontend

Production-ready frontend built with **Next.js 14**, **Tailwind CSS**, and **Axios**.

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + Framer Motion
- **Icons**: Lucide React
- **API Client**: Axios
- **Theme**: Next-themes (Dark/Light mode)

## 📁 Scalable Directory Structure

```text
src/
├── app/            # Routes & Layouts
├── components/     # UI Components
│   └── layout/     # Navbar, Sidebar, etc.
├── lib/            # Axios, Utilities
├── services/       # API Services
└── hooks/          # Custom React Hooks
```

## ⚙️ Environment Setup

Create a `.env.local` file in the root directory:

```bash
NEXT_PUBLIC_API_URL=https://xai-governance-platform-vnhj.onrender.com
```

## 🚀 Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
   _Access at: http://localhost:3000_

## 🏗️ Production Build

1. Build the application:
   ```bash
   npm run build
   ```
2. Start in production mode:
   ```bash
   npm start
   ```

## ☁️ Deployment (Vercel)

1. Push your code to GitHub.
2. Sign in to [Vercel](https://vercel.com).
3. Import the repository.
4. Set the **Root Directory** to `frontend-v2` (or rename to `frontend` first).
5. Add the environment variable: `NEXT_PUBLIC_API_URL`.
6. Click **Deploy**.

---

**Backend Base URL**: `https://xai-governance-platform-vnhj.onrender.com`
