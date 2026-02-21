# Hostinger Node.js Deployment Guide - Fix 503 Error

## ⚠️ Current Issue: 503 Service Unavailable

This means your Node.js application is **not running** on Hostinger's server.

## 🔧 Step-by-Step Fix

### 1. **Access Hostinger Control Panel**
- Go to: https://hpanel.hostinger.com
- Login to your account
- Select your website: `nmimsonlineuniversity.com`

### 2. **Check Node.js Application Status**
Navigate to: **Advanced** → **Node.js**

You should see:
- ✅ **Status: Running** (Green) - If this shows "Stopped" (Red), that's your problem!
- Application Root: Usually `/public_html` or `/domains/nmimsonlineuniversity.com/public_html`
- Entry Point: `server.js`
- Node.js Version: 18.x or 20.x (recommended)

### 3. **Setup Application (If Not Already Done)**

#### A. Create Node.js Application
1. Click **"Create Application"**
2. Fill in:
   - **Application Mode**: Production
   - **Application Root**: `/domains/nmimsonlineuniversity.com/public_html` (or `/public_html`)
   - **Application URL**: `nmimsonlineuniversity.com`
   - **Application Startup File**: `server.js`
   - **Node.js Version**: 18.x or higher

#### B. Deploy from GitHub
1. In the application settings, find **"Repository"**
2. Connect your GitHub account
3. Select repository: `samarth207/nmims`
4. Branch: `main`
5. Click **"Deploy"**

### 4. **Configure Environment Variables**

In Hostinger Node.js app settings, add these environment variables:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=u261758575_nmims
DB_PASSWORD=s8jlXp3*Le
DB_NAME=u261758575_nmims
NODE_ENV=production
```

**DO NOT** import .env file - manually enter each variable!

### 5. **Install Dependencies**

After deployment, Hostinger should automatically run `npm install`. 

If not, use **SSH** (see step 6) to manually run:
```bash
cd ~/domains/nmimsonlineuniversity.com/public_html
npm install --production
```

### 6. **SSH Access (For Manual Troubleshooting)**

#### Connect via SSH:
```bash
ssh u261758575@145.79.212.103
# Enter your SSH password when prompted
```

#### Navigate to your app:
```bash
cd ~/domains/nmimsonlineuniversity.com/public_html
# OR
cd ~/public_html
```

#### Check if files are there:
```bash
ls -la
```

You should see:
- `server.js`
- `package.json`
- `node_modules/` directory
- `public/` directory

#### Install dependencies (if missing):
```bash
npm install --production
```

#### Test database connection:
```bash
mysql -u u261758575_nmims -p -h localhost u261758575_nmims
# Password: s8jlXp3*Le
```

If connected successfully:
```sql
SHOW TABLES;
EXIT;
```

#### Check Node.js logs:
```bash
# View application logs
tail -100 ~/logs/app_error.log
# OR
tail -100 ~/.npm/_logs/*-debug.log
```

### 7. **Start/Restart Application**

#### Via Hostinger Control Panel:
1. Go to **Advanced** → **Node.js**
2. Find your application
3. Click **"Restart"** or **"Start"** button
4. Wait 10-20 seconds
5. Check status becomes **Running** (Green)

#### Via SSH (if needed):
```bash
# This is usually managed by Hostinger's control panel
# But if you need to manually test:
node server.js
# Press Ctrl+C to stop, then restart via control panel
```

### 8. **Test the Application**

After starting, test these URLs:
- https://nmimsonlineuniversity.com/health - Should return: `{"status":"ok",...}`
- https://nmimsonlineuniversity.com/ - Should load your homepage

### 9. **Common Mistakes to Avoid**

❌ **Wrong Application Root**
- Must be the full path to where your files are
- Usually `/domains/nmimsonlineuniversity.com/public_html`
- NOT just `/`

❌ **Missing node_modules**
- Always run `npm install` after deployment
- Hostinger should do this automatically, but verify

❌ **Wrong DB_HOST**
- Must be `localhost` (not an IP address)
- Database is on the same server

❌ **Port Conflicts**
- Don't hardcode ports in .env as 3001, 3002, etc.
- Use `PORT=3000` and let Hostinger manage it

❌ **Wrong Entry Point**
- Must be `server.js` (not `index.js` or `app.js`)

❌ **.htaccess conflicts**
- Node.js apps don't need .htaccess
- Remove or disable it

### 10. **Check Application Logs**

In Hostinger Control Panel:
1. Go to **Node.js** application
2. Click on your application name  
3. Look for **"Logs"** or **"Error Log"** section
4. Check for error messages

Common errors you might see:
- `Cannot find module` - Run `npm install`
- `EADDRINUSE` - Port already in use, restart app
- `ECONNREFUSED` - Database connection failed, check credentials
- `MODULE_NOT_FOUND` - Dependencies missing

## 🆘 Still Not Working?

### A. Verify Node.js Version
```bash
node --version  # Should be v18.x or v20.x
npm --version
```

### B. Test Locally First
On your computer:
```bash
cd c:\Users\samth\Desktop\DD\nmims
npm install
npm start
```
Visit http://localhost:3000 - If it works locally, the issue is deployment.

### C. Check Hostinger Status Page
- Visit: https://www.hostinger.com/status-page
- Ensure no ongoing issues

### D. Contact Hostinger Support
If none of above works, contact Hostinger support with:
- Your domain: `nmimsonlineuniversity.com`
- Error: "503 Service Unavailable"
- What you tried: "Node.js application won't start after deployment"

## ✅ Success Checklist

- [ ] Node.js application shows **Status: Running** in Hostinger panel
- [ ] All files visible via SSH in application directory  
- [ ] `node_modules/` folder exists and is populated
- [ ] Environment variables configured in Hostinger panel
- [ ] Database connection successful (test via SSH)
- [ ] `https://nmimsonlineuniversity.com/health` returns `{"status":"ok"}`
- [ ] Main website loads without 503 error

## 📝 Quick Commands Summary

```bash
# SSH Connect
ssh u261758575@145.79.212.103

# Navigate to app
cd ~/domains/nmimsonlineuniversity.com/public_html

# Install dependencies
npm install --production

# Check logs
tail -50 ~/logs/app_error.log

# Test database
mysql -u u261758575_nmims -p -h localhost u261758575_nmims

# Manual start (for testing only)
node server.js
```

---

**Note**: After making these changes, commit and push to GitHub, then redeploy from Hostinger's Node.js application manager.
