import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import './App.css';

// --- Global Config ---
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
// This is your public key, it's safe to be here.
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51SBi3L7cTFRYZBmvme4HtkAvE4naWHZIleb90F6FzPV16ZGYeub4K12vtiXuu8VoU15yUKhOldC2h3Go5llxZLlD00v4iof5Fq';
const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

// --- Notification Component ---
function Notification({ message, type }) {
    return <div className={`notification ${type}`}>{message}</div>;
}

// --- Main App Component ---
function App() {
    const [page, setPage] = useState('home');
    const [user, setUser] = useState(null);
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [notification, setNotification] = useState(null);
    const [checkoutData, setCheckoutData] = useState(null);

    const showNotification = (message, type = 'info') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

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
        setPage(userInfo.role === 'seller' ? 'sellerDashboard' : 'home');
    };

    const handleLogout = () => {
        setUser(null);
        setCart([]);
        localStorage.removeItem('userInfo');
        localStorage.removeItem('cart');
        setPage('home');
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
        navigate('redirecting');
    };

    const navigate = (pageName, product = null) => {
        if (product) setSelectedProduct(product);
        setPage(pageName);
    };

    const renderPage = () => {
        switch (page) {
            case 'login': return <LoginPage onLogin={handleLogin} setPage={setPage} />;
            case 'register': return <RegisterPage onLogin={handleLogin} setPage={setPage} />;
            case 'productDetail': return <ProductDetailPage product={selectedProduct} addToCart={addToCart} navigate={navigate} showNotification={showNotification} />;
            case 'cart': return <CartPage cart={cart} updateCartQty={updateCartQty} removeFromCart={removeFromCart} user={user} navigate={navigate} showNotification={showNotification} startCheckout={startCheckout} />;
            case 'redirecting': return <RedirectingPage navigate={navigate} />;
            case 'payment':
                return (
                    <Elements stripe={stripePromise}>
                        <PaymentPage user={user} checkoutData={checkoutData} showNotification={showNotification} navigate={navigate} clearCart={() => setCart([])} />
                    </Elements>
                );
            case 'orderSuccess': return <OrderSuccessPage navigate={navigate} />;
            case 'myOrders': return <MyOrdersPage user={user} navigate={navigate} />;
            case 'sellerDashboard': return <SellerDashboard user={user} navigate={navigate} />;
            case 'addProduct': return <AddProductPage user={user} navigate={navigate} fetchProducts={fetchProducts} showNotification={showNotification} />;
            case 'manageOrders': return <SellerOrdersPage user={user} navigate={navigate} />;
            default: return <HomePage products={products} navigate={navigate} />;
        }
    };

    return (
        <div className="app-container">
            {notification && <Notification message={notification.message} type={notification.type} />}
            {page === 'redirecting' && <div className="blur-background" />}
            <Header user={user} onLogout={handleLogout} navigate={navigate} cartCount={cart.reduce((acc, item) => acc + item.qty, 0)} />
            <main>{renderPage()}</main>
            <Footer />
        </div>
    );
}

// --- Page Components ---

