/**
 * Sample catalogue for Moore Supermarket.
 * Variant tuple: [label, price, compareAtPrice|null, stock]
 * `pack` and `hue` drive the generated packshot illustration (see scripts/generate-product-art.js).
 */

const categories = [
  // African
  { name: 'Rice and Grains', slug: 'rice-and-grains', region: 'african', description: 'Long-grain parboiled rice, ofada, semovita, fonio and more.' },
  { name: 'African Spices and Seasonings', slug: 'african-spices-and-seasonings', region: 'african', description: 'Suya pepper, crayfish, curry, thyme, bouillon and seasoning cubes.' },
  { name: 'Palm Oil and Cooking Oils', slug: 'palm-oil-and-cooking-oils', region: 'african', description: 'Red palm oil, groundnut oil and vegetable oils for authentic flavour.' },
  { name: 'Garri and Cassava Products', slug: 'garri-and-cassava-products', region: 'african', description: 'White and yellow garri, fufu flour, lafun and tapioca.' },
  { name: 'Yam and Plantain', slug: 'yam-and-plantain', region: 'african', description: 'Fresh puna yam, plantain, poundo yam and elubo flour.' },
  { name: 'African Snacks', slug: 'african-snacks', region: 'african', description: 'Chin chin, plantain chips, kuli kuli and other favourites.' },
  { name: 'African Beverages', slug: 'african-beverages', region: 'african', description: 'Malt drinks, Milo, zobo, Lipton and Bournvita.' },
  { name: 'Canned and Packaged Foods', slug: 'canned-and-packaged-foods', region: 'african', description: 'Tomato paste, sardines, corned beef and instant noodles.' },
  { name: 'Beans and Legumes', slug: 'beans-and-legumes', region: 'african', description: 'Honey beans, black-eyed peas, egusi and ogbono.' },
  { name: 'African Sauces and Condiments', slug: 'african-sauces-and-condiments', region: 'african', description: 'Shito, pepper sauce, palm nut cream and stew bases.' },
  // Caribbean
  { name: 'Caribbean Spices and Seasonings', slug: 'caribbean-spices-and-seasonings', region: 'caribbean', description: 'All-purpose seasoning, allspice, curry powder and browning.' },
  { name: 'Jamaican Products', slug: 'jamaican-products', region: 'caribbean', description: 'Ackee, jerk seasoning, Jamaican patties and more from Jamaica.' },
  { name: 'Caribbean Snacks', slug: 'caribbean-snacks', region: 'caribbean', description: 'Banana chips, hard dough bread, bulla cake and ginger biscuits.' },
  { name: 'Tropical Drinks and Juices', slug: 'tropical-drinks-and-juices', region: 'caribbean', description: 'Ting, Kola Champagne, sorrel, mango and guava nectars.' },
  { name: 'Caribbean Sauces', slug: 'caribbean-sauces', region: 'caribbean', description: 'Hot pepper sauces, jerk BBQ sauce and escovitch sauce.' },
  { name: 'Coconut Products', slug: 'coconut-products', region: 'caribbean', description: 'Coconut milk, cream, water and virgin coconut oil.' },
  { name: 'Caribbean Rice and Grains', slug: 'caribbean-rice-and-grains', region: 'caribbean', description: 'Basmati, cornmeal, hominy corn and rice-and-peas essentials.' },
  { name: 'Caribbean Canned Foods', slug: 'caribbean-canned-foods', region: 'caribbean', description: 'Callaloo, gungo peas, mackerel and Vienna sausages.' },
  { name: 'Tropical Fruits', slug: 'tropical-fruits', region: 'caribbean', description: 'Mangoes, breadfruit, soursop, green bananas and more.' },
  { name: 'Caribbean Cooking Ingredients', slug: 'caribbean-cooking-ingredients', region: 'caribbean', description: 'Scotch bonnet peppers, salted codfish, dumpling flour and pimento.' },
];

const p = (category, name, brand, origin, pack, hue, description, variants, extra = {}) => ({
  category, name, brand, origin, pack, hue, description, variants, ...extra,
});

