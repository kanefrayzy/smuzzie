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
| `MAIL_*` | (не заданы) | SMTP для письма «заказ готов», см. ниже |

Если на сервере включён кэш конфигурации (`php artisan config:cache`), после правки `.env` его надо пересобрать.

### Почта

Сейчас в `.env` на сервере нет ни одной переменной `MAIL_*`. Пока почта не настроена, письмо «заказ готов» не уходит: ошибка пишется в лог, а сам заказ не страдает. Покупатель всё равно видит ссылку на странице заказа сразу после оформления. Для отправки нужны данные SMTP:

```
MAIL_MAILER=smtp
MAIL_HOST=...
MAIL_PORT=587
MAIL_USERNAME=...
MAIL_PASSWORD=...
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=noreply@smuzzie.com
MAIL_FROM_NAME="Smuzzie"
```

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
- **Таблицы баннеров** ни от чего не зависят. При полном откате можно сделать `php artisan migrate:rollback --step=4`. Порядок миграций: `jobs`, шрифты, шаблоны, заказы.
