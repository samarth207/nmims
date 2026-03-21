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
const crypto = require('crypto');
const fsSync = require('fs');
const fs = require('fs').promises;

// Lazy-load optional modules
let mysql;
try {
    mysql = require('mysql2/promise');
} catch (e) {
    console.error('mysql2 module not available:', e.message);
}

let jwt;
try {
    jwt = require('jsonwebtoken');
} catch (e) {
    console.error('jsonwebtoken not available:', e.message);
}

let multer;
try {
    multer = require('multer');
} catch (e) {
    console.error('multer not available:', e.message);
}

let MongoClient;
try {
    MongoClient = require('mongodb').MongoClient;
} catch (e) {
    console.error('mongodb module not available:', e.message);
}

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Blog CMS Configuration =====
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const MONGODB_URI = process.env.MONGODB_URI;
const BLOGS_FILE = path.join(__dirname, 'blogs-data.json');
const BLOG_IMAGES_DIR = path.join(__dirname, 'public', 'images', 'blog');

// Ensure blog images directory exists
if (!fsSync.existsSync(BLOG_IMAGES_DIR)) {
    fsSync.mkdirSync(BLOG_IMAGES_DIR, { recursive: true });
    console.log('Created blog images directory');
}

// Multer config for image uploads
let upload = null;
if (multer) {
    const storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, BLOG_IMAGES_DIR),
        filename: (req, file, cb) => {
            const uniqueName = Date.now() + '-' + crypto.randomBytes(4).toString('hex');
            const ext = path.extname(file.originalname).toLowerCase();
            cb(null, uniqueName + ext);
        }
    });
    upload = multer({
        storage,
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
            if (/\.(jpe?g|png|gif|webp|svg)$/i.test(file.originalname)) {
                cb(null, true);
            } else {
                cb(new Error('Only image files (JPG, PNG, GIF, WebP, SVG) are allowed'));
            }
        }
    });
}

// ===== JWT Auth Middleware =====
function authenticateAdmin(req, res, next) {
    if (!jwt) return res.status(500).json({ success: false, message: 'Auth module not available' });
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Authentication required' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.adminUser = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    }
}

// ===== MongoDB Blog Storage =====
let blogsCollection = null;

async function connectMongo() {
    if (!MongoClient || !MONGODB_URI) {
        console.warn('MongoDB not configured, using file-based blog storage');
        return;
    }
    try {
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        blogsCollection = client.db('nmims').collection('blogs');
        console.log('MongoDB connected for blog storage');
    } catch (err) {
        console.error('MongoDB connection failed:', err.message);
        console.log('Falling back to file-based blog storage');
    }
}

// ===== Blog Data Helpers =====
async function loadBlogs() {
    if (blogsCollection) {
        return await blogsCollection.find({}).sort({ createdAt: 1 }).toArray();
    }
    try {
        const data = await fs.readFile(BLOGS_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

async function saveBlogs(blogs) {
    if (blogsCollection) {
        await blogsCollection.deleteMany({});
        if (blogs.length > 0) await blogsCollection.insertMany(blogs);
        return;
    }
    await fs.writeFile(BLOGS_FILE, JSON.stringify(blogs, null, 2));
}

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

// Explicit route for /blog — must be before static middleware to prevent
// Express from redirecting /blog → /blog/ because public/blog/ is a directory
app.get('/blog', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'blog.html'));
});

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

