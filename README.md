# Schedule for колледж связи пгути 

Reskin of https://lk.ks.psuti.ru/ since it lacks mobile support.

[![Screenshot](https://github.com/VityaSchel/kspguti-schedule/assets/59040542/07cc1f67-ccb0-4522-a59d-16387fa11987#gh-dark-mode-only)](https://kspsuti.ru#gh-dark-mode-only)

[![Screenshot](https://github.com/VityaSchel/kspguti-schedule/assets/59040542/7bd26798-5ec1-4033-a9ca-84ffa0c44f52#gh-light-mode-only)](https://kspsuti.ru#gh-light-mode-only)

[Visit website](https://kspsuti.ru)

## Tech stack & features

- React 19.2.0 with Next.js 16.0.3 (pages router)
- Tailwind CSS
- @shadcn/ui components (built with Radix UI)
- JSDOM for parsing scraped pages, rehydration strategy for cache
- TypeScript 5.6.0 with types for each package
- Telegram Bot API (via [node-telegram-bot-api]) for parsing failure notifications
- Custom [js parser for teachers' photos](https://gist.github.com/VityaSchel/28f1a360ee7798511765910b39c6086c)
- Accessability & tab navigation support
- Dark theme with automatic switching based on system settings

Tools used: pnpm, eslint, react-icons. Deployed with Netlify and supported by Cloudflare.

## Development

### Prerequisites

- Node.js 20+ (see `.nvmrc`)
- npm 10+ or pnpm

### Local development

```bash
# Install dependencies
npm install
# or
pnpm install

# Run development server
npm run dev
# or
pnpm dev
```

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
- `PROXY_URL` - URL for schedule parsing
- `PARSING_FAILURE_NOTIFICATIONS_TELEGRAM_BOTAPI_TOKEN` - Telegram bot token
- `PARSING_FAILURE_NOTIFICATIONS_TELEGRAM_CHAT_ID` - Telegram chat ID

### Production deployment

#### Netlify

The project includes `netlify.toml` for automatic deployment configuration.

#### Docker

The Dockerfile uses Next.js standalone output for optimized production builds. The image includes:
- Multi-stage build for smaller image size
- Non-root user for security
- Health checks
- Production optimizations

#### Other platforms

The project can be deployed to any platform supporting Node.js 20+:
- Vercel
- Railway
- DigitalOcean App Platform
- AWS App Runner
- Any Docker-compatible platform
