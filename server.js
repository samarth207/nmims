require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// ===== MySQL Connection Pool =====
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'nmims_online',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// ===== Auto-create table on startup =====
async function initDatabase() {
    try {
        const connection = await pool.getConnection();
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
        console.log('✅ Database connected & form_submissions table ready');
    } catch (err) {
        console.error('⚠️  Database connection failed:', err.message);
        console.log('   Server will continue without DB. Update .env with your Hostinger credentials.');
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

        const [result] = await pool.query(
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
    } catch (err) {
        console.error('Form submission error:', err.message);
        res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
});

// ===== API: Get all submissions (admin) =====
app.get('/api/submissions', async (req, res) => {
    try {
        const [rows] = await pool.query(
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
    if (req.path.startsWith('/api/') || req.path.includes('.')) {
        return next();
    }

    const filePath = path.join(__dirname, 'public', req.path + '.html');
    res.sendFile(filePath, (err) => {
        if (err) {
            if (req.path === '/') {
                res.sendFile(path.join(__dirname, 'public', 'index.html'));
            } else {
                next();
            }
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    initDatabase();
});
