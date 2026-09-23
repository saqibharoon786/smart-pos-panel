# Book POS

Frontend and backend are separate folders. Dummy login and in-browser inventory are gone. Data is stored in **MongoDB**. Dashboard routes and API routes both require a real login.

## Login (from `backend/.env`)

- Email: `hamzabook@gmail.com`
- Password: `786786`

Change these only in `backend/.env`. The frontend never stores the password.

## Database

MongoDB must be running. Connection string:

```
MONGODB_URI=mongodb://127.0.0.1:27017/bookpos
```

Collections: `products`, `popHistory`, `sales`, `posReturns`, `heldSales`, `meta`.

## Run locally

From this folder:

```sh
npm run install:all
npm run dev
```

- API: http://127.0.0.1:4000
- App: Vite / Lovable default (often http://localhost:8080)

`/app` and every `/api/*` route except `/api/auth/login` and `/api/health` require an httpOnly JWT cookie. Opening `/app` without signing in redirects to the landing page.

## Folders

- `frontend/` — TanStack Start UI
- `backend/` — Express API + inventory/sales logic
