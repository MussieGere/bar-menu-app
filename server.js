require('dotenv').config();
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const QRCode = require('qrcode');
const multer = require('multer');
const fs = require('fs');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = 'ai-paladini-secret-2026';
const MONGODB_URI = process.env.MONGODB_URI; 

// --- MONGODB CONNECTION ---
if (!MONGODB_URI) {
  console.error("FATAL ERROR: MONGODB_URI is not defined.");
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✦ Connected to MongoDB Atlas'))
  .catch(err => console.error('MongoDB connection error:', err));

// --- MONGOOSE SCHEMAS & MODELS ---

// 1. MENU ITEM SCHEMA (with new sortOrder field)
const menuItemSchema = new mongoose.Schema({
  id: String,
  tab: String,
  category: String,
  name: String,
  price: String,
  desc: String,
  desc_it: String,
  desc_en: String,
  desc_es: String,
  desc_de: String,
  desc_fr: String,
  available: { type: Boolean, default: true },
  image: String,
  // --- DIETARY BADGES ---
  isVegetarian: { type: Boolean, default: false },
  isVegan: { type: Boolean, default: false },
  isGlutenFree: { type: Boolean, default: false },
  clicks: { type: Number, default: 0 },
  // --- NEW: Sort order within category ---
  sortOrder: { type: Number, default: 999 }
}, { strict: false });
const MenuItem = mongoose.model('MenuItem', menuItemSchema);

// 2. TAB SCHEMA (for managing the 6 main tabs)
const tabSchema = new mongoose.Schema({
  key: { type: String, unique: true }, // 'bar', 'food', 'restaurant', 'cocktails', 'wine', 'desserts'
  label: String, // Display name: 'Bar & Caffetteria', 'Pizza & Sandwiches', etc.
  protected: { type: Boolean, default: true }, // Can't delete the 6 built-in tabs
  sortOrder: { type: Number, default: 999 }
});
const Tab = mongoose.model('Tab', tabSchema);

// 3. CATEGORY SCHEMA (for managing sub-categories within tabs)
const categorySchema = new mongoose.Schema({
  tabKey: String, // Foreign key: references Tab.key
  name: String, // Display name: 'Pizze / Pizzas', 'Colazione / Breakfast', etc.
  sortOrder: { type: Number, default: 999 }
});
const Category = mongoose.model('Category', categorySchema);

// --- IDEMPOTENT STARTUP SYNC ---
// This runs ONCE on startup and safely creates Tab and Category records from existing MenuItem data
// It won't break live menus because it checks if data already exists
async function syncCategoriesFromMenu() {
  try {
    // 1. Sync the 6 built-in tabs
    const builtInTabs = [
      { key: 'bar', label: 'Bar & Caffetteria', sortOrder: 1 },
      { key: 'food', label: 'Pizza & Sandwiches', sortOrder: 2 },
      { key: 'restaurant', label: 'Ristorante', sortOrder: 3 },
      { key: 'cocktails', label: 'Cocktails & Spirits', sortOrder: 4 },
      { key: 'wine', label: 'Wine List', sortOrder: 5 },
      { key: 'desserts', label: 'Desserts', sortOrder: 6 }
    ];

    for (const tabData of builtInTabs) {
      const existing = await Tab.findOne({ key: tabData.key });
      if (!existing) {
        await Tab.create(tabData);
        console.log(`✓ Created tab: ${tabData.key}`);
      }
    }

    // 2. Sync categories from existing menu items
    const menuItems = await MenuItem.find({});
    const categoriesByTab = {}; // Track categories we've seen

    // Group items by tab and category
    menuItems.forEach(item => {
      if (!item.tab || !item.category) return;
      if (!categoriesByTab[item.tab]) categoriesByTab[item.tab] = new Set();
      categoriesByTab[item.tab].add(item.category);
    });

    // Create Category records for any that don't exist
    let sortIndex = 1;
    for (const [tabKey, categories] of Object.entries(categoriesByTab)) {
      for (const categoryName of categories) {
        const existing = await Category.findOne({ tabKey, name: categoryName });
        if (!existing) {
          await Category.create({ tabKey, name: categoryName, sortOrder: sortIndex });
          console.log(`✓ Created category: ${tabKey} > ${categoryName}`);
          sortIndex++;
        }
      }
    }

    // 3. Initialize sortOrder on menu items if they don't have one
    // Count items within each category to assign sortOrder
    for (const [tabKey, categories] of Object.entries(categoriesByTab)) {
      for (const categoryName of categories) {
        const items = await MenuItem.find({ tab: tabKey, category: categoryName });
        items.forEach((item, index) => {
          if (!item.sortOrder || item.sortOrder === 999) {
            item.sortOrder = index + 1;
            item.save().catch(err => console.error('Error saving sortOrder:', err));
          }
        });
      }
    }

    console.log('✓ Category sync complete!');
  } catch (err) {
    console.error('Category sync error:', err);
  }
}

// Run the sync after a short delay to ensure DB connection is ready
setTimeout(syncCategoriesFromMenu, 2000);

// --- EXISTING MENU DATABASE (unchanged) ---
const initialMenuDatabase = [
  // Burgers
  { id: '1', tab: 'food', category: 'Burger / Burgers', name: 'Hamburger', price: '€ 8,50', desc: "hamburger 200gr, pomodoro, insalata, olio d'oliva, origano", available: true },
  { id: '2', tab: 'food', category: 'Burger / Burgers', name: 'Cheeseburger', price: '€ 9,00', desc: "hamburger 200gr, formaggio cheddar, pomodoro, insalata, olio d'oliva, origano", available: true },
  { id: '3', tab: 'food', category: 'Burger / Burgers', name: 'Egg Burger', price: '€ 10,00', desc: "hamburger 200gr, formaggio cheddar, pomodoro, insalata, uovo fritto, olio, origano", available: true },
  // Panini
  { id: '4', tab: 'food', category: 'Panini / Sandwiches', name: 'Caprese', price: '€ 5,50', desc: "pomodoro, mozzarella, olio d'oliva, basilico, origano", available: true },
  { id: '5', tab: 'food', category: 'Panini / Sandwiches', name: 'Cotto', price: '€ 6,00', desc: "prosciutto cotto, pomodoro, mozzarella, olio d'oliva, origano", available: true },
  { id: '6', tab: 'food', category: 'Panini / Sandwiches', name: 'Paladino', price: '€ 6,50', desc: "salame piccante, mozzarella, tabasco, olio d'oliva, origano", available: true },
  { id: '7', tab: 'food', category: 'Panini / Sandwiches', name: 'Hot-dog', price: '€ 6,00', desc: "wurstel, ketchup, maionese", available: true },
  { id: '8', tab: 'food', category: 'Panini / Sandwiches', name: 'Solito', price: '€ 7,50', desc: "prosciutto crudo, mozzarella, pomodoro, insalata, olio d'oliva, origano", available: true },
  { id: '9', tab: 'food', category: 'Panini / Sandwiches', name: 'Tonnato', price: '€ 7,50', desc: "tonno, pomodoro, mozzarella, insalata, olio d'oliva, origano", available: true },
  { id: '10', tab: 'food', category: 'Panini / Sandwiches', name: 'Siciliano', price: '€ 7,00', desc: "pepato, olive, acciughe, olio d'oliva, pepe, origano", available: true },
  { id: '11', tab: 'food', category: 'Panini / Sandwiches', name: 'Vegetariano', price: '€ 7,50', desc: "pomodoro, mozzarella, verdure grigliate, olio, origano", available: true },
  { id: '12', tab: 'food', category: 'Panini / Sandwiches', name: 'Orlando', price: '€ 8,50', desc: "pollo, mozzarella, pomodoro, insalata, olio d'oliva, origano", available: true },
  { id: '13', tab: 'food', category: 'Panini / Sandwiches', name: 'Rinaldo', price: '€ 10,00', desc: "philadelphia, salmone affumicato, insalata, olio d'oliva, origano", available: true },
  { id: '14', tab: 'food', category: 'Panini / Sandwiches', name: 'Angelica', price: '€ 9,50', desc: "bresaola, rucola, grana, olio d'oliva, origano", available: true },
  // Pizze
  { id: '15', tab: 'food', category: 'Pizze / Pizzas', name: 'Margherita', price: '€ 8,00', desc: "pomodoro, mozzarella, olio d'oliva, origano", available: true },
  { id: '16', tab: 'food', category: 'Pizze / Pizzas', name: 'Capricciosa', price: '€ 12,00', desc: "pomodoro, mozzarella, funghi, prosciutto cotto, uovo, olio d'oliva, origano", available: true },
  { id: '17', tab: 'food', category: 'Pizze / Pizzas', name: 'Vegetariana', price: '€ 12,50', desc: "mozzarella, funghi, spinaci, zucchine, melanzane grigliate, olio d'oliva, origano", available: true },
  { id: '18', tab: 'food', category: 'Pizze / Pizzas', name: 'Ai Paladini', price: '€ 12,50', desc: "pomodoro, mozzarella, crudo, burrata, olio d'oliva, origano", available: true },
  { id: '19', tab: 'food', category: 'Pizze / Pizzas', name: 'Norma', price: '€ 12,50', desc: "pomodoro, mozzarella, melanzane fritte, ricotta salata, basilico, olio d'oliva, origano", available: true },
  { id: '20', tab: 'food', category: 'Pizze / Pizzas', name: 'Diavola', price: '€ 12,00', desc: "pomodoro, mozzarella, cipolla, salame piccante, olive nere, olio d'oliva, origano", available: true },
  { id: '21', tab: 'food', category: 'Pizze / Pizzas', name: 'Siciliana', price: '€ 12,00', desc: "pomodoro, mozzarella, acciughe, capperi, cipolla, olive nere, olio d'oliva, origano", available: true },
  { id: '22', tab: 'food', category: 'Pizze / Pizzas', name: 'Vulcano', price: '€ 14,00', desc: "mozzarella di bufala, funghi, salsiccia, olive nere, cipolla, grana, olio d'oliva, origano", available: true },
  { id: '23', tab: 'food', category: 'Pizze / Pizzas', name: 'Isola Bella', price: '€ 14,00', desc: "mozzarella di bufala, pomodorini, prosciutto crudo, rucola, grana, olio d'oliva, origano", available: true },
  { id: '24', tab: 'food', category: 'Pizze / Pizzas', name: 'Pistacchio', price: '€ 15,00', desc: "mozzarella, guancale, pistacchio, olio, origano", available: true },
  { id: '25', tab: 'food', category: 'Pizze / Pizzas', name: 'Gustosa', price: '€ 15,00', desc: "pomodoro, mozzarella, cipolla, olive nere, tonno, olio d'oliva, origano", available: true },
  { id: '26', tab: 'food', category: 'Pizze / Pizzas', name: 'Boscaiola', price: '€ 12,50', desc: "pomodoro, mozzarella, funghi, salsiccia, cipolla, olio d'oliva, origano", available: true },
  { id: '27', tab: 'food', category: 'Pizze / Pizzas', name: 'Acciughe e Burrata', price: '€ 13,00', desc: "pomodoro, acciughe, burrata, olio, origano", available: true },
  // Beers
  { id: '28', tab: 'bar', category: 'Birre / Beers', name: 'Ceres', price: '€ 4,00', desc: "", available: true },
  { id: '29', tab: 'bar', category: 'Birre / Beers', name: 'Heineken', price: '€ 4,00', desc: "", available: true },
  { id: '30', tab: 'bar', category: 'Birre / Beers', name: "Beck's", price: '€ 3,50', desc: "", available: true },
];

async function seedDatabase() {
  const count = await MenuItem.countDocuments();
  if (count === 0) {
    console.log("Database is empty. Seeding initial menu...");
    await MenuItem.insertMany(initialMenuDatabase);
    console.log("Seeding complete!");
  }
}
seedDatabase();

// Ensure images directory exists
const imagesDir = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, imagesDir),
  filename: (req, file, cb) => {
    const uniqueName = `${crypto.randomBytes(4).toString('hex')}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  cb(null, allowedMimes.includes(file.mimetype));
}});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --- SECURITY MIDDLEWARE ---
const requireAdmin = (req, res, next) => {
  const token = req.cookies.adminToken;
  if (!token) return res.redirect('/login.html');
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    res.clearCookie('adminToken');
    res.redirect('/login.html');
  }
};

const requireApiAdmin = (req, res, next) => {
  const token = req.cookies.adminToken;
  if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
  }
};

// --- LOGIN ROUTE ---
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '12h' });
    res.cookie('adminToken', token, { httpOnly: true, secure: true, sameSite: 'strict' });
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: 'Invalid password' });
  }
});

// --- INTERCEPT ADMIN.HTML ---
app.get('/admin.html', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.get('/admin', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

// Prevent caching
app.use((req, res, next) => {
  res.set({ 'Cache-Control': 'no-store, no-cache', 'Pragma': 'no-cache' });
  next();
});

// --- SESSION LOGIC ---
function generateToken() {
  const expiry = Date.now() + 30 * 60 * 1000;
  const payload = `${crypto.randomBytes(8).toString('hex')}.${expiry}`;
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('hex').slice(0, 16);
  return `${payload}.${sig}`;
}

app.get('/api/session', (req, res) => {
  const { token } = req.query;
  if (!token) return res.json({ valid: false });
  const parts = token.split('.');
  if (parts.length !== 3) return res.json({ valid: false });
  
  const expiry = parseInt(parts[1], 10);
  if (Date.now() > expiry) return res.json({ valid: false });
  
  res.json({ valid: true, expiry });
});

app.get('/scan', (req, res) => {
  const token = generateToken();
  const menu = req.query.menu || 'main';
  res.redirect(`/menu.html?token=${token}&menu=${menu}`);
});

// --- DATABASE API ENDPOINTS ---

// --- NEW: GET ALL TABS (for admin UI category dropdowns) ---
app.get('/api/tabs', async (req, res) => {
  try {
    const tabs = await Tab.find().sort({ sortOrder: 1 });
    res.json(tabs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tabs' });
  }
});

// --- NEW: GET CATEGORIES FOR A SPECIFIC TAB ---
app.get('/api/categories/:tabKey', async (req, res) => {
  try {
    const { tabKey } = req.params;
    const categories = await Category.find({ tabKey }).sort({ sortOrder: 1 });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// --- NEW: UPDATE TAB SORT ORDER ---
app.post('/api/tabs/reorder', requireApiAdmin, async (req, res) => {
  try {
    const { tabKey, direction } = req.body; // direction: 'up' or 'down'
    
    const tab = await Tab.findOne({ key: tabKey });
    if (!tab) return res.status(404).json({ success: false });

    if (direction === 'up') {
      // Swap with the tab above (lower sortOrder)
      const swapTab = await Tab.findOne({ sortOrder: { $lt: tab.sortOrder } }).sort({ sortOrder: -1 });
      if (swapTab) {
        const tempSort = tab.sortOrder;
        tab.sortOrder = swapTab.sortOrder;
        swapTab.sortOrder = tempSort;
        await Promise.all([tab.save(), swapTab.save()]);
      }
    } else if (direction === 'down') {
      // Swap with the tab below (higher sortOrder)
      const swapTab = await Tab.findOne({ sortOrder: { $gt: tab.sortOrder } }).sort({ sortOrder: 1 });
      if (swapTab) {
        const tempSort = tab.sortOrder;
        tab.sortOrder = swapTab.sortOrder;
        swapTab.sortOrder = tempSort;
        await Promise.all([tab.save(), swapTab.save()]);
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// --- NEW: UPDATE CATEGORY SORT ORDER ---
app.post('/api/categories/reorder', requireApiAdmin, async (req, res) => {
  try {
    const { categoryId, direction } = req.body;
    
    const category = await Category.findById(categoryId);
    if (!category) return res.status(404).json({ success: false });

    if (direction === 'up') {
      const swapCategory = await Category.findOne({ 
        tabKey: category.tabKey, 
        sortOrder: { $lt: category.sortOrder } 
      }).sort({ sortOrder: -1 });
      
      if (swapCategory) {
        const tempSort = category.sortOrder;
        category.sortOrder = swapCategory.sortOrder;
        swapCategory.sortOrder = tempSort;
        await Promise.all([category.save(), swapCategory.save()]);
      }
    } else if (direction === 'down') {
      const swapCategory = await Category.findOne({ 
        tabKey: category.tabKey, 
        sortOrder: { $gt: category.sortOrder } 
      }).sort({ sortOrder: 1 });
      
      if (swapCategory) {
        const tempSort = category.sortOrder;
        category.sortOrder = swapCategory.sortOrder;
        swapCategory.sortOrder = tempSort;
        await Promise.all([category.save(), swapCategory.save()]);
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// --- NEW: REORDER ITEMS WITHIN CATEGORY ---
app.post('/api/menu/reorder-items', requireApiAdmin, async (req, res) => {
  try {
    const { itemId, direction } = req.body;
    
    const item = await MenuItem.findOne({ id: itemId });
    if (!item) return res.status(404).json({ success: false });

    if (direction === 'up') {
      const swapItem = await MenuItem.findOne({ 
        tab: item.tab,
        category: item.category,
        sortOrder: { $lt: item.sortOrder }
      }).sort({ sortOrder: -1 });
      
      if (swapItem) {
        const tempSort = item.sortOrder;
        item.sortOrder = swapItem.sortOrder;
        swapItem.sortOrder = tempSort;
        await Promise.all([item.save(), swapItem.save()]);
      }
    } else if (direction === 'down') {
      const swapItem = await MenuItem.findOne({ 
        tab: item.tab,
        category: item.category,
        sortOrder: { $gt: item.sortOrder }
      }).sort({ sortOrder: 1 });
      
      if (swapItem) {
        const tempSort = item.sortOrder;
        item.sortOrder = swapItem.sortOrder;
        swapItem.sortOrder = tempSort;
        await Promise.all([item.save(), swapItem.save()]);
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// --- EXISTING MENU ENDPOINTS (all unchanged) ---

app.get('/api/menu', async (req, res) => {
  try {
    const menu = await MenuItem.find({});
    res.json(menu);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
});

app.post('/api/menu/toggle', requireApiAdmin, async (req, res) => {
  try {
    const { id } = req.body;
    const item = await MenuItem.findOne({ id });
    if (item) {
      item.available = !item.available;
      await item.save();
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.post('/api/menu/add', requireApiAdmin, async (req, res) => {
  try {
    const { tab, category, name, price, desc_it, desc_en, image, available, isVegetarian, isVegan, isGlutenFree } = req.body;
    
    const newId = require('crypto').randomBytes(4).toString('hex');
    
    // Get the highest sortOrder in this category to add new item at the end
    const lastItem = await MenuItem.findOne({ tab, category }).sort({ sortOrder: -1 });
    const newSortOrder = lastItem ? lastItem.sortOrder + 1 : 1;
    
    const newItem = new MenuItem({
      id: newId,
      tab,
      category,
      name,
      price,
      desc_it,
      desc_en,
      image,
      available,
      isVegetarian,
      isVegan,
      isGlutenFree,
      clicks: 0,
      sortOrder: newSortOrder
    });

    await newItem.save();
    res.json({ success: true });
  } catch (err) {
    console.error("Error adding item:", err);
    res.status(500).json({ success: false, message: 'Failed to add item' });
  }
});

const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET
});

app.post('/api/menu/upload-image', requireApiAdmin, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  
  try {
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'ai-paladini-menu'
    });
    
    fs.unlinkSync(req.file.path);
    
    res.json({ success: true, imagePath: result.secure_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Cloud upload failed' });
  }
});

app.post('/api/menu/update-image', requireApiAdmin, async (req, res) => {
  try {
    const { id, imagePath } = req.body;
    await MenuItem.findOneAndUpdate({ id }, { image: imagePath });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.post('/api/menu/update-price', requireApiAdmin, async (req, res) => {
  try {
    const { id, price, image, isVegetarian, isVegan, isGlutenFree } = req.body;

    const updateData = {
      price: price,
      isVegetarian: isVegetarian,
      isVegan: isVegan,
      isGlutenFree: isGlutenFree
    };

    if (image) {
      updateData.image = image;
    }

    await MenuItem.findOneAndUpdate({ id: id }, { $set: updateData });
    
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update item' });
  }
});

app.post('/api/menu/update-category', requireApiAdmin, async (req, res) => {
  try {
    const { id, tab, category } = req.body;
    await MenuItem.findOneAndUpdate({ id }, { tab, category });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.post('/api/menu/reset-analytics', requireApiAdmin, async (req, res) => {
  try {
    await MenuItem.updateMany({}, { $set: { clicks: 0 } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.post('/api/menu/delete', requireApiAdmin, async (req, res) => {
  try {
    const { id } = req.body;
    const result = await MenuItem.deleteOne({ id });
    if (result.deletedCount > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, message: 'Item not found' });
    }
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.post('/api/menu/track', async (req, res) => {
  try {
    const { id } = req.body;
    await MenuItem.findOneAndUpdate({ id }, { $inc: { clicks: 1 } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// --- ADMIN QR GENERATOR ---
app.get('/api/admin-qr', requireApiAdmin, async (req, res) => {
  const scanUrl = `${req.protocol}://${req.get('host')}/scan?menu=main`;
  const qrDataUrl = await QRCode.toDataURL(scanUrl, { color: { dark: '#0C0A08', light: '#ffffff' } });
  res.json({ scanUrl, qrDataUrl });
});

app.get('/api/admin-qr-wine', requireApiAdmin, async (req, res) => {
  const scanUrl = `${req.protocol}://${req.get('host')}/scan?menu=wine`;
  const qrDataUrl = await QRCode.toDataURL(scanUrl, { color: { dark: '#8B3A3A', light: '#ffffff' } });
  res.json({ scanUrl, qrDataUrl });
});

app.get('/api/admin-qr-desserts', requireApiAdmin, async (req, res) => {
  const scanUrl = `${req.protocol}://${req.get('host')}/scan?menu=desserts`;
  const qrDataUrl = await QRCode.toDataURL(scanUrl, { color: { dark: '#8B5A2B', light: '#fffacd' } });
  res.json({ scanUrl, qrDataUrl });
});

// --- PAGE ROUTING ---
app.get('/', (req, res) => res.redirect('/admin.html'));
app.get('/admin', (req, res) => res.redirect('/admin.html'));
app.use((req, res) => res.status(404).send('Page not found. Are you looking for /admin.html?'));

app.listen(PORT, () => console.log(`\n✦ Ai Paladini Server running at http://localhost:${PORT}`));
