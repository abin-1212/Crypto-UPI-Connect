import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const adminMiddleware = async (req, res, next) => {
    try {
        // Get token from header
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ error: 'No token, authorization denied' });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Find user
        const user = await User.findById(decoded.userId || decoded.id); // Handling varying payload keys

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        // Check if user is admin
        if (user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error("Admin Middleware Error:", error.message);
        res.status(401).json({ error: 'Token is not valid' });
    }
};

export default adminMiddleware;
