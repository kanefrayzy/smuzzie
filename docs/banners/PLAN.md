# Видеобаннеры: план

Статус: **реализовано и выложено на прод 2026-10-22** (ветка `feature/banners`, влита в `main`). План утверждён с правками, они внесены ниже, ответы на вопросы в §16.

Что осталось вне этой задачи:
- ~~платёжный модуль~~: крипта через WestWallet, ветка `feature/payments-westwallet`, см. DEPLOY.md, раздел «Payments (WestWallet)»;
- SMTP-данные для письма «заказ готов» (см. DEPLOY.md, §5);
- ссылка на `/banners` в меню, снятие `noindex` и добавление в sitemap, когда появится оплата.

## 0. Что выяснилось при изучении

### Подтверждается

- **Прототип** (`docs/banners/prototype/`) работает так, как описано в ТЗ:
  - один `overlay.js` для превью и рендера;
  - зоны задаются в % от размера видео;
  - автоподгонка шрифта;
  - `colorchannelmixer` с матрицей CSS. Коэффициенты в `hueMatrix()` совпадают с матрицей `hue-rotate` из спецификации W3C Filter Effects.
- **Очереди.** Во всём проекте ставится в очередь только `OptimizePortfolioMedia::dispatchAfterResponse()`. Этот job не реализует `ShouldQueue` и всегда выполняется в том же PHP-процессе, независимо от `QUEUE_CONNECTION`. Новая очередь его не заденет. `QUEUE_CONNECTION=sync` не трогаю.
- **Сервер:**
  - Ubuntu 24.04, 4 ядра, 5.8 ГБ RAM, Node 20;
  - в PHP есть GD с FreeType, PNG, JPEG и WebP, а также `pcntl` (нужен для таймаутов `queue:work`) и `intl`;
  - библиотеки `libnss3`, `libgbm1`, `libasound2t64` уже стоят;
  - Chromium, supervisor и cron не установлены.
- **nginx:**
  - публично отдаётся только `/storage` → `storage/app/public`, поэтому новый приватный диск в `storage/app/banners` наружу не попадёт;
  - `/api` идёт прямо в PHP-FPM;
  - `client_max_body_size 512m`.

### Расхождения с ТЗ и что предлагаю

| # | Что | Почему это проблема | Предложение |
|---|-----|---------------------|-------------|
| 1 | Водяной знак на GD | GD не читает woff2, а `imagettftext` нужен TTF | Положить в репозиторий `backend/resources/fonts/DejaVuSans-Bold.ttf` (тот же шрифт, что в `watermark.py`; лицензия Bitstream Vera, свободная, ~700 КБ). На сервере он уже есть в `fonts-dejavu-core`, но свой файл нужен для одинакового результата на Windows-машине разработчика |
| 2 | Цвет превью и рендера | У `source.mp4` и `preview.mp4` из прототипа нет цветовых тегов (`color_space=unknown`). Для таких видео браузеры сами угадывают матрицу (для SD часто bt601), а ffmpeg в рендере считает bt709. Тогда цвет фона в превью и в файле разойдётся ещё до сдвига оттенка | Мастер и превью всегда несут теги bt709. Исходник H.264 yuv420p с чётными размерами **не перекодируется**: теги ставятся ремуксом (`-c copy -bsf:v h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1`, `+faststart`). Перекодирование только если это не H.264 yuv420p или размеры нечётные. Превью кодируется всегда (720px + водяной знак), с явными тегами и `in_range/out_range=tv` |
| 3 | `text-wrap: balance` в `overlay.css` | Алгоритм балансировки разный в Chrome, Safari и Firefox (Chrome балансирует только до 6 строк). Если покупатель в Safari, его переносы могут отличаться от рендера в Chromium | Переносы решает модуль, а не браузер. Модуль сам разбивает текст на строки: измеряет слова через `Range`/`canvas`, жадно укладывает в ширину зоны, затем балансирует бинарным поиском ширины при том же числе строк. Строки выводятся явно (каждая строка отдельным блоком, `white-space: pre`), браузер их не переносит. Подгонка шрифта тоже бинарным поиском, а не шагом 1px |
| 4 | Повторная очередь | У стандартного подключения `database` `retry_after=90`. Рендер дольше 90 с будет запущен второй раз параллельно | Отдельное подключение `banners` (driver database, queue `banners`, `retry_after=900`, `after_commit=true`) и `timeout=600` у job |
| 5 | Тесты | `phpunit.xml` смотрит в рабочую базу из `.env`, локального `.env` нет. На SQLite в памяти старая миграция с `->change()` падает: Laravel 10 для этого требует `doctrine/dbal` | Включить в `phpunit.xml` SQLite `:memory:` и добавить `doctrine/dbal ^3` в **require-dev** (только для тестов, в прод не попадает) |
| 6 | Линт фронта | В `frontend/` нет `.eslintrc`, `next lint` при первом запуске задаёт интерактивные вопросы | Добавить `.eslintrc.json` с `next/core-web-vitals`. Если в существующем коде вылезут ошибки линта, чинить буду только явные; про остальное отчитаюсь |
| 7 | Почта | В `.env` на сервере нет ни одной переменной `MAIL_*`, мейлер по умолчанию `smtp`. Без настройки письмо упадёт | Это ожидаемо: ошибка письма ловится и пишется в лог, заказ не падает. SMTP-данные нужны от тебя (раздел в DEPLOY.md) |
| 8 | Песочница Chromium | На сервере `kernel.apparmor_restrict_unprivileged_userns=1`, песочница Chromium под `www-data` без AppArmor-профиля не запустится | **Основной вариант:** AppArmor-профиль для бинарника Chromium с разрешением `userns`, песочница включена (`chromiumSandbox: true`). **Запасной:** `--no-sandbox`, переключается `BANNERS_CHROMIUM_SANDBOX=false`. В обоих случаях рендер идёт не от root (воркер под `www-data`), а все запросы страницы, кроме локального статик-сервера, режутся через `page.route` |
| 9 | Размер шрифта: «база / мин / макс» | В прототипе есть `size` и `minSize`, максимума нет | `size` задаёт базовый размер. Ползунок покупателя работает как множитель в диапазоне `[minSize/size … maxSize/size]`. Автоподгонка уменьшает шрифт от выбранного размера максимум до `minSize`. Если текст не влез и на `minSize`, длинные слова переносятся по буквам (`overflow-wrap:anywhere`, как в прототипе), а покупатель видит подсказку |
| 10 | Длина текста | JS `str.length` считает UTF-16, а PHP `mb_strlen` считает символы. На эмодзи и редких символах лимиты разойдутся | И фронт, и бэкенд считают кодовые точки: `Array.from(s).length` и `mb_strlen` |

