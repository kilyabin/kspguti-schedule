# Schedule for College of Communication Volga State Goverment University of ICT (КС ПГУТИ)

Reskin of https://lk.ks.psuti.ru/ since it lacks mobile support.

[![Screenshot](https://github.com/VityaSchel/kspguti-schedule/assets/59040542/07cc1f67-ccb0-4522-a59d-16387fa11987#gh-dark-mode-only)](https://schedule.itlxrd.space/)

[![Screenshot](https://github.com/VityaSchel/kspguti-schedule/assets/59040542/7bd26798-5ec1-4033-a9ca-84ffa0c44f52#gh-light-mode-only)](https://schedule.itlxrd.space/)

[Visit website](https://kspsuti.ru)

## Tech stack & features

- React 19.2.0 with Next.js 16.0.3 (pages router)
- Tailwind CSS
- @shadcn/ui components (built with Radix UI)
- JSDOM for parsing scraped pages, rehydration strategy for cache
- TypeScript 5.9.3 with types for each package
- Telegram Bot API (via [node-telegram-bot-api]) for parsing failure notifications
- Custom [js parser for teachers' photos](https://gist.github.com/VityaSchel/28f1a360ee7798511765910b39c6086c)
- Accessibility & tab navigation support
- Dark theme with automatic switching based on system settings
- Admin panel for managing groups and settings

## Known issues

- Previous week cannot be accessed if you enter from main "/"

Workaround: Locate to next week, then enter previous twice.

## Project structure

```
kspguti-schedule/
├── src/                          # Source code
│   ├── app/                      # App router (Next.js 13+)
│   │   ├── agregator/           # Schedule fetching logic
│   │   ├── parser/              # HTML parsing for schedule
│   │   └── utils/               # App-level utilities
│   ├── pages/                    # Pages router (Next.js)
│   │   ├── api/                 # API routes
│   │   │   └── admin/          # Admin panel API endpoints
│   │   ├── [group].tsx         # Dynamic group schedule page
│   │   ├── admin.tsx           # Admin panel page
│   │   └── index.tsx           # Home page
│   ├── entities/                # Entities
│   ├── features/                # Feature modules
│   ├── shared/                 # Shared code
│   │   ├── constants/          # App constants
│   │   ├── context/            # React contexts
│   │   ├── data/               # Data loaders and JSON files
│   │   ├── model/              # Data models
│   │   ├── providers/          # React providers
│   │   ├── ui/                 # Shared UI components
│   │   └── utils/              # Utility functions
│   ├── shadcn/                 # shadcn/ui components
│   └── widgets/                # Complex UI widgets
├── public/                      # Static assets
│   └── teachers/               # Teacher photos
├── old/                         # Deprecated files (see old/README.md)
├── scripts/                     # Deployment scripts
├── systemd/                    # Systemd service file
├── components.json             # shadcn/ui config
├── docker-compose.yml          # Docker Compose config
├── Dockerfile                  # Docker image definition
├── next.config.js              # Next.js configuration
├── tailwind.config.js          # Tailwind CSS config
└── tsconfig.json               # TypeScript config
```

## Development

### Prerequisites

- Node.js 20+ (see `.nvmrc`)
- npm 10+ or pnpm

### Local development

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

### Admin Panel

The application includes an admin panel for managing groups and application settings. Access it at `/admin` route.

**Features:**
- Manage groups (add, edit, delete)
- Configure application settings (e.g., week navigation)
- Password-protected access with session management

**Environment variables for admin panel:**
- `ADMIN_PASSWORD` - Password for admin panel access (required)
- `ADMIN_SESSION_SECRET` - Secret key for session tokens (optional, defaults to 'change-me-in-production')

⚠️ **Important:** Always set a strong `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` in production!

### Docker deployment

#### Build and run with Docker

```bash
# Build the image
docker build -t kspguti-schedule .

# Run the container
docker run -p 3000:3000 kspguti-schedule
```

#### Using Docker Compose

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

**Environment variables:** Edit `docker-compose.yml` to add your environment variables:
- `PROXY_URL` - URL for schedule parsing (optional)
- `PARSING_FAILURE_NOTIFICATIONS_TELEGRAM_BOTAPI_TOKEN` - Telegram bot token (optional)
- `PARSING_FAILURE_NOTIFICATIONS_TELEGRAM_CHAT_ID` - Telegram chat ID (optional)
- `ADMIN_PASSWORD` - Password for admin panel access (required for admin features)
- `ADMIN_SESSION_SECRET` - Secret key for session tokens (optional, but recommended in production)
- `NEXT_PUBLIC_SITE_URL` - Site URL for canonical links and sitemap (optional)

### Production deployment

#### Netlify

The project includes `netlify.toml` for automatic deployment configuration.

#### Docker

The Dockerfile uses Next.js standalone output for optimized production builds. The image includes:
- Multi-stage build for smaller image size
- Non-root user for security
- Health checks
- Production optimizations

#### System installation (Linux systemd)

Install the application directly on a Linux system as a systemd service:

**Prerequisites:**
- Linux system with systemd
- Node.js 20+ installed
- Root/sudo access
- ICU library (for Node.js):
  - Arch Linux: `sudo pacman -S icu`
  - Ubuntu/Debian: `sudo apt-get install libicu-dev`
  - Fedora/RHEL/CentOS: `sudo dnf install libicu` or `sudo yum install libicu`

**Installation:**

```bash
# Clone the repository
git clone <repository-url>
cd kspguti-schedule
# Copy example and edit .env
cp .env.production.example .env
nano .env
# Run the installation script
sudo ./scripts/install.sh
```

The installation script will:
- Check Node.js and npm versions
- Copy files to `/opt/kspguti-schedule`
- Install dependencies
- Build the production version
- Install and enable systemd service

**Configuration:**

1. Edit environment variables:
```bash
sudo nano /opt/kspguti-schedule/.env
```

The installation script will:
- Copy `.env` file from source directory if it exists
- Preserve existing `.env` in installation directory if it already exists
- Create `.env` from `.env.production.example` if no `.env` file is found

2. Update systemd service if needed:
```bash
sudo nano /etc/systemd/system/kspguti-schedule.service
```

**Managing the service:**

Use the management script for easy service control:

```bash
# Start the service
sudo ./scripts/manage.sh start

# Stop the service
sudo ./scripts/manage.sh stop

# Restart the service
sudo ./scripts/manage.sh restart

# Check status
./scripts/manage.sh status

# View logs
./scripts/manage.sh logs
./scripts/manage.sh logs -f  # Follow logs

# Update application
sudo ./scripts/manage.sh update

# Enable/disable autostart
sudo ./scripts/manage.sh enable
sudo ./scripts/manage.sh disable
```

**Service configuration:**

- Installation directory: `/opt/kspguti-schedule`
- Service user: `www-data`
- Port: `3000` (configurable via environment variables)
- Logs: `journalctl -u kspguti-schedule`

**Environment variables:**

See `.env.production.example` for available options. The application uses `.env` file in production:

**Schedule parsing:**
- `PROXY_URL` - URL for schedule parsing (optional, defaults to https://lk.ks.psuti.ru)
- `PARSING_FAILURE_NOTIFICATIONS_TELEGRAM_BOTAPI_TOKEN` - Telegram bot token for parsing failure notifications (optional)
- `PARSING_FAILURE_NOTIFICATIONS_TELEGRAM_CHAT_ID` - Telegram chat ID for receiving notifications (optional)

**Admin panel:**
- `ADMIN_PASSWORD` - Password for admin panel access (required for admin features)
- `ADMIN_SESSION_SECRET` - Secret key for session tokens (optional, defaults to 'change-me-in-production', but should be changed in production)

**Site configuration:**
- `NEXT_PUBLIC_SITE_URL` - Site URL for canonical links and sitemap (optional, defaults to https://schedule.itlxrd.space)

#### Other platforms

The project can be deployed to any platform supporting Node.js 20+:
- Vercel
- Railway
- DigitalOcean App Platform
- AWS App Runner
- Any Docker-compatible platform