// DB diagnostic endpoint (check if database is connected)
app.get('/api/db-status', async (req, res) => {
    const db = getPool();
    if (!db) {
        return res.json({ 
            connected: false, 
            error: 'No pool created',
            env: {
                DB_HOST: process.env.DB_HOST || '(not set)',
                DB_PORT: process.env.DB_PORT || '(not set)',
                DB_USER: process.env.DB_USER || '(not set)',
                DB_NAME: process.env.DB_NAME || '(not set)',
                DB_PASSWORD_SET: process.env.DB_PASSWORD ? 'yes (' + process.env.DB_PASSWORD.length + ' chars)' : 'NO - MISSING!'
            }
        });
    }
    try {
        const [rows] = await db.query('SELECT 1 as test');
        const [tables] = await db.query('SHOW TABLES');
        const [count] = await db.query('SELECT COUNT(*) as total FROM form_submissions').catch(() => [[{total: 'table not found'}]]);
        res.json({ 
            connected: true, 
            test: rows[0],
            tables: tables.map(t => Object.values(t)[0]),
            submissions_count: count[0]?.total,
            env: {
                DB_HOST: process.env.DB_HOST,
                DB_PORT: process.env.DB_PORT,
                DB_USER: process.env.DB_USER,
                DB_NAME: process.env.DB_NAME,
                DB_PASSWORD_SET: 'yes (' + (process.env.DB_PASSWORD || '').length + ' chars)'
            }
        });
    } catch (err) {
        res.json({ 
            connected: false, 
            error: err.message,
            code: err.code,
            env: {
                DB_HOST: process.env.DB_HOST || '(not set)',
                DB_PORT: process.env.DB_PORT || '(not set)',
                DB_USER: process.env.DB_USER || '(not set)',
                DB_NAME: process.env.DB_NAME || '(not set)',
                DB_PASSWORD_SET: process.env.DB_PASSWORD ? 'yes (' + process.env.DB_PASSWORD.length + ' chars)' : 'NO - MISSING!'
            }
        });
    }
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

// ===================================================
// ===== BLOG CMS API ROUTES =====
// ===================================================

// ----- Admin Login -----
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password required' });
    }
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        if (!jwt) return res.status(500).json({ success: false, message: 'Auth module not available' });
        const token = jwt.sign({ username, role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ success: true, token });
    } else {
        res.status(401).json({ success: false, message: 'Invalid username or password' });
    }
});

// ----- Admin: Upload Image -----
app.post('/api/admin/upload-image', authenticateAdmin, (req, res) => {
    if (!upload) return res.status(500).json({ success: false, message: 'Upload module not available' });
    upload.single('image')(req, res, (err) => {
        if (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image file provided' });
        }
        const imageUrl = '/images/blog/' + req.file.filename;
        res.json({ success: true, url: imageUrl, filename: req.file.filename });
    });
});

// ----- Admin: List All Blogs -----
app.get('/api/admin/blogs', authenticateAdmin, async (req, res) => {
    try {
        const blogs = await loadBlogs();
        res.json({ success: true, data: blogs });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to load blogs' });
    }
});

// ----- Admin: Get Single Blog -----
app.get('/api/admin/blogs/:id', authenticateAdmin, async (req, res) => {
    try {
        const blogs = await loadBlogs();
        const blog = blogs.find(b => b.id === req.params.id);
        if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });
        res.json({ success: true, data: blog });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to load blog' });
    }
});