## 1. Как это работает целиком

```
Админ: загружает видео шаблона ──► ProcessBannerTemplate (очередь banners)
         ffprobe → мастер MP4 (приватно) → водяной знак GD → превью 720px + постер (публично)
       размечает зоны в визуальном редакторе → «Проверить рендер» (тестовый заказ)

Покупатель: /banners → /banners/[slug]
         превью = <video src=preview.mp4> с CSS hue-rotate + overlay-модуль в родном разрешении, ужатый transform: scale
         «Оформить» → POST /banners/orders (email + параметры + логотип)
         → заказ pending_payment, снимок шаблона
         → /banners/order/[token], опрос статуса

Оплата (сейчас кнопка админа, потом вебхук) → BannerOrderService::markPaid()
         → queued → RenderBannerOrder (очередь banners, 1 воркер)
         → node renderer/src/render.mjs job.json
              Chromium: тот же overlay-модуль → overlay.png (прозрачный, родное разрешение)
              ffmpeg: bt709 → RGB → colorchannelmixer(матрица CSS) → overlay → bt709 → MP4 (+ GIF)
         → ready, письмо со ссылкой → кнопки скачать (подписанная ссылка на 7 дней)
```

## 2. Формат конфигурации шаблона (утверждён)

Хранится в `banner_templates.config` (JSON). При заказе в `banner_orders.snapshot` копируется **полный снимок шаблона** (см. §4), а не только `config`.

Принцип: `style` описывает, как зона выглядит по умолчанию, а `controls` задаёт, что из этого можно менять покупателю и в каких пределах. Контрол без блока или с `enabled: false` в UI не показывается, а бэкенд игнорирует его значение и берёт значение из `style`.

```jsonc
{
  "schemaVersion": 1,                // версия формата; редактор, валидатор и рендер читают по ней
  "accent": "#1e9bff",               // для свечения текста и свотчей
  "hue": {                           // контрол цвета фона (уровень всего баннера)
    "enabled": true,
    "default": 0,
    "presets": [0, 35, 95, 150, 195, 250, 300]   // свотчи; пределы ползунка всегда 0–359
  },
  "zones": [
    {
      "key": "logo", "type": "image", "label": "Логотип",
      "x": 30, "y": 3.3, "w": 40, "h": 5.6,          // % от ширины/высоты видео
      "style": { "scale": 100, "alignX": "center", "alignY": "center" },
      "controls": {
        "upload": { "enabled": true, "maxBytes": 2097152 },   // ≤ глобального лимита из config/banners.php
        "scale":  { "enabled": true, "min": 30, "max": 100 }, // % от зоны
        "align":  { "enabled": true, "x": ["left", "center", "right"], "y": ["top", "center", "bottom"] }
      }
    },
    {
      "key": "title", "type": "text", "label": "Заголовок",
      "x": 26.5, "y": 14.6, "w": 47, "h": 9.2,
      "style": {
        "text": "SMUZZIE STUDIO",        // текст по умолчанию
        "fontId": 3,                      // banner_fonts (конкретное начертание)
        "size": 4.4,                      // базовый размер, % от ШИРИНЫ видео
        "minSize": 2.2,                   // нижний предел автоподгонки
        "case": "upper",                  // none | upper | lower
        "align": "center",                // left | center | right
        "color": "#ffffff",
        "glow": true,
        "lineHeight": 1.14, "letterSpacing": -0.01
      },
      "controls": {
        "text":    { "enabled": true, "maxLength": 32, "multiline": false },
        "size":    { "enabled": true, "min": 2.2, "max": 6.0 },   // % от ширины; minSize ≤ min ≤ size ≤ max
        "color":   { "enabled": true, "palette": ["#ffffff", "#1e9bff", "#ffd400"], "custom": true },
        "align":   { "enabled": true, "options": ["left", "center", "right"] },
        "visible": { "enabled": true }
      }
    }
  ]
}
```

