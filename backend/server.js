import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db.js';
import userRoutes from './routes/userRoutes.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';

dotenv.config();
connectDB();

const app = express();

// ================ CORS CONFIGURATION (FULL + WORKING) ==================
    const whitelist = [
        "http://localhost:3000",
        "https://lumina-marketplace.onrender.com",
        "https://lumina-marketplace-frontend.up.railway.app",
        "https://jharkhand-ecom.onrender.com"
    ];

    const corsOptions = {
        origin: function (origin, callback) {
            if (!origin) return callback(null, true);

            if (whitelist.includes(origin)) {
                callback(null, true);
            } else {
                console.log("❌ CORS BLOCKED:", origin);
                callback(new Error("Not allowed by CORS"));
            }
        },
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true
    };

    app.use(cors(corsOptions));
    app.options(/.*/, cors(corsOptions));

// ========================================================================

// Increase payload limit
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ limit: "200mb", extended: true }));

// Test route
app.get("/", (req, res) => {
    res.send("API is running...");
});

// Routes
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);

// Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