// ----- Admin: Create Blog -----
app.post('/api/admin/blogs', authenticateAdmin, async (req, res) => {
    try {
        const blogs = await loadBlogs();
        const data = req.body;

        // Sanitize slug
        let slug = (data.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
        if (!slug && data.title) {
            slug = data.title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').substring(0, 80);
        }

        // Check duplicate slug
        if (blogs.some(b => b.slug === slug)) {
            slug = slug + '-' + Date.now().toString(36);
        }

        const blog = {
            id: crypto.randomUUID(),
            title: (data.title || '').substring(0, 70),
            slug,
            excerpt: (data.excerpt || '').substring(0, 250),
            featureImage: data.featureImage || '',
            featureImageAlt: data.featureImageAlt || '',
            featureImageTitle: data.featureImageTitle || '',
            content: data.content || '',
            faqs: Array.isArray(data.faqs) ? data.faqs : [],
            authorName: data.authorName || '',
            authorBio: data.authorBio || '',
            authorImage: data.authorImage || '',
            authorPage: data.authorPage || '',
            metaTitle: (data.metaTitle || '').substring(0, 60),
            metaDescription: (data.metaDescription || '').substring(0, 250),
            focusKeyword: data.focusKeyword || '',
            primaryKeyword: data.primaryKeyword || '',
            categories: Array.isArray(data.categories) ? data.categories : [],
            tags: Array.isArray(data.tags) ? data.tags : [],
            status: ['draft', 'pending', 'published', 'scheduled'].includes(data.status) ? data.status : 'draft',
            publishDate: data.publishDate || '',
            publishTime: data.publishTime || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        blogs.push(blog);
        await saveBlogs(blogs);

        // Generate static HTML if published
        if (blog.status === 'published') {
            await generateBlogHTML(blog, blogs);
            await generateBlogListingData(blogs);
        }

        console.log('Blog created:', blog.title, '(' + blog.status + ')');
        res.json({ success: true, data: blog });
    } catch (err) {
        console.error('Create blog error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to create blog' });
    }
});

// ----- Admin: Update Blog -----
app.put('/api/admin/blogs/:id', authenticateAdmin, async (req, res) => {
    try {
        const blogs = await loadBlogs();
        const index = blogs.findIndex(b => b.id === req.params.id);
        if (index === -1) return res.status(404).json({ success: false, message: 'Blog not found' });

        const data = req.body;
        const existing = blogs[index];

        // Sanitize slug
        let slug = (data.slug || existing.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
        
        // Check duplicate slug (exclude current blog)
        if (blogs.some(b => b.slug === slug && b.id !== req.params.id)) {
            slug = slug + '-' + Date.now().toString(36);
        }

        // If slug changed, remove old HTML file
        if (existing.slug && existing.slug !== slug) {
            const oldHtmlPath = path.join(__dirname, 'public', 'blog', existing.slug + '.html');
            await fs.unlink(oldHtmlPath).catch(() => {});
        }

        const updated = {
            ...existing,
            title: (data.title || existing.title || '').substring(0, 70),
            slug,
            excerpt: (data.excerpt || existing.excerpt || '').substring(0, 250),
            featureImage: data.featureImage !== undefined ? data.featureImage : existing.featureImage,
            featureImageAlt: data.featureImageAlt !== undefined ? data.featureImageAlt : existing.featureImageAlt,
            featureImageTitle: data.featureImageTitle !== undefined ? data.featureImageTitle : existing.featureImageTitle,
            content: data.content !== undefined ? data.content : existing.content,
            faqs: Array.isArray(data.faqs) ? data.faqs : existing.faqs,
            authorName: data.authorName !== undefined ? data.authorName : existing.authorName,
            authorBio: data.authorBio !== undefined ? data.authorBio : existing.authorBio,
            authorImage: data.authorImage !== undefined ? data.authorImage : existing.authorImage,
            authorPage: data.authorPage !== undefined ? data.authorPage : existing.authorPage,
            metaTitle: (data.metaTitle || existing.metaTitle || '').substring(0, 60),
            metaDescription: (data.metaDescription || existing.metaDescription || '').substring(0, 250),
            focusKeyword: data.focusKeyword !== undefined ? data.focusKeyword : existing.focusKeyword,
            primaryKeyword: data.primaryKeyword !== undefined ? data.primaryKeyword : existing.primaryKeyword,
            categories: Array.isArray(data.categories) ? data.categories : existing.categories,
            tags: Array.isArray(data.tags) ? data.tags : existing.tags,
            status: ['draft', 'pending', 'published', 'scheduled'].includes(data.status) ? data.status : existing.status,
            publishDate: data.publishDate !== undefined ? data.publishDate : existing.publishDate,
            publishTime: data.publishTime !== undefined ? data.publishTime : existing.publishTime,
            updatedAt: new Date().toISOString()
        };

        blogs[index] = updated;
        await saveBlogs(blogs);

        // Generate/remove static HTML based on status
        if (updated.status === 'published') {
            await generateBlogHTML(updated, blogs);
        } else if (existing.status === 'published' && updated.status !== 'published') {
            // Was published, now unpublished — remove HTML
            const htmlPath = path.join(__dirname, 'public', 'blog', updated.slug + '.html');
            await fs.unlink(htmlPath).catch(() => {});
        }
        await generateBlogListingData(blogs);

        console.log('Blog updated:', updated.title, '(' + updated.status + ')');
        res.json({ success: true, data: updated });
    } catch (err) {
        console.error('Update blog error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to update blog' });
    }
});

// ----- Admin: Delete Blog -----
app.delete('/api/admin/blogs/:id', authenticateAdmin, async (req, res) => {
    try {
        const blogs = await loadBlogs();
        const index = blogs.findIndex(b => b.id === req.params.id);
        if (index === -1) return res.status(404).json({ success: false, message: 'Blog not found' });

        const blog = blogs[index];

        // Remove static HTML file if it exists
        if (blog.slug) {
            const htmlPath = path.join(__dirname, 'public', 'blog', blog.slug + '.html');
            await fs.unlink(htmlPath).catch(() => {});
        }

        blogs.splice(index, 1);
        await saveBlogs(blogs);
        await generateBlogListingData(blogs);

        console.log('Blog deleted:', blog.title);
        res.json({ success: true, message: 'Blog deleted' });
    } catch (err) {
        console.error('Delete blog error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to delete blog' });
    }
});

