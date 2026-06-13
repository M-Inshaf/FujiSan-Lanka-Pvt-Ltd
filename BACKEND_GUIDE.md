# Backend Server Implementation Guide

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** PostgreSQL
- **Real-time:** Socket.io
- **Authentication:** JWT + OAuth2
- **API:** RESTful + GraphQL optional
- **Deployment:** Docker + Kubernetes

## Project Structure

```
fuji-san-backend/
├── src/
│   ├── config/
│   │   ├── database.ts
│   │   ├── jwt.ts
│   │   └── environment.ts
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── cutting.controller.ts
│   │   ├── finishing.controller.ts
│   │   ├── ledger.controller.ts
│   │   └── analytics.controller.ts
│   ├── models/
│   │   ├── Agent.ts
│   │   ├── Cutting.ts
│   │   ├── Finishing.ts
│   │   ├── Ledger.ts
│   │   └── AuditLog.ts
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── data.service.ts
│   │   ├── analytics.service.ts
│   │   ├── sync.service.ts
│   │   └── collaboration.service.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── error.middleware.ts
│   │   ├── validation.middleware.ts
│   │   └── rateLimit.middleware.ts
│   ├── websocket/
│   │   ├── events.ts
│   │   ├── handlers.ts
│   │   └── middleware.ts
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── data.routes.ts
│   │   ├── analytics.routes.ts
│   │   └── admin.routes.ts
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── errors.ts
│   │   └── validators.ts
│   └── app.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── migrations/
│   └── *.sql
├── .env.example
├── package.json
└── tsconfig.json
```

## Core Implementation

### 1. Database Setup

```sql
-- migrations/001_init.sql

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  full_name VARCHAR(255),
  role VARCHAR(50),
  auth_provider VARCHAR(50),
  auth_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE organizations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  owner_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE agents (
  id SERIAL PRIMARY KEY,
  org_id INTEGER REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cutting_entries (
  id SERIAL PRIMARY KEY,
  org_id INTEGER REFERENCES organizations(id),
  agent_id INTEGER REFERENCES agents(id),
  invoice_no VARCHAR(255) UNIQUE NOT NULL,
  date DATE NOT NULL,
  item_name VARCHAR(255),
  description TEXT,
  layers INTEGER,
  sizes INTEGER,
  expected_qty INTEGER,
  unit_rate DECIMAL(10, 2),
  projected_value DECIMAL(15, 2),
  status VARCHAR(50),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE finishing_receipts (
  id SERIAL PRIMARY KEY,
  org_id INTEGER REFERENCES organizations(id),
  cutting_id INTEGER REFERENCES cutting_entries(id),
  grade_a INTEGER,
  damaged_complete INTEGER,
  waste INTEGER,
  total_accepted INTEGER,
  shortage INTEGER,
  gross_bill DECIMAL(15, 2),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  org_id INTEGER REFERENCES organizations(id),
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(100),
  entity_type VARCHAR(100),
  entity_id INTEGER,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_org_id ON cutting_entries(org_id);
CREATE INDEX idx_agent_id ON cutting_entries(agent_id);
CREATE INDEX idx_audit_org ON audit_logs(org_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);
```

### 2. Express Server Setup

```typescript
// src/app.ts
import express, { Express } from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

class Application {
  private app: Express;
  private server: http.Server;
  private io: SocketIOServer;

  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: { origin: process.env.FRONTEND_URL }
    });
  }

  setupMiddleware() {
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    });
    this.app.use(limiter);
  }

  setupRoutes() {
    this.app.use('/api/auth', require('./routes/auth.routes'));
    this.app.use('/api/data', require('./routes/data.routes'));
    this.app.use('/api/analytics', require('./routes/analytics.routes'));
  }

  setupWebSocket() {
    this.io.on('connection', (socket) => {
      console.log(`User connected: ${socket.id}`);

      socket.on('user:join', (data) => {
        socket.join(`org:${data.orgId}`);
      });

      socket.on('data:update', (data) => {
        socket.to(`org:${data.orgId}`).emit('data:update', data);
      });

      socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
      });
    });
  }

  start(port: number) {
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();

    this.server.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  }
}

export default Application;
```

### 3. Authentication Service

