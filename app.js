require('dotenv').config();
const express = require('express');
const session = require('express-session');
const app = express();

// ==========================================
// 1. DATABASE
// ==========================================
let mockUsers = []; 
let mockTransactions = [];
let mockTrades = []; 

// ==========================================
// 2. MIDDLEWARE
// ==========================================
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json()); 
app.use(express.urlencoded({ extended: false }));
app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
}));

// ==========================================
// 3. AUTH ROUTES
// ==========================================
app.get('/', (req, res) => res.render('landing'));

app.get('/register', (req, res) => res.render('register'));
app.post('/register', (req, res) => {
    const { name, email, password } = req.body;
    if (mockUsers.find(user => user.email === email)) return res.send('User exists.');

    const newUser = {
        _id: Date.now().toString(),
        name, email, password,
        balance: 0.00,
        isOnline: true
    };
    mockUsers.push(newUser);
    req.session.user = newUser;
    
    // ADMIN CHECK: If email ends with @nova.com, go to Admin Panel
    if (email.endsWith('@nova.com')) return res.redirect('/admin');
    
    res.redirect('/dashboard');
});

app.get('/login', (req, res) => res.render('login'));
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const user = mockUsers.find(u => u.email === email);

    if (user && user.password === password) {
        user.isOnline = true;
        req.session.user = user;
        
        // ADMIN CHECK
        if (user.email.endsWith('@nova.com')) return res.redirect('/admin');
        
        return res.redirect('/dashboard');
    }
    res.send('Invalid credentials.');
});

app.get('/logout', (req, res) => {
    if (req.session.user) {
        const user = mockUsers.find(u => u._id === req.session.user._id);
        if (user) user.isOnline = false;
    }
    req.session.destroy();
    res.redirect('/');
});

// ==========================================
// 4. BANKING ROUTES
// ==========================================
app.get('/dashboard', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const currentUser = mockUsers.find(u => u._id === req.session.user._id);
    const txs = mockTransactions.filter(t => t.userId === currentUser._id);
    res.render('dashboard', { user: currentUser, transactions: txs.reverse() });
});

app.post('/deposit', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    mockTransactions.push({
        userId: req.session.user._id,
        type: 'deposit',
        amount: parseFloat(req.body.amount),
        method: req.body.method,
        status: 'pending'
    });
    res.redirect('/dashboard');
});

app.get('/withdraw', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const user = mockUsers.find(u => u._id === req.session.user._id);
    res.render('withdraw', { user });
});

app.post('/withdraw', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const { amount, method, walletAddress } = req.body;
    const user = mockUsers.find(u => u._id === req.session.user._id);
    const val = parseFloat(amount);

    if (user.balance < val) return res.send("Insufficient Funds");
    user.balance -= val; 

    mockTransactions.push({
        userId: user._id, type: 'withdraw', amount: val, method, walletAddress, status: 'pending'
    });
    res.redirect('/dashboard');
});

// ==========================================
// 5. ADMIN ROUTES (RESTORED)
// ==========================================
function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.email.endsWith('@nova.com')) {
        return next();
    }
    res.send("⛔ ACCESS DENIED: You are not an admin.");
}

app.get('/admin', isAdmin, (req, res) => {
    res.render('admin', { users: mockUsers, transactions: mockTransactions.reverse() });
});

app.post('/admin/approve', isAdmin, (req, res) => {
    const { userId, amount } = req.body;
    const tx = mockTransactions.find(t => t.userId === userId && t.amount == amount && t.status === 'pending');
    
    if (tx) {
        tx.status = 'approved';
        const user = mockUsers.find(u => u._id === userId);
        
        // Add money if deposit
        if (tx.type === 'deposit') {
            user.balance += parseFloat(amount);
        } 
    }
    res.redirect('/admin');
});

app.post('/admin/reject', isAdmin, (req, res) => {
    const { userId, amount } = req.body;
    const tx = mockTransactions.find(t => t.userId === userId && t.amount == amount && t.status === 'pending');
    
    if (tx) {
        tx.status = 'rejected';
        const user = mockUsers.find(u => u._id === userId);

        // Refund money if withdraw
        if (tx.type === 'withdraw') {
            user.balance += parseFloat(amount); 
        }
    }
    res.redirect('/admin');
});