const products = [
  // Rice and Grains
  p('rice-and-grains', 'Royal Stallion Parboiled Long Grain Rice', 'Royal Stallion', 'Thailand', 'sack', 140,
    'Premium stone-free parboiled long grain rice, perfect for jollof, fried rice and coconut rice. Cooks fluffy and separate every time.',
    [['10 lb', 14.99, 17.99, 40], ['25 lb', 32.99, 38.99, 22], ['50 lb', 59.99, null, 8]], { rating: 4.8, numReviews: 214, sold: 940, featured: true, bestSeller: true, tags: ['jollof', 'rice'] }),
  p('rice-and-grains', 'Ofada Rice (Unpolished)', 'Ofada Gold', 'Nigeria', 'bag', 30,
    'Aromatic, locally grown Nigerian unpolished rice with a distinctive nutty flavour. Traditionally served with ayamase (designer stew).',
    [['2 lb', 8.49, null, 30], ['5 lb', 18.99, null, 14]], { rating: 4.6, numReviews: 61, sold: 210, tags: ['ofada'] }),
  p('rice-and-grains', 'Golden Penny Semovita', 'Golden Penny', 'Nigeria', 'bag', 45,
    'Fine semolina for smooth, stretchy swallow. Pairs perfectly with egusi, okra and efo riro.',
    [['2 lb', 6.49, null, 50], ['10 lb', 19.99, 22.99, 18]], { rating: 4.7, numReviews: 132, sold: 520, bestSeller: true, tags: ['swallow'] }),
  p('rice-and-grains', 'Organic Fonio Grain', 'Yolélé', 'Senegal', 'pouch', 55,
    'Ancient West African super-grain that cooks in five minutes. Gluten-free, light and nutty — a great substitute for couscous or rice.',
    [['1 lb', 7.99, null, 24]], { rating: 4.5, numReviews: 38, sold: 96, tags: ['gluten-free'] }),

  // African Spices and Seasonings
  p('african-spices-and-seasonings', 'Suya Pepper Spice (Yaji)', 'Mama Africa', 'Nigeria', 'jar', 15,
    'Smoky, nutty and fiery suya spice blend made with ground kuli kuli, ginger, chilli and spices. Rub onto beef, chicken or roasted vegetables.',
    [['3.5 oz', 4.99, null, 60], ['8 oz', 9.49, null, 25]], { rating: 4.9, numReviews: 188, sold: 610, featured: true, bestSeller: true, tags: ['suya', 'grill'] }),
  p('african-spices-and-seasonings', 'Maggi Star Seasoning Cubes', 'Maggi', 'Nigeria', 'box', 5,
    'The essential West African bouillon cube for stews, soups and jollof rice. 100 cubes per pack.',
    [['100 cubes', 5.99, 6.99, 80]], { rating: 4.8, numReviews: 302, sold: 1300, bestSeller: true, tags: ['bouillon'] }),
  p('african-spices-and-seasonings', 'Ground Crayfish', 'Ola Ola', 'Nigeria', 'jar', 25,
    'Finely ground smoked crayfish adds deep umami to egusi, ogbono, okra and pepper soup.',
    [['3 oz', 6.49, null, 34], ['7 oz', 12.99, null, 4]], { rating: 4.7, numReviews: 97, sold: 340, tags: ['soup'] }),
  p('african-spices-and-seasonings', 'Pepper Soup Spice Mix', 'Tropical Sun', 'Nigeria', 'pouch', 20,
    'Aromatic blend of calabash nutmeg, alligator pepper, uda and uziza for a warming Nigerian pepper soup.',
    [['3.5 oz', 4.49, null, 45]], { rating: 4.6, numReviews: 54, sold: 180, tags: ['pepper soup'] }),

  // Palm Oil and Cooking Oils
  p('palm-oil-and-cooking-oils', 'Red Palm Oil (Zomi)', 'Praise', 'Ghana', 'bottle', 10,
    'Rich, unrefined red palm oil with an authentic aroma. Essential for banga soup, red-red, efo riro and palava sauce.',
    [['500 ml', 6.99, null, 40], ['1 L', 11.99, 13.99, 28], ['2 L', 21.99, null, 10]], { rating: 4.8, numReviews: 156, sold: 720, featured: true, bestSeller: true, tags: ['palm oil'] }),
  p('palm-oil-and-cooking-oils', 'Pure Groundnut Oil', 'Kings', 'Nigeria', 'bottle', 45,
    'Cold-pressed peanut oil with a clean, nutty taste. Ideal for frying plantain, puff-puff and akara.',
    [['1 L', 8.99, null, 30], ['3 L', 22.99, null, 12]], { rating: 4.6, numReviews: 72, sold: 260 }),
  p('palm-oil-and-cooking-oils', 'Palm Kernel Oil', 'Tropical Sun', 'Ghana', 'bottle', 35,
    'Light golden palm kernel oil for cooking and traditional recipes.',
    [['500 ml', 7.49, null, 0]], { rating: 4.3, numReviews: 18, sold: 40 }),

  // Garri and Cassava Products
  p('garri-and-cassava-products', 'Ijebu White Garri', 'Ayoola', 'Nigeria', 'bag', 50,
    'Crisp, sour Ijebu-style garri — perfect for soaking with cold water, sugar and groundnuts, or for making eba.',
    [['4 lb', 7.99, null, 55], ['10 lb', 16.99, 19.99, 20]], { rating: 4.7, numReviews: 143, sold: 580, bestSeller: true, tags: ['eba'] }),
  p('garri-and-cassava-products', 'Yellow Garri (with Palm Oil)', 'Ayoola', 'Nigeria', 'bag', 40,
    'Smooth yellow garri processed with palm oil for a rich colour and mild flavour. Makes soft, golden eba.',
    [['4 lb', 8.49, null, 38]], { rating: 4.6, numReviews: 81, sold: 300 }),
  p('garri-and-cassava-products', 'Cassava Fufu Flour', 'Tropiway', 'Ghana', 'box', 35,
    'Instant cassava fufu flour — just add hot water and stir for smooth, stretchy fufu in minutes.',
    [['24 oz', 6.99, null, 42], ['4 lb', 15.99, null, 15]], { rating: 4.5, numReviews: 90, sold: 330, tags: ['fufu'] }),

  // Yam and Plantain
  p('yam-and-plantain', 'Fresh Ghana Puna Yam', 'Moore Fresh', 'Ghana', 'produce', 30,
    'Hand-selected fresh puna yam tubers with a fluffy, starchy texture. Boil, fry or pound into iyan.',
    [['Per lb', 3.49, null, 120], ['Whole tuber (~5 lb)', 16.99, 17.45, 25]], { rating: 4.7, numReviews: 66, sold: 410, featured: true, tags: ['fresh', 'yam'] }),
  p('yam-and-plantain', 'Green Plantains', 'Moore Fresh', 'Ecuador', 'produce', 90,
    'Firm green plantains for tostones, plantain chips and boiled plantain. Ripens to sweet dodo in 4–6 days.',
    [['Each', 0.89, null, 300], ['Bunch of 5', 3.99, 4.45, 60]], { rating: 4.8, numReviews: 120, sold: 1100, bestSeller: true, tags: ['fresh', 'plantain'] }),
  p('yam-and-plantain', 'Poundo Yam Flour', 'Ola Ola', 'Nigeria', 'bag', 30,
    'Instant pounded yam flour for smooth, lump-free iyan without the pounding. Serve with egusi or efo riro.',
    [['4 lb', 11.99, 13.99, 34], ['10 lb', 26.99, null, 9]], { rating: 4.6, numReviews: 104, sold: 450 }),
  p('yam-and-plantain', 'Elubo (Yam Flour for Amala)', 'Ayoola', 'Nigeria', 'bag', 25,
    'Traditional sun-dried yam flour for dark, earthy amala. Best with ewedu and gbegiri.',
    [['4 lb', 10.99, null, 3]], { rating: 4.5, numReviews: 47, sold: 150 }),

  // African Snacks
  p('african-snacks', 'Crunchy Chin Chin', 'Tasty Bites', 'Nigeria', 'pouch', 35,
    'Sweet, crunchy fried dough bites lightly spiced with nutmeg. The ultimate Nigerian party snack.',
    [['10 oz', 4.99, null, 70]], { rating: 4.7, numReviews: 88, sold: 390, featured: true }),
  p('african-snacks', 'Plantain Chips (Lightly Salted)', 'Olu Olu', 'Nigeria', 'pouch', 50,
    'Thin, crispy plantain chips fried to golden perfection with a pinch of sea salt.',
    [['3 oz', 2.49, 2.99, 100], ['6-pack', 12.99, 14.94, 20]], { rating: 4.6, numReviews: 72, sold: 520, bestSeller: true }),
  p('african-snacks', 'Kuli Kuli Groundnut Sticks', 'Mama Africa', 'Nigeria', 'pouch', 28,
    'Crunchy roasted peanut snack sticks — high in protein and delicious with garri or on its own.',
    [['7 oz', 3.99, null, 40]], { rating: 4.4, numReviews: 29, sold: 110 }),

  // African Beverages
  p('african-beverages', 'Maltina Classic Malt Drink', 'Maltina', 'Nigeria', 'can', 30,
    'Rich, non-alcoholic malt drink fortified with vitamins. Best served ice cold.',
    [['Single can', 1.79, null, 150], ['24-pack', 36.99, 42.96, 15]], { rating: 4.8, numReviews: 160, sold: 870, featured: true, bestSeller: true }),
  p('african-beverages', 'Milo Chocolate Malt Powder', 'Nestlé Milo', 'Ghana', 'can', 125,
    'The West African favourite chocolate malt energy drink. Mix with hot or cold milk.',
    [['14 oz', 8.99, null, 45], ['3.3 lb', 21.99, 24.99, 12]], { rating: 4.9, numReviews: 210, sold: 640, bestSeller: true }),
  p('african-beverages', 'Zobo Hibiscus Leaves (Dried)', 'Moore Select', 'Nigeria', 'pouch', 340,
    'Dried roselle hibiscus petals for brewing refreshing zobo with ginger, pineapple and cloves.',
    [['4 oz', 4.49, null, 55]], { rating: 4.6, numReviews: 58, sold: 230, tags: ['zobo', 'sorrel'] }),

  // Canned and Packaged Foods
  p('canned-and-packaged-foods', 'Gino Tomato Paste', 'Gino', 'Nigeria', 'can', 5,
    'Thick, double-concentrated tomato paste — the backbone of a rich jollof and Sunday stew.',
    [['2.5 oz (x10)', 6.99, null, 60], ['14 oz', 3.49, null, 70]], { rating: 4.7, numReviews: 95, sold: 610 }),
  p('canned-and-packaged-foods', 'Titus Sardines in Vegetable Oil', 'Titus', 'Morocco', 'can', 210,
    'Tender sardines in vegetable oil. Enjoy with bread, in stews or with fried yam.',
    [['125 g', 2.29, null, 90], ['Pack of 5', 10.49, 11.45, 22]], { rating: 4.6, numReviews: 77, sold: 430 }),
  p('canned-and-packaged-foods', 'Indomie Chicken Instant Noodles', 'Indomie', 'Nigeria', 'box', 45,
    'The iconic instant noodles loved across West Africa. Carton of 40 packs.',
    [['Single pack', 0.79, null, 400], ['Carton (40)', 26.99, 31.6, 18]], { rating: 4.8, numReviews: 250, sold: 1500, bestSeller: true }),

  // Beans and Legumes
  p('beans-and-legumes', 'Oloyin Honey Beans', 'Ola Ola', 'Nigeria', 'bag', 30,
    'Naturally sweet brown honey beans — the best choice for ewa agoyin, porridge beans and moi moi.',
    [['4 lb', 9.99, null, 35], ['10 lb', 21.99, null, 10]], { rating: 4.8, numReviews: 112, sold: 380, featured: true }),
  p('beans-and-legumes', 'Ground Egusi (Melon Seeds)', 'Tropical Sun', 'Nigeria', 'pouch', 50,
    'Finely ground melon seeds for thick, flavourful egusi soup.',
    [['14 oz', 9.49, 10.99, 40]], { rating: 4.7, numReviews: 86, sold: 360 }),
  p('beans-and-legumes', 'Ground Ogbono Seeds', 'Ola Ola', 'Nigeria', 'pouch', 30,
    'Wild mango seeds, ground for a perfectly drawy ogbono soup.',
    [['7 oz', 10.99, null, 20]], { rating: 4.6, numReviews: 41, sold: 140 }),

  // African Sauces and Condiments
  p('african-sauces-and-condiments', 'Ghanaian Shito Black Pepper Sauce', 'Mama Africa', 'Ghana', 'jar', 15,
    'Rich, smoky Ghanaian hot sauce made with dried fish, shrimp, ginger and chilli. Delicious with kenkey, rice or fried yam.',
    [['10 oz', 7.99, null, 32]], { rating: 4.8, numReviews: 99, sold: 300, featured: true }),
  p('african-sauces-and-condiments', 'Palm Nut Cream (Banga)', 'Tropical Sun', 'Ghana', 'can', 10,
    'Concentrated palm fruit cream for banga soup and abenkwan (palm nut soup).',
    [['28 oz', 4.99, 5.79, 36]], { rating: 4.5, numReviews: 52, sold: 200 }),
  p('african-sauces-and-condiments', 'Nigerian Pepper Stew Base', 'Moore Kitchen', 'USA', 'jar', 8,
    'Slow-cooked blend of tatashe, tomatoes, scotch bonnet and onions. Ready to fry for instant stew or jollof base.',
    [['16 oz', 6.99, null, 28]], { rating: 4.4, numReviews: 23, sold: 90 }),

  // Caribbean Spices and Seasonings
  p('caribbean-spices-and-seasonings', 'Grace All Purpose Seasoning', 'Grace', 'Jamaica', 'jar', 110,
    'A savoury blend of herbs and spices for meats, fish, rice and vegetables.',
    [['5.29 oz', 4.49, null, 50]], { rating: 4.7, numReviews: 102, sold: 410 }),
  p('caribbean-spices-and-seasonings', 'Jamaican Curry Powder', 'Betapac', 'Jamaica', 'jar', 45,
    'Turmeric-rich Jamaican curry with allspice and fenugreek — the secret to curry goat and curry chicken.',
    [['4 oz', 4.99, null, 46], ['1 lb', 13.99, 15.99, 14]], { rating: 4.9, numReviews: 170, sold: 560, featured: true, bestSeller: true, tags: ['curry goat'] }),
  p('caribbean-spices-and-seasonings', 'Browning Sauce', 'Grace', 'Jamaica', 'bottle', 20,
    'Caramelised sugar browning for rich colour in stew chicken, oxtail and black cake.',
    [['4.8 oz', 3.49, null, 60]], { rating: 4.7, numReviews: 64, sold: 290 }),
  p('caribbean-spices-and-seasonings', 'Whole Pimento (Allspice) Berries', 'Moore Select', 'Jamaica', 'pouch', 15,
    'Fragrant whole Jamaican pimento berries — essential for jerk, escovitch and soups.',
    [['2 oz', 3.99, null, 40]], { rating: 4.6, numReviews: 31, sold: 120 }),

  // Jamaican Products
  p('jamaican-products', 'Grace Ackee in Brine', 'Grace', 'Jamaica', 'can', 50,
    "Tender, buttery ackee — Jamaica's national fruit. Sauté with saltfish, onions and scotch bonnet for the classic breakfast.",
    [['19 oz', 12.99, 14.99, 45]], { rating: 4.9, numReviews: 230, sold: 820, featured: true, bestSeller: true, tags: ['ackee and saltfish'] }),
  p('jamaican-products', "Walkerswood Traditional Jerk Seasoning", 'Walkerswood', 'Jamaica', 'jar', 25,
    'Authentic hot & spicy jerk paste with scotch bonnet, pimento, thyme and scallion. Marinate overnight for the best results.',
    [['10 oz', 7.99, null, 55], ['17 oz', 11.99, 13.49, 20]], { rating: 4.9, numReviews: 260, sold: 900, featured: true, bestSeller: true, tags: ['jerk', 'grill'] }),
  p('jamaican-products', 'Jamaican Beef Patties (Frozen)', "Tastee", 'Jamaica', 'box', 30,
    'Flaky golden pastry filled with spicy seasoned beef. Bake from frozen in 25 minutes. Box of 6.',
    [['6-pack', 9.99, null, 30], ['12-pack', 18.49, 19.98, 12]], { rating: 4.7, numReviews: 140, sold: 470 }),
  p('jamaican-products', 'Blue Mountain Coffee Blend', 'Jablum', 'Jamaica', 'bag', 30,
    'Smooth, mild Jamaica Blue Mountain coffee blend — ground for drip and French press.',
    [['8 oz', 19.99, null, 18]], { rating: 4.8, numReviews: 58, sold: 120 }),

  // Caribbean Snacks
  p('caribbean-snacks', 'Hard Dough Bread', 'National', 'Jamaica', 'box', 40,
    'Soft, slightly sweet dense Jamaican bread loaf. Perfect toasted with butter or with ackee and saltfish.',
    [['Loaf', 5.49, null, 20]], { rating: 4.6, numReviews: 46, sold: 260 }),
  p('caribbean-snacks', 'Spiced Bun', 'HTB', 'Jamaica', 'box', 15,
    'Dark, moist spiced bun with raisins and cherries. Traditional with a slice of cheese.',
    [['21 oz', 8.99, 9.99, 22]], { rating: 4.7, numReviews: 61, sold: 200, featured: true }),
  p('caribbean-snacks', 'Banana Chips', 'Chippies', 'Jamaica', 'pouch', 55,
    'Crispy salted green banana chips — a favourite Jamaican snack.',
    [['2.1 oz', 1.99, null, 80], ['12-pack', 19.99, 23.88, 10]], { rating: 4.5, numReviews: 39, sold: 310 }),

  // Tropical Drinks and Juices
  p('tropical-drinks-and-juices', 'Ting Grapefruit Soda', 'Ting', 'Jamaica', 'can', 75,
    'Sparkling Jamaican grapefruit soda made with real juice. Crisp, tart and refreshing.',
    [['Single can', 1.69, null, 160], ['12-pack', 17.99, 20.28, 20]], { rating: 4.8, numReviews: 128, sold: 760, bestSeller: true }),
  p('tropical-drinks-and-juices', 'Kola Champagne', 'DG', 'Jamaica', 'bottle', 25,
    'Sweet cream-soda style Caribbean favourite with a hint of kola.',
    [['20 oz', 2.29, null, 70]], { rating: 4.5, numReviews: 37, sold: 190 }),
  p('tropical-drinks-and-juices', 'Mango Nectar', 'Tropical Rhythms', 'Jamaica', 'bottle', 38,
    'Thick, sweet mango nectar made from ripe Caribbean mangoes.',
    [['16 oz', 2.49, 2.99, 5], ['1 L', 4.49, null, 26]], { rating: 4.6, numReviews: 44, sold: 220 }),
  p('tropical-drinks-and-juices', 'Sorrel Drink (Seasonal)', 'Grace', 'Jamaica', 'bottle', 345,
    'Ready-to-drink sorrel infused with ginger and spices — a Caribbean Christmas tradition.',
    [['1 L', 4.99, null, 0]], { rating: 4.7, numReviews: 52, sold: 260 }),

  // Caribbean Sauces
  p('caribbean-sauces', 'Scotch Bonnet Pepper Sauce', 'Encona', 'Jamaica', 'bottle', 5,
    'Fiery West Indian hot pepper sauce made with scotch bonnet chillies. A few drops go a long way.',
    [['5 oz', 4.49, null, 60]], { rating: 4.8, numReviews: 118, sold: 470, bestSeller: true }),
  p('caribbean-sauces', 'Jerk BBQ Sauce', 'Walkerswood', 'Jamaica', 'bottle', 15,
    'Smoky-sweet barbecue sauce with a jerk kick. Brush on ribs, wings and grilled chicken.',
    [['17 oz', 6.99, 7.99, 34]], { rating: 4.6, numReviews: 57, sold: 210, featured: true }),
  p('caribbean-sauces', 'Pickapeppa Sauce', 'Pickapeppa', 'Jamaica', 'bottle', 30,
    'Tangy, sweet Jamaican condiment aged in oak barrels. Great with cream cheese or on steak.',
    [['5 oz', 5.49, null, 24]], { rating: 4.7, numReviews: 70, sold: 180 }),

  // Coconut Products
  p('coconut-products', 'Coconut Milk (Full Fat)', 'Grace', 'Jamaica', 'can', 190,
    'Rich, creamy coconut milk for rice and peas, curries, run down and desserts.',
    [['13.5 oz', 2.49, null, 120], ['Pack of 6', 13.49, 14.94, 25]], { rating: 4.8, numReviews: 150, sold: 820, bestSeller: true }),
  p('coconut-products', 'Pure Coconut Water', 'Grace', 'Jamaica', 'can', 150,
    'Naturally hydrating coconut water with no added sugar.',
    [['17.5 oz', 2.99, null, 80]], { rating: 4.5, numReviews: 48, sold: 260 }),
  p('coconut-products', 'Virgin Coconut Oil', 'KTC', 'Caribbean', 'jar', 165,
    'Cold-pressed unrefined coconut oil for cooking, baking and hair care.',
    [['16 oz', 9.99, 11.99, 30]], { rating: 4.7, numReviews: 63, sold: 190, featured: true }),

  // Caribbean Rice and Grains
  p('caribbean-rice-and-grains', 'Fine Yellow Cornmeal', 'Lasco', 'Jamaica', 'bag', 48,
    'Fine yellow cornmeal for cornmeal porridge, festivals and turn cornmeal.',
    [['2 lb', 3.99, null, 50]], { rating: 4.6, numReviews: 40, sold: 210 }),
  p('caribbean-rice-and-grains', 'Hominy Corn', 'Grace', 'Jamaica', 'can', 55,
    'Tender hominy corn for creamy Jamaican hominy porridge with nutmeg and vanilla.',
    [['19 oz', 2.79, null, 44]], { rating: 4.5, numReviews: 28, sold: 120 }),
  p('caribbean-rice-and-grains', 'Golden Sella Basmati Rice', 'Tilda', 'India', 'sack', 42,
    'Long-grain parboiled basmati — the rice of choice for Caribbean rice and peas and pelau.',
    [['10 lb', 19.99, 22.99, 26]], { rating: 4.8, numReviews: 95, sold: 400 }),

  // Caribbean Canned Foods
  p('caribbean-canned-foods', 'Callaloo in Brine', 'Grace', 'Jamaica', 'can', 115,
    'Tender Jamaican callaloo greens, ready to steam with onions, tomato and saltfish.',
    [['19 oz', 3.99, null, 48]], { rating: 4.6, numReviews: 66, sold: 300 }),
  p('caribbean-canned-foods', 'Gungo (Pigeon) Peas', 'Grace', 'Jamaica', 'can', 85,
    'Green pigeon peas — the traditional choice for Christmas rice and peas.',
    [['15 oz', 2.49, 2.89, 60]], { rating: 4.7, numReviews: 54, sold: 340 }),
  p('caribbean-canned-foods', 'Mackerel in Tomato Sauce', 'Grace', 'Jamaica', 'can', 0,
    'Mackerel fillets in rich tomato sauce. Classic with boiled green bananas and dumplings.',
    [['15 oz', 3.49, null, 70]], { rating: 4.6, numReviews: 61, sold: 360 }),

  // Tropical Fruits
  p('tropical-fruits', 'Fresh Julie Mangoes', 'Moore Fresh', 'Jamaica', 'produce', 40,
    'Sweet, juicy, fibre-free Julie mangoes. Ripe and ready to eat.',
    [['Each', 1.99, null, 90], ['Box of 6', 10.99, 11.94, 15]], { rating: 4.8, numReviews: 74, sold: 410, featured: true }),
  p('tropical-fruits', 'Fresh Breadfruit', 'Moore Fresh', 'Jamaica', 'produce', 85,
    'Whole breadfruit for roasting, frying or boiling. A Caribbean staple.',
    [['Each (~3 lb)', 6.99, null, 18]], { rating: 4.5, numReviews: 22, sold: 90 }),
  p('tropical-fruits', 'Green Bananas', 'Moore Fresh', 'Ecuador', 'produce', 100,
    'Firm green cooking bananas — boil and serve with mackerel, saltfish or run down.',
    [['Per lb', 1.29, null, 200]], { rating: 4.6, numReviews: 35, sold: 300 }),

  // Caribbean Cooking Ingredients
  p('caribbean-cooking-ingredients', 'Fresh Scotch Bonnet Peppers', 'Moore Fresh', 'Jamaica', 'produce', 10,
    'Fiery, fruity scotch bonnets — the heart of jerk, pepper sauce and escovitch.',
    [['4 oz', 2.99, null, 60]], { rating: 4.9, numReviews: 88, sold: 520, bestSeller: true }),
  p('caribbean-cooking-ingredients', 'Boneless Salted Codfish', 'Moore Select', 'Canada', 'box', 205,
    'Premium boneless salted cod for ackee and saltfish, fish fritters and bul jol. Soak before cooking.',
    [['1 lb', 13.99, 15.99, 40]], { rating: 4.8, numReviews: 97, sold: 450, featured: true }),
  p('caribbean-cooking-ingredients', 'Dumpling Flour', 'Lasco', 'Jamaica', 'bag', 25,
    'All-purpose flour milled for perfect fried dumplings (johnny cakes) and spinners.',
    [['4 lb', 5.49, null, 36]], { rating: 4.5, numReviews: 24, sold: 130 }),
];

module.exports = { categories, products };