- Ширина, высота, длительность и fps не входят в `config`. Они хранятся в колонках шаблона (их заполняет ffprobe) и попадают в снимок заказа.
- Размер шрифта задаётся в процентах от ширины видео, поэтому всё работает независимо от разрешения.
- Ползунок размера показывается покупателю как множитель от `style.size`, ходит в пределах `[controls.size.min … controls.size.max]`. Автоподгонка уменьшает шрифт от выбранного размера максимум до `style.minSize`.
- `controls.text.maxLength` действует и когда контрол текста выключен: тогда это лимит для текста по умолчанию в админке.
- Ключ зоны: `^[a-z][a-z0-9_]{0,31}$`, уникален в шаблоне. Зон до 20, картинок до 3.
- Конфиг при сохранении в админке проверяет `BannerConfigValidator` (бэкенд): существование шрифтов, согласованность пределов, координаты зон внутри 0–100.

### Параметры покупателя

Хранятся в `banner_orders.params` после нормализации сервером:

```jsonc
{
  "schemaVersion": 1,
  "hue": 150,
  "zones": {
    "title": { "text": "Nova Pay", "size": 5.0, "color": "#ffffff", "align": "left", "visible": true },
    "logo":  { "scale": 80, "alignX": "left", "alignY": "center" }   // сам файл: multipart images[logo]
  }
}
```

`size` хранится абсолютным значением (% от ширины), а не множителем: так снимок и параметры однозначны даже если базовый размер в шаблоне потом поменяют. Фронт показывает его как множитель.

### Правила проверки на сервере

- Проверка идёт по **снимку** шаблона.
- Ключи, которых нет в шаблоне, и значения выключенных контролов **отбрасываются молча**. В заказ сохраняется уже очищенная версия, рендерится ровно она.
- **Неверные значения у включённых контролов дают 422:**
  - длина больше `maxLength`;
  - `size` или `scale` вне `[min, max]`;
  - цвет не `#rrggbb`;
  - свой цвет при `custom: false`, если его нет в палитре;
  - `hue` вне 0–359;
  - `align` не из `options`;
  - перевод строки при `multiline: false`;
  - логотип больше `upload.maxBytes`.
- Управляющие символы из текста удаляются, сам текст приводится к NFC (через `intl`).

## 3. Хранилище (утверждено)

### Новый приватный диск `banners`

Путь `storage/app/banners`, не публичный:

```
templates/<template_uuid>/source-<rev>.mp4     мастер для рендера (rev растёт при каждой замене видео)
templates/<template_uuid>/upload-<rev>.<ext>   исходный загруженный файл, удаляется после успешной обработки
orders/<order_token>/image-<zone>.png          логотип покупателя (перекодирован GD)
orders/<order_token>/banner.mp4|banner.gif     результат
tmp/<order_token>-<attempt>/                   job.json, overlay.png, временные файлы ffmpeg
```

### Публичный диск

```
banners/templates/<template_uuid>/preview-<rev>.mp4   720px, водяной знак вшит, теги bt709
banners/templates/<template_uuid>/poster-<rev>.webp
banners/fonts/<font_uuid>.woff2                       шрифты нужны браузеру для превью, поэтому они публичные
```

### Решения

- **Мастер:**
  - Загруженный H.264 yuv420p с чётными размерами (MP4 или MOV) не перекодируется. Ремукс в MP4 с тегами bt709 через `h264_metadata` и `+faststart`.
  - Всё остальное (ProRes, другие кодеки, 10 бит, 4:2:2, нечётные размеры) перекодируется в H.264, CRF 15, preset slow, yuv420p, bt709.
  - Загруженный файл (`upload-<rev>`) удаляется после успешной обработки.
- **Неизменяемые файлы.** Файлы шрифтов, мастеров и логотипов никогда не перезаписываются. Новая загрузка создаёт новый файл (новый `rev` или новый uuid). Снимок заказа хранит пути к ним, поэтому замена видео или шрифта не ломает оформленные заказы, а «Перерендерить» работает в любой момент.
- **Что живёт сколько:**

  | что | срок |
  |---|---|
  | заказ, его параметры и снимок | навсегда |
  | логотипы оплаченных заказов | навсегда, нужны для перерендера |
  | мастер, на который ссылается хотя бы один оплаченный заказ | навсегда |
  | готовые MP4/GIF | 30 дней после `ready_at` (`BANNERS_RESULT_TTL_DAYS`), потом удаляются; «Перерендерить» собирает их заново |
  | неоплаченные заказы вместе с логотипами | 7 дней |
  | тестовые заказы | 7 дней |
  | `tmp/` | сутки |
  | старые ревизии мастера и превью без ссылок | удаляются очисткой |

- **Удаление в админке:**
  - Шаблон удаляется мягко (`softDeletes`): пропадает из каталога, заказы и их файлы остаются.
  - Шрифт, который используется в шаблоне, удалить нельзя (409 со списком шаблонов). Шрифт, который используется только в заказах, скрывается из выбора (`deleted_at`), а файл остаётся.
- **Ссылка на скачивание** создаётся при каждом открытии страницы заказа и живёт 7 дней. Если файлы уже удалены по сроку, страница заказа говорит об этом, а админ может перерендерить.

## 4. Модели и миграции

### `banner_fonts`

| поле | тип | |
|---|---|---|
| id | | |
| uuid | char(36) unique | имя файла |
| name | string(80) | отображаемое и CSS-имя (в CSS используется `bf-<id>`, не имя из админки) |
| weight | smallint | 100–900 |
| style | enum normal/italic | |
| path | string | путь на публичном диске |
| file_size | int | |
| timestamps, deleted_at | | |

### `banner_templates`

