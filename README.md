# Straits Digital

One React frontend and one Flask backend containing three independently owned
DBFS features.

## Repository layout

- **Victor:** `frontend/src/victor`, `backend/victor`
  - Stocks, portfolio, AI, Stocks auth and PayPal checkout.
- **Zavier:** `frontend/src/zavier`, `backend/zavier`
  - Crypto canvas, market data, Crypto auth, orders and PayPal services.
- **Ong Xuan:** `frontend/src/ong_xuan`, `backend/ong_xuan`
  - Forex rates, quotes, Forex auth, orders and PayPal checkout.
- **Shared frontend:** entrypoint/router, global CSS, UI primitives, API client
  and formatting/navigation helpers.
- **Shared backend:** Flask configuration and the Supabase connection only.

Each member owns their login screen, navigation bar, profile menu, auth session,
feature UI and backend logic. The root app only switches between sections.

## Run locally

Copy `.env.example` to `.env`, fill in your credentials and start Flask:

```powershell
python -m pip install -r requirements.txt
python run.py
```

In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open <http://127.0.0.1:5173>. Use `127.0.0.1` consistently for PayPal callback
URLs.

## Integration notes

- Section URLs are `?section=Stocks`, `?section=Crypto` and `?section=Forex`.
- Auth endpoints are `/api/victor/auth`, `/api/zavier/auth` and
  `/api/ong-xuan/auth`. `/api/auth` remains a Stocks compatibility alias.
- Logging out of one section does not log out the other sections.
- Existing feature APIs remain `/api/market`, `/api/ai`, `/api/orders`,
  `/api/portfolio`, `/api/crypto` and `/api/ong-xuan/forex`.
- Reuse `@/shared/components/ui` and `@/shared/lib/api` for consistent design
  and Flask requests. Do not import another member's feature files.
- All modules use the same Supabase project through
  `backend/shared/database.py`; each feature continues using its own tables.
- `api_cache` is intentionally shared. Keep cache keys provider/feature
  prefixed.
- PayPal checkout code remains inside each member's backend folder. Register
  the matching member callback from `.env.example` in your PayPal Sandbox app.
- Secrets stay in the root `.env` because the combined backend is one process;
  each presenter uses their own local values.
