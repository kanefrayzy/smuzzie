# Видеобаннеры: установка на сервер

Сервер: Ubuntu 24.04, `/var/www/smuzzie`, PHP 8.3-FPM (`www-data`), Next.js под pm2, MySQL. Общая процедура деплоя без простоя описана в `CLAUDE.md` (раздел «Production server»). Здесь только то, что добавляет конструктор баннеров.

Все команды выполняются от root.

## 1. Код и база

```bash
TS=$(date +%Y%m%d-%H%M%S); B=/root/backups/smuzzie-$TS; mkdir -p $B
mysqldump --single-transaction design_portfolio | gzip > $B/db.sql.gz
cd /var/www/smuzzie && git status --short && git pull --ff-only origin main
cd backend && sudo -u www-data php artisan migrate --force
```

Миграции добавляют таблицы `jobs`, `banner_fonts`, `banner_templates` и `banner_orders`. Существующие таблицы не меняются.

Composer ставить не нужно: новая зависимость `doctrine/dbal` нужна только тестам (`require-dev`).

## 2. Рендерер и Chromium

```bash
cd /var/www/smuzzie/renderer
npm ci --no-audit --no-fund
npm run build                                   # dist/overlay.js и dist/overlay.mjs из frontend/src/lib/banner-overlay

# Chromium для Playwright (около 150 МБ) и его системные библиотеки (apt)
PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright npx playwright-core install --with-deps chromium-headless-shell
chmod -R a+rX /opt/ms-playwright
```

`npm run build` нужно повторять после каждого `git pull`, который меняет `frontend/src/lib/banner-overlay/`: рендер использует собранную копию этого модуля. `dist/` в git не хранится.

Версия `playwright-core` (а значит, и Chromium) зафиксирована в `renderer/package.json`. Обновлять её стоит осознанно: после обновления сделать «Test render» на нескольких шаблонах и сравнить результат с прежним.

### Песочница Chromium

На Ubuntu 24.04 включён `kernel.apparmor_restrict_unprivileged_userns=1`. Без своего профиля песочница Chromium под `www-data` не запустится.

**Основной вариант: AppArmor-профиль, песочница включена.**

```bash
cp /var/www/smuzzie/deploy/apparmor/smuzzie-chromium /etc/apparmor.d/
apparmor_parser -r /etc/apparmor.d/smuzzie-chromium
```

**Запасной вариант**, если профиль почему-то не работает: добавить в `backend/.env` строку `BANNERS_CHROMIUM_SANDBOX=false` и перезапустить воркер. Chromium тогда запускается с `--no-sandbox`. Риск небольшой:
- рендер в любом случае идёт не от root, а от `www-data`;
- страница рендера может обращаться только к локальному статик-серверу, все остальные запросы режет `page.route`;
- данные покупателя попадают в DOM только через `textContent` и свойства элементов.

### Проверка рендерера

```bash
cd /var/www/smuzzie/renderer
sudo -u www-data env HOME=/tmp PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright npm test
```

Должно быть 14 из 14 тестов, в том числе тест совпадения цвета CSS и ffmpeg и полный рендер MP4/GIF.

## 3. Воркер очереди (supervisor)

```bash
apt-get install -y supervisor
cp /var/www/smuzzie/deploy/supervisor/smuzzie-banners-worker.conf /etc/supervisor/conf.d/
supervisorctl reread && supervisorctl update
supervisorctl status smuzzie-banners-worker
```

Устройство воркера:
- один процесс с `nice 10`, поэтому одновременно идёт один рендер или одна обработка видео шаблона;
- работает под `www-data`;
- раз в час перезапускается сам (`--max-time=3600`);
- лог: `backend/storage/logs/banners-worker.log`.

**После каждого деплоя** воркер нужно перезапустить, иначе он продолжит выполнять старый код:

```bash
cd /var/www/smuzzie/backend && sudo -u www-data php artisan queue:restart
```

Supervisor поднимет воркер заново, текущее задание при этом доработает до конца.

Общая очередь Laravel (`QUEUE_CONNECTION`) не меняется. Баннеры используют своё подключение `banners` (драйвер database).

## 4. Планировщик (cron)

```bash
( crontab -u www-data -l 2>/dev/null; echo '* * * * * cd /var/www/smuzzie/backend && php artisan schedule:run >> /dev/null 2>&1' ) | crontab -u www-data -
```

