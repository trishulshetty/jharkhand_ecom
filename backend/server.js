import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors'; // Make sure cors is imported
import connectDB from './config/db.js';
import userRoutes from './routes/userRoutes.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';

dotenv.config();
connectDB();

const app = express();

// --- CORS Configuration ---
// This is the crucial part that fixes the connection issue.
const whitelist = [
    'http://localhost:3000', // for local development
    'https://jharkhand-ecom.onrender.com' // your live frontend URL
];

const corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1 || !origin) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  }
};

app.use(cors(corsOptions));
// --- End of CORS Configuration ---


app.use(express.json({ limit: '50mb' })); // Increased limit for base64 images

app.get('/', (req, res) => {
    res.send('API is running...');
});

app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, console.log(`Server running on port ${PORT}`));

