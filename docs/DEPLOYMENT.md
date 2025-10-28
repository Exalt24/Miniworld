# MiniWorld Deployment Guide

Production deployment guide for MiniWorld blockchain gaming platform.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Deployment Options](#deployment-options)
- [Docker Deployment](#docker-deployment)
- [Manual Deployment](#manual-deployment)
- [Production Configuration](#production-configuration)
- [Security Hardening](#security-hardening)
- [Monitoring Setup](#monitoring-setup)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

**Minimum**:
- 2 CPU cores
- 4GB RAM
- 20GB SSD storage
- Ubuntu 22.04+ or Windows Server 2022+

**Recommended**:
- 4 CPU cores
- 8GB RAM
- 50GB SSD storage
- Ubuntu 22.04 LTS

### Software Requirements

- **Docker**: 20.10+ & Docker Compose 2.0+
- **Node.js**: 22.12+ (if manual deployment)
- **PostgreSQL**: 18.0+ (if manual deployment)
- **Nginx**: Latest stable (reverse proxy)
- **SSL Certificate**: Let's Encrypt or commercial

---

## Deployment Options

### Option 1: Docker Deployment (Recommended)

**Pros**:
- Complete isolation
- Easy rollback
- Consistent environments
- One-command deployment

**Cons**:
- Requires Docker knowledge
- Slight resource overhead

**Use for**: Production, staging, quick deployments

---

### Option 2: Manual Deployment

**Pros**:
- Fine-grained control
- No containerization overhead
- Direct system access

**Cons**:
- More configuration
- Harder to replicate
- Manual updates

**Use for**: Custom setups, specific requirements

---

## Docker Deployment

### Step 1: Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose-plugin

# Verify installation
docker version
docker compose version
```

### Step 2: Clone & Configure

```bash
# Clone repository
git clone <repository-url>
cd miniworld

# Copy environment templates
cp docker/.env.docker .env
cp backend/.env.example backend/.env
cp game-client/.env.example game-client/.env
cp creator-dashboard/.env.example creator-dashboard/.env

# Edit .env files with production values
nano .env
```

**Required `.env` values**:
```bash
# Contract address (deploy first, then update)
CONTRACT_ADDRESS=

# Database password (generate strong password)
DB_PASSWORD=your_secure_password_here

# CORS origin (your domain)
CORS_ORIGIN=https://yourdomain.com

# API URLs (your domain)
VITE_API_URL=https://yourdomain.com/api
VITE_WS_URL=wss://yourdomain.com
```

### Step 3: Deploy Smart Contract

```bash
# Start blockchain node
docker-compose up -d contracts

# Wait for node to be ready
sleep 10

# Deploy contract
docker-compose exec contracts npx hardhat ignition deploy ignition/modules/MiniWorld.ts --network localhost

# Get contract address
docker-compose exec contracts cat ignition/deployments/chain-31337/deployed_addresses.json

# Copy address to .env files
# Update CONTRACT_ADDRESS in:
# - .env
# - backend/.env
# - game-client/.env
# - creator-dashboard/.env
```

### Step 4: Build & Start Services

```bash
# Build all services
docker-compose build

# Start database
docker-compose up -d postgres

# Wait for database
sleep 10

# Start backend (runs migrations automatically)
docker-compose up -d backend

# Wait for backend
sleep 10

# Start frontends
docker-compose up -d game-client creator-dashboard

# Verify all services running
docker-compose ps
```

### Step 5: Configure Nginx Reverse Proxy

Create `/etc/nginx/sites-available/miniworld`:

```nginx
# Upstream services
upstream backend {
    server localhost:4000;
}

upstream game_client {
    server localhost:3000;
}

upstream creator_dashboard {
    server localhost:3001;
}

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Game Client
    location / {
        proxy_pass http://game_client;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Creator Dashboard
    location /dashboard {
        proxy_pass http://creator_dashboard;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and start:

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/miniworld /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Step 6: SSL Certificate

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal (already configured)
sudo certbot renew --dry-run
```

### Step 7: Verify Deployment

```bash
# Check services
curl https://yourdomain.com/api/health

# Expected: {"status":"healthy",...}

# Check world state
curl https://yourdomain.com/api/world

# View logs
docker-compose logs -f backend
```

---

## Manual Deployment

### Step 1: Install Dependencies

```bash
# PostgreSQL 18
sudo apt install postgresql-18

# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install nodejs

# PM2 (process manager)
sudo npm install -g pm2
```

### Step 2: Setup Database

```bash
# Create database
sudo -u postgres psql
CREATE DATABASE miniworld;
CREATE USER miniworld_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE miniworld TO miniworld_user;
\q

# Run migrations
cd backend
npm run migrate
```

### Step 3: Build Services

```bash
# Backend
cd backend
npm ci --only=production
npm run build

# SDK
cd ../sdk
npm ci --only=production
npm run build

# Game Client
cd ../game-client
npm ci --only=production
npm run build

# Creator Dashboard
cd ../creator-dashboard
npm ci --only=production
npm run build
```

### Step 4: Start Services with PM2

```bash
# Backend
cd backend
pm2 start dist/index.js --name miniworld-backend

# Serve frontends with nginx (see nginx config above)
# Copy dist/ folders to /var/www/
sudo cp -r game-client/dist /var/www/game-client
sudo cp -r creator-dashboard/dist /var/www/creator-dashboard
```

### Step 5: Configure PM2 Startup

```bash
# Save PM2 configuration
pm2 save

# Generate startup script
pm2 startup

# Run the generated command (shown in output)
```

---

## Production Configuration

### Environment Variables

**Backend (.env)**:
```bash
PORT=4000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=miniworld
DB_USER=miniworld_user
DB_PASSWORD=your_secure_password
RPC_URL=http://localhost:8545  # Or public RPC
CONTRACT_ADDRESS=0x...
CHAIN_ID=31337  # Or mainnet: 1
START_BLOCK=0
GRID_SIZE=10
CORS_ORIGIN=https://yourdomain.com
LOG_LEVEL=info
NODE_ENV=production
```

**Frontend (.env)**:
```bash
VITE_API_URL=https://yourdomain.com/api
VITE_WS_URL=wss://yourdomain.com
VITE_CONTRACT_ADDRESS=0x...
```

### Database Tuning

PostgreSQL config (`/etc/postgresql/18/main/postgresql.conf`):

```
# Memory
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
work_mem = 4MB

# Connections
max_connections = 100

# Write performance
wal_buffers = 16MB
checkpoint_completion_target = 0.9

# Query performance
random_page_cost = 1.1
effective_io_concurrency = 200
```

Restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

---

## Security Hardening

### Firewall Rules

```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable

# Block direct access to services
sudo ufw deny 3000/tcp
sudo ufw deny 3001/tcp
sudo ufw deny 4000/tcp
sudo ufw deny 5432/tcp
sudo ufw deny 8545/tcp
```

### Fail2Ban (Brute Force Protection)

```bash
# Install
sudo apt install fail2ban

# Configure
sudo nano /etc/fail2ban/jail.local
```

Add:
```ini
[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
```

Start:
```bash
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### PostgreSQL Security

```bash
# Edit pg_hba.conf
sudo nano /etc/postgresql/18/main/pg_hba.conf
```

Change:
```
# Only allow local connections
host    all    all    127.0.0.1/32    scram-sha-256
```

### Docker Security

```bash
# Run containers as non-root (already configured)
# Limit resources
docker-compose up -d --limit-cpu=1 --limit-memory=512m backend
```

---

## Monitoring Setup

### Health Checks

**Backend health endpoint**: `https://yourdomain.com/api/health`

**Uptime monitoring**: Set up with UptimeRobot, Pingdom, or similar

**Check interval**: Every 5 minutes

**Alert on**: 3 consecutive failures

### Log Monitoring

```bash
# View Docker logs
docker-compose logs -f --tail=100 backend

# PM2 logs
pm2 logs miniworld-backend

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Metrics (Optional)

**Prometheus + Grafana**:

1. Install Prometheus
2. Configure exporters (node_exporter, postgres_exporter)
3. Install Grafana
4. Import dashboards

---

## Backup Strategy

### Database Backup

```bash
# Daily backup script
#!/bin/bash
BACKUP_DIR="/backups/miniworld"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/miniworld_$DATE.sql"

pg_dump -U miniworld_user miniworld > $BACKUP_FILE
gzip $BACKUP_FILE

# Delete backups older than 7 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
```

Add to cron:
```bash
# Daily at 2 AM
0 2 * * * /usr/local/bin/backup-miniworld.sh
```

### Contract Deployment Backup

```bash
# Backup deployment files
cp -r contracts/ignition/deployments /backups/deployments/
```

---

## Updates & Maintenance

### Zero-Downtime Updates

```bash
# 1. Build new images
docker-compose build

# 2. Update backend (rolling update)
docker-compose up -d --no-deps backend

# 3. Update frontends
docker-compose up -d --no-deps game-client creator-dashboard

# 4. Verify
curl https://yourdomain.com/api/health
```

### Database Migrations

```bash
# Run new migrations
docker-compose exec backend node dist/migrations/run.js

# Or manually
cd backend
npm run migrate
```

---

## Troubleshooting

### Services Won't Start

```bash
# Check logs
docker-compose logs backend

# Check ports
sudo netstat -tulpn | grep -E '(3000|3001|4000|5432|8545)'

# Restart services
docker-compose restart
```

### Database Connection Errors

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test connection
psql -h localhost -U miniworld_user -d miniworld

# Check pg_hba.conf
sudo nano /etc/postgresql/18/main/pg_hba.conf
```

### Nginx Errors

```bash
# Test configuration
sudo nginx -t

# Check error logs
sudo tail -f /var/log/nginx/error.log

# Restart nginx
sudo systemctl restart nginx
```

### Out of Memory

```bash
# Check memory usage
docker stats

# Increase swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

---

## Performance Optimization

### Database Indexes

Already optimized with indexes on:
- `owner`
- `coordinates (x, y)`
- `item_type`
- `timestamp`

### Nginx Caching

Add to nginx config:
```nginx
# Cache static assets
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### CDN (Optional)

Use CloudFlare for:
- Static asset caching
- DDoS protection
- SSL termination
- Global distribution

---

## Scaling Considerations

### Horizontal Scaling (Future)

**Backend**: Load balancer + multiple instances

**Database**: Read replicas for queries

**WebSocket**: Redis pub/sub for multi-instance

### Vertical Scaling

Increase VM resources:
- More CPU for backend
- More RAM for PostgreSQL
- Faster SSD for database

---

## Rollback Procedure

### Quick Rollback

```bash
# Stop current version
docker-compose down

# Checkout previous version
git checkout <previous-tag>

# Start services
docker-compose up -d
```

### Database Rollback

```bash
# Restore from backup
gunzip miniworld_YYYYMMDD.sql.gz
psql -U miniworld_user miniworld < miniworld_YYYYMMDD.sql
```

---

## Cost Estimation

### Cloud VM (AWS EC2)

**t3.medium** (2 vCPU, 4GB RAM):
- Instance: $30/month
- Storage (50GB): $5/month
- Bandwidth: $5-10/month
- **Total**: ~$40-45/month

**t3.large** (2 vCPU, 8GB RAM):
- Instance: $60/month
- Storage (50GB): $5/month
- **Total**: ~$65-70/month

### Additional Costs

- Domain: $10-15/year
- SSL (Let's Encrypt): Free
- Monitoring: $0-20/month
- Backups (S3): $1-5/month

---

## Checklist

Before going live:

- [ ] SSL certificate installed and valid
- [ ] Firewall configured
- [ ] Database backups automated
- [ ] Health monitoring set up
- [ ] Logs rotation configured
- [ ] CORS properly restricted
- [ ] Rate limiting enabled
- [ ] Error tracking configured
- [ ] Documentation updated
- [ ] Test deployment in staging first

---

For architecture details, see [ARCHITECTURE.md](ARCHITECTURE.md).

For API reference, see [API.md](API.md).

For Docker setup, see [DOCKER-SETUP.md](DOCKER-SETUP.md).