| поле | тип | |
|---|---|---|
| id, uuid | | |
| slug | string unique | |
| name | string | |
| description | text null | |
| price | decimal(10,2) | пока не используется |
| currency | char(3) default `USD` | |
| is_active | bool | |
| sort_order | int | |
| config | json | формат из §2 |
| outputs | json | `{ "mp4": true, "gif": { "enabled": true, "width": 600, "fps": 15 } }` |
| watermark | json | `{ "text": "SMUZZIE  PREVIEW", "opacity": 20 }` (0–255) |
| source_rev | int | |
| source_path, upload_path | string null | приватный диск |
| preview_path, poster_path | string null | публичный диск |
| width, height, frame_count | int null | |
| duration, fps | decimal null | |
| processing_status | string | `none / pending / processing / ready / failed` |
| processing_error | text null | |
| processed_at | timestamp null | |
| timestamps, deleted_at | | |

Публичная выдача шаблона только со статусом `ready` и `is_active`.

### `banner_orders`

| поле | тип | |
|---|---|---|
| id | | |
| token | uuid unique | публичная ссылка |
| template_id | FK null on delete | |
| is_test | bool | тестовый рендер админа |
| email | string null | null у тестовых |
| status | string index | `pending_payment / queued / rendering / ready / failed` |
| params | json | нормализованные параметры покупателя |
| snapshot | json | см. ниже |
| images | json | `{ "logo": "orders/<token>/image-logo.png" }` |
| amount, currency | | снимок цены |
| payment_provider, payment_reference | string null | для будущей платёжки |
| paid_at, queued_at, rendering_started_at, ready_at, failed_at, notified_at | timestamp null | |
| attempts | int | |
| error | text null | |
| render_log | text null | хвост stderr рендера |
| result | json null | `{ "mp4": {"path","size"}, "gif": {...}, "timings": {...}, "fit": {...} }` |
| result_purged_at | timestamp null | файлы результата удалены по сроку |
| ip | string(45) null | для разбора злоупотреблений |
| timestamps | | |

**`snapshot` — полный снимок шаблона на момент заказа** (`snapshotVersion: 1`):
- `template`: `{id, uuid, slug, name, price, currency}`;
- `config` целиком (со своим `schemaVersion`), `outputs`, `watermark`;
- медиа: `width`, `height`, `fps`, `duration`, `frame_count`, `source_rev`, `source_path`;
- `fonts`: `[{id, name, weight, style, path}]` — шрифты, которые использует шаблон.

Рендер читает **только** снимок, шаблон после заказа может меняться как угодно.

### Таблица `jobs`

Стандартная `queue:table`. `failed_jobs` уже есть.

## 5. Сервис заказов и статусы

```
pending_payment ──markPaid()──► queued ──job──► rendering ──► ready
                                   ▲                    └──► failed
                     rerender() ───┘  (из ready/failed, только админ)
```

`App\Services\Banners\BannerOrderService`:

- `create(template, email, rawParams, files, ip)`:
  1. нормализует параметры (`BannerParamsValidator`);
  2. обрабатывает логотипы (`BannerImageProcessor`);
  3. снимает снимок шаблона и создаёт заказ.

  Если `BANNERS_AUTO_APPROVE=true`, сразу вызывает `markPaid($order, 'auto')`.
- `markPaid(order, provider, reference = null)`:
  - единственная точка перехода в оплаченный статус, сюда же потом придёт вебхук;
  - работает в транзакции с `lockForUpdate`;
  - идемпотентный: если статус уже не `pending_payment`, ничего не делает и возвращает false. Повторный вебхук безопасен.
- `rerender(order)`: сбрасывает `result` и ставит заказ в очередь заново.
- `markRendering / markReady / markFailed`: их вызывает только job.

## 6. API

Все пути под `/api/v1`.

### Публичные

| метод | путь | лимит | |
|---|---|---|---|
| GET | `/banners/templates` | api | активные и готовые: slug, name, price, preview, poster, width, height, duration, форматы |
| GET | `/banners/templates/{slug}` | api | + публичный `config` и шрифты с URL; без путей к мастеру |
| POST | `/banners/orders` | `banner-orders`: 5/мин и 30/день на IP | multipart: `template` (slug), `email`, `params` (JSON-строка), `images[<zone>]` |
| GET | `/banners/orders/{token}` | 60/мин | статус, шаблон, отметки времени; при `ready` подписанные ссылки на скачивание (7 дней) |
| GET | `/banners/orders/{token}/download/{format}` | `signed` | стрим файла (`Storage::download`), `format` = `mp4` или `gif` |

Логотип загружается в том же запросе, что и заказ, а не отдельным эндпоинтом. Превью и так строится локально из `FileReader`, серверу файл нужен только при заказе. Так не появляются осиротевшие логотипы без заказа. Лимит на логотипы получается тем же лимитом на заказы. Размер, формат и пиксели фронт проверяет до отправки, сервер проверяет ещё раз.

### Админские

Под `auth:api` + `admin`, как существующие.

**Шаблоны и шрифты:**
- `GET|POST /admin/banner-templates`, `GET|PUT|DELETE /admin/banner-templates/{id}`;
- `POST /admin/banner-templates/{id}/source`: загрузить или заменить видео, ставит `ProcessBannerTemplate` в очередь;
- `POST /admin/banner-templates/{id}/reprocess`: пересобрать превью, например после смены водяного знака;
- `POST /admin/banner-templates/{id}/test-render`: тестовый заказ (`is_test`, тексты по умолчанию, сразу в очередь);
- `POST /admin/banner-templates/reorder`;
- `GET|POST /admin/banner-fonts`, `PUT|DELETE /admin/banner-fonts/{id}`.