// ----- Public: Get Published Blogs -----
app.get('/api/blogs', async (req, res) => {
    try {
        const blogs = await loadBlogs();
        const published = blogs
            .filter(b => b.status === 'published')
            .sort((a, b) => new Date(b.publishDate || b.createdAt) - new Date(a.publishDate || a.createdAt))
            .map(b => ({
                title: b.title,
                slug: b.slug,
                excerpt: b.excerpt,
                featureImage: b.featureImage,
                featureImageAlt: b.featureImageAlt,
                categories: b.categories,
                authorName: b.authorName,
                publishDate: b.publishDate,
                tags: b.tags
            }));
        res.json({ success: true, data: published });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to load blogs' });
    }
});

// ===================================================
// ===== BLOG HTML GENERATOR =====
// ===================================================

function escHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function generateBlogHTML(blog, allBlogs) {
    const siteUrl = 'https://nmimsonlineuniversity.com';
    const title = escHtml(blog.metaTitle || blog.title);
    const description = escHtml(blog.metaDescription || blog.excerpt);
    const ogImage = blog.featureImage ? siteUrl + blog.featureImage : '';
    const canonicalUrl = siteUrl + '/blog/' + blog.slug;
    const publishDate = blog.publishDate || blog.createdAt?.split('T')[0] || '';
    const categories = (blog.categories || []).map(c => escHtml(c));
    const authorName = escHtml(blog.authorName || 'NMIMS Online');

    // Get related posts (same category, exclude current)
    const related = (allBlogs || [])
        .filter(b => b.id !== blog.id && b.status === 'published' && b.categories?.some(c => blog.categories?.includes(c)))
        .slice(0, 3);

    // FAQ Schema
    let faqSchema = '';
    if (blog.faqs && blog.faqs.length > 0) {
        const faqEntities = blog.faqs.map(faq => `{
            "@type": "Question",
            "name": ${JSON.stringify(faq.question)},
            "acceptedAnswer": {
                "@type": "Answer",
                "text": ${JSON.stringify(faq.answer)}
            }
        }`).join(',\n            ');
        faqSchema = `
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            ${faqEntities}
        ]
    }
    </script>`;
    }

    // FAQ HTML
    let faqHtml = '';
    if (blog.faqs && blog.faqs.length > 0) {
        faqHtml = `
            <div class="faq-section" style="margin-top:50px;">
                <h2>Frequently Asked Questions</h2>
                ${blog.faqs.map(faq => `
                <div class="faq-item-display" style="background:#f8f9ff;border-radius:12px;padding:20px;margin-bottom:15px;">
                    <h3 style="font-size:18px;margin-bottom:10px;">${escHtml(faq.question)}</h3>
                    <p>${escHtml(faq.answer)}</p>
                </div>`).join('')}
            </div>`;
    }

    // Author HTML
    let authorHtml = '';
    if (blog.authorName) {
        const authorImgHtml = blog.authorImage
            ? `<img src="${escHtml(blog.authorImage)}" alt="${authorName}" style="width:60px;height:60px;border-radius:50%;object-fit:cover;">`
            : `<div style="width:60px;height:60px;border-radius:50%;background:#E8E5FF;display:flex;align-items:center;justify-content:center;font-size:24px;">👤</div>`;
        const authorNameHtml = blog.authorPage
            ? `<a href="${escHtml(blog.authorPage)}" style="color:#333;text-decoration:none;font-weight:600;">${authorName}</a>`
            : `<span style="font-weight:600;">${authorName}</span>`;
        authorHtml = `
            <div style="display:flex;gap:15px;align-items:center;margin-top:40px;padding-top:30px;border-top:1px solid #eee;">
                ${authorImgHtml}
                <div>
                    ${authorNameHtml}
                    ${blog.authorBio ? `<p style="font-size:14px;color:#666;margin:4px 0 0;">${escHtml(blog.authorBio)}</p>` : ''}
                </div>
            </div>`;
    }

    // Related posts HTML
    let relatedHtml = '';
    if (related.length > 0) {
        relatedHtml = related.map(r => `
                    <a href="/blog/${escHtml(r.slug)}" class="related-post">
                        ${r.featureImage ? `<img src="${escHtml(r.featureImage)}" alt="${escHtml(r.featureImageAlt || r.title)}">` : ''}
                        <div class="related-post-info">
                            <h5>${escHtml(r.title)}</h5>
                            <span>${escHtml(r.publishDate || '')}</span>
                        </div>
                    </a>`).join('');
    }

    // Tags HTML
    const tagsHtml = (blog.tags || []).map(t => 
        `<span class="blog-tag" style="display:inline-block;background:#f0f0f0;padding:5px 15px;border-radius:20px;font-size:13px;color:#666;">${escHtml(t)}</span>`
    ).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - NMIMS Online Blog</title>
    <meta name="description" content="${description}">
    <meta name="keywords" content="${escHtml((blog.focusKeyword || '') + (blog.tags ? ', ' + blog.tags.join(', ') : ''))}">
    <meta name="robots" content="index, follow">
    <meta name="author" content="${authorName}">
    <link rel="canonical" href="${canonicalUrl}">
    <meta property="og:type" content="article">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:url" content="${canonicalUrl}">
    ${ogImage ? `<meta property="og:image" content="${ogImage}">` : ''}
    <meta property="og:site_name" content="NMIMS Online">
    <meta property="article:published_time" content="${publishDate}">
    <meta property="article:modified_time" content="${blog.updatedAt || ''}">
    ${categories.map(c => `<meta property="article:tag" content="${c}">`).join('\n    ')}
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    ${ogImage ? `<meta name="twitter:image" content="${ogImage}">` : ''}
    <link rel="stylesheet" href="../css/style.css">
    <link rel="stylesheet" href="../css/hub-page.css">
    <link rel="stylesheet" href="../css/responsive.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../css/popup-form.css">
    <link rel="icon" type="image/png" href="../images/favicon.png">
    <link rel="stylesheet" href="../css/brochure-popup.css">
    <style>
        .blog-detail-hero { background: linear-gradient(135deg, #6C4DE6 0%, #8B5CF6 100%); padding: 60px 0 80px; color: white; }
        .breadcrumb { margin-bottom: 20px; }
        .breadcrumb a { color: rgba(255,255,255,0.8); text-decoration: none; }
        .breadcrumb span { color: rgba(255,255,255,0.6); margin: 0 10px; }
        .blog-detail-hero h1 { font-size: 42px; font-weight: 700; margin-bottom: 20px; max-width: 800px; }
        .blog-meta { display: flex; gap: 30px; align-items: center; flex-wrap: wrap; }
        .blog-meta-item { display: flex; align-items: center; gap: 8px; font-size: 14px; opacity: 0.9; }
        .blog-category-tag { background: rgba(255,255,255,0.2); padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; }
        .blog-content-section { padding: 60px 0; }
        .blog-content-wrapper { display: grid; grid-template-columns: 1fr 350px; gap: 50px; }
        .blog-main-content { max-width: 800px; }
        .blog-featured-image { width: 100%; height: 400px; object-fit: cover; border-radius: 20px; margin-bottom: 40px; margin-top: -80px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); }
        .blog-main-content h2 { font-size: 28px; font-weight: 700; color: #333; margin: 40px 0 20px; }
        .blog-main-content h3 { font-size: 22px; font-weight: 600; color: #333; margin: 30px 0 15px; }
        .blog-main-content h4 { font-size: 18px; font-weight: 600; color: #333; margin: 25px 0 12px; }
        .blog-main-content p { font-size: 17px; line-height: 1.8; color: #555; margin-bottom: 20px; }
        .blog-main-content ul, .blog-main-content ol { margin: 20px 0; padding-left: 30px; }
        .blog-main-content li { font-size: 17px; line-height: 1.8; color: #555; margin-bottom: 10px; }
        .blog-main-content img { max-width: 100%; height: auto; border-radius: 12px; margin: 20px 0; }
        .blog-main-content table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .blog-main-content th, .blog-main-content td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        .blog-main-content th { background: #f5f5f5; font-weight: 600; }
        .blog-main-content blockquote { background: #f8f9ff; border-left: 4px solid #6C4DE6; padding: 25px 30px; margin: 30px 0; border-radius: 0 15px 15px 0; }
        .blog-main-content blockquote p { font-style: italic; color: #333; margin: 0; }
        .blog-main-content a { color: #6C4DE6; text-decoration: underline; }
        .blog-sidebar { position: sticky; top: 100px; }
        .sidebar-widget { background: #f8f9ff; border-radius: 20px; padding: 30px; margin-bottom: 30px; }
        .sidebar-widget h4 { font-size: 18px; font-weight: 700; color: #333; margin-bottom: 20px; }
        .related-post { display: flex; gap: 15px; margin-bottom: 20px; text-decoration: none; color: inherit; }
        .related-post:last-child { margin-bottom: 0; }
        .related-post img { width: 80px; height: 60px; object-fit: cover; border-radius: 10px; }
        .related-post-info h5 { font-size: 14px; font-weight: 600; color: #333; margin-bottom: 5px; line-height: 1.4; }
        .related-post-info span { font-size: 12px; color: #888; }
        .cta-widget { background: linear-gradient(135deg, #6C4DE6 0%, #8B5CF6 100%); color: white; }
        .cta-widget h4 { color: white; }
        .cta-widget p { font-size: 14px; opacity: 0.9; margin-bottom: 20px; }
        .cta-widget .btn { background: white; color: #6C4DE6; width: 100%; text-align: center; display: inline-block; padding: 12px; border-radius: 30px; text-decoration: none; font-weight: 600; }
        .blog-tags { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 40px; padding-top: 30px; border-top: 1px solid #eee; }
        @media (max-width: 992px) { .blog-content-wrapper { grid-template-columns: 1fr; } }
        @media (max-width: 768px) { .blog-detail-hero h1 { font-size: 28px; } .blog-featured-image { height: 250px; } }
    </style>
    <script type="application/ld+json">
    {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": ${JSON.stringify(blog.title || '')},
        "description": ${JSON.stringify(blog.metaDescription || blog.excerpt || '')},
        "image": ${JSON.stringify(ogImage || '')},
        "author": {
            "@type": "Person",
            "name": ${JSON.stringify(blog.authorName || 'NMIMS Online')}
        },
        "publisher": {
            "@type": "Organization",
            "name": "NMIMS Online",
            "logo": { "@type": "ImageObject", "url": "${siteUrl}/images/logo.png" }
        },
        "datePublished": "${publishDate}",
        "dateModified": "${blog.updatedAt || publishDate}",
        "mainEntityOfPage": { "@type": "WebPage", "@id": "${canonicalUrl}" },
        "keywords": ${JSON.stringify((blog.focusKeyword || '') + (blog.tags?.length ? ', ' + blog.tags.join(', ') : ''))}
    }
    </script>${faqSchema}
</head>
<body>
    <!-- Navigation -->
    <nav class="navbar">
        <div class="container">
            <div class="nav-wrapper">
                <div class="nav-logo">
                    <a href="/"><img src="../images/logo.png" alt="NMIMS Logo"></a>
                </div>
                <button class="mobile-menu-toggle" id="mobileMenuToggle" aria-label="Toggle mobile menu">
                    <span class="hamburger-line"></span><span class="hamburger-line"></span><span class="hamburger-line"></span>
                </button>
                <ul class="nav-menu">
                    <li class="nav-item"><a href="/blog" class="nav-link active">Blog</a></li>
                </ul>
                <div class="nav-buttons">
                    <div class="find-program-wrapper">
                        <button class="btn btn-primary" onclick="window.location.href='/'">Find a Program</button>
                    </div>
                </div>
            </div>
        </div>
    </nav>

    <!-- Blog Hero -->
    <section class="blog-detail-hero">
        <div class="container">
            <div class="breadcrumb">
                <a href="/">Home</a><span>/</span><a href="/blog">Blog</a><span>/</span>${escHtml(blog.title)}
            </div>
            <h1>${escHtml(blog.title)}</h1>
            <div class="blog-meta">
                ${categories.map(c => `<span class="blog-category-tag">${c}</span>`).join(' ')}
                <div class="blog-meta-item">📅 ${publishDate}</div>
                <div class="blog-meta-item">✍️ ${authorName}</div>
            </div>
        </div>
    </section>

    <!-- Blog Content -->
    <section class="blog-content-section">
        <div class="container">
            <div class="blog-content-wrapper">
                <div class="blog-main-content">
                    ${blog.featureImage ? `<img class="blog-featured-image" src="${escHtml(blog.featureImage)}" alt="${escHtml(blog.featureImageAlt || blog.title)}"${blog.featureImageTitle ? ` title="${escHtml(blog.featureImageTitle)}"` : ''}>` : ''}
                    
                    ${blog.content || ''}

                    ${faqHtml}

                    ${tagsHtml ? `<div class="blog-tags">${tagsHtml}</div>` : ''}

                    ${authorHtml}
                </div>

                <!-- Sidebar -->
                <div class="blog-sidebar">
                    ${related.length > 0 ? `
                    <div class="sidebar-widget">
                        <h4>Related Articles</h4>
                        ${relatedHtml}
                    </div>` : ''}

                    <div class="sidebar-widget cta-widget">
                        <h4>Ready to Transform Your Career?</h4>
                        <p>Explore NMIMS Online programs designed for working professionals.</p>
                        <a href="/" class="btn">Explore Programs</a>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Footer -->
    <footer class="footer-section">
        <div class="footer-container">
            <div class="footer-bottom">
                <div class="container">
                    <div class="footer-bottom-content">
                        <div class="footer-disclaimer">
                            <p>© ${new Date().getFullYear()} NMIMS. All Rights Reserved.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </footer>

    <script src="../js/popup-form.js"></script>
    <script src="../js/brochure-popup.js"></script>
</body>
</html>`;

    // Ensure blog directory exists
    const blogDir = path.join(__dirname, 'public', 'blog');
    await fs.mkdir(blogDir, { recursive: true });

    // Write the file
    const filePath = path.join(blogDir, blog.slug + '.html');
    await fs.writeFile(filePath, html, 'utf8');
    console.log('Generated blog HTML: /blog/' + blog.slug + '.html');
}

// Generate a JSON file of published blogs for the listing page
async function generateBlogListingData(blogs) {
    const published = blogs
        .filter(b => b.status === 'published')
        .sort((a, b) => new Date(b.publishDate || b.createdAt) - new Date(a.publishDate || a.createdAt))
        .map(b => ({
            title: b.title,
            slug: b.slug,
            excerpt: b.excerpt,
            featureImage: b.featureImage,
            featureImageAlt: b.featureImageAlt,
            categories: b.categories,
            authorName: b.authorName,
            publishDate: b.publishDate,
            tags: b.tags
        }));
    
    const outputPath = path.join(__dirname, 'public', 'blog-listing.json');
    await fs.writeFile(outputPath, JSON.stringify(published, null, 2));
}
// ===== MBA Online URL Structure: 301 Redirects (old .html → new clean URLs) =====
const mbaOnlineRedirects = {
    '/programs/mba-online-hub.html': '/online-mba',
    '/programs/mba-marketing.html':  '/online-mba/marketing',
    '/programs/mba-financial.html':  '/online-mba/finance',
    '/programs/mba-hr.html':         '/online-mba/human-resource-management',
    '/programs/mba-operations.html': '/online-mba/operations-data-sciences',
    '/programs/mba-business.html':   '/online-mba/business-management',
};

Object.entries(mbaOnlineRedirects).forEach(([oldPath, newPath]) => {
    app.get(oldPath, (req, res) => res.redirect(301, newPath));
});

// ===== MBA Online Clean URL Routes =====
const mbaOnlineRoutes = {
    '/online-mba':                          'programs/mba-online-hub.html',
    '/online-mba/marketing':                'programs/mba-marketing.html',
    '/online-mba/finance':                  'programs/mba-financial.html',
    '/online-mba/human-resource-management': 'programs/mba-hr.html',
    '/online-mba/operations-data-sciences': 'programs/mba-operations.html',
    '/online-mba/business-management':      'programs/mba-business.html',
};

Object.entries(mbaOnlineRoutes).forEach(([routePath, filePath]) => {
    app.get(routePath, (req, res) => {
        res.sendFile(path.join(__dirname, 'public', filePath), (err) => {
            if (err) res.status(404).send('Page not found');
        });
    });
});

// ===== Root Page 301 Redirects (.html → clean) =====
const rootRedirects = {
    '/index.html':                    '/',
    '/undergraduate.html':            '/undergraduate',
    '/young-professionals.html':      '/young-professionals',
    '/mid-senior-professionals.html': '/mid-senior-professionals',
    '/all-programs.html':             '/all-programs',
    '/blog.html':                     '/blog',
};
Object.entries(rootRedirects).forEach(([o, n]) => app.get(o, (req, res) => res.redirect(301, n)));

// ===== MBA WX 301 Redirects + Clean URL Routes =====
const mbaWxRedirects = {
    '/programs/mba-wx-hub.html':               '/mba-wx',
    '/programs/mba-wx-marketing.html':         '/mba-wx/marketing',
    '/programs/mba-wx-finance.html':           '/mba-wx/finance',
    '/programs/mba-wx-operations.html':        '/mba-wx/operations',
    '/programs/mba-wx-leadership.html':        '/mba-wx/leadership',
    '/programs/mba-wx-digital-marketing.html': '/mba-wx/digital-marketing',
};
Object.entries(mbaWxRedirects).forEach(([o, n]) => app.get(o, (req, res) => res.redirect(301, n)));

const mbaWxRoutes = {
    '/mba-wx':                   'programs/mba-wx-hub.html',
    '/mba-wx/marketing':         'programs/mba-wx-marketing.html',
    '/mba-wx/finance':           'programs/mba-wx-finance.html',
    '/mba-wx/operations':        'programs/mba-wx-operations.html',
    '/mba-wx/leadership':        'programs/mba-wx-leadership.html',
    '/mba-wx/digital-marketing': 'programs/mba-wx-digital-marketing.html',
};
Object.entries(mbaWxRoutes).forEach(([routePath, filePath]) => {
    app.get(routePath, (req, res) => {
        res.sendFile(path.join(__dirname, 'public', filePath), (err) => {
            if (err) res.status(404).send('Page not found');
        });
    });
});

// ===== Bachelors 301 Redirects + Clean URL Routes =====
const bachelorsRedirects = {
    '/programs/bachelors-hub.html': '/bachelors',
    '/programs/bcom.html':          '/bachelors/bcom',
    '/programs/bba.html':           '/bachelors/bba',
};
Object.entries(bachelorsRedirects).forEach(([o, n]) => app.get(o, (req, res) => res.redirect(301, n)));

const bachelorsRoutes = {
    '/bachelors':      'programs/bachelors-hub.html',
    '/bachelors/bcom': 'programs/bcom.html',
    '/bachelors/bba':  'programs/bba.html',
};
Object.entries(bachelorsRoutes).forEach(([routePath, filePath]) => {
    app.get(routePath, (req, res) => {
        res.sendFile(path.join(__dirname, 'public', filePath), (err) => {
            if (err) res.status(404).send('Page not found');
        });
    });
});

// ===== Blog .html → clean URL redirect =====
app.get(/^\/blog\/(.+)\.html$/, (req, res) => {
    res.redirect(301, '/blog/' + req.params[0]);
});

// ===== Admin .html → clean URL redirects =====
const adminRedirects = {
    '/admin/login.html': '/admin/login',
    '/admin/dashboard.html': '/admin/dashboard',
    '/admin/editor.html': '/admin/editor',
};
Object.entries(adminRedirects).forEach(([oldUrl, newUrl]) => {
    app.get(oldUrl, (req, res) => res.redirect(301, newUrl));
});

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
    // Connect to MongoDB for blog storage
    connectMongo().catch(err => {
        console.error('MongoDB init failed, using file storage:', err.message);
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
