# Collection Report

Дашборд збору коштів по клініках: ціль vs. фактичний collection, статус кожної клініки та прогрес до бонусного Tier.

Сайт статичний (HTML + CSS + JS-модулі, без збірки), дані — у Firebase Realtime Database. Хоститься на GitHub Pages.

## Бонусні Tier

Tier визначається **кількістю клінік, що виконали 100%+ своєї цілі**:

| Tier   | Клінік на 100%+ |
|--------|-----------------|
| Tier 1 | 12–14           |
| Tier 2 | 15–23           |
| Tier 3 | 24+             |

Пороги змінюються в одному місці — `TIERS` у [js/config.js](js/config.js).

## Структура

```
index.html            розмітка сторінки
css/styles.css        стилі; кольори — токени в :root
js/
  main.js             старт, рендер, обробка кнопок, логін
  config.js           бізнес-правила: Tier, статуси, штати, розмітка Excel
  state.js            стан сторінки
  data.js             усе, що працює з Firebase (auth, дані, історія, налаштування)
  metrics.js          розрахунки (% виконання, статуси, Tier, підсумки)
  render.js           KPI, картки клінік, таблиця, панель Tier
  charts.js           графіки (Chart.js)
  locations.js        додати / редагувати / видалити / перетягнути клініку
  history.js          архів звітів
  importer.js         імпорт Excel, синхронізація з SharePoint, налаштування
  excel.js            парсинг Excel (спільний для сайту й tools/)
  utils.js            форматування, модалки, toast
tools/                Node-скрипти для локальної роботи (на сайті не використовуються)
firebase/             правила бази даних
```

## Локальний запуск

ES-модулі не працюють через `file://`, потрібен локальний сервер:

```bash
npm start            # http://localhost:8080
```

(або розширення Live Server у VS Code).

## Деплой на GitHub Pages

1. **Settings → Pages → Build and deployment → Source: Deploy from a branch**
2. Branch: **`main`**, folder: **`/ (root)`** → Save.
3. Через 1–2 хв сайт оновиться на `https://yuraromaniv.github.io/collection-report/`.

Кожен push у `main` оновлює сайт автоматично.

## Налаштування Firebase (один раз)

1. **Authentication → Users** — змінити пароль адміна (старий був у відкритому коді).
2. **Authentication → Settings → User actions** — вимкнути *Enable create (sign-up)*, щоб ніхто не міг зареєструвати власний акаунт.
3. **Authentication → Settings → Authorized domains** — додати `yuraromaniv.github.io`.
4. **Realtime Database → Rules** — вставити вміст [firebase/database.rules.json](firebase/database.rules.json), замінивши `YOUR_ADMIN_EMAIL` на email адміна. Читання даних лишається публічним, запис і налаштування — тільки для адміна.
5. На сайті: **Login → Settings** — вставити посилання SharePoint на Excel-файл. Воно зберігається в базі (`config/sharepointUrl`), а не в коді.

## Інструменти (Node)

```bash
npm install

# Подивитися, як сайт прочитає Excel-файл
npm run inspect -- "C:/path/CR.xlsx" [Sheet]

# Залити Excel у базу з командного рядка (облікові дані — у .env, див. .env.example)
npm run sync -- "C:/path/CR.xlsx" [Sheet]
```

> `.env`, Excel-файли та `node_modules` не комітяться (див. `.gitignore`).