**Заказы:**
- `GET /admin/banner-orders?status=&include_tests=`, `GET /admin/banner-orders/{id}`: ответ включает подписанные ссылки на результат;
- `POST /admin/banner-orders/{id}/mark-paid`, вызывает `markPaid($order, 'manual', 'admin:<id>')`;
- `POST /admin/banner-orders/{id}/rerender`.

## 7. Фронтенд

### Общий overlay-модуль `frontend/src/lib/banner-overlay/`

Чистый TypeScript без React и зависимостей. Единственный источник раскладки.

- `types.ts`: `TemplateConfig`, `Zone`, `BuyerParams` (используют редактор, админка и рендер).
- `color.ts`: `hueMatrix(deg)`, `shiftColor(hex, deg)`, `parseHex`.
- `css.ts`: стили слоя строкой. Модуль сам вставляет их в `<style>` через `textContent`, поэтому стили тоже единые.
- `fit.ts`: подгонка шрифта и собственная балансировка строк.
- `overlay.ts`: `build(stage, tpl, fonts)`, `update(stage, tpl, params, images)`.
  - `update` возвращает `{ zones: { title: { requested, used, overflow } } }`, это нужно для подсказки «шрифт уменьшен».
  - Пользовательские данные попадают в DOM только через `textContent`, `style.*` и `img.src`.
- `fonts.ts`: регистрация через `new FontFace('bf-<id>', 'url(...)')` и `document.fonts.add`. Без CSS-строк с пользовательскими данными.

### React-обёртка

`components/banners/BannerPreview.tsx`:
- `<video>` с превью и CSS `hue-rotate`;
- сцена в родном разрешении с `transform: scale`;
- пересчёт масштаба через `ResizeObserver`.

### Страницы

- **`/banners`**: каталог. Карточки с постером, видео проигрывается при наведении (на тач-устройствах при попадании в экран, как в портфолио), цена, разрешение.
- **`/banners/[slug]`**: редактор.
  - **Компьютер:** превью слева, закреплено при прокрутке, панель справа.
  - **Телефон:** превью сверху, панель снизу.
  - **Для каждого текстового поля:**
    - текст со счётчиком;
    - ползунок размера;
    - палитра и свой цвет;
    - выравнивание;
    - показать или скрыть;
    - «Сбросить».
  - **Логотип:** перетаскивание файла, ползунок 30–100%, выравнивание по осям, удаление.
  - **Цвет фона:** свотчи с реальным итоговым цветом (`shiftColor(accent)`) и ползунок 0–359.
  - «Сбросить всё».
  - **Черновик** в `localStorage` под ключом `banner-draft:<slug>:v1`, через `try/catch`. Логотип сохраняется data-URL'ом, только если влезает; иначе черновик хранится без него.
  - **Оформление:** email и кнопка.
- **`/banners/order/[token]`**:
  - статус заказа, опрос каждые 4 секунды, пока заказ не в `ready` или `failed`;
  - на скрытой вкладке опрос реже;
  - кнопки скачать MP4 и GIF;
  - `noindex`.
- **Видимость:** пока нет оплаты, раздел доступен только по прямой ссылке. В шапке и футере ссылки нет, все страницы `/banners*` с `noindex`, в sitemap не попадают. Метаданные через серверные `layout.tsx` + `pageMetadata()`, как у остальных страниц.

### Админка

В сайдбаре появляется группа «Banners»: Templates, Fonts, Orders.

- **`/admin/banners`**: список шаблонов (постер, статус обработки, активность, цена, сортировка).
- **`/admin/banners/[id]`**:
  - **Настройки:** slug, название, цена, accent, форматы, ширина GIF, активность, водяной знак (текст, прозрачность), загрузка видео со статусом обработки.
  - **Редактор зон:**
    - превью шаблона с прямоугольниками зон;
    - зоны можно тянуть мышкой и менять их размер за 8 ручек (Pointer Events, без библиотек);
    - сетка-привязка с шагом 0.1%;
    - список зон и форма с точными значениями;
    - живой overlay поверх с текстами по умолчанию.
  - **«Проверить рендер»:** результат тестового рендера показывается в той же странице.
- **`/admin/banners/fonts`**: загрузка woff2, название, вес, стиль, образец «Аа Жж Zz 123» этим шрифтом. Удаление недоступно, если шрифт используется.
- **`/admin/banners/orders`**:
  - фильтр по статусу и тестовым заказам;
  - карточка заказа: параметры, снимок, логотип, отметки времени, лог ошибки;
  - кнопки «Подтвердить оплату», «Перерендерить», «Скачать».

## 8. Рендер: `renderer/`

```
renderer/
  package.json          playwright-core (точная версия), esbuild (dev)
  build.mjs             esbuild: frontend/src/lib/banner-overlay/index.ts → dist/overlay.js (IIFE, window.BannerOverlay)
  src/render.mjs        точка входа: node src/render.mjs <job.json>
  src/server.mjs        локальный статический сервер: отдаёт только render.html, overlay.js и шрифты из job.json (белый список)
  src/ffmpeg.mjs        сборка аргументов ffmpeg (MP4, GIF), матрица из dist/overlay.js
  page/render.html      пустая страница со сценой
  test/hue.test.mjs     node:test
  dist/                 собирается, в git не коммитится
```

### Почему Playwright, а не Puppeteer

