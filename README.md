# Straits Digital

Group application for DBFS Assignment 2. It uses one React frontend and one
Flask backend, with each member's feature kept in a named folder.

## Ownership

- **Shared:** `frontend/src/shared`, `backend/shared`
  - Navigation, login UI, API client, reusable UI, PayPal login and Supabase connection
- **Victor:** `frontend/src/victor/stocks`, `backend/victor`
  - Stocks, portfolio, AI, orders and Stocks PayPal checkout
- **Zavier:** `frontend/src/zavier`, `backend/zavier`
  - Crypto page and `/api/crypto`
- **Ong Xuan:** `frontend/src/ong_xuan`, `backend/ong_xuan`
  - Other page and `/api/other` until the feature name is confirmed

## Run locally

Copy `.env.example` to `.env`, fill in your own credentials, then start Flask:

```powershell
python -m pip install -r requirements.txt
python run.py
```

Start React in another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open <http://127.0.0.1:5173>. Vite forwards `/api` requests to Flask at
<http://127.0.0.1:5000>.

## Current repository setup

- The shared navigation already switches between Stocks, Crypto and Other.
- Crypto and Other currently open as blank pages.
- Zavier and Ong Xuan's Flask modules and health routes are already registered.
- PayPal login and the user session are shared across all pages.
- Each feature keeps its own checkout logic inside its member backend folder.
- All modules use the same Supabase project through `backend/shared/database.py`.
- Each member uses their own `.env` and credentials when presenting locally.

## Implementing your frontend

- Start from `CryptoPage.jsx` or `OtherPage.jsx` in your member folder.
- Add your own `components`, `hooks` or `lib` folders when the page grows.
- Reuse controls from `@/shared/components/ui` to keep the design consistent.
- Call Flask through the shared client:

```jsx
import { api } from "@/shared/lib/api";

const data = await api.get("/api/crypto/example");
await api.post("/api/crypto/example", { value });
```

- API keys and service secrets stay in the backend `.env`, not React files.

## Implementing your backend

- Add routes inside your member folder and keep them under your existing prefix.
- The current member `__init__.py` shows how the Flask blueprint is registered.
- Larger features can be separated into `routes/` and `services/`, similar to
  `backend/victor`.
- Authenticated endpoints can use:

```python
from backend.shared.auth import require_user

user, error = require_user()
if error:
    return error
```

- External API calls and calculations fit better in a service file, leaving the
  route responsible for validation and returning JSON.

## PayPal and Supabase

- PayPal **login** is shared in `backend/shared/paypal_auth.py`.
- PayPal **checkout** is individual. Victor's example is in
  `backend/victor/services/paypal.py` and `backend/victor/routes/orders.py`.
- Zavier and Ong Xuan can create their own checkout services and callback routes
  inside their folders.
- The shared Supabase client is available with:

```python
from backend.shared.database import supabase
```

- User data should be queried using the authenticated `user["user_id"]`.
- New tables should use clear feature names such as `crypto_watchlist`.
- New database changes go into a new timestamped file under
  `supabase/migrations`.

## Adding configuration

- Add the variable name with an empty value to `.env.example`.
- Load it once in `backend/config.py`.
- Use the `Config` value inside your backend service.
- Restart Flask after changing `.env`.
- `.env`, logs, `node_modules`, build output and Python caches are already ignored
  by Git.

## Quick check before sharing

- Your page opens from the shared navigation.
- Your Flask endpoint returns JSON and handles missing input clearly.
- Login/logout and the other two pages still work.
- Supabase data is separated by the authenticated user.
- Checkout success and cancellation return to the correct page.
- `npm run build` passes.
