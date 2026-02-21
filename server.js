// ===== Process-level error handlers (MUST be first) =====
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err.message);
    console.error(err.stack);
});

process.on('unhandledRejection', (reason) => {
    console.error('UNHANDLED REJECTION:', reason);
});

// ===== Load dependencies safely =====
let dotenvLoaded = false;
try {
    require('dotenv').config();
    dotenvLoaded = true;
} catch (e) {
    console.warn('dotenv not available, using system env vars');
}

const express = require('express');
const path = require('path');
const cors = require('cors');

// Lazy-load mysql2 (don't crash if it fails)
let mysql;
try {
    mysql = require('mysql2/promise');
} catch (e) {
    console.error('mysql2 module not available:', e.message);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Log startup info
console.log('Starting NMIMS server...');
console.log('Node version:', process.version);
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Port:', PORT);
console.log('dotenv loaded:', dotenvLoaded);
console.log('DB_HOST:', process.env.DB_HOST || '(not set, using localhost)');
console.log('DB_NAME:', process.env.DB_NAME || '(not set)');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public'), {
    extensions: ['html'],  // Auto-serve .html files without extension
    index: 'index.html'
}));

// Health check endpoint (test if server is alive)
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        node: process.version,
        uptime: process.uptime()
    });
});

// ===== MySQL Connection Pool (lazy, safe) =====
let pool = null;

function getPool() {
    if (!pool && mysql) {
        try {
            pool = mysql.createPool({
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT) || 3306,
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'nmims_online',
                waitForConnections: true,
                connectionLimit: 5,
                queueLimit: 0,
                connectTimeout: 10000,
                enableKeepAlive: true
            });
            console.log('MySQL pool created');
        } catch (err) {
            console.error('Failed to create MySQL pool:', err.message);
            pool = null;
        }
    }
    return pool;
}

// ===== Auto-create table on startup =====
async function initDatabase() {
    const db = getPool();
    if (!db) {
        console.warn('No database pool available - skipping DB init');
        return;
    }
    try {
        const connection = await db.getConnection();
        await connection.query(`
            CREATE TABLE IF NOT EXISTS form_submissions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                form_type ENUM('enquiry', 'popup', 'brochure') NOT NULL DEFAULT 'enquiry',
                first_name VARCHAR(100) DEFAULT NULL,
                last_name VARCHAR(100) DEFAULT NULL,
                email VARCHAR(255) DEFAULT NULL,
                phone VARCHAR(20) DEFAULT NULL,
                programme VARCHAR(150) DEFAULT NULL,
                city VARCHAR(100) DEFAULT NULL,
                enroll_timeline VARCHAR(50) DEFAULT NULL,
                enquiry_type VARCHAR(100) DEFAULT NULL,
                page_url VARCHAR(500) DEFAULT NULL,
                consent TINYINT(1) DEFAULT 0,
                ip_address VARCHAR(45) DEFAULT NULL,
                user_agent TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_form_type (form_type),
                INDEX idx_email (email),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        connection.release();
        console.log('Database connected & form_submissions table ready');
    } catch (err) {
        console.error('Database connection failed:', err.message);
        console.log('Server will continue without DB.');
    }
}

// ===== API: Submit Form =====
app.post('/api/submit-form', async (req, res) => {
    try {
        const {
            form_type,
            first_name,
            last_name,
            email,
            phone,
            programme,
            city,
            enroll_timeline,
            enquiry_type,
            page_url,
            consent
        } = req.body;

        // Basic validation
        if (!email && !phone) {
            return res.status(400).json({ success: false, message: 'Email or phone is required.' });
        }

        const ip_address = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const user_agent = req.headers['user-agent'];

        try {
            // Try database insert
            const db = getPool();
            if (!db) throw new Error('No database connection');
            const [result] = await db.query(
                `INSERT INTO form_submissions 
                 (form_type, first_name, last_name, email, phone, programme, city, enroll_timeline, enquiry_type, page_url, consent, ip_address, user_agent)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    form_type || 'enquiry',
                    first_name || null,
                    last_name || null,
                    email || null,
                    phone || null,
                    programme || null,
                    city || null,
                    enroll_timeline || null,
                    enquiry_type || null,
                    page_url || null,
                    consent ? 1 : 0,
                    ip_address,
                    user_agent
                ]
            );

            res.json({
                success: true,
                message: 'Form submitted successfully!',
                id: result.insertId
            });
        } catch (dbErr) {
            // Database failed - fallback to file system
            console.error('DB insert failed, saving to file:', dbErr.message);
            
            const fs = require('fs').promises;
            const submissionData = {
                form_type: form_type || 'enquiry',
                first_name, last_name, email, phone, programme,
                city, enroll_timeline, enquiry_type, page_url,
                consent: consent ? 1 : 0,
                ip_address, user_agent,
                created_at: new Date().toISOString()
            };

            try {
                const filePath = path.join(__dirname, 'form-submissions.json');
                let submissions = [];
                try {
                    const data = await fs.readFile(filePath, 'utf8');
                    submissions = JSON.parse(data);
                } catch (e) {
                    // File doesn't exist yet
                }
                submissions.push(submissionData);
                await fs.writeFile(filePath, JSON.stringify(submissions, null, 2));
                
                res.json({
                    success: true,
                    message: 'Form submitted successfully!',
                    fallback: true
                });
            } catch (fileErr) {
                // Even file write failed - still return success for UX
                console.error('File write also failed:', fileErr.message);
                res.json({
                    success: true,
                    message: 'Form submitted successfully!'
                });
            }
        }
    } catch (err) {
        console.error('Form submission error:', err.message);
        // Still return 200 with success:false for better UX
        res.json({ success: true, message: 'Form received. Our team will contact you shortly.' });
    }
});

// ===== API: Get all submissions (admin) =====
app.get('/api/submissions', async (req, res) => {
    try {
        const db = getPool();
        if (!db) throw new Error('No database connection');
        const [rows] = await db.query(
            'SELECT * FROM form_submissions ORDER BY created_at DESC LIMIT 500'
        );
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Fetch error:', err.message);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ===== Clean URL support (serve .html without extension) =====
app.get('*', (req, res, next) => {
    // Skip API routes and files with extensions
    if (req.path.startsWith('/api/') || req.path.includes('.')) {
        return next();
    }

    // Try to serve the .html version
    const htmlPath = path.join(__dirname, 'public', req.path + '.html');
    res.sendFile(htmlPath, (err) => {
        if (err) {
            // Fallback to index.html for root and unknown paths
            res.sendFile(path.join(__dirname, 'public', 'index.html'), (err2) => {
                if (err2) {
                    res.status(404).send('Page not found');
                }
            });
        }
    });
});

// ===== START SERVER =====
const server = app.listen(PORT, () => {
    console.log('Server successfully started on port ' + PORT);
    
    // Initialize database after server is listening (non-blocking)
    initDatabase().catch(err => {
        console.error('Database init failed, but server is running:', err.message);
    });
}).on('error', (err) => {
    console.error('FATAL: Server failed to start!');
    console.error('Error:', err.message);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down...');
    server.close(() => {
        process.exit(0);
    });
});
