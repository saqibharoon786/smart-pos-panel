# Book POS backend

Express API for inventory (POP), sales (POS), holds, and returns.

Requires MongoDB (`MONGODB_URI` in `.env`). Auth credentials are also in `.env`. Protected routes require the `pos_token` httpOnly cookie issued by `POST /api/auth/login`.
