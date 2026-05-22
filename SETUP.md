# Zika Booking Setup Guide

Welcome to the **Zika Booking** repository! This monorepo is built using a modern, scalable architecture featuring multiple microservices, Next.js web portals, and an Expo-based cross-platform mobile application.

This guide will walk you or your friends through setting up the repository from scratch.

---

## 🏗️ Architecture Overview

The repository is structured as a **PNPM Workspace** managed by **Turborepo** for extremely fast builds and parallel task orchestration:

```
Zika-Booking/
├── apps/
│   ├── admin/       # Admin Control Panel (Next.js)
│   ├── mobile/      # Cross-platform Mobile App (Expo / React Native)
│   └── web/         # Guest Booking Portal (Next.js)
├── services/
│   ├── auth-service/     # Authentication & Session Management (Fastify)
│   ├── listing-service/  # Hotels, Apartments, Rentals, Bookings & iCal (Fastify)
│   └── payment-service/  # Payments integration, Stripe & Webhooks (Fastify)
├── packages/
│   ├── database/    # Shared Prisma DB configuration
│   └── tsconfig/    # Shared TypeScript configurations
└── package.json     # Global workspaces config
```

---

## ⚡ Quick Start

Follow these steps to get the entire stack running locally on your machine.

### 1. Prerequisites
Ensure you have the following installed:
* **Node.js** (v18+ recommended)
* **PNPM** (`npm i -g pnpm`)
* **PostgreSQL** & **Redis** (running locally or via Docker)

---

### 2. Database & Redis Setup
All services connect to the same PostgreSQL instance, but utilize **separate database schemas** (e.g., `auth`, `listings`, `payments`) to keep their tables isolated and maintain modular boundaries.

1. Create a PostgreSQL database called `zika_booking` (or whatever name you prefer).
2. Ensure your local Redis server is running on the default port `6379`.

---

### 3. Environment Variables
To make setup a breeze, we have provided `.env.example` files at both the root level and within individual service/app directories.

1. **Root Configuration**:
   Copy `.env.example` at the root of the project to a new file named `.env`:
   ```bash
   cp .env.example .env
   ```
   * Update the `DATABASE_URL` with your local PostgreSQL credentials.
   * Make sure to specify the base port/credentials correctly.

2. **Service/App Customizations** (Optional):
   For convenience, Turbo passes global env variables down to services. However, if you want specific overrides, copy the `.env.example` to `.env` in the following folders and update them:
   * `services/auth-service/`
   * `services/listing-service/`
   * `services/payment-service/`
   * `apps/mobile/`

---

### 4. Installation
Install all dependencies using PNPM from the root of the project:
```bash
pnpm install
```

---

### 5. Database Migrations
Generate Prisma clients and push the schema to your local database:
```bash
pnpm --filter "*" prisma db push
```
*(This command runs `prisma db push` across all microservices, creating the necessary database schemas and tables automatically)*.

If you have sample data to seed, run:
```bash
psql -U your_postgres_user -d zika_booking -f seed.sql
```

---

### 6. Run the Development Servers
Launch all services and web apps in parallel using:
```bash
pnpm turbo dev
```
This runs:
* **Auth Service** on `http://localhost:3001`
* **Listing Service** on `http://localhost:3003`
* **Payment Service** on `http://localhost:3004`
* **Web Portal** on `http://localhost:3000`
* **Admin Portal** on `http://localhost:3002`
* **Mobile Expo Server** on `http://localhost:8081`

---

## 📱 Running the Mobile App (Expo)

The Zika Booking mobile app is designed with a **zero-configuration local setup**. 

### 📡 Automatic Host Detection
Unlike traditional mobile setups where you have to hardcode your local development IP address in `.env` (which breaks every time your router changes your IP or a friend clones the repo), our app features **automatic host detection**:
* It dynamically reads Expo's development server host Uri (`Constants.expoConfig?.hostUri`).
* If you scan the Expo QR code with your physical iOS or Android phone, the app automatically detects the host computer's IP address and routes all Auth, Listing, and Payment API requests to your local servers over Wi-Fi!
* **No `.env` IP changes required!** Just leave `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_LISTING_API_URL`, and `EXPO_PUBLIC_PAYMENT_API_URL` empty in development.

### 🔓 CORS Pre-configured for React Native
React Native does not send the standard browser `Origin` headers. In local development (`NODE_ENV !== "production"`), the microservices are pre-configured to automatically bypass strict CORS origins, enabling seamless communication between your physical phone/simulator and the local Fastify backend APIs.

### 🚀 To Run on Simulator or Phone:
1. Navigate to the mobile app folder:
   ```bash
   cd apps/mobile
   ```
2. Start the Expo server:
   ```bash
   pnpm expo start
   ```
3. Press `a` for Android Emulator, `i` for iOS Simulator, or scan the QR code with the **Expo Go** app on your physical phone (make sure your phone and computer are on the same Wi-Fi network).

---

## 🛠️ Troubleshooting

#### 1. Prisma Client Compilation Issues
If you encounter errors like `PrismaClient is not a constructor`, run the prisma generate command explicitly:
```bash
pnpm --filter "*" prisma generate
```

#### 2. Redis Connection Refused
Ensure your Redis service is started.
* **macOS**: `brew services start redis`
* **Windows**: Start the Redis service from Windows Services or run `redis-server`
* **Docker**: `docker run -d -p 6379:6379 redis`

#### 3. Network Request Failed on Mobile Phone
If your physical phone shows "Network request failed" or can't connect:
* Make sure both your computer and phone are connected to the **exact same Wi-Fi network**.
* Check that your computer's firewall is not blocking incoming connections on ports `3001`, `3003`, and `3004`.
* Ensure that the Fastify services are listening on `0.0.0.0` (which they are by default in our configs) so they accept connections from external devices on the network.
