import express from 'express';
import Product from '../models/productModel.js';
import { protect, seller } from '../utils/authMiddleware.js';

const router = express.Router();

// @desc    Fetch all products
// @route   GET /api/products
// @access  Public
router.get('/', async (req, res) => {
  const products = await Product.find({});
  res.json(products);
});

// @desc    Fetch own products
// @route   GET /api/products/mine
// @access  Private/Seller
router.get('/mine', protect, seller, async (req, res) => {
  const products = await Product.find({ seller: req.user._id }).sort({ createdAt: -1 });
  res.json(products);
});

// @desc    Fetch single product
// @route   GET /api/products/:id
// @access  Public
router.get('/:id', async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (product) {
    res.json(product);
  } else {
    res.status(404).json({ message: 'Product not found' });
  }
});

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Seller
router.post('/', protect, seller, async (req, res) => {
  const { name, price, description, images, countInStock } = req.body;

  const product = new Product({
    name,
    price,
    seller: req.user._id,
    images,
    countInStock,
    description,
  });

  const createdProduct = await product.save();
  res.status(201).json(createdProduct);
});

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Seller
router.put('/:id', protect, seller, async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }
  if (product.seller.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Not authorized to update this product' });
  }

  const { name, price, description, images, countInStock } = req.body;
  if (name !== undefined) product.name = name;
  if (price !== undefined) product.price = price;
  if (description !== undefined) product.description = description;
  if (countInStock !== undefined) product.countInStock = countInStock;
  if (images !== undefined) product.images = images;

  const updated = await product.save();
  res.json(updated);
});

export default router;

