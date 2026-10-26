#!/bin/sh
set -e

echo "Deploying Prisma migrations..."
npx prisma migrate deploy

echo "Starting NestJS Production Server..."
exec node dist/main.js