```typescript
// src/services/auth.service.ts
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

class AuthService {
  async generateToken(userId: number, orgId: number) {
    return jwt.sign(
      { userId, orgId },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );
  }

  async hashPassword(password: string) {
    return bcrypt.hash(password, 10);
  }

  async comparePassword(password: string, hash: string) {
    return bcrypt.compare(password, hash);
  }

  async register(email: string, password: string, fullName: string) {
    const hashedPassword = await this.hashPassword(password);
    // Create user in database
    const user = await User.create({
      email,
      password_hash: hashedPassword,
      full_name: fullName
    });
    return this.generateToken(user.id, 0);
  }

  async login(email: string, password: string) {
    const user = await User.findOne({ email });
    if (!user) throw new Error('User not found');

    const isValid = await this.comparePassword(password, user.password_hash);
    if (!isValid) throw new Error('Invalid password');

    return this.generateToken(user.id, user.org_id);
  }
}

export default new AuthService();
```

### 4. Data Sync Service

```typescript
// src/services/sync.service.ts
class SyncService {
  async syncClientData(orgId: number, clientData: any) {
    const { cutting, finishing, ledger } = clientData;

    // Sync cutting entries
    for (const entry of cutting) {
      if (!entry.id) {
        // New entry
        await CuttingEntry.create({ ...entry, org_id: orgId });
      } else {
        // Update existing
        await CuttingEntry.update(entry, { where: { id: entry.id, org_id: orgId } });
      }
    }

    // Similar for finishing and ledger

    // Log sync event
    await AuditLog.create({
      org_id: orgId,
      action: 'SYNC_COMPLETED',
      entity_type: 'SYNC'
    });

    return { success: true, timestamp: new Date() };
  }

  async getChanges(orgId: number, lastSyncTime: Date) {
    const changes = {
      cutting: await CuttingEntry.findAll({
        where: {
          org_id: orgId,
          updated_at: { $gt: lastSyncTime }
        }
      }),
      finishing: await FinishingReceipt.findAll({
        where: {
          org_id: orgId,
          updated_at: { $gt: lastSyncTime }
        }
      }),
      ledger: await Ledger.findAll({
        where: {
          org_id: orgId,
          updated_at: { $gt: lastSyncTime }
        }
      })
    };
    return changes;
  }
}

export default new SyncService();
```

### 5. Analytics API

```typescript
// src/controllers/analytics.controller.ts
import { Request, Response } from 'express';

class AnalyticsController {
  async getKPIs(req: Request, res: Response) {
    const { orgId } = req.params;

    const kpis = await Analytics.calculateKPIs(orgId);
    res.json(kpis);
  }

  async getRevenueTrend(req: Request, res: Response) {
    const { orgId } = req.params;
    const { days = 30 } = req.query;

    const trend = await Analytics.getRevenueTrend(orgId, parseInt(days as string));
    res.json(trend);
  }

  async getAgentPerformance(req: Request, res: Response) {
    const { orgId } = req.params;

    const performance = await Analytics.getAgentPerformance(orgId);
    res.json(performance);
  }
}

export default new AnalyticsController();
```

## API Endpoints

### Authentication
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh-token
POST   /api/auth/logout
```

### Data Management
```
GET    /api/data/cutting
POST   /api/data/cutting
PUT    /api/data/cutting/:id
DELETE /api/data/cutting/:id

GET    /api/data/finishing
POST   /api/data/finishing
PUT    /api/data/finishing/:id
DELETE /api/data/finishing/:id

GET    /api/data/ledger
POST   /api/data/ledger
PUT    /api/data/ledger/:id
DELETE /api/data/ledger/:id
```

### Analytics
```
GET    /api/analytics/kpis
GET    /api/analytics/revenue-trend
GET    /api/analytics/agent-performance
GET    /api/analytics/payment-methods
GET    /api/analytics/monthly-performance
```

### Sync
```
POST   /api/sync/push
GET    /api/sync/pull?lastSync=<timestamp>
```

## Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: fuji
      POSTGRES_PASSWORD: secure_password
      POSTGRES_DB: fuji_san
    volumes:
      - postgres_data:/var/lib/postgresql/data

  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://fuji:secure_password@db:5432/fuji_san
      JWT_SECRET: your_secret_key
      NODE_ENV: production
    depends_on:
      - db

volumes:
  postgres_data:
```

## Testing

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Coverage
npm run test:coverage
```

## Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] SSL certificates configured
- [ ] Rate limiting configured
- [ ] CORS properly set
- [ ] Logging configured
- [ ] Monitoring set up
- [ ] Backups configured
- [ ] CI/CD pipeline set up
- [ ] Load balancer configured