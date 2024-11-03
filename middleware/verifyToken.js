// middleware/verifyToken.js
import jwt from 'jsonwebtoken';

export const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];  // Expect token in "Authorization: Bearer <token>" format

    if (!token) {
        return res.status(403).json({ message: 'No token provided' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        req.userId = decoded.id;  // Attach userId to the request if needed
        next();
    });
};