- Прототип уже написан на Playwright: `render.cjs` переносится почти без изменений.
- `npx playwright install --with-deps chromium-headless-shell` на Ubuntu сам ставит нужные системные библиотеки.
- Берётся `playwright-core`: пакет не скачивает браузер при `npm install`, браузер ставится отдельной командой в `/opt/ms-playwright`.
- Версия фиксируется точно. Обновление Chromium может немного сдвинуть раскладку, поэтому обновлять его нужно осознанно, с тестовым рендером.

У Puppeteer те же возможности, но системные зависимости пришлось бы описывать вручную, а без явной выгоды это лишняя работа.

### Почему esbuild

- Он собирает TypeScript-модуль из `frontend/` в один IIFE-файл для страницы рендера за миллисекунды.
- `tsc` не умеет так склеивать модули.
- Это devDependency только в `renderer/`, около 9 МБ.

### Вход: `job.json`

Его пишет Laravel во временную папку:

```jsonc
{ "width": 1450, "height": 1694, "config": {...}, "params": {...},
  "source": "/abs/source-3.mp4", "fonts": [{"id": 3, "weight": 700, "style": "normal", "file": "/abs/x.woff2"}],
  "images": {"logo": "/abs/image-logo.png"},
  "outputs": {"mp4": true, "gif": {"width": 600, "fps": 15}},
  "workDir": "/abs/tmp/<token>-1", "ffmpeg": "ffmpeg", "threads": 3 }
```

### Выход: одна JSON-строка в stdout

```
{ "ok": true, "mp4": "...", "gif": "...", "timings": {...}, "fit": {...} }
```

При ошибке: `{ "ok": false, "error": "..." }` и код выхода 1.

### Изоляция страницы

- Логотипы передаются data-URL'ами, страница не читает диск.
- `page.route('**/*')` пропускает только `http://127.0.0.1:<port>/`, все остальные запросы обрываются.
- JavaScript страницы выполняет только наш код, данные покупателя передаются как аргумент `evaluate`.
- Chromium запускается из воркера под `www-data` (не root), с песочницей (`chromiumSandbox: true`, нужен AppArmor-профиль, см. DEPLOY.md). Без профиля — запасной режим `--no-sandbox` через `BANNERS_CHROMIUM_SANDBOX=false`.

### Шрифты

Те же woff2-файлы, что на сайте. Перед скриншотом:
1. для каждого шрифта `document.fonts.load()`;
2. `document.fonts.ready`;
3. если какой-то шрифт не загрузился, рендер падает с ошибкой, а не тихо подставляет запасной шрифт.

### ffmpeg

**MP4:**
```
[0:v]scale=in_color_matrix=bt709:in_range=tv,format=gbrp,colorchannelmixer=<матрица CSS>[bg];
[bg][1:v]overlay=0:0:format=rgb[mix]; [mix]scale=out_color_matrix=bt709:out_range=tv,format=yuv420p
```
`libx264 -preset medium -crf 18 -pix_fmt yuv420p`, теги bt709, `+faststart`, без звука, `-threads 3`.

**GIF:** как в прототипе, `palettegen=stats_mode=diff` + `paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle`.

### Вызов из Laravel

`Process::timeout(540)->run(['node', 'renderer/src/render.mjs', $jobFile])`. Job при этом:
- читает JSON из stdout;
- переносит файлы из `tmp/` в `orders/<token>/`;
- удаляет `tmp/`.

### Тест матрицы (`renderer/test/hue.test.mjs`)

1. `hueMatrix` из модуля сравнивается с эталонными значениями из спецификации W3C. Значения записаны в тесте числами, а не той же формулой.
2. Проверка на реальном Chromium. Рисуется полоса из 24 цветов с CSS `filter: hue-rotate(X)` для X ∈ {35, 150, 250}, делается скриншот. Результат сравнивается с:
   - `shiftColor()` из модуля;
   - выходом ffmpeg с тем же `colorchannelmixer`, который строит `src/ffmpeg.mjs`.

   Допуск ≤ 2/255 на канал. Заодно это показывает, что фильтр `hue` в ffmpeg сюда не подходит.

## 9. Очередь, письма, очистка

- **`config/queue.php`:** новое подключение `banners`: database, `queue=banners`, `retry_after=900`, `after_commit=true`.
- **`ProcessBannerTemplate`:** `ShouldQueue`, подключение и очередь `banners`, `tries=1`, `timeout=900`.
  - ffprobe;
  - мастер;
  - водяной знак через GD: диагональная сетка, по умолчанию альфа 20/255, текст и альфа берутся из шаблона;
  - превью шириной до 720px, CRF 26, теги bt709;
  - постер WebP.

  Ограничения на исходник: до 60 с, сторона до 4096 px, до 60 fps. Всё это в `config/banners.php`.
- **`RenderBannerOrder`:** `tries=2`, `timeout=600`, `backoff=30`. В `failed()` выставляется статус `failed` с текстом ошибки.

  Одновременно идёт один рендер, потому что в supervisor запущен один воркер (`numprocs=1`, `nice 10`):
  ```
  php artisan queue:work banners --queue=banners --tries=2 --timeout=600 --max-time=3600 --memory=256
  ```
  Тогда на шаблоны и рендеры вместе приходится не больше одного тяжёлого процесса, и PHP-FPM с Next не проседают.
- **Письмо.** `App\Mail\BannerReadyMail`, первый Mailable в проекте: Blade-шаблоны HTML и текст, ссылка на `/banners/order/<token>`.
  - Отправляется из job после `ready`, внутри `try/catch`. Тестовым заказам (`is_test`) письмо не отправляется.
  - При ошибке пишется в лог, `notified_at` остаётся пустым.
  - URL фронта берётся из `BANNERS_FRONTEND_URL`, по умолчанию `APP_URL`.
