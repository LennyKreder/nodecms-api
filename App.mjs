import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import env from "dotenv";
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

env.config();
const app = express();
const port = process.env.APP_PORT;

// Create a connection to the MySQL database
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Middleware for token verification
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(403).json({ message: 'No token provided' });

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ message: 'Unauthorized' });
        req.userId = decoded.id;
        next();
    });
};

// Middleware
app.use(bodyParser.json());
app.use(cors({
    origin: "*",
    methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH']
}));

app.get("/", (req, res) => {
    res.send("Welcome to Nodecms");
});

app.get("/homepage", async (req, res) => {
    try {
        // Get connection from pool
        const connection = await db.getConnection();

        // Use "1" as a string to match exactly
        const [rows] = await connection.execute('SELECT * FROM pages WHERE homepage = ? LIMIT 1', ["1"]);

        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).json({ error: 'Homepage not found' });
        }

        connection.release();
    } catch (error) {
        console.error('Error connecting to the database:', error);
        res.status(500).json({ error: 'Error fetching homepage from the database' });
    }
});

// Public route to get all pages with limited fields
app.get("/pages", async (req, res) => {
    try {
        const connection = await db.getConnection();
        const [rows] = await connection.execute('SELECT title, content FROM pages ORDER BY position');
        res.json(rows);
        connection.release();
    } catch (error) {
        console.error('Error fetching pages:', error);
        res.status(500).json({ error: 'Error fetching pages from the database' });
    }
});

// Public route to fetch only title and content of a single page by ID
app.get("/page/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const connection = await db.getConnection();
        const [rows] = await connection.execute("SELECT title, content FROM pages WHERE id = ?", [id]);
        connection.release();

        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).json({ message: `Page with id ${id} not found.` });
        }
    } catch (error) {
        console.error('Error fetching page:', error);
        res.status(500).json({ message: 'An error occurred while fetching the page.' });
    }
});

// Protected route for admin to fetch all pages
app.get("/admin/pages", verifyToken, async (req, res) => {
    try {
        const connection = await db.getConnection();
        const [rows] = await connection.execute('SELECT * FROM pages ORDER BY position');
        //console.log("Fetched pages:", rows);  // Log fetched data for verification
        res.json(rows);
        connection.release();
    } catch (error) {
        console.error('Error fetching pages:', error);
        res.status(500).json({ error: 'Error fetching pages from the database' });
    }
});

// Protected route for reordering pages
app.post('/admin/pages/reorder', verifyToken, async (req, res) => {
    const { orderedPageIds } = req.body;

    // Check that the data format is correct
    if (!orderedPageIds || !Array.isArray(orderedPageIds)) {
        return res.status(400).json({ message: 'Invalid data format' });
    }

    try {
        const connection = await db.getConnection();

        // Update each page's position based on the array index
        for (let i = 0; i < orderedPageIds.length; i++) {
            const pageId = orderedPageIds[i];
            await connection.execute('UPDATE pages SET position = ? WHERE id = ?', [i, pageId]);
        }

        connection.release();
        res.status(200).json({ message: 'Page order updated successfully' });
    } catch (error) {
        console.error('Error updating page order:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Protected route for admin to fetch all data of a single page by ID
app.get("/admin/page/:id", verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        const connection = await db.getConnection();
        const [rows] = await connection.execute("SELECT * FROM pages WHERE id = ?", [id]);
        connection.release();
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).json({ message: `Page with id ${id} not found.` });
        }
    } catch (error) {
        console.error('Error fetching page:', error);
        res.status(500).json({ message: 'An error occurred while fetching the page.' });
    }
});

// Protected route for admin to create a new page
app.post("/admin/page", verifyToken, async (req, res) => {
    const { title, content, slug } = req.body;
    try {
        const connection = await db.getConnection();
        const [result] = await connection.execute("INSERT INTO pages (title, content, slug) VALUES (?, ?, ?)", [title, content, slug]);
        connection.release();

        res.status(201).json({ message: "Page successfully created.", pageId: result.insertId });
    } catch (err) {
        console.error('Error creating page:', err);
        res.status(500).json({ error: "An error occurred while creating the page." });
    }
});

// Protected route for admin to update a page
app.put("/admin/page/:id", verifyToken, async (req, res) => {
    const { id } = req.params;
    const { title, content, slug } = req.body;
    try {
        const connection = await db.getConnection();
        const [result] = await connection.execute("UPDATE pages SET title = ?, content = ?, slug = ? WHERE id = ?", [title, content, slug, id]);
        connection.release();

        if (result.affectedRows > 0) {
            res.json({ message: `Page with id: ${id} successfully updated.` });
        } else {
            res.status(404).json({ error: `Page with id: ${id} not found.` });
        }
    } catch (error) {
        console.error('Error updating page:', error);
        res.status(500).json({ error: "An error occurred while updating the page." });
    }
});

// Protected route for admin to partially update a page
app.patch("/admin/page/:id", verifyToken, async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    try {
        const connection = await db.getConnection();

        const fields = Object.keys(updates).map(field => `${field} = ?`).join(", ");
        const values = Object.values(updates);

        const [result] = await connection.execute(`UPDATE pages SET ${fields} WHERE id = ?`, [...values, id]);
        connection.release();

        if (result.affectedRows > 0) {
            res.json({ message: `Page with id: ${id} successfully updated.` });
        } else {
            res.status(404).json({ error: `Page with id: ${id} not found.` });
        }
    } catch (error) {
        console.error('Error in PATCH /admin/page/:id:', error);
        res.status(500).json({ error: "An error occurred while updating the page." });
    }
});

// Protected route for admin to delete a page
app.delete("/admin/page/:id", verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        const connection = await db.getConnection();
        const [result] = await connection.execute("DELETE FROM pages WHERE id = ?", [id]);
        connection.release();

        if (result.affectedRows > 0) {
            res.json({ message: `Page with id: ${id} successfully deleted.` });
        } else {
            res.status(404).json({ error: `Page with id: ${id} not found.` });
        }
    } catch (error) {
        console.error('Error deleting page:', error);
        res.status(500).json({ error: "An error occurred while deleting the page." });
    }
});

// Register new admin user
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const connection = await db.getConnection();
        await connection.execute('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
        connection.release();
        res.status(201).json({ message: 'Admin user created successfully' });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ error: 'Failed to register user' });
    }
});

// Login route with JWT generation
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const connection = await db.getConnection();
        const [rows] = await connection.execute('SELECT * FROM users WHERE username = ?', [username]);
        connection.release();

        if (rows.length === 0) return res.status(401).json({ message: 'Invalid credentials' });
        const user = rows[0];

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) return res.status(401).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}.`);
});