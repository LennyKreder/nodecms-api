import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import env from "dotenv";
import mysql from 'mysql2/promise';

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

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors({
    origin: "*",
    methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH']
}))

app.get("/", (req, res) => {
    res.send("Welcome to Keep");
});

app.get("/notes", async (req, res) => {
    try {
        //Get connection from pool
        const connection = await db.getConnection();

        const [rows] = await connection.execute('SELECT * from notes');
        res.json(rows);

        // Release the connection back to the pool
        connection.release();

    } catch (error) {
        console.error('Error connecting to the database:', error);
        res.status(500).json({ error: 'Error fetching notes from the database' });
    }
});

app.post("/note", async (req, res) => {
    const { title, content } = req.body; // Expecting title and content in the request body
    let connection;

    try {
        connection = await db.getConnection(); // Get a connection from the pool

        // Insert the new note
        const [result] = await connection.query("INSERT INTO notes (title, content) VALUES (?, ?)", [title, content]);

        // Fetch the newly created note
        const [newNote] = await connection.query("SELECT * FROM notes WHERE id = ?", [result.insertId]);

        res.status(201).json({ message: "Note successfully created.", newNote: newNote[0] });
    } catch (err) {
        console.error('Error in POST /note:', err);
        res.status(500).json({ error: "An error occurred while creating the note." });
    } finally {
        if (connection) {
            connection.release(); // Release the connection back to the pool
        }
    }
});

app.patch("/note/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const note = req.body;
    console.log(note);
    let connection;

    try {
        connection = await db.getConnection(); // Get a connection from the pool

        // Update the note
        await connection.query("UPDATE notes SET title = ?, content = ? WHERE id = ?", [note.title, note.content, id]);

        // Fetch the updated note
        const [updatedNote] = await connection.query("SELECT * FROM notes WHERE id = ?", [id]);

        if (updatedNote.length > 0) {
            res.json({ message: `Note with id: ${id} successfully updated.`, updatedNote: updatedNote[0] });
        } else {
            res.status(404).json({ error: `Note with id: ${id} not found. No notes were updated.` });
        }
    } catch (err) {
        console.error('Error in PATCH /note/:id:', err);
        res.status(500).json({ error: `Note with id: ${id} not updated, an error occurred.` });
    } finally {
        if (connection) {
            connection.release(); // Release the connection back to the pool
        }
    }
});

app.put("/note/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const { title, content } = req.body; // Expecting the complete representation of the note
    let connection;

    try {
        connection = await db.getConnection(); // Get a connection from the pool

        // Update the note
        const [result] = await connection.query("UPDATE notes SET title = ?, content = ? WHERE id = ?", [title, content, id]);

        if (result.affectedRows > 0) {
            // Fetch the updated note
            const [updatedNote] = await connection.query("SELECT * FROM notes WHERE id = ?", [id]);
            res.json({ message: `Note with id: ${id} successfully updated.`, updatedNote: updatedNote[0] });
        } else {
            res.status(404).json({ error: `Note with id: ${id} not found. No notes were updated.` });
        }
    } catch (err) {
        console.error('Error in PUT /note/:id:', err);
        res.status(500).json({ error: `Note with id: ${id} not updated, an error occurred.` });
    } finally {
        if (connection) {
            connection.release(); // Release the connection back to the pool
        }
    }
});

app.delete("/note/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    let connection;

    try {
        connection = await db.getConnection(); // Get a connection from the pool

        // Delete the note
        const [result] = await connection.query("DELETE FROM notes WHERE id = ?", [id]);

        if (result.affectedRows > 0) {
            res.json({ message: `Note with id: ${id} successfully deleted.` });
        } else {
            res.status(404).json({ error: `Note with id: ${id} not found. No notes were deleted.` });
        }
    } catch (err) {
        console.error('Error in DELETE /note/:id:', err);
        res.status(500).json({ error: `Note with id: ${id} not deleted, an error occurred.` });
    } finally {
        if (connection) {
            connection.release(); // Release the connection back to the pool
        }
    }
});

app.listen(3000, () => {
    console.log(`Server running on port ${port}.`);
});