- **`banners:cleanup`:**
  - удаляет неоплаченные заказы старше 7 дней вместе с файлами;
  - удаляет тестовые заказы (`is_test`) старше 7 дней вместе с файлами;
  - удаляет папки `tmp/` старше суток;
  - удаляет готовые MP4/GIF старше `BANNERS_RESULT_TTL_DAYS` (30). Заказ, параметры, снимок и логотип остаются, у заказа появляется `result_purged_at`; «Перерендерить» собирает файлы заново;
  - удаляет старые ревизии мастера и превью, на которые никто не ссылается;
  - флаг `--dry-run`.

  В `Kernel::schedule` запускается ежедневно в 04:10 с `withoutOverlapping()`.

### Новые переменные `.env`

| переменная | по умолчанию |
|---|---|
| `BANNERS_AUTO_APPROVE` | false |
| `BANNERS_FRONTEND_URL` | `APP_URL` |
| `BANNERS_RESULT_TTL_DAYS` | 30 |
| `BANNERS_NODE_BINARY` | node |
| `BANNERS_FFMPEG_THREADS` | 3 |
| `BANNERS_CHROMIUM_SANDBOX` | true (false = запасной режим `--no-sandbox`) |
| `PLAYWRIGHT_BROWSERS_PATH` | `/opt/ms-playwright` |

Плюс `MAIL_*`.

## 10. Безопасность

- **Логотип:**
  - тип определяется через `finfo` по содержимому, а не по расширению; разрешены только png, jpeg и webp, SVG отклоняется;
  - до 2 МБ;
  - `getimagesize` проверяет размеры до декодирования: до 4096 px по стороне и до 16 Мп (защита от «бомб» распаковки);
  - картинка декодируется через GD и перекодируется в PNG с альфой; метаданные и «хвосты» после данных пропадают;
  - если картинка заметно больше зоны в родном разрешении, она уменьшается до 2× размера зоны.
- **Шрифты:** проверяется сигнатура `wOF2`, файл до 2 МБ.
- **Видео шаблона:** только админ. ffprobe должен найти видеопоток, иначе загрузка отклоняется. Ограничения на длительность и размеры.
- **Тексты:** длина считается в символах, управляющие символы удаляются. В DOM текст попадает только через `textContent`. В PHP тексты не проходят через `strip_tags`: покупатель может хотеть символ `<`, а экранирование здесь не нужно.
- **Скачивание:**
  - `temporarySignedRoute` на 7 дней;
  - подпись покрывает токен заказа и формат;
  - файл отдаётся из приватного диска стримом;
  - если файла нет, возвращается 404.
- **Ограничение частоты** заказов: на IP, через `RateLimiter::for('banner-orders')`.
- **Админские маршруты:** `auth:api` + `admin`, это проверяется тестами.

## 11. Тесты

### Бэкенд

PHPUnit, SQLite в памяти, `Storage::fake`, `Queue::fake`, `Process::fake`.

- **`BannerOrderCreateTest`:**
  - успешный заказ: параметры нормализованы, снимок записан, статус `pending_payment`;
  - при `AUTO_APPROVE` заказ уходит в очередь;
  - лишние ключи и выключенные контролы отброшены;
  - 422 при:
    - длине больше лимита;
    - `scale` вне диапазона;
    - неверном hex;
    - чужом цвете при выключенном `customColor`;
    - `hue` равном 400;
    - неверном `align`;
    - переводе строки в однострочном поле;
  - неактивный или необработанный шаблон даёт 404;
  - ограничение частоты возвращает 429.
- **`BannerLogoTest`:**
  - PNG, JPG и WebP принимаются, на выходе PNG;
  - SVG, а также PNG, который на деле текст, отклоняются;
  - отклоняются файлы больше 2 МБ и с разрешением выше лимита по пикселям.
- **`BannerOrderServiceTest`:**
  - `markPaid` идемпотентный;
  - переходы статусов;
  - `rerender`.
- **`BannerDownloadTest`:**
  - подписанная ссылка работает;
  - без подписи, с подделанной или просроченной подписью, с чужим токеном ответ 403 или 404;
  - статус заказа отдаёт ссылки только при `ready`.
- **`BannerAdminAccessTest`:** все админские маршруты баннеров без токена отвечают 401, с токеном пользователя без роли admin отвечают 403.
- **`RenderBannerOrderTest`:** успех, ошибка с сохранением текста ошибки, письмо, которое упало, не валит заказ (через `Process::fake` и `Mail::fake`).
- **`BannerCleanupTest`.**

### Рендер

`npm test` в `renderer/` (hue-тест, раздел 8) и smoke-рендер маленького тестового шаблона, сгенерированного ffmpeg (`lavfi testsrc`, 2 с).

### Фронт

`tsc --noEmit`, `next lint`, `next build`.

## 12. Этапы

Ветка `feature/banners`, коммит после каждого этапа, после каждого этапа короткий отчёт.

1. **Основа:**
   - конфиг `banners.php`, диск `banners`, подключение очереди;
   - миграции (`banner_fonts`, `banner_templates`, `banner_orders`, `jobs`) и модели;
   - тестовая инфраструктура (SQLite + dbal, `.eslintrc`);
   - тест доступа к админке.
2. **Шрифты и шаблоны (бэкенд + админка без редактора зон):**
   - CRUD;
   - загрузка видео;
   - `ProcessBannerTemplate` (ffprobe, мастер, водяной знак GD, превью, постер);
   - страницы админки: список, настройки, шрифты.