// ==========================================
// 6. TRADING ROUTES
// ==========================================
app.get('/trade', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    const user = mockUsers.find(u => u._id === req.session.user._id);
    const myTrades = mockTrades.filter(t => t.userId === user._id);
    res.render('trade', { user, trades: myTrades.reverse() });
});

app.post('/trade/place', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    
    const { pair, action, amount, orderType, limitPrice, sl, tp, currentPrice } = req.body;
    const user = mockUsers.find(u => u._id === req.session.user._id);
    const tradeAmount = parseFloat(amount);
    
    // Use client price
    let entryPrice = parseFloat(currentPrice);

    if (orderType === 'LIMIT' && limitPrice) {
        entryPrice = parseFloat(limitPrice);
    }

    if (user.balance < tradeAmount) return res.send("❌ Insufficient Margin.");

    if (orderType === 'MARKET') {
        if(action === 'BUY') entryPrice = entryPrice * 1.0002;
        else entryPrice = entryPrice * 0.9998;
    }

    user.balance -= tradeAmount;

    const newTrade = {
        id: Date.now().toString(),
        userId: user._id,
        pair, action,
        amount: tradeAmount,
        entryPrice: entryPrice.toFixed(2),
        sl: sl ? parseFloat(sl) : 0,
        tp: tp ? parseFloat(tp) : 0,
        status: orderType === 'LIMIT' ? 'PENDING' : 'OPEN',
        startTime: new Date().getTime()
    };

    mockTrades.push(newTrade);
    res.redirect('/trade');
});

app.post('/trade/close', (req, res) => {
    const { tradeId, price } = req.body;
    const trade = mockTrades.find(t => t.id === tradeId);
    
    if (trade && trade.status === 'OPEN') {
        const finalPrice = price ? parseFloat(price) : parseFloat(trade.entryPrice);
        closeTrade(trade, finalPrice, 'MANUAL'); 
    }
    res.redirect('/trade');
});

// ==========================================
// 7. RELAY ENGINE
// ==========================================

// Receive Price from Browser
app.post('/api/tick', (req, res) => {
    const { price } = req.body;
    const currentPrice = parseFloat(price);

    if (!currentPrice || isNaN(currentPrice)) return res.sendStatus(400);

    mockTrades.forEach(trade => {
        if(trade.status.includes('CLOSED')) return;

        if (trade.status === 'PENDING') {
            const target = parseFloat(trade.entryPrice);
            if (trade.action === 'BUY' && currentPrice <= target) {
                trade.status = 'OPEN';
                trade.entryPrice = currentPrice; 
                console.log(`⚡ FILLED: Buy Limit @ ${currentPrice}`);
            }
            if (trade.action === 'SELL' && currentPrice >= target) {
                trade.status = 'OPEN';
                trade.entryPrice = currentPrice; 
                console.log(`⚡ FILLED: Sell Limit @ ${currentPrice}`);
            }
        }

        if (trade.status === 'OPEN') {
            const sl = trade.sl;
            const tp = trade.tp;

            if (trade.action === 'BUY') {
                if (sl > 0 && currentPrice <= sl) closeTrade(trade, currentPrice, 'SL');
                else if (tp > 0 && currentPrice >= tp) closeTrade(trade, currentPrice, 'TP');
            }
            else if (trade.action === 'SELL') {
                if (sl > 0 && currentPrice >= sl) closeTrade(trade, currentPrice, 'SL');
                else if (tp > 0 && currentPrice <= tp) closeTrade(trade, currentPrice, 'TP');
            }
        }
    });

    res.json({ status: 'ok' });
});

function closeTrade(trade, closePrice, reason) {
    trade.status = `CLOSED (${reason})`;
    
    let pnl = 0;
    const entry = parseFloat(trade.entryPrice);
    const amount = parseFloat(trade.amount);
    
    if (trade.action === 'BUY') pnl = ((closePrice - entry) / entry) * amount * 50;
    else pnl = ((entry - closePrice) / entry) * amount * 50;

    const user = mockUsers.find(u => u._id === trade.userId);
    if (user) {
        user.balance += (amount + pnl);
        console.log(`💰 TRADE CLOSED (${reason}): $${pnl.toFixed(2)}`);
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server started on http://localhost:${PORT}`);
    console.log(`📡 WAITING FOR BROWSER DATA...`);
});