function RedirectingPage({ navigate }) {
    useEffect(() => {
        const timer = setTimeout(() => {
            navigate('payment');
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

function PaymentPage({ user, checkoutData, showNotification, navigate, clearCart }) {
    useEffect(() => {
        if (!checkoutData) {
            navigate('cart');
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
                navigate('orderSuccess');
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

function CartPage({ cart, updateCartQty, removeFromCart, user, navigate, showNotification, startCheckout }) {
    const [shippingAddress, setShippingAddress] = useState({ address: '', city: '', postalCode: '', country: '' });

    const handleInputChange = (e) => {
        setShippingAddress({ ...shippingAddress, [e.target.name]: e.target.value });
    };

    const handleProceedToCheckout = () => {
        if (!user) {
            showNotification('Please log in to proceed.', 'error');
            navigate('login');
            return;
        }
        if (!shippingAddress.address || !shippingAddress.city || !shippingAddress.postalCode || !shippingAddress.country) {
            showNotification('Please fill in all shipping address fields.', 'error');
            return;
        }
        startCheckout(cart, shippingAddress);
    };
    
    const totalPrice = cart.reduce((acc, item) => acc + item.qty * item.price, 0);

    return (
        <div className="page-container cart-container">
            <h1>Shopping Cart</h1>
            {cart.length === 0 ? <p>Your cart is empty. <span className="link" onClick={() => navigate('home')}>Go Shopping</span></p> : (
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

function Header({ user, onLogout, navigate, cartCount }) {
    return (
        <header className="header">
            <div className="logo" onClick={() => navigate('home')}>Jharkhand AI Tourism</div>
            <nav>
                {user ? (
                    <>
                        {user.role === 'buyer' && (
                            <>
                                <button onClick={() => navigate('cart')}>Cart ({cartCount})</button>
                                <button onClick={() => navigate('myOrders')}>My Orders</button>
                            </>
                        )}
                        {user.role === 'seller' && (
                            <button onClick={() => navigate('sellerDashboard')}>Dashboard</button>
                        )}
                        <span>Hello, {user.name}</span>
                        <button onClick={onLogout}>Logout</button>
                    </>
                ) : (
                    <>
                        <button onClick={() => navigate('login')}>Login</button>
                        <button onClick={() => navigate('register')}>Register</button>
                    </>
                )}
            </nav>
        </header>
    );
}

function HomePage({ products, navigate }) {
    return (
        <div className="page-container">
            <h1>Featured Products</h1>
            <div className="product-grid">
                {products.map((product) => (
                    <ProductCard key={product._id} product={product} navigate={navigate} />
                ))}
            </div>
        </div>
    );
}

function ProductCard({ product, navigate }) {
    return (
        <div className="card product-card" onClick={() => navigate('productDetail', product)}>
            <img src={product.images[0]} alt={product.name} className="product-image" />
            <h3>{product.name}</h3>
            <p className="price">${product.price.toFixed(2)}</p>
        </div>
    );
}

function ProductDetailPage({ product, addToCart, navigate, showNotification }) {
    const [qty, setQty] = useState(1);
    
    if(!product) return <div>Loading...</div>;

    const handleAddToCart = () => {
        addToCart(product, qty);
        showNotification(`${qty} x ${product.name} added to cart!`);
    };

    return (
        <div className="page-container product-detail-container">
            <button onClick={() => navigate('home')} className="back-btn">&larr; Back to Products</button>
            <div className="product-detail-content">
                <div className="product-detail-images">
                    {product.images.map((img, index) => (
                        <img key={index} src={img} alt={`${product.name} view ${index + 1}`} />
                    ))}
                </div>
                <div className="product-detail-info">
                    <h1>{product.name}</h1>
                    <p className="price">${product.price.toFixed(2)}</p>
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

function OrderSuccessPage({ navigate }) {
    return (
        <div className="page-container center-content">
            <div className="card">
                <h2>Order Placed Successfully!</h2>
                <p>Thank you for your purchase.</p>
                <button onClick={() => navigate('myOrders')}>View My Orders</button>
                <button onClick={() => navigate('home')}>Continue Shopping</button>
            </div>
        </div>
    );
}

function MyOrdersPage({ user, navigate }) {
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


function LoginPage({ onLogin, setPage }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const config = { headers: { 'Content-Type': 'application/json' } };
            const { data } = await axios.post(`${API_URL}/users/login`, { email, password }, config);
            onLogin(data);
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
                <p>New here? <span className="link" onClick={() => setPage('register')}>Register</span></p>
            </div>
        </div>
    );
}

function RegisterPage({ onLogin, setPage }) {
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
                <p>Already have an account? <span className="link" onClick={() => setPage('login')}>Login</span></p>
            </div>
        </div>
    );
}


function SellerDashboard({ user, navigate }) {
    return (
        <div className="page-container seller-dashboard">
            <h1>Seller Dashboard</h1>
            <p>Welcome, {user.name}!</p>
            <div className="dashboard-actions">
                <button onClick={() => navigate('addProduct')}>Add New Product</button>
                <button onClick={() => navigate('manageOrders')}>Manage Orders</button>
            </div>
        </div>
    );
}

function AddProductPage({ user, navigate, fetchProducts, showNotification }) {
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
            navigate('sellerDashboard');
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

function SellerOrdersPage({ user, navigate }) {
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

function Footer() {
    return (
        <footer className="footer">
            <p>&copy; {new Date().getFullYear()} Jharkhand AI Tourism. All rights reserved.</p>
        </footer>
    );
}

export default App;


