# GameStringer Secrets Setup Guide

This guide explains how to securely configure API keys and secrets for GameStringer.

## 🔐 Security First

**IMPORTANT**: Never commit real API keys or secrets to version control. Always use environment variables and the `.env.local` file.

## 📋 Required vs Optional Secrets

### Required Secrets (Must be configured)
- `DATABASE_URL` - Database connection string
- `NEXTAUTH_SECRET` - Authentication secret key
- `NEXTAUTH_URL` - Authentication URL

### Optional Secrets (Feature-dependent)
- `STEAM_API_KEY` - Steam Web API integration
- `STEAMGRIDDB_API_KEY` - Game artwork from SteamGridDB
- `OPENAI_API_KEY` - AI translation services
- `ABACUSAI_API_KEY` - Advanced AI features
- `EPIC_CLIENT_ID` / `EPIC_CLIENT_SECRET` - Epic Games Store integration
- `ITCHIO_CLIENT_ID` / `ITCHIO_CLIENT_SECRET` - itch.io integration

## 🚀 Quick Setup

1. **Copy the template**:
   ```bash
   cp .env.example .env.local
   ```

2. **Edit `.env.local`** with your actual values:
   ```bash
   # Required
   DATABASE_URL="file:./prisma/dev.db"
   NEXTAUTH_SECRET="your-32-char-secret-here"
   NEXTAUTH_URL="http://localhost:3000"
   
   # Optional (add only if you need these features)
   STEAM_API_KEY="your-steam-api-key"
   OPENAI_API_KEY="sk-your-openai-key"
   ```

3. **Verify configuration**:
   ```bash
   npm run dev
   ```
   Check the admin dashboard at `/admin/secrets` for status.

## 🔑 API Key Setup Instructions

### Steam API Key
1. Go to [Steam Web API Key](https://steamcommunity.com/dev/apikey)
2. Sign in with your Steam account
3. Enter your domain name (use `localhost` for development)
4. Copy the generated API key to `STEAM_API_KEY`

### OpenAI API Key
1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Sign in to your OpenAI account
3. Click "Create new secret key"
4. Copy the key to `OPENAI_API_KEY`

### SteamGridDB API Key
1. Go to [SteamGridDB API](https://www.steamgriddb.com/profile/preferences/api)
2. Sign in to your account
3. Generate a new API key
4. Copy the key to `STEAMGRIDDB_API_KEY`

### Epic Games Store API
1. Go to [Epic Developer Portal](https://dev.epicgames.com/portal/)
2. Create a new application
3. Get Client ID and Client Secret
4. Add to `EPIC_CLIENT_ID` and `EPIC_CLIENT_SECRET`

### itch.io API Keys
1. Go to [itch.io API Keys](https://itch.io/user/settings/api-keys)
2. Generate a new API key
3. Copy to `ITCHIO_CLIENT_ID` and `ITCHIO_CLIENT_SECRET`

## 🛡️ Security Best Practices

### 1. Environment Separation
```bash
# Development
.env.local

# Production
.env.production.local

# Never commit these files!
```

### 2. Secret Rotation
- Rotate API keys every 90 days
- Use different keys for development/staging/production
- Monitor API key usage and alerts

### 3. Access Control
- Limit API key permissions where possible
- Use read-only keys when write access isn't needed
- Monitor API usage for anomalies

### 4. Secret Validation
Use the built-in validator:
```javascript
import { secretsManager } from '@/lib/secrets-manager';

// Validate a secret format
const isValid = secretsManager.validateSecret('STEAM_API_KEY', 'your-key');
```

## 🧪 Testing Your Setup

### 1. Check Configuration Status
```bash
# Visit the admin dashboard
http://localhost:3000/admin/secrets
```

### 2. Validate Secrets
```javascript
// Use the secrets validator in the admin dashboard
// Or programmatically:
import { getSecretsStatus } from '@/lib/secrets-manager';

const status = getSecretsStatus();
console.log('Missing required secrets:', status.missing);
```

### 3. Test API Connections
```bash
# Test Steam API
curl "http://localhost:3000/api/steam/test"

# Test translation API
curl "http://localhost:3000/api/translate/test"
```

## 🚨 Troubleshooting

### Common Issues

1. **"Missing required secrets" error**
   - Check that all required secrets are set in `.env.local`
   - Verify the file is in the project root
   - Restart the development server

2. **Invalid secret format**
   - Use the validator in the admin dashboard
   - Check API documentation for correct format
   - Regenerate the API key if needed

3. **API not working despite valid keys**
   - Check API key permissions
   - Verify rate limits aren't exceeded
   - Check network connectivity

### Environment Variables Not Loading
```bash
# Check if .env.local exists
ls -la .env.local

# Check file permissions
chmod 600 .env.local

# Restart development server
npm run dev
```

## 📊 Monitoring

### Admin Dashboard
- Access at `/admin/secrets`
- Shows configuration status
- Validates secret formats
- Generates new secret keys

### Logging
```javascript
import { logger } from '@/lib/logger';

// Secrets manager logs initialization
logger.info('Secrets loaded successfully');
```

## 🔄 Production Deployment

### 1. Environment Variables
Set in your hosting platform:
```bash
# Vercel
vercel env add STEAM_API_KEY

# Netlify
netlify env:set STEAM_API_KEY your-key

# Docker
docker run -e STEAM_API_KEY=your-key
```

### 2. Database Migration
```bash
# Ensure DATABASE_URL is set for production
DATABASE_URL="postgresql://user:pass@host:5432/db"

# Run migrations
npx prisma migrate deploy
```

### 3. Security Checklist
- [ ] All required secrets configured
- [ ] Production API keys (not development)
- [ ] Secrets rotation schedule
- [ ] Monitoring and alerting
- [ ] Backup and recovery plan

## 🆘 Emergency Procedures

### If Secrets Are Compromised
1. **Immediately rotate all affected API keys**
2. **Check logs for unauthorized usage**
3. **Update all environments with new keys**
4. **Review access logs and permissions**
5. **Document the incident**

### Recovery Steps
```bash
# 1. Generate new secrets
npm run admin:generate-secrets

# 2. Update environment files
cp .env.local.backup .env.local

# 3. Restart all services
npm run dev

# 4. Verify functionality
npm run test:secrets
```

## 📚 Additional Resources

- [Steam Web API Documentation](https://steamcommunity.com/dev)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)

---

**Remember**: Security is a shared responsibility. Always follow your organization's security policies and best practices.