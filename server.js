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

// --- MONGOOSE SCHEMA & MODEL ---
const menuItemSchema = new mongoose.Schema({
  id: String,
  tab: String,
  category: String,
  name: String,
  price: String,
  desc: String,
  desc_it: String,
  desc_en: String,
  available: Boolean,
  image: String,
  // --- NEW DIETARY FIELDS ---
  isVegetarian: { type: Boolean, default: false },
  isVegan: { type: Boolean, default: false },
  isGlutenFree: { type: Boolean, default: false },
  clicks: { type: Number, default: 0 }
});
const MenuItem = mongoose.model('MenuItem', menuItemSchema);

// --- SETTINGS SCHEMA FOR LAYOUT & ORDER ---
const settingsSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  value: mongoose.Schema.Types.Mixed
});
const Settings = mongoose.model('Settings', settingsSchema);

// --- SEED DATABASE ON STARTUP ---
// Paste your ENTIRE existing menuDatabase array here:
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
  { id: '24', tab: 'food', category: 'Pizze / Pizzas', name: 'Pistacchio', price: '€ 15,00', desc: "mozzarella, guanciale, pistacchio, olio, origano", available: true },
  { id: '25', tab: 'food', category: 'Pizze / Pizzas', name: 'Gustosa', price: '€ 15,00', desc: "pomodoro, mozzarella, cipolla, olive nere, tonno, olio d'oliva, origano", available: true },
  { id: '26', tab: 'food', category: 'Pizze / Pizzas', name: 'Boscaiola', price: '€ 12,50', desc: "pomodoro, mozzarella, funghi, salsiccia, cipolla, olio d'oliva, origano", available: true },
  { id: '27', tab: 'food', category: 'Pizze / Pizzas', name: 'Acciughe e Burrata', price: '€ 13,00', desc: "pomodoro, acciughe, burrata, olio, origano", available: true },
  // Beers
  { id: '28', tab: 'drinks', category: 'Birre / Beers', name: 'Ceres', price: '€ 4,00', desc: "", available: true },
  { id: '29', tab: 'drinks', category: 'Birre / Beers', name: 'Heineken', price: '€ 4,00', desc: "", available: true },
  { id: '30', tab: 'drinks', category: 'Birre / Beers', name: "Beck's", price: '€ 3,50', desc: "", available: true },
  { id: '31', tab: 'drinks', category: 'Birre / Beers', name: 'Erdinger Weiss', price: '€ 5,50', desc: "", available: true },
  { id: '32', tab: 'drinks', category: 'Birre / Beers', name: 'Messina cristalli di sale', price: '€ 3,50', desc: "", available: true },
  { id: '33', tab: 'drinks', category: 'Birre / Beers', name: 'Corona', price: '€ 4,00', desc: "", available: true },
  { id: '34', tab: 'drinks', category: 'Birre / Beers', name: 'Nazionali 33 cl', price: '€ 3,00', desc: "", available: true },
  { id: '35', tab: 'drinks', category: 'Birre / Beers', name: 'Nazionali 66 cl', price: '€ 5,00', desc: "", available: true },
  { id: '36', tab: 'drinks', category: 'Birre / Beers', name: 'Nazionale alla Spina Piccola 20cl', price: '€ 3,50', desc: "", available: true },
  { id: '37', tab: 'drinks', category: 'Birre / Beers', name: 'Nazionale alla Spina Media 40cl', price: '€ 6,00', desc: "", available: true },
  { id: '38', tab: 'drinks', category: 'Birre / Beers', name: 'Birra artigianale bionda 37.5 cl', price: '€ 7,50', desc: "", available: true },
  { id: '39', tab: 'drinks', category: 'Birre / Beers', name: 'Birra artigianale rossa 37.5 cl', price: '€ 8,50', desc: "", available: true },
  { id: '40', tab: 'drinks', category: 'Birre / Beers', name: 'Birra artigianale nera 37.5 cl', price: '€ 9,50', desc: "", available: true },
  // Vini
  { id: '41', tab: 'drinks', category: 'Vini / Wine', name: 'Calice bianco, rosso, rosè', price: '€ 6,00', desc: "", available: true },
  { id: '42', tab: 'drinks', category: 'Vini / Wine', name: 'Flutè prosecco', price: '€ 6,00', desc: "", available: true },
  // Liquori
  { id: '43', tab: 'drinks', category: 'Liquori / Liquors', name: 'Nazionali', price: '€ 5,00', desc: "", available: true },
  { id: '44', tab: 'drinks', category: 'Liquori / Liquors', name: 'Nazionali barricati', price: '€ 6,00', desc: "", available: true },
  { id: '45', tab: 'drinks', category: 'Liquori / Liquors', name: 'Esteri', price: '€ 6,00', desc: "", available: true },
  { id: '46', tab: 'drinks', category: 'Liquori / Liquors', name: 'Amari', price: '€ 4,00', desc: "", available: true },
  { id: '47', tab: 'drinks', category: 'Liquori / Liquors', name: 'Amaretto Disaronno', price: '€ 5,00', desc: "", available: true },
  { id: '48', tab: 'drinks', category: 'Liquori / Liquors', name: 'Limoncello', price: '€ 4,00', desc: "", available: true },
  { id: '49', tab: 'drinks', category: 'Liquori / Liquors', name: 'Rosoli e Creme', price: '€ 4,00', desc: "", available: true },
  // Aperitivi
  { id: '50', tab: 'drinks', category: 'Aperitivi / Long drink', name: 'Aperol Spritz', price: '€ 8,00', desc: "", available: true },
  { id: '51', tab: 'drinks', category: 'Aperitivi / Long drink', name: 'Campari Orange', price: '€ 8,00', desc: "", available: true },
  { id: '52', tab: 'drinks', category: 'Aperitivi / Long drink', name: 'Gin Tonic Beefeater', price: '€ 8,00', desc: "", available: true },
  { id: '53', tab: 'drinks', category: 'Aperitivi / Long drink', name: 'Rum e Cola', price: '€ 8,00', desc: "", available: true },
  { id: '54', tab: 'drinks', category: 'Aperitivi / Long drink', name: 'Vodka Lemon', price: '€ 8,00', desc: "", available: true },
  { id: '55', tab: 'drinks', category: 'Aperitivi / Long drink', name: 'Vodka Orange', price: '€ 8,00', desc: "", available: true },
  { id: '56', tab: 'drinks', category: 'Aperitivi / Long drink', name: 'Vodka Redbull', price: '€ 8,00', desc: "", available: true },
  { id: '57', tab: 'drinks', category: 'Aperitivi / Long drink', name: 'Shot', price: '€ 3,00', desc: "", available: true },
  { id: '58', tab: 'drinks', category: 'Aperitivi / Long drink', name: 'Aperitivi analcolici', price: '€ 5,00', desc: "", available: true },
  { id: '59', tab: 'drinks', category: 'Aperitivi / Long drink', name: 'Aperitivi analcolici alla frutta', price: '€ 8,00', desc: "", available: true },
  // Soft drinks
  { id: '60', tab: 'drinks', category: 'Bevande / Soft drink', name: 'Acqua 50 cl', price: '€ 1,30', desc: "still or sparkling water", available: true },
  { id: '61', tab: 'drinks', category: 'Bevande / Soft drink', name: 'Acqua 1L', price: '€ 2,50', desc: "still or sparkling water", available: true },
  { id: '62', tab: 'drinks', category: 'Bevande / Soft drink', name: 'Acqua tonica', price: '€ 2,50', desc: "tonic/tonic lemon", available: true },
  { id: '63', tab: 'drinks', category: 'Bevande / Soft drink', name: 'Coca Cola, Fanta, Sprite 33 cl', price: '€ 2,50', desc: "", available: true },
  { id: '64', tab: 'drinks', category: 'Bevande / Soft drink', name: 'Lemon Soda, Chinotto, The Freddo 33 cl', price: '€ 2,50', desc: "", available: true },
  { id: '65', tab: 'drinks', category: 'Bevande / Soft drink', name: 'Red bull', price: '€ 4,00', desc: "", available: true },
  { id: '66', tab: 'drinks', category: 'Bevande / Soft drink', name: 'Spremuta di arancia', price: '€ 3,50', desc: "fresh orange juice", available: true },
  { id: '67', tab: 'drinks', category: 'Bevande / Soft drink', name: 'Spremuta di limone', price: '€ 4,00', desc: "fresh lemon juice", available: true },
  { id: '68', tab: 'drinks', category: 'Bevande / Soft drink', name: 'Succo di frutta', price: '€ 3,00', desc: "fruit juice in bottles", available: true },
  // Antipasti
  { id: '69', tab: 'restaurant', category: 'Antipasti / Starters', name: 'Tagliere di salumi e formaggi', price: '€ 15,00', desc: "cured meats and cheeses plate", available: true },
  { id: '70', tab: 'restaurant', category: 'Antipasti / Starters', name: 'Parmigiana', price: '€ 7,50', desc: "melanzane, salsa, mozzarella, basilico, parmigiano", available: true },
  { id: '71', tab: 'restaurant', category: 'Antipasti / Starters', name: 'Bruschetta', price: '€ 6,00', desc: "pomodoro, olio d'oliva, basilico, origano", available: true },
  { id: '72', tab: 'restaurant', category: 'Antipasti / Starters', name: 'Bruschetta nettuno', price: '€ 7,50', desc: "formaggio spalmabile, acciughe, miele", available: true },
  { id: '73', tab: 'restaurant', category: 'Antipasti / Starters', name: 'Bruschetta venere', price: '€ 7,00', desc: "pomodoro, cipolla rossa, ricotta salata, basilico", available: true },
  { id: '74', tab: 'restaurant', category: 'Antipasti / Starters', name: 'Bruschetta efesto', price: '€ 6,50', desc: "pomodoro, olio piccante, peperoncino, basilico, origano", available: true },
  // Primi Piatti
  { id: '75', tab: 'restaurant', category: 'Primi Piatti / First Courses', name: 'Lasagne al ragù', price: '€ 8,50', desc: "lasagna, ragú di carne, besciamella, mozzarella, parmigiano", available: true },
  { id: '76', tab: 'restaurant', category: 'Primi Piatti / First Courses', name: 'Gnocchi al pomodoro', price: '€ 8,00', desc: "gnocchi, pomodoro", available: true },
  { id: '77', tab: 'restaurant', category: 'Primi Piatti / First Courses', name: 'Tortellini alfredo', price: '€ 10,00', desc: "parmigiano, burro, prosciutto, panna, pepe", available: true },
  { id: '78', tab: 'restaurant', category: 'Primi Piatti / First Courses', name: 'Pasta Carbonara', price: '€ 11,00', desc: "guanciale, uova, parmigiano, pepe", available: true },
  { id: '79', tab: 'restaurant', category: 'Primi Piatti / First Courses', name: 'Pasta Arrabbiata', price: '€ 9,00', desc: "salsa piccante al pomodoro", available: true },
  { id: '80', tab: 'restaurant', category: 'Primi Piatti / First Courses', name: 'Pasta Amatriciana', price: '€ 10,00', desc: "salsa di pomodoro, guanciale, parmigiano", available: true },
  { id: '81', tab: 'restaurant', category: 'Primi Piatti / First Courses', name: 'Pasta Salmone', price: '€ 12,00', desc: "salmone affumicato, panna, salsa di pomodoro", available: true },
  { id: '82', tab: 'restaurant', category: 'Primi Piatti / First Courses', name: 'Pasta Norma', price: '€ 12,00', desc: "salsa di pomodoro, melanzane fritte, ricotta salata", available: true },
  { id: '83', tab: 'restaurant', category: 'Primi Piatti / First Courses', name: 'Pasta Carbonara di zucchine', price: '€ 11,00', desc: "zucchine, uova, parmigiano", available: true },
  { id: '84', tab: 'restaurant', category: 'Primi Piatti / First Courses', name: 'Spaghetti Veloci', price: '€ 9,50', desc: "aglio, olio d'oliva, peperoncino", available: true },
  { id: '85', tab: 'restaurant', category: 'Primi Piatti / First Courses', name: 'Spaghetti siciliani', price: '€ 11,50', desc: "olio, peperoncino, aglio, acciuga, pangrattato tostato", available: true },
  { id: '86', tab: 'restaurant', category: 'Primi Piatti / First Courses', name: 'Pasta Pistacchio', price: '€ 13,00', desc: "salsiccia, pesto di pistacchio, panna, granella di pistacchio", available: true },
  // Secondi Piatti
  { id: '87', tab: 'restaurant', category: 'Secondi Piatti / Main Courses', name: 'Cotoletta di pollo', price: '€ 9,50', desc: "", available: true },
  { id: '88', tab: 'restaurant', category: 'Secondi Piatti / Main Courses', name: 'Bistecca ai ferri', price: '€ 12,00', desc: "", available: true },
  { id: '89', tab: 'restaurant', category: 'Secondi Piatti / Main Courses', name: 'Petto di pollo grigliato', price: '€ 9,00', desc: "", available: true },
  { id: '90', tab: 'restaurant', category: 'Secondi Piatti / Main Courses', name: 'Arrosto misto came, salsiccia, polpetta', price: '€ 15,00', desc: "", available: true },
  { id: '91', tab: 'restaurant', category: 'Secondi Piatti / Main Courses', name: 'Polpette in salsa di pomodoro con ricotta salata', price: '€ 10,00', desc: "", available: true },
  // Desserts & Breakfast
  { id: '92', tab: 'desserts', category: 'Colazione / Breakfast', name: 'Cornetti/Croissant', price: '€ 1,80', desc: "", available: true },
  { id: '93', tab: 'desserts', category: 'Colazione / Breakfast', name: 'Cornetto al pistacchio', price: '€ 2,00', desc: "Pistachio croissants", available: true },
  { id: '94', tab: 'desserts', category: 'Colazione / Breakfast', name: 'Muffin', price: '€ 3,00', desc: "", available: true },
  { id: '95', tab: 'desserts', category: 'Colazione / Breakfast', name: 'Brioches', price: '€ 1,50', desc: "", available: true },
  { id: '96', tab: 'desserts', category: 'Colazione / Breakfast', name: 'Occhi di bue', price: '€ 3,00', desc: "Biscuit with chocolate, jam or pistachio", available: true },
  { id: '97', tab: 'desserts', category: 'Colazione / Breakfast', name: 'Crostata', price: '€ 3,50', desc: "", available: true },
  { id: '98', tab: 'desserts', category: 'Colazione / Breakfast', name: 'Zuccotto', price: '€ 3,00', desc: "marmellata di zucca, mandorle tostate", available: true },
  { id: '99', tab: 'desserts', category: 'Colazione / Breakfast', name: 'Cassatella', price: '€ 3,00', desc: "", available: true },
  { id: '100', tab: 'desserts', category: 'Colazione / Breakfast', name: 'Torta monoporzione', price: '€ 3,50', desc: "slice cake", available: true },
  { id: '101', tab: 'desserts', category: 'Gelateria / Ice cream', name: 'Granita', price: '€ 3,50', desc: "", available: true },
  { id: '102', tab: 'desserts', category: 'Gelateria / Ice cream', name: 'Brioche con gelato', price: '€ 6,00', desc: "brioche with ice-cream", available: true },
  { id: '103', tab: 'desserts', category: 'Gelateria / Ice cream', name: 'Cono gelato', price: '€ 3,50', desc: "ice-cream cone", available: true },
  { id: '104', tab: 'desserts', category: 'Gelateria / Ice cream', name: 'Coppetta piccola', price: '€ 3,00', desc: "small ice-cream cup", available: true },
  { id: '105', tab: 'desserts', category: 'Gelateria / Ice cream', name: 'Coppetta media', price: '€ 4,00', desc: "medium ice-cream cup", available: true },
  { id: '106', tab: 'desserts', category: 'Gelateria / Ice cream', name: 'Coppetta grande', price: '€ 5,00', desc: "big ice-cream cup", available: true },
  { id: '107', tab: 'desserts', category: 'Gelateria / Ice cream', name: 'Cannolo siciliano', price: '€ 3,00', desc: "sicilian pastry roll filled with ricotta cheese", available: true },
  // Wines - Sparkling
  { id: '108', tab: 'wine', category: 'Bollicine / Sparkling Wine', name: 'Ventuno DOC Brut Millesimato Cantine la Salute', price: '€ 22,00', desc: "Prosecco, Glera, Vol 11%", available: true },
  { id: '109', tab: 'wine', category: 'Bollicine / Sparkling Wine', name: 'Metodo Classico Extra Brut B. Cristo di Campobello 36 mesi', price: '€ 47,50', desc: "Grillo, Vol 12%", available: true },
  // Wines - Etna Bianchi
  { id: '110', tab: 'wine', category: 'I Vini dell\'Etna - Bianchi', name: 'Etna Bianco DOC Monteleone', price: '€ 44,00', desc: "Carricante, Vol 12,5%", available: true },
  { id: '111', tab: 'wine', category: 'I Vini dell\'Etna - Bianchi', name: 'Grotta della Neve Etna Bianco DOC Serafica', price: '€ 35,00', desc: "Carricante, Catarratto, Vol 13%", available: true },
  { id: '112', tab: 'wine', category: 'I Vini dell\'Etna - Bianchi', name: 'Contrada Arcuria Etna Bianco DOC BIO Baglio di Pianetto', price: '€ 32,00', desc: "Carricante, Vol 12,5%", available: true },
  { id: '113', tab: 'wine', category: 'I Vini dell\'Etna - Bianchi', name: 'Etna DOC BIO Bianco Contrada Santo Spirito Palmento Costanzo', price: '€ 73,00', desc: "Carricante, Vol 12%", available: true },
  { id: '114', tab: 'wine', category: 'I Vini dell\'Etna - Bianchi', name: 'Gagà Etna Bianco DOC Tenute Foti Randazzese', price: '€ 39,00', desc: "Carricante, Vol 12,5%", available: true },
  { id: '115', tab: 'wine', category: 'I Vini dell\'Etna - Bianchi', name: 'Etna Bianco DOC Me Gioiu Tenute Foti Randazzese', price: '€ 48,00', desc: "Carricante, Vol 12,5%", available: true },
  // Wines - Etna Rosati
  { id: '116', tab: 'wine', category: 'I Vini dell\'Etna - Rosati', name: 'Aita Etna Rosato DOC Tenute Foti Randazzese', price: '€ 39,00', desc: "Nerello Mascalese, Vol 12,5%", available: true },
  { id: '117', tab: 'wine', category: 'I Vini dell\'Etna - Rosati', name: 'Grotta dei Lamponi Etna Rosato DOC Serafica', price: '€ 36,00', desc: "Nerello Mascalese, Vol 13%", available: true },
  { id: '118', tab: 'wine', category: 'I Vini dell\'Etna - Rosati', name: 'Contrada Santo Spirito Etna Rosato DOC BIO Baglio di Pianetto', price: '€ 29,50', desc: "Nerello Mascalese, Vol 12,5%", available: true },
  // Wines - Etna Rossi
  { id: '119', tab: 'wine', category: 'I Vini dell\'Etna - Rossi', name: 'Etna Rosso DOC Monteleone', price: '€ 45,00', desc: "Nerello Mascalese, Nerello Cappuccio, Vol 13,5%", available: true },
  { id: '120', tab: 'wine', category: 'I Vini dell\'Etna - Rossi', name: 'Grotta del Gelo Etna Rosso DOC Serafica', price: '€ 36,00', desc: "Nerello Mascalese, Nerello Cappuccio, Vol 13%", available: true },
  { id: '121', tab: 'wine', category: 'I Vini dell\'Etna - Rossi', name: 'Contrada Santo Spirito Etna Rosso DOC BIO Baglio di Pianetto', price: '€ 32,00', desc: "Nerello Mascalese, Vol 13%", available: true },
  { id: '122', tab: 'wine', category: 'I Vini dell\'Etna - Rossi', name: 'Ninù Etna Rosso DOC Tenute Foti Randazzese', price: '€ 40,00', desc: "Nerello Mascalese, Vol 14%", available: true },
  // Wines - Siciliani Bianchi
  { id: '123', tab: 'wine', category: 'Vini Siciliani - Bianchi', name: 'Mater Soli IGT Bianco', price: '€ 23,00', desc: "Zibibbo, Vol 12%", available: true },
  { id: '124', tab: 'wine', category: 'Vini Siciliani - Bianchi', name: 'Mirantur IGP Serafica', price: '€ 24,00', desc: "Catarratto, Vol 13%", available: true },
  { id: '125', tab: 'wine', category: 'Vini Siciliani - Bianchi', name: 'Lalùci DOC BIO B. Cristo di Campobello', price: '€ 31,50', desc: "Grillo, Vol 12,5%", available: true },
  { id: '126', tab: 'wine', category: 'Vini Siciliani - Bianchi', name: 'Laudari DOC B. Cristo di Campobello', price: '€ 40,00', desc: "Chardonnay, Vol 13,5%", available: true },
  { id: '127', tab: 'wine', category: 'Vini Siciliani - Bianchi', name: 'Adènzia B. Cristo di Campobello DOC BIO', price: '€ 29,00', desc: "Inzolia, Grillo, Vol 13%", available: true },
  { id: '128', tab: 'wine', category: 'Vini Siciliani - Bianchi', name: 'C\'D\'C\' Terre Siciliane IGP B. Cristo di Campobello', price: '€ 24,50', desc: "Inzolia, Chardonnay, Catarratto, Vol 12,5%", available: true },
  { id: '129', tab: 'wine', category: 'Vini Siciliani - Bianchi', name: 'Insolia DOC BIO Baglio di Pianetto', price: '€ 23,00', desc: "Insolia, Vol 12,5%", available: true },
  { id: '130', tab: 'wine', category: 'Vini Siciliani - Bianchi', name: 'Grillo DOC BIO Baglio di Pianetto', price: '€ 23,00', desc: "Grillo, Vol 12,5%", available: true },
  { id: '131', tab: 'wine', category: 'Vini Siciliani - Bianchi', name: 'Catarratto DOC BIO Baglio di Pianetto', price: '€ 23,00', desc: "Catarratto, Vol 12%", available: true },
  { id: '132', tab: 'wine', category: 'Vini Siciliani - Bianchi', name: 'Maria Costanza DOP Bianco Milazzo', price: '€ 35,00', desc: "Inzolia, Chardonnay, Vol 13%", available: true },
  { id: '133', tab: 'wine', category: 'Vini Siciliani - Bianchi', name: 'Maria Costanza Gran Riserva DOP BIO Milazzo', price: '€ 65,00', desc: "Inzolia, Chardonnay, Sauvignon Blanc, Viogner, Vol 13%", available: true },
  { id: '134', tab: 'wine', category: 'Vini Siciliani - Bianchi', name: 'Ceuso DOC BIO Tonnino', price: '€ 49,00', desc: "Catarratto, Grillo, Grecanico, Vol 12,5%", available: true },
  { id: '135', tab: 'wine', category: 'Vini Siciliani - Bianchi', name: 'Pizzo di Gallo IGP BIO Tonnino', price: '€ 27,00', desc: "Pinot Grigio Ramato, Vol 12,5%", available: true },
  { id: '136', tab: 'wine', category: 'Vini Siciliani - Bianchi', name: 'Costa di Mezzo IGP BIO Tonnino', price: '€ 26,00', desc: "Pinot Grigio, Vol 12,5%", available: true },
  { id: '137', tab: 'wine', category: 'Vini Siciliani - Bianchi', name: 'Triangolo di Zabib IGP BIO Tonnino', price: '€ 24,00', desc: "Zibibbo, Vol 12%", available: true },
  { id: '138', tab: 'wine', category: 'Vini Siciliani - Bianchi', name: 'Mediterraneo IGP BIO Tonnino', price: '€ 28,00', desc: "Chenin Blanc, Vol 12,5%", available: true },
  { id: '139', tab: 'wine', category: 'Vini Siciliani - Bianchi', name: 'Bellifolli IGT Valle dell\'Acate', price: '€ 20,00', desc: "Inzolia, Vol 12%", available: true },
  { id: '140', tab: 'wine', category: 'Vini Siciliani - Bianchi', name: 'Per Mari DOC BIO Casa Grazia', price: '€ 27,00', desc: "Grillo, Vol 12%", available: true },
  // Wines - Siciliani Rosati
  { id: '141', tab: 'wine', category: 'Vini Siciliani - Rosati', name: 'C\'D\'C\' DOC Rosato B. Cristo di Campobello BIO', price: '€ 24,50', desc: "Nero d'Avola, Vol 12,5%", available: true },
  { id: '142', tab: 'wine', category: 'Vini Siciliani - Rosati', name: 'Per Mari Rosato DOC Casa Grazia', price: '€ 27,00', desc: "Frappato, Vol 12,5%", available: true },
  // Wines - Siciliani Rossi
  { id: '143', tab: 'wine', category: 'Vini Siciliani - Rossi', name: 'Bellifolli DOC Valle dell\'Acate', price: '€ 20,00', desc: "Nero d'Avola, Vol 12,5%", available: true },
  { id: '144', tab: 'wine', category: 'Vini Siciliani - Rossi', name: 'Bellifolli IGT Valle dell\'Acate', price: '€ 20,00', desc: "Syrah, Vol 12,5%", available: true },
  { id: '145', tab: 'wine', category: 'Vini Siciliani - Rossi', name: 'Mater Soli IGT Alicasi', price: '€ 24,50', desc: "Perricone, Vol 13%", available: true },
  { id: '146', tab: 'wine', category: 'Vini Siciliani - Rossi', name: 'Mater Soli IGT Calisto', price: '€ 24,50', desc: "Syrah Leggero Appassimento, Vol 12,5%", available: true },
  { id: '147', tab: 'wine', category: 'Vini Siciliani - Rossi', name: 'Mirantur IGP Serafica', price: '€ 24,00', desc: "Nerello Mascalese, Nerello Cappuccio, Vol 13%", available: true },
  { id: '148', tab: 'wine', category: 'Vini Siciliani - Rossi', name: 'Lu Patri DOC B. Cristo di Campobello', price: '€ 42,50', desc: "Nero d'Avola, Vol 14,5%", available: true },
  { id: '149', tab: 'wine', category: 'Vini Siciliani - Rossi', name: 'Lusirà DOC B. Cristo di Campobello', price: '€ 42,50', desc: "Syrah, Vol 14,5%", available: true },
  { id: '150', tab: 'wine', category: 'Vini Siciliani - Rossi', name: 'Vi Veri DOC BIO Casa Grazia', price: '€ 38,00', desc: "Cabernet Sauvignon, Vol 14,5%", available: true },
  { id: '151', tab: 'wine', category: 'Vini Siciliani - Rossi', name: 'C\'D\'C\' IGP B. Cristo di Campobello', price: '€ 24,50', desc: "Nero d'Avola, Merlot, Syrah, Cabernet Sauvignon, Vol 13,5%", available: true },
  { id: '152', tab: 'wine', category: 'Vini Siciliani - Rossi', name: 'Syrah DOC BIO Baglio di Pianetto', price: '€ 24,00', desc: "Syrah, Vol 13,5%", available: true },
  { id: '153', tab: 'wine', category: 'Vini Siciliani - Rossi', name: 'Frappato IGT BIO Baglio di Pianetto', price: '€ 24,00', desc: "Frappato, Vol 13%", available: true },
  { id: '154', tab: 'wine', category: 'Vini Siciliani - Rossi', name: 'Nero d\'Avola DOC BIO Baglio di Pianetto', price: '€ 24,00', desc: "Nero d'Avola, Vol 13,5%", available: true },
  { id: '155', tab: 'wine', category: 'Vini Siciliani - Rossi', name: 'Adènzia DOC B. Cristo di Campobello', price: '€ 32,00', desc: "Nero d'Avola, Syrah, Vol 14,5%", available: true },
  { id: '156', tab: 'wine', category: 'Vini Siciliani - Rossi', name: 'Passo della Contessa DOC BIO Tonnino', price: '€ 23,50', desc: "Nero d'Avola, Vol 13%", available: true },
  { id: '157', tab: 'wine', category: 'Vini Siciliani - Rossi', name: 'Ceuso Tonnino DOC BIO', price: '€ 59,00', desc: "Nero d'Avola, Cabernet Sauvignon, Merlot, Vol 14%", available: true },
  { id: '158', tab: 'wine', category: 'Vini Siciliani - Rossi', name: 'Candido – Vomere d\'Oro BIO', price: '€ 21,00', desc: "Perricone, Vol 12,5%", available: true },
  { id: '159', tab: 'wine', category: 'Vini Siciliani - Rossi', name: 'Victorya 1607 DOCG BIO Casa Grazia', price: '€ 35,00', desc: "Cerasuolo di Vittoria, Vol 13%", available: true },
  // Wines - Vini Italiani
  { id: '160', tab: 'wine', category: 'Vini Italiani', name: 'Santa Cristina – Chardonnay DOC', price: '€ 25,00', desc: "Chardonnay, Vol 12%", available: true },
  { id: '161', tab: 'wine', category: 'Vini Italiani', name: 'Cantina La Salute – Liette Sauvignon Trevenezie IGT', price: '€ 23,00', desc: "Sauvignon Blanc, Vol 12%", available: true },
  { id: '162', tab: 'wine', category: 'Vini Italiani', name: 'Vigna di Pallino Tenuta Sette Ponti Chianti BIO', price: '€ 22,50', desc: "Sangiovese, Vol 14%", available: true },
  { id: '163', tab: 'wine', category: 'Vini Italiani', name: 'Barolo Marchesi di Barolo 2023', price: '€ 82,00', desc: "Nebbiolo, Vol 14%", available: true },
  // Wines - Vini Mossi
  { id: '164', tab: 'wine', category: 'Vini Mossi / Sparkling Wine', name: 'Bianco di Nera IGP Milazzo', price: '€ 29,00', desc: "BIO Inzolia, Chardonnay, Nerello Cappuccio, Vol 12%", available: true },
  { id: '165', tab: 'wine', category: 'Vini Mossi / Sparkling Wine', name: 'Rosso di Nera IGP Milazzo', price: '€ 29,00', desc: "BIO Nero d'Avola, Nerello Cappuccio, Vol 12%", available: true },
  { id: '166', tab: 'wine', category: 'Vini Mossi / Sparkling Wine', name: 'Rosè di Rosa IGP Milazzo', price: '€ 29,00', desc: "BIO Inzolia Rosa, Chardonnay, Vol 12%", available: true }
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
app.use(cookieParser()); // NEW: Parse cookies

