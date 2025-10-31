# Better Auth Setup Guide

## ✅ Database is Ready!

Your PostgreSQL database has been configured to work with Better Auth. Both your Express backend and Next.js frontend will share the same database.

---

## 📊 Database Connection Details

**Add this to your Next.js `.env` file on Vercel:**

```bash
# PostgreSQL Connection (for Better Auth)
DATABASE_URL="postgresql://cs2user:cs2pass123@178.156.147.69:5432/cs2floatapi"

# Better Auth Secret (must match backend)
BETTER_AUTH_SECRET="cs2float-secret-key-change-in-production"
BETTER_AUTH_URL="https://cs2floatchecker.com"

# Steam API Key
STEAM_API_KEY="863053349689FA6DE8D1B9D5792A62AF"
```

---

## 📦 Install Dependencies in Your Next.js App

```bash
npm install better-auth
npm install @better-auth/steam  # Custom Steam plugin
npm install postgres  # PostgreSQL adapter
```

---

## 🔧 Better Auth Configuration

Create `lib/auth.ts` in your Next.js app:

```typescript
import { betterAuth } from "better-auth";
import { steamAuth } from "@better-auth/steam";  // From the gist
import { Pool } from "pg";

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const auth = betterAuth({
  database: {
    provider: "postgres",
    pool,
  },

  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL!,

  // Use the Steam plugin
  plugins: [
    steamAuth({
      apiKey: process.env.STEAM_API_KEY!,
      // Steam will redirect back to your Next.js app
      callbackURL: `${process.env.BETTER_AUTH_URL}/api/auth/callback/steam`,
    }),
  ],

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update every day
  },
});
```

---

## 🎯 Create API Routes in Next.js

### 1. Auth API Route: `app/api/auth/[...all]/route.ts`

```typescript
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

### 2. Steam Login Button

```typescript
'use client';

import { signIn } from "better-auth/client";

export function SteamLoginButton() {
  const handleLogin = async () => {
    await signIn.social({
      provider: "steam",
      callbackURL: "/dashboard",  // Where to go after login
    });
  };

  return (
    <button onClick={handleLogin}>
      Sign in with Steam
    </button>
  );
}
```

### 3. Use Auth in Components

```typescript
'use client';

import { useSession } from "better-auth/react";

export function UserProfile() {
  const { data: session, isPending } = useSession();

  if (isPending) return <div>Loading...</div>;
  if (!session) return <div>Not logged in</div>;

  return (
    <div>
      <img src={session.user.image} alt="Avatar" />
      <p>Welcome, {session.user.name}</p>
      <p>Steam ID: {session.user.steam_id}</p>
    </div>
  );
}
```

### 4. Make API Calls with Auth

```typescript
import { auth } from "@/lib/auth";

// Get session on server
const session = await auth.api.getSession({
  headers: request.headers,
});

// Call your Express backend with Steam ID
const response = await fetch(
  `https://api.cs2floatchecker.com/api/portfolio/${session.user.steam_id}`,
  {
    headers: {
      'Authorization': `Bearer ${session.session.token}`,
    },
  }
);
```

---

## 🔄 Database Schema

Better Auth will use these tables (already created):

- **users** - Stores user profiles (Steam data)
- **sessions** - Active user sessions
- **accounts** - OAuth provider accounts (Steam)
- **verification_tokens** - For email verification (not used for Steam)

---

## 🎯 How It Works

```
1. User clicks "Login with Steam" on cs2floatchecker.com
   ↓
2. Better Auth redirects to Steam OpenID
   ↓
3. Steam authenticates user
   ↓
4. Steam redirects back to: cs2floatchecker.com/api/auth/callback/steam
   ↓
5. Better Auth:
   - Creates/updates user in PostgreSQL
   - Creates session in PostgreSQL
   - Sets secure cookie (same domain!)
   ↓
6. User redirected to dashboard
   ↓
7. Frontend reads session from cookie
   ↓
8. Frontend calls Express API with session token
```

---

## ✅ Benefits

- ✅ **Same domain cookies** - No cross-domain issues!
- ✅ **Shared database** - Both apps see same users
- ✅ **Simple auth** - Better Auth handles everything
- ✅ **Type-safe** - Full TypeScript support
- ✅ **Persistent sessions** - Stays logged in across navigation

---

## 🔧 Express Backend Changes

The Express backend will:
- Remove Passport.js (no longer needed)
- Accept Better Auth session tokens
- Verify tokens and extract Steam ID
- Continue serving portfolio data

(I'll update the backend after you confirm frontend is ready)

---

## 📝 Next Steps

1. **Add DATABASE_URL to Vercel** environment variables
2. **Install Better Auth** in your Next.js app
3. **Copy the code above** into your Next.js app
4. **Deploy to Vercel**
5. **Test login** at cs2floatchecker.com

Let me know when you're ready and I'll update the Express backend!