Планировщик каждый день в 04:10 запускает `banners:cleanup`. Ручной запуск: `sudo -u www-data php artisan banners:cleanup --dry-run`. Команда удаляет:
- неоплаченные и тестовые заказы старше 7 дней;
- готовые файлы старше 30 дней;
- временные папки рендера.

## 5. Переменные `.env`

Для запуска ничего добавлять не нужно, у всех переменных есть значения по умолчанию. При необходимости:

| переменная | по умолчанию | что делает |
|---|---|---|
| `BANNERS_AUTO_APPROVE` | false | true: новые заказы сразу уходят в рендер без подтверждения оплаты. Только для разработки |
| `BANNERS_FRONTEND_URL` | `APP_URL` | адрес сайта для ссылок в письмах |
| `BANNERS_RESULT_TTL_DAYS` | 30 | сколько дней хранить готовые MP4/GIF |
| `BANNERS_FFMPEG_THREADS` | 3 | потоки ffmpeg на один рендер (на сервере 4 ядра) |
| `BANNERS_CHROMIUM_SANDBOX` | true | false: запасной режим `--no-sandbox` |
| `PLAYWRIGHT_BROWSERS_PATH` | (задан в конфиге supervisor) | где лежит Chromium |
| `MAIL_*` | (не заданы) | почта через Resend, см. «Почта (Resend)» ниже |

Если на сервере включён кэш конфигурации (`php artisan config:cache`), после правки `.env` его надо пересобрать.

### Почта (Resend)

Все письма сайта уходят через SMTP Resend. Пакет `resend/resend-laravel` не нужен: в Laravel 10 нет встроенного транспорта `resend`, а обычный SMTP-мейлер с ним работает без новых зависимостей.

Пока ключа нет, письма не уходят: ошибка пишется в `storage/logs/laravel.log` (`Email not sent: ...`), а заказ, оплата и форма контактов работают как обычно.

#### Какие письма и когда

| письмо | кому | когда |
|---|---|---|
| Order received | покупателю | заказ создан и ждёт оплаты: сводка, кнопка «Complete payment» на `/banners/order/<token>`, фиксация цены на `BANNERS_PAYMENT_LOCK_MINUTES` минут, удаление неоплаченных через 7 дней |
| Payment received | покупателю | заказ стал оплаченным (`markPaid`): монета, сумма, tx, «рендерим, пришлём письмо» |
| New paid order | админу | то же событие; не шлётся, когда оплату подтвердил сам админ кнопкой |
| Your banner is ready | покупателю | рендер готов |
| Payment needs review | админу | недоплата, опоздавший платёж на проверку, вторая оплата уже оплаченного заказа |
| Render failed | админу | рендер упал после последней попытки |
| Contact form | админу | сообщение из формы, `Reply-To` = отправитель |
| We got your message | отправителю формы | автоответ с цитатой (до 600 символов), не больше 2 в сутки на один адрес |

- Тестовые рендеры и `BANNERS_AUTO_APPROVE` писем об оплате не получают.
- Каждое письмо по заказу уходит один раз. Гарантию дают колонки `*_notified_at` в `banner_orders` (миграция `2026_10_23_000001`). Повторный IPN, повторный рендер и ретрай второй копии не пришлют.
- Письма, вызванные запросом (оформление, IPN, форма, кнопка в админке), отправляются после того, как ответ ушёл браузеру (`terminate()` после `fastcgi_finish_request`). SMTP не замедляет страницу. Письма из воркера и планировщика уходят сразу.
- В очередь письма не ставятся. Единственный воркер занят рендерами, и письмо ждало бы за ними минуты.
- Если письмо не ушло, ошибка только логируется. Повторной отправки нет.

#### Домен в Resend

1. Resend → Domains → Add domain → `smuzzie.com`. Регион оставить по умолчанию (`us-east-1`) или выбрать ближайший, от этого зависит значение MX.
2. Добавить у DNS-провайдера записи, которые покажет Resend. Значения копировать из панели, ниже только их вид:

   | тип | имя | значение | приоритет |
   |---|---|---|---|
   | MX | `send` | `feedback-smtp.us-east-1.amazonses.com` (регион из панели) | 10 |
   | TXT | `send` | `v=spf1 include:amazonses.com ~all` | |
   | TXT | `resend._domainkey` | `p=MIGfMA0GCSq...` (длинный ключ DKIM из панели) | |

   Записи стоят на поддомене `send.smuzzie.com`: это адрес возврата (Return-Path) Resend. Существующие MX и SPF самого `smuzzie.com` не трогаются и почте домена не мешают. Имена вводятся без домена: `send`, а не `send.smuzzie.com`.