// --- SECURITY MIDDLEWARE ---
// Protects the HTML page
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

// Protects the API endpoints from Postman/Hacker attacks
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
    // Generate a 12-hour token
    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '12h' });
    // Save it in a secure, HttpOnly cookie so JavaScript cannot steal it
    res.cookie('adminToken', token, { httpOnly: true, secure: true, sameSite: 'strict' });
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: 'Invalid password' });
  }
});

// --- INTERCEPT ADMIN.HTML (MUST BE BEFORE express.static) ---
app.get('/admin.html', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.get('/admin', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Now we can safely serve the rest of the public folder
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

// --- ONE-TIME DATABASE MIGRATION SCRIPT ---
app.get('/api/migrate-db', async (req, res) => {
  try {
    // 1. Move all 'drinks' to 'bar'
    await MenuItem.updateMany({ tab: 'drinks' }, { $set: { tab: 'bar' } });

    // 2. Move Breakfast out of 'desserts' and into 'bar'
    await MenuItem.updateMany({ category: 'Colazione / Breakfast' }, { $set: { tab: 'bar' } });

    // 3. Automatically add the entire Cocktails & Spirits list
    const cocktailCount = await MenuItem.countDocuments({ tab: 'cocktails' });
    if (cocktailCount === 0) {
      const newCocktails = [
        // SPARKLING & SPRITZ (8€)
        { name: 'Bellini', desc_it: 'Pesca, Prosecco', desc_en: 'Peach, Prosecco', price: '€ 8,00', category: 'Sparkling & Spritz' },
        { name: 'Rossini', desc_it: 'Fragola, Prosecco', desc_en: 'Strawberry, Prosecco', price: '€ 8,00', category: 'Sparkling & Spritz' },
        { name: 'Mimosa', desc_it: 'Arancia, Prosecco', desc_en: 'Orange, Prosecco', price: '€ 8,00', category: 'Sparkling & Spritz' },
        { name: 'Kir Royal', desc_it: 'Creme de Cassis, Prosecco', desc_en: 'Creme de Cassis, Prosecco', price: '€ 8,00', category: 'Sparkling & Spritz' },
        { name: 'Aperol Spritz', desc_it: 'Aperol, Prosecco, Soda water', desc_en: 'Aperol, Prosecco, Soda water', price: '€ 8,00', category: 'Sparkling & Spritz' },
        { name: 'Martini Spritz', desc_it: 'Martini bianco, Prosecco, Soda Water', desc_en: 'Sweet Vermouth, Prosecco, Soda Water', price: '€ 8,00', category: 'Sparkling & Spritz' },
        { name: 'Campari Spritz', desc_it: 'Campari, Prosecco, Soda Water', desc_en: 'Campari, Prosecco, Soda Water', price: '€ 8,00', category: 'Sparkling & Spritz' },
        { name: 'Hugo Spritz', desc_it: 'Liquore Sambuco, Prosecco, Soda Water', desc_en: 'Elderflower Liqueur, Prosecco, Soda Water', price: '€ 8,00', category: 'Sparkling & Spritz' },
        { name: 'Limoncello Spritz', desc_it: 'Limoncello, Prosecco, Soda Water', desc_en: 'Limoncello, Prosecco, Soda Water', price: '€ 8,00', category: 'Sparkling & Spritz' },

        // PRE-DINNER (9€)
        { name: 'Americano', desc_it: 'Martini rosso, Bitter Campari, Soda Water', desc_en: 'Sweet Vermouth, Campari, Soda Water', price: '€ 9,00', category: 'Pre-Dinner' },
        { name: 'Negroni', desc_it: 'Bitter Campari, Martini rosso, Gin', desc_en: 'Campari, Sweet Vermouth, Gin', price: '€ 9,00', category: 'Pre-Dinner' },
        { name: 'Dry Martini', desc_it: 'Gin, Martini dry', desc_en: 'Gin, Dry Vermouth', price: '€ 9,00', category: 'Pre-Dinner' },
        { name: 'Vodka Martini', desc_it: 'Vodka, Martini dry', desc_en: 'Vodka, Dry Vermouth', price: '€ 9,00', category: 'Pre-Dinner' },
        { name: 'Daiquiri', desc_it: 'Rum, succo di limone, Sciroppo di zucchero', desc_en: 'Rum, Lemon juice, Simple syrup', price: '€ 9,00', category: 'Pre-Dinner' },
        { name: 'Manhattan', desc_it: 'Canadian whisky, Martini rosso, Angostura', desc_en: 'Canadian whisky, Sweet Vermouth, Angostura bitters', price: '€ 9,00', category: 'Pre-Dinner' },

        // AFTER DINNER (9€)
        { name: 'Black Russian', desc_it: 'Kalua, Vodka', desc_en: 'Kahlúa, Vodka', price: '€ 9,00', category: 'After Dinner' },
        { name: 'French Connection', desc_it: 'Cognac, Amaretto', desc_en: 'Cognac, Amaretto', price: '€ 9,00', category: 'After Dinner' },
        { name: 'God Father', desc_it: 'Whisky, Amaretto', desc_en: 'Whisky, Amaretto', price: '€ 9,00', category: 'After Dinner' },
        { name: 'God Mother', desc_it: 'Vodka, Amaretto', desc_en: 'Vodka, Amaretto', price: '€ 9,00', category: 'After Dinner' },
        { name: 'Irish Coffee', desc_it: 'Whisky Irlandese, Caffè, Panna', desc_en: 'Irish Whiskey, Coffee, Cream', price: '€ 9,00', category: 'After Dinner' },
        { name: 'Stinger', desc_it: 'Brandy, crema di menta bianca', desc_en: 'Brandy, White crème de menthe', price: '€ 9,00', category: 'After Dinner' },
        { name: 'Espresso Martini', desc_it: 'Vodka, Kahlúa, Espresso, Sciroppo di zucchero', desc_en: 'Vodka, Kahlúa, Espresso, Simple Syrup', price: '€ 9,00', category: 'After Dinner' },

        // ALL TIME (10€)
        { name: 'Caipirinha', desc_it: 'Cachaça, Lime, Zucchero di canna', desc_en: 'Cachaça, Lime, Brown sugar', price: '€ 10,00', category: 'All Time' },
        { name: 'Caipiroska', desc_it: 'Vodka, Lime, Zucchero di canna', desc_en: 'Vodka, Lime, Brown sugar', price: '€ 10,00', category: 'All Time' },
        { name: 'Daiquiri alla frutta', desc_it: 'Rum, Succo di limone, Zucchero, Frutta fresca', desc_en: 'Rum, Lemon juice, Sugar, Fresh fruit', price: '€ 10,00', category: 'All Time' },
        { name: 'Margarita', desc_it: 'Tequila, Triple sec, Succo di limone', desc_en: 'Tequila, Triple sec, Lemon juice', price: '€ 10,00', category: 'All Time' },
        { name: 'Mojito', desc_it: 'Rum, Lime, Zucchero di canna, Menta, Soda water', desc_en: 'Rum, Lime, Brown sugar, Mint, Soda water', price: '€ 10,00', category: 'All Time' },
        { name: 'Piña Colada', desc_it: 'Rum, Succo di ananas, Cocco', desc_en: 'Rum, Pineapple juice, Coconut', price: '€ 10,00', category: 'All Time' },
        { name: 'Tequila Sunrise', desc_it: 'Tequila, Succo d\'arancia, Granatina', desc_en: 'Tequila, Orange juice, Grenadine', price: '€ 10,00', category: 'All Time' },
        { name: 'Cuba Libre', desc_it: 'Rum, Succo di limone, Coca Cola', desc_en: 'Rum, Lemon juice, Coca Cola', price: '€ 10,00', category: 'All Time' },
        { name: 'Bloody Mary', desc_it: 'Vodka, Pomodoro, Limone, Worcester, Tabasco', desc_en: 'Vodka, Tomato, Lemon, Worcester, Tabasco', price: '€ 10,00', category: 'All Time' },
        { name: 'Long Island Ice Tea', desc_it: 'Tequila, Vodka, Rum, Triple sec, Gin, Limone', desc_en: 'Tequila, Vodka, Rum, Triple sec, Gin, Lemon', price: '€ 10,00', category: 'All Time' },
        { name: 'Moscow Mule', desc_it: 'Vodka, Succo di lime, Ginger beer', desc_en: 'Vodka, Lime juice, Ginger beer', price: '€ 10,00', category: 'All Time' },
        { name: 'Pimm\'s cup n.1', desc_it: 'Pimm\'s, Ginger Ale, frutta mista', desc_en: 'Pimm\'s, Ginger Ale, mixed fruit', price: '€ 10,00', category: 'All Time' },

        // GIN TONIC / MIXERS
        { name: 'Gin Mare Tonic', desc_it: '', desc_en: '', price: '€ 12,00', category: 'Gin Tonic / Mixers' },
        { name: 'Gin Hendrick\'s Tonic', desc_it: '', desc_en: '', price: '€ 11,00', category: 'Gin Tonic / Mixers' },
        { name: 'Gin Bombay Tonic', desc_it: '', desc_en: '', price: '€ 9,00', category: 'Gin Tonic / Mixers' },
        { name: 'Gin Tanqueray Tonic', desc_it: '', desc_en: '', price: '€ 9,00', category: 'Gin Tonic / Mixers' },
        { name: 'Gin Beefeater Tonic', desc_it: '', desc_en: '', price: '€ 8,00', category: 'Gin Tonic / Mixers' },
        { name: 'Vodka Tonic/Lemon', desc_it: '', desc_en: '', price: '€ 8,00', category: 'Gin Tonic / Mixers' },
        { name: 'Vodka Orange', desc_it: '', desc_en: '', price: '€ 8,00', category: 'Gin Tonic / Mixers' },
        { name: 'Vodka RedBull', desc_it: '', desc_en: '', price: '€ 8,00', category: 'Gin Tonic / Mixers' },
        { name: 'Rum e Cola', desc_it: '', desc_en: '', price: '€ 8,00', category: 'Gin Tonic / Mixers' },

        // DISTILLATI / SPIRITS
        { name: 'Gin Mare', desc_it: 'Gin', desc_en: 'Gin', price: '€ 10,00', category: 'Distillati / Spirits' },
        { name: 'Gin Hendrick\'s', desc_it: 'Gin', desc_en: 'Gin', price: '€ 9,00', category: 'Distillati / Spirits' },
        { name: 'Gin Bombay Sapphire / Tanqueray', desc_it: 'Gin', desc_en: 'Gin', price: '€ 7,00', category: 'Distillati / Spirits' },
        { name: 'Absolut', desc_it: 'Vodka', desc_en: 'Vodka', price: '€ 8,00', category: 'Distillati / Spirits' },
        { name: 'Belvedere', desc_it: 'Vodka', desc_en: 'Vodka', price: '€ 9,00', category: 'Distillati / Spirits' },
        { name: 'Josè Cuervo', desc_it: 'Tequila', desc_en: 'Tequila', price: '€ 7,00', category: 'Distillati / Spirits' },
        { name: 'Havana 7', desc_it: 'Rum', desc_en: 'Rum', price: '€ 8,00', category: 'Distillati / Spirits' },
        { name: 'Jack Daniel\'s (Bourbon)', desc_it: 'Whisky', desc_en: 'Whisky', price: '€ 8,00', category: 'Distillati / Spirits' },
        { name: 'Laphroaig 10 (Single malt)', desc_it: 'Whisky', desc_en: 'Whisky', price: '€ 9,00', category: 'Distillati / Spirits' },
        { name: 'Oban 14 (Torbato)', desc_it: 'Whisky', desc_en: 'Whisky', price: '€ 10,00', category: 'Distillati / Spirits' },
        { name: 'Courvoisier Vsop', desc_it: 'Cognac', desc_en: 'Cognac', price: '€ 11,00', category: 'Distillati / Spirits' },
        { name: 'Remy Martin Vsop', desc_it: 'Cognac', desc_en: 'Cognac', price: '€ 12,00', category: 'Distillati / Spirits' },
        { name: 'Grappa Barricata', desc_it: 'Grappa', desc_en: 'Grappa', price: '€ 6,00', category: 'Distillati / Spirits' }
      ].map(item => ({
        id: require('crypto').randomBytes(4).toString('hex'),
        tab: 'cocktails',
        available: true,
        clicks: 0,
        ...item
      }));

      await MenuItem.insertMany(newCocktails);
    }

    res.send('<div style="font-family: sans-serif; text-align: center; padding: 50px;"><h1>✅ Migration Complete!</h1><p>Breakfast is now in the Bar menu, drinks are moved, and all Cocktails have been uploaded to MongoDB.</p><a href="/admin.html" style="padding: 15px 30px; background: #8B5A2B; color: white; text-decoration: none; border-radius: 4px;">Return to Admin Dashboard</a></div>');
  } catch (err) {
    res.status(500).send('Error during migration: ' + err.message);
  }
});

app.get('/api/menu', async (req, res) => {
  try {
    const menu = await MenuItem.find({});
    res.json(menu);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
});

// --- GET CATEGORY ORDER ---
app.get('/api/settings/category-order', async (req, res) => {
  try {
    const setting = await Settings.findOne({ key: 'categoryOrder' });
    res.json(setting ? setting.value : null);
  } catch (err) {
    res.status(500).json(null);
  }
});

// --- SAVE CATEGORY ORDER ---
app.post('/api/settings/category-order', requireApiAdmin, async (req, res) => {
  try {
    await Settings.findOneAndUpdate(
      { key: 'categoryOrder' },
      { value: req.body },
      { upsert: true, new: true } // Upsert creates it if it doesn't exist yet
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
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

// --- ADD NEW ITEM ---
app.post('/api/menu/add', requireApiAdmin, async (req, res) => {
  try {
    // 1. Catch the new dietary fields from the frontend
    const { tab, category, name, price, desc_it, desc_en, image, available, isVegetarian, isVegan, isGlutenFree } = req.body;
    
    // 2. Generate a secure, unique ID on the server (avoids frontend crashes)
    const newId = require('crypto').randomBytes(4).toString('hex');
    
    // 3. Create the new item with all the data
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
      clicks: 0
    });

    // 4. Save to MongoDB
    await newItem.save();
    res.json({ success: true });
  } catch (err) {
    console.error("Error adding item:", err);
    res.status(500).json({ success: false, message: 'Failed to add item' });
  }
});

const cloudinary = require('cloudinary').v2;

// Configure Cloudinary (You will get these keys in Step 3)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET
});

app.post('/api/menu/upload-image', requireApiAdmin, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  
  try {
    // Upload the file from the temporary local folder to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'ai-paladini-menu'
    });
    
    // Delete the temporary local file after uploading to cloud
    fs.unlinkSync(req.file.path);
    
    // Return the PERMANENT Cloudinary URL to save in your Database
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

// --- UPDATE EXISTING ITEM (Price, Image, and Dietary Badges) ---
app.post('/api/menu/update-price', requireApiAdmin, async (req, res) => {
  try {
    // 1. "Catch" all the data sent from the admin.html edit form
    const { id, price, image, isVegetarian, isVegan, isGlutenFree } = req.body;

    // 2. Package the text and boolean data together
    const updateData = {
      price: price,
      isVegetarian: isVegetarian,
      isVegan: isVegan,
      isGlutenFree: isGlutenFree
    };

    // 3. Only overwrite the image if a new one was actually uploaded
    if (image) {
      updateData.image = image;
    }

    // 4. Find the item in MongoDB and apply the updates
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

// --- RESET ANALYTICS ---
app.post('/api/menu/reset-analytics', requireApiAdmin, async (req, res) => {
  try {
    // $set: { clicks: 0 } applies to every document in the MenuItem collection
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

// --- ANALYTICS TRACKING ENDPOINT ---
app.post('/api/menu/track', async (req, res) => {
  try {
    const { id } = req.body;
    // $inc tells MongoDB to increment the current number by 1
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
