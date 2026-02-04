# ProjectRIMS Frontend

SvelteKit-based frontend for the **R**eal-time **I**nventory **M**anagement **S**ystem (RIMS).

## Tech Stack

- **Framework**: SvelteKit with Svelte 5 (Runes)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **UI Components**: shadcn-svelte
- **Build Tool**: Vite 7
- **Icons**: Tabler Icons, Lucide Svelte

## Project Structure

```
frontend/
├── src/
│   ├── lib/
│   │   ├── api/           # API client and services
│   │   │   ├── cache.ts   # Request caching & deduplication
│   │   │   ├── client.ts  # HTTP client with retry logic
│   │   │   ├── parts.ts   # Parts API
│   │   │   ├── receivings.ts
│   │   │   ├── outgoings.ts
│   │   │   ├── requests.ts
│   │   │   ├── users.ts
│   │   │   ├── movements.ts
│   │   │   ├── dashboard.ts
│   │   │   └── types.ts   # TypeScript interfaces
│   │   ├── components/    # Reusable UI components
│   │   │   └── ui/        # shadcn-svelte components
│   │   ├── stores/        # Svelte stores (auth, etc.)
│   │   ├── services/      # SSE, voice services
│   │   ├── hooks/         # Custom Svelte hooks
│   │   └── utils.ts       # Utility functions
│   ├── routes/
│   │   ├── +page.svelte   # Root redirect
│   │   ├── login/         # Authentication
│   │   └── dashboard/     # Main application
│   │       ├── parts/
│   │       ├── receivings/
│   │       ├── outgoings/
│   │       ├── requests/
│   │       ├── movements/
│   │       └── users/
│   └── app.html
├── static/
├── package.json
├── svelte.config.js
├── vite.config.ts
└── tsconfig.json
```

## Development

### Prerequisites

- Bun 1.0+
- Backend API running on `http://localhost:8000`

### Install Dependencies

```bash
bun install
```

### Start Development Server

```bash
bun dev
```

The app runs on `http://localhost:3000`

### Build for Production

```bash
bun run build
bun run preview  # Preview production build
```

### Type Checking

```bash
bun run check        # One-time check
bun run check:watch  # Watch mode
```

### Linting & Formatting

```bash
bun run lint    # Check formatting and lint
bun run format  # Auto-format with Prettier
```

## Environment Variables

Create a `.env` file in the frontend directory:

```env
VITE_API_BASE_URL=http://localhost:8000
```

## API Integration

### API Client Features

The API client ([src/lib/api/client.ts](src/lib/api/client.ts)) includes:

- **Automatic retry** with exponential backoff (2 retries by default)
- **Request deduplication** - Prevents duplicate GET requests
- **Rate limit handling** - Auto-retry on 429 with `Retry-After`
- **Request cancellation** via `AbortController`

### Response Caching

The cache system ([src/lib/api/cache.ts](src/lib/api/cache.ts)) provides:

- **In-memory cache** with configurable TTL (default 30s)
- **Cache-first strategy** via `getOrFetch()`
- **Wildcard invalidation** - `invalidate('parts:*')`
- **Automatic invalidation** on mutations

### Usage Example

```typescript
import { getParts, createPart } from '$lib/api/parts';
import type { PartCreate } from '$lib/api/types';

// Fetch with pagination
const response = await getParts({ page: 1, limit: 20 });
console.log(response.items); // PartResponse[]
console.log(response.total); // Total count

// Create with automatic cache invalidation
const newPart: PartCreate = {
	part_number: 'P001',
	part_name: 'Widget',
	min_stock: 10
};
await createPart(newPart);
```

## Authentication

Authentication uses JWT tokens stored in `localStorage`:

```typescript
import { auth } from '$lib/stores/auth.svelte';

// Login
await auth.login({ email: 'user@example.com', password: 'password' });

// Check authentication
if (auth.isAuthenticated) {
	console.log(auth.user);
}

// Check permissions
if (auth.hasPermission('parts.create')) {
	// Show create button
}

// Logout
auth.logout();
```

### Token Expiry & Auto-Relogin

If the JWT token expires (e.g. backend returns 401 Unauthorized), the frontend will:

- Automatically log out the user.
- Redirect to the login page (`/login`).
- Optionally display a notification: "Session expired, please log in again."

This is handled by the API client and the `auth` store. No manual refresh is required.

## Key Features

### Dashboard

- Real-time stats cards (parts, receivings, outgoings, requests)
- Movement chart (last 30 days)
- Low stock alerts
- Recent activity feed

### Parts Management

- CRUD operations with search and filters
- Stock status tracking (in_stock, low_stock, out_of_stock)
- Excel import functionality
- Movement history per part

### Receivings & Outgoings

- Document-based transactions
- Draft → Complete → Confirm GR/GI workflow
- Automatic stock adjustments
- Line item management

### Requests

- Material request creation
- Supply tracking per item
- Urgent item flagging

### Real-time Updates

- Server-Sent Events (SSE) for live updates
- Connection status indicator
- Auto-reconnect with backoff

## Utility Functions

