# LatticeApp Backend

<div align="center">

![LatticeApp](https://img.shields.io/badge/LatticeApp-Backend-7DD3FC?style=for-the-badge)

**Backend server for LatticeApp - Minecraft Server Management Panel**

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Fastify](https://img.shields.io/badge/Fastify-4-000000?style=flat-square)](https://fastify.dev/)

</div>

---

## Features

- **Multi-Instance Support** - Manage multiple Minecraft servers
- **All Server Types** - Vanilla, Paper, Spigot, Forge, Fabric
- **Real-time Logs** - WebSocket powered console streaming
- **Plugin Management** - Modrinth & Hangar integration
- **AI Assistant** - OpenAI, Claude, Ollama support
- **User Authentication** - JWT with role-based permissions
- **Auto Backups** - Scheduled backup system
- **File Management** - Full file browser & editor

## Quick Start

### Using Docker (Recommended)

```bash
# Pull image
docker pull ghcr.io/[owner]/latticeapp-backend:latest

# Run
docker run -d \
  --name lattice-backend \
  -p 3000:3000 \
  -v lattice-data:/app/data \
  -v lattice-servers:/app/servers \
  -e JWT_SECRET=your-secret-key \
  ghcr.io/[owner]/latticeapp-backend:latest
```

### Using Docker Compose

```yaml
version: '3.8'
services:
  lattice-backend:
    image: ghcr.io/[owner]/latticeapp-backend:latest
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - ./servers:/app/servers
      - ./backups:/app/backups
    environment:
      - JWT_SECRET=your-super-secret-key
      - PORT=3000
    restart: unless-stopped
```

### Manual Installation

```bash
# Clone
git clone https://github.com/[owner]/latticeapp-backend.git
cd latticeapp-backend

# Install
npm install

# Build
npm run build

# Run
JWT_SECRET=your-secret-key npm run start
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `HOST` | Bind address | `0.0.0.0` |
| `JWT_SECRET` | JWT signing key (required) | - |
| `LOG_LEVEL` | Logging level | `info` |

### First Run

1. Start the backend server
2. Register first user via API (becomes admin automatically)
3. Connect with [LatticeApp Frontend](https://github.com/[owner]/latticeapp-frontend)

```bash
# Create first admin user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","email":"admin@example.com","password":"your-password"}'
```

## API Reference

### Authentication

```
POST /api/auth/register   # Register new user
POST /api/auth/login      # Login
POST /api/auth/refresh    # Refresh token
GET  /api/auth/me         # Current user info
```

### Servers

```
GET    /api/servers              # List servers
POST   /api/servers              # Create server
GET    /api/servers/:id          # Server details
DELETE /api/servers/:id          # Delete server
POST   /api/servers/:id/start    # Start server
POST   /api/servers/:id/stop     # Stop server
POST   /api/servers/:id/restart  # Restart server
POST   /api/servers/:id/command  # Send command
```

### Files

```
GET    /api/servers/:id/files           # List files
GET    /api/servers/:id/files/:path     # Read file
PUT    /api/servers/:id/files/:path     # Write file
DELETE /api/servers/:id/files/:path     # Delete file
```

### Plugins & Mods

```
GET  /api/servers/:id/plugins                    # List plugins
POST /api/servers/:id/market/modrinth/search     # Search Modrinth
POST /api/servers/:id/market/hangar/search       # Search Hangar
POST /api/servers/:id/market/download            # Download from market
```

### AI

```
GET  /api/ai/providers          # List AI providers
POST /api/ai/configure          # Configure provider
POST /api/ai/chat               # Chat with AI
POST /api/ai/generate/plugin    # Generate plugin code
POST /api/ai/generate/mod       # Generate mod code
```

### WebSocket

```
ws://localhost:3000/ws

# Client -> Server
{ "type": "subscribe", "serverId": "..." }
{ "type": "command", "serverId": "...", "command": "say hello" }

# Server -> Client
{ "type": "log", "serverId": "...", "data": "..." }
{ "type": "status", "serverId": "...", "status": "running" }
```

## User Roles

| Role | Permissions |
|------|-------------|
| `admin` | All permissions + user management |
| `operator` | Server management + AI features |
| `moderator` | Console commands + view logs |
| `viewer` | View only |

## Project Structure

```
src/
├── index.ts              # Entry point
├── app.ts                # Fastify app setup
├── routes/
│   ├── auth.ts           # Authentication
│   ├── servers.ts        # Server management
│   ├── files.ts          # File operations
│   ├── plugins.ts        # Plugin management
│   ├── ai.ts             # AI integration
│   ├── monitor.ts        # Performance monitoring
│   └── backup.ts         # Backup system
├── services/
│   ├── auth.ts           # Auth service
│   ├── mc-server/        # MC server management
│   ├── market/           # Modrinth & Hangar
│   ├── ai/               # AI providers
│   └── ...
├── middleware/
│   ├── auth.ts           # JWT middleware
│   └── rbac.ts           # Role-based access
├── websocket/
│   └── handler.ts        # WebSocket handler
└── models/
    └── user.ts           # User model
```

## Development

```bash
# Development mode with hot reload
npm run dev

# Type check
npx tsc --noEmit

# Build
npm run build
```

## Related

- [LatticeApp Frontend](https://github.com/[owner]/latticeapp-frontend) - Avalonia desktop client

## License

[MIT](LICENSE)

---

<div align="center">

Made with ❤️ by LatticeApp Team

</div>
