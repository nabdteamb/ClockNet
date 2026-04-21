# ClockNet

Simple network-based attendance MVP with no authentication.

## Stack

- Next.js
- Prisma
- PostgreSQL

## Setup

1. Copy `.env.example` to `.env`
2. Set `DATABASE_URL`, `COMPANY_IP_RANGES`, `COMPANY_FIXED_IPS`, and `DEVICE_HASH_SALT`
3. Run `npm install`
4. Start PostgreSQL with `npm run db:up`
5. Run `npx prisma generate`
6. Run `npx prisma migrate dev --name init`
7. Run `npm run dev`

## Local database

- Default local Postgres is provided in `docker-compose.yml`
- Connection: `postgresql://postgres:postgres@localhost:55432/clocknet`
- Stop it with `npm run db:down`
- Inspect logs with `npm run db:logs`

## API

- `POST /api/attendance/check-in`
- `POST /api/attendance/check-out`
- `POST /api/attendance/status`
