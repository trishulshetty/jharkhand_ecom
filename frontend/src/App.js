import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import './App.css';

// --- Global Config ---
const API_URL = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api`;

// This is your public key, it's safe to be here.
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51SBi3L7cTFRYZBmvme4HtkAvE4naWHZIleb90F6FzPV16ZGYeub4K12vtiXuu8VoU15yUKhOldC2h3Go5llxZLlD00v4iof5Fq';
const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

// --- Notification Component ---
function Notification({ message, type }) {
    return <div className={`notification ${type}`}>{message}</div>;
}

// --- Main App Component ---
function App() {
    const location = useLocation();
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState([]);
    const [notification, setNotification] = useState(null);
    const [checkoutData, setCheckoutData] = useState(null);

    const showNotification = (message, type = 'info') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    useEffect(() => {
        // Handle redirect from 404.html
        const redirectPath = sessionStorage.getItem('redirectPath');
        if (redirectPath) {
            sessionStorage.removeItem('redirectPath');
            navigate(redirectPath, { replace: true });
        }
    }, [navigate]);

    useEffect(() => {
        const storedUser = localStorage.getItem('userInfo');
        if (storedUser) setUser(JSON.parse(storedUser));
        const storedCart = localStorage.getItem('cart');
        if (storedCart) setCart(JSON.parse(storedCart));
        fetchProducts();
    }, []);
    
    useEffect(() => {
        localStorage.setItem('cart', JSON.stringify(cart));
    }, [cart]);

    const fetchProducts = async () => {
        try {
            const { data } = await axios.get(`${API_URL}/products`);
            setProducts(data);
        } catch (error) {
            console.error('Error fetching products:', error);
        }
    };

    const handleLogin = (userInfo) => {
        setUser(userInfo);
        localStorage.setItem('userInfo', JSON.stringify(userInfo));
    };

    const handleLogout = () => {
        setUser(null);
        setCart([]);
        localStorage.removeItem('userInfo');
        localStorage.removeItem('cart');
    };
    
    const addToCart = (product, qty = 1) => {
        const existItem = cart.find((x) => x._id === product._id);
        if (existItem) {
            setCart(cart.map((x) => x._id === existItem._id ? { ...x, qty: x.qty + qty } : x));
        } else {
            setCart([...cart, { ...product, qty }]);
        }
    };
    
    const updateCartQty = (productId, qty) => {
        const newQty = Number(qty);
        if (newQty < 1) return;
        setCart(cart.map(item => item._id === productId ? {...item, qty: newQty } : item));
    };
    
    const removeFromCart = (productId) => {
        setCart(cart.filter(item => item._id !== productId));
    };
    
    const startCheckout = (cartData, addressData) => {
        setCheckoutData({ cart: cartData, shippingAddress: addressData });
    };

    return (
        <div className="app-container">
            {notification && <Notification message={notification.message} type={notification.type} />}
            <Header user={user} onLogout={handleLogout} cartCount={cart.reduce((acc, item) => acc + item.qty, 0)} />
            <main>
                <Routes>
                    <Route path="/" element={<HomePage products={products} />} />
                    <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
                    <Route path="/register" element={<RegisterPage onLogin={handleLogin} />} />
                    <Route path="/p/:slug" element={<ProductDetailPage products={products} addToCart={addToCart} showNotification={showNotification} />} />
                    <Route path="/cart" element={<CartPage cart={cart} updateCartQty={updateCartQty} removeFromCart={removeFromCart} user={user} showNotification={showNotification} startCheckout={startCheckout} />} />
                    <Route path="/redirecting" element={<RedirectingPage />} />
                    <Route path="/payment" element={
                        <Elements stripe={stripePromise}>
                            <PaymentPage user={user} checkoutData={checkoutData} showNotification={showNotification} clearCart={() => setCart([])} />
                        </Elements>
                    } />
                    <Route path="/order-success" element={<OrderSuccessPage />} />
                    <Route path="/my-orders" element={<MyOrdersPage user={user} />} />
                    <Route path="/seller-dashboard" element={<SellerDashboard user={user} />} />
                    <Route path="/add-product" element={<AddProductPage user={user} fetchProducts={fetchProducts} showNotification={showNotification} />} />
                    <Route path="/manage-products" element={<ManageProductsPage user={user} showNotification={showNotification} />} />
                    <Route path="/manage-orders" element={<SellerOrdersPage user={user} />} />
                </Routes>
            </main>
            <Footer />
        </div>
    );
}

// --- Page Components ---

function RedirectingPage() {
    const navigate = useNavigate();
    useEffect(() => {
        const timer = setTimeout(() => {
            navigate('/payment');
        }, 3000);
        return () => clearTimeout(timer);
    }, [navigate]);

    return (
        <div className="redirecting-page">
            <div className="redirecting-box card glass">
                <h2>Finalizing Your Order...</h2>
                <p>Redirecting to our secure payment page.</p>
                <div className="spinner"></div>
            </div>
        </div>
    );
}

function PaymentPage({ user, checkoutData, showNotification, clearCart }) {
    const navigate = useNavigate();
    useEffect(() => {
        if (!checkoutData) {
            navigate('/cart');
        }
    }, [checkoutData, navigate]);

    if (!checkoutData) {
        return null; // or a loading indicator
    }

    return (
        <div className="page-container payment-page-container">
            <div className="card payment-card">
                 <h2>Complete Your Payment</h2>
                 <p>Please enter your card details below.</p>
                <CheckoutForm
                    user={user}
                    cart={checkoutData.cart}
                    shippingAddress={checkoutData.shippingAddress}
                    showNotification={showNotification}
                    navigate={navigate}
                    clearCart={clearCart}
                />
            </div>
        </div>
    );
}

function CheckoutForm({ user, cart, shippingAddress, showNotification, navigate, clearCart }) {
    const stripe = useStripe();
    const elements = useElements();
    const [processing, setProcessing] = useState(false);
    const totalPrice = cart.reduce((acc, item) => acc + item.qty * item.price, 0);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!stripe || !elements) return;
        setProcessing(true);

        try {
            const { data: { clientSecret } } = await axios.post(
                `${API_URL}/orders/create-payment-intent`,
                { amount: totalPrice },
                { headers: { Authorization: `Bearer ${user.token}` } }
            );

            const { paymentIntent, error: paymentError } = await stripe.confirmCardPayment(clientSecret, {
                payment_method: {
                    card: elements.getElement(CardElement),
                    billing_details: { name: user.name, email: user.email },
                },
            });

            if (paymentError) {
                showNotification(paymentError.message, 'error');
                setProcessing(false);
                return;
            }

            if (paymentIntent.status === 'succeeded') {
                const orderData = {
                    orderItems: cart,
                    shippingAddress,
                    totalPrice,
                    paymentIntentId: paymentIntent.id,
                };
                await axios.post(`${API_URL}/orders`, orderData, {
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` }
                });
                
                showNotification('Payment successful! Order placed.', 'success');
                clearCart();
                navigate('/order-success');
            }
        } catch (error) {
            console.error('Checkout error:', error);
            showNotification('An unexpected error occurred.', 'error');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="stripe-form">
            <CardElement options={{ style: { base: { fontSize: '16px', '::placeholder': { color: '#aab7c4' } } } }} />
            <button type="submit" disabled={!stripe || processing} className="pay-button">
                {processing ? 'Processing...' : `Pay $${totalPrice.toFixed(2)}`}
            </button>
        </form>
    );
}

