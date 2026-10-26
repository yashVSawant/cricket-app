# Cricket Tournament Platform - Backend API

Production-grade NestJS REST API and Socket.IO real-time server for managing cricket tournaments, ball-by-ball live scoring, teams, and player statistics.

---

## 🛠️ Tech Stack
- **Framework**: NestJS (TypeScript)
- **Database ORM**: Prisma ORM with PostgreSQL
- **Caching & Broker**: Redis (ioredis)
- **Background Jobs**: BullMQ
- **Realtime Gateway**: Socket.IO with Redis Adapter
- **Authentication**: JWT Access Token (15 min) + Refresh Token (httpOnly Cookie, Redis stored)
- **Documentation**: Swagger OpenAPI at `/docs`
- **Health Check**: `/health`

---

## 📋 Environment Variables (`.env`)

| Variable | Description | Default |
|---|---|---|
| `PORT` | API Port | `4000` |
| `NODE_ENV` | Environment (`development` / `production`) | `development` |
| `DATABASE_URL` | PostgreSQL connection URL | `postgresql://postgres:postgres@localhost:5432/cricket_db?schema=public` |
| `REDIS_HOST` | Redis hostname | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD`| Redis password | (optional) |
| `REDIS_DB` | Redis database index | `0` |
| `JWT_ACCESS_SECRET` | Secret key for access token signing | `...` |
| `JWT_ACCESS_EXPIRES_IN` | Access token lifetime | `15m` |
| `JWT_REFRESH_SECRET` | Secret key for refresh token signing | `...` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifetime | `7d` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed frontend origins | `http://localhost:3000,http://127.0.0.1:3000` |
| `COOKIE_SECURE` | Set `true` in production with HTTPS | `false` |
| `COOKIE_SAME_SITE` | Cookie SameSite policy (`lax`, `none`, `strict`) | `lax` |

---

## 🚀 Local Development Setup

### 1. Prerequisites
- Node.js >= 20
- PostgreSQL >= 15
- Redis >= 7

### 2. Install Dependencies & Generate Prisma Client
```bash
npm install
npx prisma generate
```

### 3. Database Migration
```bash
npx prisma migrate dev --name init
```

### 4. Run the API
```bash
# Development with hot reloading
npm run start:dev

# Production build & start
npm run build
npm run start:prod
```

### 5. Access Endpoints
- Swagger API Docs: `http://localhost:4000/docs`
- Health Check: `http://localhost:4000/health`
- Base API URL: `http://localhost:4000/api/v1`

---

## 🐳 Docker & Separate Server Deployment

### Production Docker Compose (Backend Server)
Deploy PostgreSQL, Redis, and NestJS API together:
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### Reverse Proxy & TLS Setup
See sample configurations in `backend/deploy/`:
- `backend/deploy/Caddyfile`: Automatic TLS with Let's Encrypt and WebSocket proxying.
- `backend/deploy/nginx.conf`: High-performance Nginx reverse proxy with SSL termination.