3. **Overlay-модуль и редакторы:**
   - `banner-overlay` (перенос `overlay.js` на TypeScript + собственная балансировка);
   - `BannerPreview`;
   - визуальный редактор зон в админке;
   - публичный каталог и редактор покупателя с черновиком.
4. **Заказы:**
   - `BannerParamsValidator`, `BannerImageProcessor`, `BannerOrderService`;
   - публичный API и страница заказа;
   - админский список и карточка, «Подтвердить оплату»;
   - feature-тесты.
5. **Рендер и очередь:**
   - `renderer/` (Playwright, esbuild, тест матрицы);
   - `RenderBannerOrder`;
   - «Проверить рендер» и «Перерендерить»;
   - подписанное скачивание.
6. **Письма, очистка, документация:**
   - `BannerReadyMail`;
   - `banners:cleanup` + schedule;
   - `docs/banners/DEPLOY.md`, `deploy/supervisor/smuzzie-banners-worker.conf`;
   - раздел в CLAUDE.md.

## 13. Новые зависимости

| пакет | где | зачем |
|---|---|---|
| `doctrine/dbal ^3` | backend require-dev | миграции с `->change()` на SQLite в тестах (Laravel 10 без него не может) |
| `playwright-core` (точная версия) | renderer | headless Chromium для слоя текста |
| `esbuild` | renderer devDependencies | сборка общего overlay-модуля для страницы рендера |
| DejaVu Sans Bold (TTF) | backend/resources/fonts | шрифт водяного знака для GD |

Во фронт ничего нового не ставится: перетаскивание, ползунки и редактор зон пишу сама на Pointer Events.

## 14. Что нужно на сервере

Подробно, по шагам, будет в DEPLOY.md.

1. `cd renderer && npm ci && npm run build`. Chromium: `PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright npx playwright install --with-deps chromium-headless-shell`, около 150 МБ. Права на чтение для `www-data`.
   AppArmor-профиль для бинарника `chrome-headless-shell` (разрешает user namespaces, песочница остаётся включённой). Запасной вариант `BANNERS_CHROMIUM_SANDBOX=false`.
2. Supervisor (`apt install supervisor`) и конфиг воркера из `deploy/`.
3. Cron для `www-data`: `* * * * * cd /var/www/smuzzie/backend && php artisan schedule:run >> /dev/null 2>&1`.
4. Папка `storage/app/banners` с владельцем `www-data`. Миграции.
5. Новые переменные `.env` и данные SMTP.
6. После деплоя кода: `php artisan queue:restart`, чтобы воркер подхватил новый код. Это шаг в процедуре деплоя.

## 15. Риски

- **Браузер не Chromium.** У покупателя в Safari или Firefox превью может немного отличаться от рендера: шейпинг через CoreText отличается на доли пикселя, иногда это меняет перенос. Собственная балансировка и одинаковые шрифты убирают основную разницу. Если понадобится гарантия, следующий шаг: перед оплатой показывать покупателю PNG-кадр с сервера (около 2 с). Сейчас этого не делаю.
- **Нагрузка на процессор.** Рендер 1450×1694 × 4 с занимает около 15 с. Шаблон 4K × 30 с займёт минуты. Ограничения размера и длительности, `nice` и `-threads 3`, один воркер.
- **Размер GIF.** Длинные и большие GIF выходят тяжёлыми: в прототипе 4.7 МБ при 600 px × 4 с. Ширина и fps GIF настраиваются в шаблоне. Предупреждение в админке, если оценка больше 15 МБ.
- **Шрифт без кириллицы.** Если в woff2 нет нужных символов, браузер и Chromium подставят разные запасные шрифты. В админке показывается образец, рендер падает, если `document.fonts.check()` для текста не проходит.
- **Обновление Chromium или ffmpeg** может сдвинуть результат. Версии зафиксированы, перед обновлением делается тестовый рендер.
- **Почта** не настроена: пока её не настроят, письма не уходят. Ссылка на заказ при этом видна сразу после оформления.
- **Воркер** не перезапущен после деплоя и выполняет старый код. Решается `queue:restart` в процедуре деплоя.

## 16. Решения по вопросам (2026-10-22)

1. **Формат JSON:** проценты от ширины и ползунок между min и max подтверждены. Добавлены `schemaVersion`, у каждой зоны блок `controls` с пределами, в заказе полный снимок шаблона (§2, §4).
2. **Готовые файлы** хранятся 30 дней, потом удаляются. Заказ и параметры остаются навсегда, «Перерендерить» собирает файл заново (§3).
3. **MOV** после успешной обработки удаляется, мастер из него делается в CRF 15, preset slow. Загруженный H.264 yuv420p не перекодируется, только ремукс с тегами и faststart (§0 п.2, §3).
4. **«Проверить рендер»** работает как тестовый заказ `is_test`: без письма, скрыт в общем списке по умолчанию, удаляется через 7 дней.
5. **Ссылки на /banners в шапке нет.** Только прямая ссылка, `noindex`, вне sitemap, пока нет оплаты.
6. **В git из прототипа** только код и `template.json`. Видео, GIF, картинки и шрифты прототипа в `.gitignore`.

Правки к §0: Chromium основным вариантом через AppArmor-профиль с песочницей, `--no-sandbox` запасной; bt709-теги ремуксом без перекодирования; переносы строк решает модуль, строки рендерятся явно.