function CartPage({ cart, updateCartQty, removeFromCart, user, showNotification, startCheckout }) {
    const navigate = useNavigate();
    const [shippingAddress, setShippingAddress] = useState({ address: '', city: '', postalCode: '', country: '' });

    const handleInputChange = (e) => {
        setShippingAddress({ ...shippingAddress, [e.target.name]: e.target.value });
    };

    const handleProceedToCheckout = () => {
        if (!user) {
            showNotification('Please log in to proceed.', 'error');
            navigate('/login');
            return;
        }
        if (!shippingAddress.address || !shippingAddress.city || !shippingAddress.postalCode || !shippingAddress.country) {
            showNotification('Please fill in all shipping address fields.', 'error');
            return;
        }
        startCheckout(cart, shippingAddress);
        navigate('/redirecting');
    };
    
    const totalPrice = cart.reduce((acc, item) => acc + item.qty * item.price, 0);

    return (
        <div className="page-container cart-container">
            <h1>Shopping Cart</h1>
            {cart.length === 0 ? <p>Your cart is empty. <Link to="/" className="link">Go Shopping</Link></p> : (
                <>
                    <div className="cart-items">
                        {cart.map(item => (
                            <div key={item._id} className="cart-item">
                                <img src={item.images[0]} alt={item.name} />
                                <div className="item-details">
                                    <h3>{item.name}</h3>
                                    <p>${item.price.toFixed(2)}</p>
                                </div>
                                <div className="item-actions">
                                    <input type="number" value={item.qty} onChange={(e) => updateCartQty(item._id, e.target.value)} min="1" max={item.countInStock} />
                                    <button onClick={() => removeFromCart(item._id)}>Remove</button>
                                </div>
                                <p className="item-total">${(item.qty * item.price).toFixed(2)}</p>
                            </div>
                        ))}
                    </div>
                    <div className="cart-summary">
                        <h2>Order Summary</h2>
                        <div className="shipping-form card">
                            <h3>Shipping Address</h3>
                            <input type="text" name="address" placeholder="Address" onChange={handleInputChange} required />
                            <input type="text" name="city" placeholder="City" onChange={handleInputChange} required />
                            <input type="text" name="postalCode" placeholder="Postal Code" onChange={handleInputChange} required />
                            <input type="text" name="country" placeholder="Country" onChange={handleInputChange} required />
                        </div>
                        <div className="total-section">
                            <p>Total: <span>${totalPrice.toFixed(2)}</span></p>
                            <button onClick={handleProceedToCheckout} disabled={cart.length === 0}>Proceed to Checkout</button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}


// --- All other components remain the same ---

function Header({ user, onLogout, cartCount }) {
    return (
        <header className="header">
            <Link to="/" className="logo">Jharkhand AI Tourism</Link>
            <nav>
                {user ? (
                    <>
                        {user.role === 'buyer' && (
                            <>
                                <Link to="/cart"><button>Cart ({cartCount})</button></Link>
                                <Link to="/my-orders"><button>My Orders</button></Link>
                            </>
                        )}
                        {user.role === 'seller' && (
                            <Link to="/seller-dashboard"><button>Dashboard</button></Link>
                        )}
                        <span>Hello, {user.name}</span>
                        <button onClick={onLogout}>Logout</button>
                    </>
                ) : (
                    <>
                        <Link to="/login"><button>Login</button></Link>
                        <Link to="/register"><button>Register</button></Link>
                    </>
                )}
            </nav>
        </header>
    );
}

function HomePage({ products }) {
    return (
        <div className="page-container">
            <h1>Featured Products</h1>
            <div className="product-grid">
                {products.map((product) => (
                    <ProductCard key={product._id} product={product} />
                ))}
            </div>
        </div>
    );
}

function ProductCard({ product }) {
    const slug = `${product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${product._id}`;
    return (
        <Link to={`/p/${slug}`} className="card product-card">
            <img src={product.images[0]} alt={product.name} className="product-image" />
            <h3>{product.name}</h3>
            <p className="price">₹{product.price.toFixed(2)}</p>
        </Link>
    );
}

function ProductDetailPage({ products, addToCart, showNotification }) {
    const { slug } = useParams();
    const navigate = useNavigate();
    const [qty, setQty] = useState(1);
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    
    const productId = slug.split('-').pop();

    useEffect(() => {
        const fetchProduct = async () => {
            // First check if product is in the products array
            const foundProduct = products.find(p => p._id === productId);
            if (foundProduct) {
                setProduct(foundProduct);
                setLoading(false);
            } else {
                // If not found, fetch from API
                try {
                    const { data } = await axios.get(`${API_URL}/products/${productId}`);
                    setProduct(data);
                    setLoading(false);
                } catch (error) {
                    console.error('Error fetching product:', error);
                    setLoading(false);
                }
            }
        };
        
        fetchProduct();
    }, [productId, products]);
    
    if(loading) return <div className="page-container"><p>Loading...</p></div>;
    if(!product) return <div className="page-container"><p>Product not found.</p></div>;

    const handleAddToCart = () => {
        addToCart(product, qty);
        showNotification(`${qty} x ${product.name} added to cart!`);
    };

    return (
        <div className="page-container product-detail-container">
            <button onClick={() => navigate('/')} className="back-btn">&larr; Back to Products</button>
            <div className="product-detail-content">
                <div className="product-detail-images">
                    {product.images.map((img, index) => (
                        <img key={index} src={img} alt={`${product.name} view ${index + 1}`} />
                    ))}
                </div>
                <div className="product-detail-info">
                    <h1>{product.name}</h1>
                    <p className="price">₹{product.price.toFixed(2)}</p>
                    <p>{product.description}</p>
                    <p>Status: {product.countInStock > 0 ? 'In Stock' : 'Out of Stock'}</p>
                    {product.countInStock > 0 && (
                        <div className="add-to-cart-controls">
                            <select value={qty} onChange={(e) => setQty(Number(e.target.value))}>
                                {[...Array(product.countInStock).keys()].map((x) => (
                                    <option key={x + 1} value={x + 1}>{x + 1}</option>
                                ))}
                            </select>
                            <button onClick={handleAddToCart}>Add to Cart</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function OrderSuccessPage() {
    return (
        <div className="page-container center-content">
            <div className="card">
                <h2>Order Placed Successfully!</h2>
                <p>Thank you for your purchase.</p>
                <Link to="/my-orders"><button>View My Orders</button></Link>
                <Link to="/"><button>Continue Shopping</button></Link>
            </div>
        </div>
    );
}

function MyOrdersPage({ user }) {
    const [orders, setOrders] = useState([]);

    useEffect(() => {
        if (!user) return;
        const fetchOrders = async () => {
            try {
                const config = {
                    headers: {
                        Authorization: `Bearer ${user.token}`,
                    },
                };
                const { data } = await axios.get(`${API_URL}/orders/myorders`, config);
                setOrders(data);
            } catch (error) {
                console.error("Failed to fetch orders:", error);
            }
        };
        fetchOrders();
    }, [user]);

    return (
        <div className="page-container">
            <h1>My Orders</h1>
            {orders.length === 0 ? <p>You have no orders.</p> : (
                <div className="order-list">
                    {orders.map(order => (
                        <div key={order._id} className="card order-card">
                            <h3>Order ID: {order._id}</h3>
                            <p>Date: {new Date(order.createdAt).toLocaleDateString()}</p>
                            <p>Total: ${order.totalPrice.toFixed(2)}</p>
                            <p>Paid: {order.isPaid ? 'Yes' : 'No'}</p>
                            <h4>Items:</h4>
                            <ul>
                                {order.orderItems.map(item => (
                                    <li key={item.product}>{item.name} (x{item.qty})</li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}


function LoginPage({ onLogin }) {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const config = { headers: { 'Content-Type': 'application/json' } };
            const { data } = await axios.post(`${API_URL}/users/login`, { email, password }, config);
            onLogin(data);
            navigate(data.role === 'seller' ? '/seller-dashboard' : '/');
        } catch (err) {
            setError(err.response?.data?.message || 'An error occurred');
        }
    };

    return (
        <div className="page-container auth-container">
            <div className="card auth-card">
                <h2>Login</h2>
                {error && <p className="error">{error}</p>}
                <form onSubmit={handleSubmit}>
                    <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    <button type="submit">Login</button>
                </form>
                <p>New here? <Link to="/register" className="link">Register</Link></p>
            </div>
        </div>
    );
}

function RegisterPage({ onLogin }) {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('buyer');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const config = { headers: { 'Content-Type': 'application/json' } };
            const { data } = await axios.post(`${API_URL}/users/register`, { name, email, password, role }, config);
            onLogin(data);
            navigate(data.role === 'seller' ? '/seller-dashboard' : '/');
        } catch (err) {
            setError(err.response?.data?.message || 'An error occurred');
        }
    };

    return (
        <div className="page-container auth-container">
            <div className="card auth-card">
                <h2>Register</h2>
                {error && <p className="error">{error}</p>}
                <form onSubmit={handleSubmit}>
                    <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
                    <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    <div className="role-selector">
                        <label>
                            <input type="radio" value="buyer" checked={role === 'buyer'} onChange={(e) => setRole(e.target.value)} />
                            I am a Buyer
                        </label>
                        <label>
                            <input type="radio" value="seller" checked={role === 'seller'} onChange={(e) => setRole(e.target.value)} />
                            I am a Seller
                        </label>
                    </div>
                    <button type="submit">Register</button>
                </form>
                <p>Already have an account? <Link to="/login" className="link">Login</Link></p>
            </div>
        </div>
    );
}


function SellerDashboard({ user }) {
    return (
        <div className="page-container seller-dashboard">
            <h1>Seller Dashboard</h1>
            <p>Welcome, {user.name}!</p>
            <div className="dashboard-actions">
                <Link to="/add-product"><button>Add New Product</button></Link>
                <Link to="/manage-products"><button>Manage Products</button></Link>
                <Link to="/manage-orders"><button>Manage Orders</button></Link>
            </div>
        </div>
    );
}

function AddProductPage({ user, fetchProducts, showNotification }) {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [countInStock, setCountInStock] = useState('');
    const [description, setDescription] = useState('');
    const [images, setImages] = useState([]);
    const [error, setError] = useState('');

    const handleImageUpload = (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 4) {
            setError('You can only upload a maximum of 4 images.');
            return;
        }
        setError('');
        
        const imagePromises = files.map(file => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
            });
        });
        
        Promise.all(imagePromises).then(base64Images => {
            setImages(base64Images);
        }).catch(err => {
            console.error(err);
            setError('Error converting images.');
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (images.length === 0) {
            setError('Please upload at least one image.');
            return;
        }
        
        const productData = { name, price, countInStock, description, images };

        try {
            const config = {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${user.token}`,
                },
            };
            await axios.post(`${API_URL}/products`, productData, config);
            showNotification('Product added successfully!', 'success');
            fetchProducts();
            navigate('/seller-dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to add product');
        }
    };

    return (
        <div className="page-container">
            <div className="card auth-card">
                <h2>Add New Product</h2>
                {error && <p className="error">{error}</p>}
                <form onSubmit={handleSubmit}>
                    <input type="text" placeholder="Product Name" value={name} onChange={e => setName(e.target.value)} required />
                    <input type="number" placeholder="Price" value={price} onChange={e => setPrice(e.target.value)} required />
                    <input type="number" placeholder="Count In Stock" value={countInStock} onChange={e => setCountInStock(e.target.value)} required />
                    <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} required />
                    <label>Product Images (up to 4)</label>
                    <input type="file" multiple accept="image/*" onChange={handleImageUpload} />
                    <div className="image-preview">
                        {images.map((img, i) => <img key={i} src={img} alt="preview"/>)}
                    </div>
                    <button type="submit">Add Product</button>
                </form>
            </div>
        </div>
    );
}

function SellerOrdersPage({ user }) {
    const [orders, setOrders] = useState([]);
    
    useEffect(() => {
        if (!user) return;
        const fetchOrders = async () => {
             try {
                const config = {
                    headers: {
                        Authorization: `Bearer ${user.token}`,
                    },
                };
                const { data } = await axios.get(`${API_URL}/orders/seller`, config);
                setOrders(data);
             } catch(error) {
                console.error("Failed to fetch seller orders:", error);
             }
        };
        fetchOrders();
    }, [user]);

    return (
         <div className="page-container">
            <h1>My Received Orders</h1>
            {orders.length === 0 ? <p>You have no orders yet.</p> : (
                <div className="order-list">
                    {orders.map(order => (
                        <div key={order._id} className="card order-card">
                            <h3>Order ID: {order._id}</h3>
                            <p>Date: {new Date(order.createdAt).toLocaleDateString()}</p>
                            <p>Buyer Email: {order.buyer?.email || 'N/A'}</p>
                            <p>Shipping To: {`${order.shippingAddress.address}, ${order.shippingAddress.city}`}</p>
                            <h4>Items in this order for you:</h4>
                            <ul>
                                {order.orderItems.map(item => (
                                    <li key={item.product}>
                                        {item.name} (x{item.qty}) - ${item.price.toFixed(2)} each
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function ManageProductsPage({ user, showNotification }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState(null);

    useEffect(() => {
        const fetchMine = async () => {
            if (!user) return;
            try {
                const { data } = await axios.get(`${API_URL}/products/mine`, {
                    headers: { Authorization: `Bearer ${user.token}` },
                });
                setItems(data.map(p => ({ ...p, _price: p.price, _stock: p.countInStock })));
            } catch (e) {
                console.error('Failed to fetch products', e);
            } finally {
                setLoading(false);
            }
        };
        fetchMine();
    }, [user]);

    const updateLocal = (id, field, value) => {
        setItems(prev => prev.map(it => it._id === id ? { ...it, [field]: value } : it));
    };

    const saveChanges = async (product) => {
        setSavingId(product._id);
        try {
            const payload = {
                price: Number(product._price),
                countInStock: Number(product._stock),
            };
            await axios.put(`${API_URL}/products/${product._id}`, payload, {
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
            });
            showNotification('Product updated', 'success');
            setItems(prev => prev.map(it => it._id === product._id ? { ...it, price: payload.price, countInStock: payload.countInStock } : it));
        } catch (e) {
            console.error('Failed to update product', e);
            showNotification('Failed to update product', 'error');
        } finally {
            setSavingId(null);
        }
    };

    if (!user) return <div className="page-container"><p>Please login as seller.</p></div>;

    return (
        <div className="page-container">
            <h1>Manage Products</h1>
            {loading ? (
                <p>Loading...</p>
            ) : items.length === 0 ? (
                <p>No products yet. <Link to="/add-product" className="link">Add one</Link></p>
            ) : (
                <div className="product-manage-list">
                    {items.map(p => (
                        <div key={p._id} className="card product-manage-item">
                            <div className="pm-left">
                                <img src={p.images?.[0]} alt={p.name} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6 }} />
                                <div className="pm-info">
                                    <h3>{p.name}</h3>
                                    <p>{p.description}</p>
                                </div>
                            </div>
                            <div className="pm-edit">
                                <label>
                                    Price (₹)
                                    <input type="number" value={p._price} onChange={e => updateLocal(p._id, '_price', e.target.value)} />
                                </label>
                                <label>
                                    In Stock
                                    <input type="number" value={p._stock} onChange={e => updateLocal(p._id, '_stock', e.target.value)} />
                                </label>
                                <button onClick={() => saveChanges(p)} disabled={savingId === p._id}>
                                    {savingId === p._id ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function Footer() {
    return (
        <footer className="footer">
            <p>&copy; {new Date().getFullYear()} Jharkhand AI Tourism. All rights reserved.</p>
        </footer>
    );
}

export default App;