3. DMARC, отдельная запись (Resend её не требует, но Gmail и Yahoo ждут её от отправителей):

   | тип | имя | значение |
   |---|---|---|
   | TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:<ваш ящик>` |

   Если `_dmarc` уже есть, новую не добавлять: достаточно одной. Через пару недель без проблем в отчётах можно перейти на `p=quarantine`.
4. Нажать «Verify DNS Records». Обычно это занимает минуты, иногда несколько часов.
5. Resend → API Keys → Create API key, права «Sending access», домен `smuzzie.com`. Ключ показывается один раз.

`MAIL_FROM_ADDRESS` должен быть на проверенном домене (`...@smuzzie.com`), иначе Resend отклонит письмо. Почтовый ящик для этого адреса не нужен.

#### `.env`

```
MAIL_MAILER=smtp
MAIL_HOST=smtp.resend.com
MAIL_PORT=465
MAIL_ENCRYPTION=ssl
MAIL_USERNAME=resend
MAIL_PASSWORD=re_xxxxxxxxxxxxxxxxxxxxxxxx
MAIL_FROM_ADDRESS=hello@smuzzie.com
MAIL_FROM_NAME=Smuzzie
MAIL_ADMIN_ADDRESS=you@example.com
MAIL_REPLY_TO_ADDRESS=you@example.com
```

- **Порт 465** (TLS с первого байта) вместо 587 из примера Resend. На 587 Symfony Mailer включает STARTTLS, только если сервер его предложил. Если кто-то вырежет STARTTLS по пути, ключ уйдёт открытым текстом. На 465 такого нет. Если хостинг закрывает исходящий 465, ставить `MAIL_PORT=587` и `MAIL_ENCRYPTION=tls` (или 2465, тоже SMTPS).
- `MAIL_ADMIN_ADDRESS`: куда идут уведомления админу. Можно несколько через запятую. Пусто: админские письма не отправляются.
- `MAIL_REPLY_TO_ADDRESS`: необязательный. Это `Reply-To` писем покупателям и автоответа. Нужен, если `MAIL_FROM_ADDRESS` не настоящий ящик: тогда ответы покупателей придут сюда. В письме админу о форме `Reply-To` всегда равен отправителю.
- `MAIL_TIMEOUT`: необязательный, по умолчанию 10 секунд на SMTP-команду.
- Ссылки в письмах строятся от `BANNERS_FRONTEND_URL` (по умолчанию `APP_URL`). На проде это должно быть `https://smuzzie.com`.

После правки: `sudo -u www-data php artisan config:cache`, если кэш конфигурации включён, и `sudo -u www-data php artisan queue:restart`, чтобы воркер (письма «готово» и «рендер упал») прочитал новые настройки.

#### Проверка

```bash
cd /var/www/smuzzie/backend
openssl s_client -connect smtp.resend.com:465 -quiet </dev/null 2>/dev/null | head -1   # 220 ...: порт открыт
sudo -u www-data php artisan mail:preview                         # все письма в storage/app/mail-previews/*.html и *.txt, без отправки
sudo -u www-data php artisan mail:preview all --to=you@example.com  # отправить все 8 писем с тестовыми данными
sudo -u www-data php artisan mail:preview banner-ready --to=you@example.com
```

Типы: `order-received`, `payment-confirmed`, `banner-ready`, `admin-order-paid`, `admin-payment-review`, `admin-render-failed`, `contact-message`, `contact-auto-reply`. Команда шлёт напрямую и печатает ошибку SMTP, если она есть:
- `535` значит неверный ключ;
- `domain is not verified` значит DNS ещё не проверен или `MAIL_FROM_ADDRESS` не на `smuzzie.com`.

Отправленные письма видны в Resend → Emails, со статусом доставки (delivered, bounced, complained).

Сквозная проверка: отправить форму на `/contact`, оформить заказ на `/banners`. Если письмо не пришло, искать `Email not sent` в `storage/logs/laravel.log`.

## Payments (WestWallet)

