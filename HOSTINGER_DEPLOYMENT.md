# Hostinger Deployment Checklist

## Common Causes for 503 Error:

### 1. **Node.js Application Not Running**
- Check if `npm install` was executed on the server
- Verify the app is started with `npm start` or `node server.js`
- Check Hostinger's application manager for app status

### 2. **Database Connection Issues**
- Database host should be `localhost` (not the IP) when DB is on same server
- Verify database credentials in Hostinger's `.env` file
- Test connection: 
  ```bash
  mysql -u u261758575_nmims -p -h localhost u261758575_nmims
  ```

### 3. **Port Configuration**
- Hostinger assigns ports automatically - don't hardcode ports
- Ensure `.env` has `PORT=3000` and `HOST=0.0.0.0`
- Check Hostinger control panel for assigned port

### 4. **Missing Dependencies**
```bash
cd ~/public_html/your-app-folder
npm install --production
```

### 5. **Node.js Version**
- Check required Node.js version: `node --version`
- Hostinger typically supports Node 14, 16, 18, 20
- Update via Hostinger control panel if needed

### 6. **File Permissions**
```bash
chmod -R 755 ~/public_html/your-app-folder
chmod 644 ~/public_html/your-app-folder/.env
```

### 7. **Application Manager Settings (Hostinger)**
- Application Root: `/public_html` or `/home/username/public_html`
- Application URL: Your domain
- Application Startup File: `server.js`
- Start Command: `npm start` or `node server.js`

### 8. **Check Logs**
```bash
# In Hostinger SSH
tail -f ~/logs/error_log
tail -f ~/logs/app_error.log
```

### 9. **Restart Application**
Via Hostinger control panel:
- Go to **Website** → **Application Manager**
- Click **Restart** on your Node.js application

## Quick Fix Steps:

1. **SSH into Hostinger:**
```bash
ssh u261758575@145.79.212.103
```

2. **Navigate to your app:**
```bash
cd ~/public_html
```

3. **Install dependencies:**
```bash
npm install --production
```

4. **Update .env file:**
```bash
nano .env
```
Make sure `DB_HOST=localhost`

5. **Test database connection:**
```bash
mysql -u u261758575_nmims -p -h localhost
# Enter password: s8jlXp3*Le
# Then: USE u261758575_nmims;
# Then: SHOW TABLES;
```

6. **Restart the app via Hostinger Control Panel**

## Environment Variables (Update on Server)

Create/update `.env` on your Hostinger server:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=u261758575_nmims
DB_PASSWORD=s8jlXp3*Le
DB_NAME=u261758575_nmims
PORT=3000
HOST=0.0.0.0
```

## Important Notes:

- **Never commit `.env` file** - Recreate .env on the server manually
- Use `localhost` for DB_HOST when database is on same server
- Hostinger automatically manages ports - your app should read `process.env.PORT`
- Check Hostinger's error logs in the control panel
- Ensure Application Manager shows "Running" status

## Troubleshooting Commands:

```bash
# Check if node process is running
ps aux | grep node

# Check port usage
netstat -tlnp | grep :3000

# View recent errors
tail -50 ~/logs/error_log

# Manually start (for testing)
node server.js

# Stop all node processes (if needed)
pkill node
```
