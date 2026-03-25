AmbuTrack — Final Developer Notes

Local development
-----------------
1. Backend (Express + MySQL)
- Copy `.env.example` to `Backend/.env` and set DB env vars:
  - DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
- (Optional, for real OTP email) set SMTP vars in `Backend/.env`:
  - SMTP_HOST (e.g. smtp.gmail.com)
  - SMTP_PORT (587)
  - SMTP_USER (your Gmail/email)
  - SMTP_PASS (app-specific password)
  - SMTP_FROM (optional)
  - SMTP_SECURE (true/false)

2. Frontend (Vite + React)
- `frontend/.env` contains `VITE_BACKEND_URL=http://localhost:5001` by default.

Quick start
-----------
From project root:

# Install dependencies
cd Backend
npm install
cd ../frontend
npm install

# Start backend (nodemon will pick free port if 5001 in use)
cd ../Backend
npm run dev

# Start frontend (Vite auto-picks port if in use)
cd ../frontend
npm run dev

Open the app in a browser (Vite printed local URL, e.g. http://localhost:5175).

Notes
-----
- Routes: `/` is Map, `/login` and `/register` are available via the NavBar.
- OTP: To deliver OTPs via email you must configure SMTP env in the backend. Without SMTP, the server will still accept OTP requests but will not email them (in dev it may return OTP in response; the frontend now avoids showing OTP values in a popup).

Building for production
------------------------
- Frontend: `cd frontend && npm run build` (Vite builds to `dist/`)
- Backend: ensure environment variables are set and run `node index.js` or use a process manager (pm2/systemd).

Smoke test
----------
There's a Puppeteer smoke test at `scripts/ui-smoke.js`. To run it:

cd scripts
npm install puppeteer --save-dev
node ui-smoke.js

This will navigate to the frontend root and open `/login` and `/register`, printing console logs.

Final checklist
---------------
- [ ] Configure `Backend/.env` DB settings
- [ ] (Optional) Configure SMTP for OTP sending
- [ ] Start backend and frontend

If you want, I can prepare a single-script launcher, Dockerfiles, or GitHub Actions workflow next.