Покупатель платит криптой прямо на странице заказа `/banners/order/<token>`, без перехода на сайт WestWallet:
1. выбирает монету и сеть;
2. получает адрес (один на заказ и монету, при повторном выборе тот же), сумму в монете, QR и, если сеть требует, memo/tag;
3. цена держится `BANNERS_PAYMENT_LOCK_MINUTES` минут.

WestWallet присылает IPN, мы проверяем транзакцию через их API (`POST /wallet/transaction` по id) и только после этого вызываем `BannerOrderService::markPaid()`.

### Переменные `.env`

| переменная | по умолчанию | что делает |
|---|---|---|
| `WESTWALLET_PUBLIC_KEY` | — | публичный ключ API (профиль WestWallet → API) |
| `WESTWALLET_PRIVATE_KEY` | — | приватный ключ. Без обоих ключей оформление заказа показывает «payments unavailable» |
| `WESTWALLET_IPN_SECRET` | — | рекомендуется: случайная строка (`openssl rand -hex 24`), добавляется к IPN URL как `?secret=...`, IPN без неё отклоняется |
| `WESTWALLET_IPN_URL` | `APP_URL` + `/api/v1/payments/westwallet/ipn` | менять, только если API доступен по другому адресу |
| `WESTWALLET_IPN_IPS` | `45.155.121.88` | с каких IP принимать IPN (из документации WestWallet). Пустая строка отключает проверку |
| `BANNERS_PAYMENT_LOCK_MINUTES` | 30 | сколько держится цена в монете |
| `BANNERS_PAYMENT_GRACE_MINUTES` | 15 | транзакция, замеченная в эти минуты после конца фиксации, ещё считается вовремя |
| `BANNERS_PAYMENT_UNDERPAY_TOLERANCE` | 0.5 | на сколько процентов можно недоплатить, чтобы заказ всё равно считался оплаченным |
| `BANNERS_PAYMENT_LATE_POLICY` | `requote` | опоздавший платёж в нестабильной монете: `requote` — принять, если по текущему курсу он покрывает цену, иначе на проверку админу; `accept` — всегда по старой цене; `review` — всегда админу |

После правки `.env`: `sudo -u www-data php artisan config:cache`, если кэш конфигурации включён.

### IPN URL

В кабинете WestWallet его вводить не нужно. Мы передаём `ipn_url` при создании каждого адреса (`POST /address/generate`), и WestWallet шлёт уведомления по этому адресу:

```
https://smuzzie.com/api/v1/payments/westwallet/ipn?secret=<WESTWALLET_IPN_SECRET>
```

Адрес запоминает свой `ipn_url` навсегда. Поэтому смена `APP_URL` или `WESTWALLET_IPN_SECRET` ломает IPN у уже выданных адресов. Такие платежи всё равно подхватит синхронизация (см. ниже), но только в первые 24 часа.

В настройках ключа API в WestWallet должен быть разрешён IP сервера (`66.29.152.178`). С других IP API отвечает `ip_not_allowed`.

Сайт отдаётся nginx напрямую, без CDN, поэтому Laravel видит настоящий IP отправителя IPN. Если перед сайтом когда-нибудь появится Cloudflare или другой прокси, надо настроить `TrustProxies` или поставить `WESTWALLET_IPN_IPS=` и полагаться на секрет. Подделать оплату всё равно нельзя: каждая транзакция перепроверяется через API.

### Синхронизация

Если IPN потерялся, платёж всё равно найдётся. Планировщик (cron из §4) каждую минуту запускает `banners:payments-sync`. Команда проверяет через API открытые платежи за последние 24 часа, каждый не чаще раза в 2 минуты. Ручной запуск: `sudo -u www-data php artisan banners:payments-sync --all`.

### Проверка

```bash
cd /var/www/smuzzie/backend
sudo -u www-data php artisan migrate --force                 # таблицы banner_payments, banner_payment_transactions
sudo -u www-data php artisan payments:westwallet-check       # только чтение: ключи, подпись, IP, курсы, IPN URL
curl -s https://smuzzie.com/api/v1/banners/payments/availability   # {"payments_available":true,...}
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://smuzzie.com/api/v1/payments/westwallet/ipn -d id=1   # 403: чужой IP
```

`payments:westwallet-check` должен показать «Signed request: OK» и курс у каждой монеты из таблицы. `wrong_hmac` означает неверный приватный ключ, `ip_not_allowed` — IP сервера не добавлен к ключу.

