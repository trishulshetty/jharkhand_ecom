import express from 'express';
import { protect } from '../utils/authMiddleware.js';
import Order from '../models/orderModel.js';
import Product from '../models/productModel.js';
import Stripe from 'stripe';

import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();

// Initialize Stripe but handle missing key for simulated environment
let stripe;
if (process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
} else {
    console.warn("Stripe secret key not found. Real payments will not work.");
}


/**
 * @desc    Create a Stripe payment intent (for real payments)
 * @route   POST /api/orders/create-payment-intent
 * @access  Private
 * This endpoint is for when you want to enable real Stripe payments.
 */
router.post('/create-payment-intent', protect, async (req, res) => {
    if (!stripe) {
        return res.status(500).send({ message: "Stripe is not configured on the server." });
    }
    const { amount } = req.body;
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Stripe expects cents
            currency: 'usd',
            payment_method_types: ['card'],
        });
        res.send({
            clientSecret: paymentIntent.client_secret,
        });
    } catch (error) {
        console.error("Stripe Error:", error.message);
        res.status(400).send({ message: "Failed to create payment intent", error: error.message });
    }
});


/**
 * @desc    Create a new order (works with both real and simulated payments)
 * @route   POST /api/orders
 * @access  Private
 */
router.post('/', protect, async (req, res) => {
    const { orderItems, shippingAddress, totalPrice, paymentIntentId } = req.body;

    if (!orderItems || orderItems.length === 0) {
        return res.status(400).send({ message: 'No order items' });
    }

    try {
        const order = new Order({
            buyer: req.user._id, // Corrected from 'user' to 'buyer' to match schema
            // Explicitly map only the required fields for order items
            orderItems: orderItems.map(item => ({
                name: item.name,
                qty: item.qty,
                image: item.images[0], // Corrected to use a single image string
                price: item.price,
                product: item._id, 
                seller: item.seller, // Added missing seller field
            })),
            shippingAddress,
            totalPrice,
            isPaid: true, // Marked as paid for both real and simulated flows
            paidAt: Date.now(),
            paymentResult: {
                id: paymentIntentId, // This will be real from Stripe or faked by the frontend
                status: 'succeeded',
                update_time: Date.now(),
                email_address: req.user.email,
            }
        });

        // Decrement stock count for each product ordered
        for (const item of order.orderItems) {
            await Product.updateOne({ _id: item.product }, { $inc: { countInStock: -item.qty } });
        }

        const createdOrder = await order.save();
        res.status(201).json(createdOrder);
    } catch (error) {
        console.error("Error creating order:", error);
        res.status(500).json({ message: 'Server Error', details: error.message });
    }
});


/**
 * @desc    Get logged in user's orders
 * @route   GET /api/orders/myorders
 * @access  Private
 */
router.get('/myorders', protect, async (req, res) => {
    try {
        const orders = await Order.find({ buyer: req.user._id }).sort({ createdAt: -1 }); // Corrected to find by 'buyer'
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});


/**
 * @desc    Get orders containing products sold by the logged-in seller
 * @route   GET /api/orders/seller
 * @access  Private/Seller
 */
router.get('/seller', protect, async (req, res) => {
    if (req.user.role !== 'seller') {
        return res.status(403).json({ message: 'Not authorized as a seller' });
    }

    try {
        const sellerProducts = await Product.find({ seller: req.user._id }).select('_id');
        const productIds = sellerProducts.map(p => p._id);
        
        const orders = await Order.find({ 'orderItems.product': { $in: productIds } })
            .populate('buyer', 'name email') // Populating 'buyer' instead of 'user'
            .sort({ createdAt: -1 });

        const sellerSpecificOrders = orders.map(order => {
            const sellerItems = order.orderItems.filter(item => 
                productIds.some(pId => pId.equals(item.product))
            );
            
            return {
                _id: order._id,
                buyer: order.buyer, // Corrected from 'user' to 'buyer'
                createdAt: order.createdAt,
                shippingAddress: order.shippingAddress,
                isPaid: order.isPaid,
                orderItems: sellerItems,
                totalPrice: sellerItems.reduce((acc, item) => acc + item.price * item.qty, 0)
            };
        }).filter(order => order.orderItems.length > 0);
        
        res.json(sellerSpecificOrders);

    } catch (error) {
        console.error('Error fetching seller orders:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});

export default router;

