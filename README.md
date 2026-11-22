# Campus Hall Booking System (MVP)

A React + Express + MySQL prototype for campus hall reservations.

## Features
- CR registration and login (JWT)
- Hall availability lookup by date and time
- Instant booking when a hall is free
- Automatic waitlist entry when a requested slot is occupied
- CR booking history and cancellation
- Admin-only hall blocking and all-booking view
- Overlap checking: `existing_start < requested_end AND existing_end > requested_start`
- Hall row locking inside a transaction to reduce simultaneous double-booking races

## 1. Database setup
1. Start MySQL (XAMPP is fine).
2. Open phpMyAdmin or MySQL Workbench.
3. Import `server/schema.sql`.
4. Confirm the database name is `campus_hall`.

## 2. Start backend
```bash
cd server
npm install
```
Copy `.env.example` to `.env`, then update MySQL credentials and set a long random `JWT_SECRET`.

```bash
npm run dev
```
API runs at `http://localhost:5000`.

## 3. Start frontend
Open a second terminal:
```bash
cd client
npm install
npm run dev
```
Open the Vite URL (normally `http://localhost:5173`).

If your Vite port changes, update `CLIENT_URL` in `server/.env` to match it.

## 4. Create a Hall In-charge account
Register a normal account in the app first. Then run this SQL in phpMyAdmin, replacing the email:
```sql
UPDATE users SET role='admin' WHERE email='halladmin@college.edu';
```
Log out and log back in to load the admin role.

## 5. Important prototype notes
- The app is a development MVP. Use test data until the college authorizes a pilot.
- Waiting-list requests are recorded in first-in order, but this MVP does not automatically promote a waiting user after cancellation. The Hall In-charge should review the queue and coordinate the released slot. A production version should add a timed offer/accept workflow.
- Add college email verification, rate limiting, audit logs, stronger validation, and HTTPS before real deployment.
- The first hall list is seeded by `schema.sql`; edit those sample names/capacities to match your campus.
- Admin creation is intentionally not public. Promote the authorized Hall In-charge account using SQL.
