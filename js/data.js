// Стандартное меню Chicken Hot (из Instagram @chicken_hot_petropavlovsk).
// Это значения по умолчанию: после подключения Supabase всё редактируется в админке.
window.CH_DEFAULT = {
  settings: {
    name: 'Chicken Hot',
    city: 'Петропавловск',
    tagline: 'От тебя до вкусной курочки всего один звонок',
    phone: '+7 708 597 72 35',
    whatsapp: '77085977235',
    instagram: 'chicken_hot_petropavlovsk',
    address: '',
    open: '11:00',
    close: '00:00',
    deliveryFrom: 800,
    freeFrom: 8000,
    kaspiRed: true,
    acceptOrders: true,
    payments: ['Kaspi перевод', 'Kaspi RED', 'Наличные курьеру'],
    notice: ''
  },

  categories: [
    { id: 'combo',   name: 'Комбо' },
    { id: 'wings',   name: 'Крылышки' },
    { id: 'burgers', name: 'Бургеры' },
    { id: 'snacks',  name: 'Закуски' },
    { id: 'pizza',   name: 'Пицца' },
    { id: 'rolls',   name: 'Роллы' },
    { id: 'sets',    name: 'Сеты' },
    { id: 'drinks',  name: 'Напитки' },
    { id: 'sauces',  name: 'Соусы' }
  ],

  promos: [
    { id: 'p2', active: true, title: 'Бесплатная доставка', text: 'Привезём бесплатно по Петропавловску при заказе от 8 000 ₸.', code: '', img: 'img/naggetsy.jpg' },
    { id: 'p3', active: true, title: 'Kaspi RED', text: 'Оплачивайте заказ частями через Kaspi RED.', code: '', img: '' }
  ],

  items: [
    // --- Комбо ---
    { id: 'combo-large',   cat: 'combo', name: 'Large',   desc: '50 крылышек + 2 фри + 2 л колы + 4 соуса', price: 14990, img: '', hit: true,  available: true },
    { id: 'combo-friends', cat: 'combo', name: 'Friends', desc: '40 крылышек + 2 фри + 2 л колы + 4 соуса', price: 12990, img: '', hit: false, available: true },
    { id: 'combo-family',  cat: 'combo', name: 'Family',  desc: '30 крылышек + 1 фри + 1 л колы + 2 соуса', price: 8990,  img: '', hit: false, available: true },
    { id: 'combo-middle',  cat: 'combo', name: 'Middle',  desc: '20 крылышек + 1 фри + 1 л колы + 2 соуса', price: 6990,  img: '', hit: false, available: true },

    // --- Крылышки ---
    { id: 'wings', cat: 'wings', name: 'Крылышки', desc: 'Хрустящие крылышки в панировке. Выберите количество:', img: 'img/kurochka.jpg', hit: true, available: true,
      variants: [
        { n: '20 шт', p: 5600 }, { n: '30 шт', p: 7700 }, { n: '40 шт', p: 9900 }, { n: '50 шт', p: 12500 },
        { n: '60 шт', p: 14500 }, { n: '70 шт', p: 16600 }, { n: '100 шт', p: 22900 }
      ] },

    // --- Бургеры ---
    { id: 'cheeseburger',  cat: 'burgers', name: 'Чизбургер',  desc: '', price: 1500, img: 'img/cheeseburger.jpg',  available: true },
    { id: 'hamburger',     cat: 'burgers', name: 'Гамбургер',  desc: '', price: 1400, img: 'img/hamburger.jpg',     available: true },
    { id: 'chickenburger', cat: 'burgers', name: 'Чикенбургер', desc: '', price: 1300, img: 'img/chickenburger.jpg', available: true },

    // --- Закуски ---
    { id: 'nuggets', cat: 'snacks', name: 'Наггетсы', desc: '', img: 'img/naggetsy.jpg', available: true, variants: [{ n: '5 шт', p: 800 }, { n: '10 шт', p: 1600 }] },
    { id: 'fries',   cat: 'snacks', name: 'Картофель фри', desc: '1 порция', price: 600, img: 'img/fri.jpg', available: true },

    // --- Пицца ---
    { id: 'pizza-margarita',  cat: 'pizza', name: 'Маргарита',          desc: '', price: 2890, img: 'img/pizza-margarita.jpg',    available: true },
    { id: 'pizza-pepperoni',  cat: 'pizza', name: 'Пепперони',          desc: '', price: 2990, img: 'img/pizza-pepperoni.jpg',    available: true, hit: true },
    { id: 'pizza-4-seasons',  cat: 'pizza', name: '4 сезона',           desc: '', price: 3300, img: 'img/pizza-4-sezona.jpg',     available: true },
    { id: 'pizza-chicken-mush', cat: 'pizza', name: 'С курицей и грибами', desc: '', price: 3490, img: 'img/pizza-kurica-griby.jpg', available: true },

    // --- Роллы ---
    { id: 'roll-philadelphia', cat: 'rolls', name: 'Филадельфия',            desc: '', price: 2999, img: 'img/filadelfiya.jpg',     available: true, hit: true },
    { id: 'roll-alaska',       cat: 'rolls', name: 'Аляска с лососем',       desc: '', price: 2790, img: 'img/alyaska.jpg',         available: true },
    { id: 'roll-california',   cat: 'rolls', name: 'Калифорния с крабом',    desc: '', price: 2790, img: 'img/kaliforniya.jpg',     available: true },
    { id: 'roll-chuka',        cat: 'rolls', name: 'Чука ролл',              desc: '', price: 2790, img: 'img/chuka.jpg',           available: true },
    { id: 'roll-chuka-sumakh', cat: 'rolls', name: 'Чука ролл с сумахом',    desc: '', price: 2790, img: 'img/chuka-summah.jpg',    available: true },
    { id: 'roll-cheddar',      cat: 'rolls', name: 'Сливочный чеддер',       desc: '', price: 2690, img: 'img/slivochnyi-chedr.jpg', available: true },
    { id: 'roll-caesar',       cat: 'rolls', name: 'Цезарь ролл',            desc: '', price: 2890, img: 'img/cezar.jpg',           available: true },
    { id: 'roll-asahi',        cat: 'rolls', name: 'Асахи темпура',          desc: '', price: 2890, img: 'img/asahi-tempura.jpg',   available: true },
    { id: 'roll-sake-tempura', cat: 'rolls', name: 'Саке темпура',           desc: '', price: 2990, img: 'img/sake-tempura.jpg',    available: true },
    { id: 'roll-baked-salmon', cat: 'rolls', name: 'Запечённый ролл с лососем', desc: '', price: 3190, img: 'img/zapech-losos.jpg', available: true },
    { id: 'roll-baked-chicken', cat: 'rolls', name: 'Запечённый ролл с курицей', desc: '', price: 2990, img: 'img/zapech-kurica.jpg', available: true },
    { id: 'roll-gunkan',       cat: 'rolls', name: 'Гунканы',                desc: '6 шт', price: 3000, img: 'img/gunkany.jpg',     available: true },
    { id: 'roll-sake-maki',    cat: 'rolls', name: 'Саке-маки',              desc: '', price: 1490, img: 'img/sake-maki.jpg',       available: true },
    { id: 'roll-crab-maki',    cat: 'rolls', name: 'Краб-маки',              desc: '', price: 1190, img: 'img/krab-maki.jpg',       available: true },
    { id: 'sushi-burger-salmon',  cat: 'rolls', name: 'Суши-бургер с лососем', desc: '', price: 3190, img: 'img/burger-losos.jpg',      available: true },
    { id: 'sushi-burger-chicken', cat: 'rolls', name: 'Суши-бургер с курицей', desc: '', price: 2990, img: 'img/burger-kurica-roll.jpg', available: true },

    // --- Сеты ---
    { id: 'set-for-two',   cat: 'sets', name: 'Сет «Для двоих»', desc: '', price: 5990,  img: 'img/set-dlya-dvoih.jpg',   available: true },
    { id: 'set-fried',     cat: 'sets', name: 'Сет «Жареный»',   desc: '', price: 7990,  img: 'img/set-zharenyi.jpg',    available: true },
    { id: 'set-family',    cat: 'sets', name: 'Сет «Семейный»',  desc: '', price: 9999,  img: 'img/set-semeinyi.jpg',    available: true, hit: true },
    { id: 'set-baked',     cat: 'sets', name: 'Сет «Запечённый»', desc: '', price: 11990, img: 'img/set-zapechenyi.jpg', available: true },
    { id: 'set-friends',   cat: 'sets', name: 'Сет «Для друзей»', desc: 'Роллы + пицца + картофель фри', price: 14990, img: 'img/set-dlya-druzei.jpg', available: true },

    // --- Напитки ---
    { id: 'cola', cat: 'drinks', name: 'Coca-Cola', desc: '', img: '', available: true, variants: [{ n: '1 л', p: 700 }, { n: '2 л', p: 1000 }] },

    // --- Соусы ---
    { id: 'sauce', cat: 'sauces', name: 'Соус', desc: 'Выберите вкус', img: 'img/sousy.jpg', available: true,
      variants: [{ n: 'Сырный', p: 200 }, { n: 'Томатный', p: 200 }, { n: 'Барбекю', p: 200 }, { n: 'Чесночный', p: 200 }] }
  ]
};