Сквозная проверка с реальными деньгами:
1. оформить заказ на шаблоне за $1–2;
2. выбрать USDT TRC20 или TON. Минимальный депозит WestWallet: USDT TRC20 — 10, USDT BEP20/TON/SOL — 1. Если сумма меньше минимума, монета показывается неактивной;
3. отправить сумму;
4. на странице заказа статус пройдёт «Waiting» → «Payment detected» → «Payment confirmed», заказ уйдёт в рендер;
5. в «Banner orders» у заказа видны монета, адрес, tx id и суммы.

Все IPN и результаты их проверки пишутся в `backend/storage/logs/payments-YYYY-MM-DD.log`.

### Правила

- **Недоплата** больше допуска: статус «underpaid», покупатель видит, сколько доплатить на тот же адрес.
- **Переплата:** принимается, лишнее показано админу. Автоматического возврата нет.
- **Платёж после конца фиксации цены:**
  - для USDT и USDC цена не меняется;
  - для остальных монет действует `BANNERS_PAYMENT_LATE_POLICY`;
  - статус «Needs review» решает админ: кнопка «Confirm payment» или возврат вручную.
- **Повторный IPN** ничего не меняет.
- **Ещё одна оплата** заказа, который уже оплачен (другой монетой или вручную), помечается для админа.

Кнопка «Confirm payment» в админке работает как раньше. `BANNERS_AUTO_APPROVE=true` по-прежнему пропускает оплату.

## 6. Фронтенд

Обычная сборка без простоя из `CLAUDE.md`: `NEXT_DIST_DIR=.next-new npm run build`, проверка на порту 3001, переключение папок и `pm2 restart smuzzie-frontend`.

## 7. Проверка после установки

1. **Админка → Banner fonts:** загрузить woff2 с кириллицей.
2. **Админка → Banners:**
   - создать шаблон и загрузить видео;
   - статус должен пройти Queued → Processing → Ready, превью с водяным знаком должно проиграться.
3. **Зоны:** разметить, сохранить, нажать «Test render». Через несколько секунд в блоке появится MP4.
4. **Подписанные ссылки за nginx.** Скачивание идёт по подписанной ссылке, и Laravel проверяет подпись по полному URL, включая `https`. Проверка:

   ```bash
   curl -sI "<ссылка из ответа API>" | head -1        # HTTP/2 200
   curl -sI "<та же ссылка без ?expires=...>" | head -1  # HTTP/2 403
   ```

   Если подписанная ссылка тоже даёт 403, значит PHP не видит HTTPS. Проверить, что в `/etc/nginx/fastcgi_params` есть строка `fastcgi_param HTTPS $https if_not_empty;`.
5. **Сквозной путь:** открыть `/banners`, включить шаблон в админке, оформить заказ, в «Banner orders» нажать «Confirm payment», скачать файл со страницы заказа.

Раздел `/banners` скрыт, пока нет оплаты: в меню сайта его нет, страницы отдают `noindex` и не попадают в sitemap.

## 8. Где лежат файлы

| что | где |
|---|---|
| мастер-видео шаблонов, логотипы покупателей, готовые файлы, временные папки рендера | `backend/storage/app/banners/` (приватно, nginx это не отдаёт) |
| превью шаблонов, постеры, шрифты | `backend/storage/app/public/banners/` (отдаётся через `/storage`) |
| Chromium | `/opt/ms-playwright` |
| лог воркера | `backend/storage/logs/banners-worker.log` |

## 9. Откат

- **Код:** `git checkout <предыдущий коммит>` и вернуть предыдущую сборку фронта (`.next.prev-*`).
- **Воркер:** `supervisorctl stop smuzzie-banners-worker`.
- **Оплата:** удалить `WESTWALLET_*` из `.env`, и оформление заказа покажет «payments unavailable». Таблицы платежей откатываются через `php artisan migrate:rollback --step=2`: последняя миграция `2026_10_23_000001` (колонки `*_notified_at` для писем), перед ней платежи.
- **Почта:** убрать `MAIL_PASSWORD` из `.env`, и письма перестанут уходить (ошибки только в логе). Колонки `*_notified_at` ничему не мешают.
- **Таблицы баннеров** ни от чего не зависят. При полном откате можно сделать `php artisan migrate:rollback --step=6`: сначала откатятся колонки писем и платежи, потом заказы, шаблоны, шрифты и `jobs`.