```typescript
import { debounce, throttle, formatDateTime, formatDate } from '$lib/utils';

// Debounce search input (300ms default)
const debouncedSearch = debounce((query: string) => {
	searchParts(query);
}, 300);

// Throttle scroll handler
const throttledScroll = throttle(() => {
	updateScrollPosition();
}, 100);

// Format dates (Asia/Jakarta timezone)
formatDateTime('2026-02-03T10:30:00Z'); // "3 Feb 2026, 17:30"
formatDate('2026-02-03T10:30:00Z'); // "3 Feb 2026"
```

## Folder Conventions

| Folder                   | Purpose                            |
| ------------------------ | ---------------------------------- |
| `src/lib/api/`           | API services and types             |
| `src/lib/components/`    | Reusable components                |
| `src/lib/components/ui/` | shadcn-svelte primitives           |
| `src/lib/stores/`        | Global state (Svelte 5 runes)      |
| `src/lib/services/`      | External integrations (SSE, voice) |
| `src/routes/`            | SvelteKit pages and layouts        |

## Deployment (Linux VPS with Caddy)

### 1. Install SvelteKit Node Adapter

First, switch from `adapter-auto` to `adapter-node` for VPS deployment:

```bash
bun add -d @sveltejs/adapter-node
```

Update `svelte.config.js`:

```javascript
import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			out: 'build',
			precompress: true, // Enable gzip/brotli precompression
			envPrefix: 'RIMS_'
		})
	}
};

export default config;
```

### 2. Build for Production

```bash
# Set environment variables
export VITE_API_BASE_URL=https://api.rims.r-dev.asia

# Build
bun run build
```

This creates a `build/` directory with your production app.

### 3. Transfer to VPS

```bash
# From your local machine
rsync -avz --exclude 'node_modules' ./ user@your-vps:/var/www/rims-frontend/

# Or just the build output
rsync -avz build/ package.json user@your-vps:/var/www/rims-frontend/
```

### 4. Server Setup

SSH into your VPS and set up the application:

```bash
# Install Bun (if not installed)
curl -fsSL https://bun.sh/install | bash

# Navigate to app directory
cd /var/www/rims-frontend

# Install production dependencies only
bun install --production

# Test the app runs
RIMS_API_BASE_URL=https://api.rims.r-dev.asia \
PORT=3000 \
node build/index.js
```

### 5. Create Systemd Service

Create `/etc/systemd/system/rims-frontend.service`:

```ini
[Unit]
Description=RIMS Frontend (SvelteKit)
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/rims-frontend
ExecStart=/usr/bin/node /var/www/rims-frontend/build/index.js
Restart=on-failure
RestartSec=10

# Environment
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=ORIGIN=https://rims.r-dev.asia
Environment=RIMS_API_BASE_URL=https://api.rims.r-dev.asia

# Security
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable rims-frontend
sudo systemctl start rims-frontend
sudo systemctl status rims-frontend
```

### 6. Configure Caddy

Add to your Caddyfile (`/etc/caddy/Caddyfile`):

```caddyfile
rims.r-dev.asia {
    # Enable compression
    encode gzip zstd

    # Reverse proxy to SvelteKit
    reverse_proxy localhost:3000 {
        # Health check
        health_uri /
        health_interval 30s

        # Headers
        header_up Host {host}
        header_up X-Real-IP {remote}
        header_up X-Forwarded-For {remote}
        header_up X-Forwarded-Proto {scheme}
    }

    # Security headers
    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        X-XSS-Protection "1; mode=block"
        Referrer-Policy strict-origin-when-cross-origin
        -Server
    }

    # Logs
    log {
        output file /var/log/caddy/rims-frontend.log
        format json
    }
}
```

Reload Caddy:

```bash
sudo systemctl reload caddy
```

### 7. Verify Deployment

```bash
# Check service status
sudo systemctl status rims-frontend

# Check logs
sudo journalctl -u rims-frontend -f

# Test endpoint
curl -I https://rims.yourdomain.com
```

### Alternative: PM2 Process Manager

If you prefer PM2 over systemd:

```bash
# Install PM2
bun add -g pm2

# Create ecosystem file
cat > ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [{
    name: 'rims-frontend',
    script: 'build/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      ORIGIN: 'https://rims.r-dev.asia',
      RIMS_API_BASE_URL: 'https://api.rims.r-dev.asia'
    }
  }]
};
EOF

# Start with PM2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup  # Auto-start on boot
```

### Environment Variables Reference

| Variable            | Description                    | Example                       |
| ------------------- | ------------------------------ | ----------------------------- |
| `PORT`              | Server port                    | `3000`                        |
| `ORIGIN`            | Public URL (required for CSRF) | `https://rims.r-dev.asia`     |
| `RIMS_API_BASE_URL` | Backend API URL                | `https://api.rims.r-dev.asia` |
| `NODE_ENV`          | Environment mode               | `production`                  |

### Troubleshooting

**502 Bad Gateway**

```bash
# Check if app is running
sudo systemctl status rims-frontend
curl localhost:3000
```

**CORS Issues**

- Ensure `ORIGIN` environment variable matches your domain
- Check backend CORS configuration allows frontend domain

**Static Assets Not Loading**

- Verify Caddy reverse proxy is forwarding all paths
- Check `_app/` directory exists in build output

**SSE Connection Issues**

- Disable response buffering in Caddy if needed:

```caddyfile
reverse_proxy localhost:3000 {
    flush_interval -1  # Disable buffering for SSE
}
```

## License

Proprietary - All rights reserved
