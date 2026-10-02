# VKMuzPremium — Telegram Mini App и Telegram Stars

Русскоязычный Telegram Mini App для VKMuzPremium: музыка обрабатывается локально в браузере, а цифровые подписки оплачиваются Telegram Stars (`XTR`). В репозитории находятся статический Mini App и Cloudflare Worker с базой D1.

## Реализовано

- **PRO — ⭐99 за 30 дней** и **PREMIUM — ⭐299 за 30 дней**; подписки используют ежемесячное автопродление Telegram Stars.
- Worker проверяет подпись `Telegram.WebApp.initData`, создаёт счёт через Telegram Bot API, подтверждает `pre_checkout_query` и активирует доступ только после `successful_payment` от Telegram.
- Статус подписки, срок действия и отключение автопродления доступны в Mini App. Бот отвечает на `/start`, `/plan`, `/cancel`, `/terms` и `/paysupport`.
- Аудиофайл обрабатывается локально; Mini App не отправляет его на сервер.

> Для цифровых товаров и услуг внутри Telegram правила Telegram требуют использовать Stars (`XTR`): [официальные правила](https://core.telegram.org/bots/payments-stars).

## Развертывание в Cloudflare аккаунте Shamsiddinov07xz

Команды ниже предназначены для терминала на вашем компьютере. Запускайте их под Cloudflare аккаунтом, которому принадлежит `shamsiddinov07xz.workers.dev`. Токен бота не присылайте в чат и не добавляйте в GitHub.

### 1. Скачать репозиторий и войти в нужный Cloudflare аккаунт

Установите Node.js, затем выполните:

```bash
git clone https://github.com/Husniddin2006yil-cell/vkmuzpremium-stars.git
cd vkmuzpremium-stars/payments-worker
npx wrangler login
```

В открывшемся браузере войдите именно в Cloudflare аккаунт, где работает Mini App по адресу `https://vkmuzpremium-stars.shamsiddinov07xz.workers.dev/`. Если Wrangler показывает другой аккаунт, не продолжайте — сначала переключите Cloudflare login.

### 2. Создать D1 и вписать её ID

Создайте базу один раз:

```bash
npx wrangler d1 create vkmuzpremium_stars
```

Wrangler выведет database ID. Откройте `payments-worker/wrangler.toml` и замените:

```toml
database_id = "REPLACE_WITH_DATABASE_ID"
```

на настоящий ID только что созданной базы в **этом же аккаунте**. Не используйте ID от другого Cloudflare аккаунта.

### 3. Инициализировать таблицы

Из каталога `vkmuzpremium-stars/payments-worker` запустите:

```bash
npx wrangler d1 execute vkmuzpremium_stars --remote --file=./schema.sql
```

Схема использует `CREATE TABLE IF NOT EXISTS`; повторное применение не удаляет существующие таблицы.

### 4. Добавить токен бота как Secret и развернуть Worker

```bash
npx wrangler secret put BOT_TOKEN
npx wrangler deploy
```

На запросе `secret value` вставьте токен `@VkMuzicXbot` локально в терминале Wrangler. Токен не нужен в HTML/JavaScript, GitHub, обычных Worker variables или сообщениях.

Worker создаётся как `vkmuzpremium-stars-payments`; при включённом `workers.dev` ожидаемый адрес — `https://vkmuzpremium-stars-payments.shamsiddinov07xz.workers.dev`.

### 5. Опубликовать Mini App обновление

Файл `app.js` уже указывает на этот Worker, а `wrangler.toml` задаёт `/start` кнопке текущий Mini App адрес. Опубликуйте корень репозитория тем же способом, которым был развернут сайт `https://vkmuzpremium-stars.shamsiddinov07xz.workers.dev/`. Если статический сайт подключён к GitHub, выполните redeploy после обновления репозитория.

В BotFather задайте URL Mini App:

```text
https://vkmuzpremium-stars.shamsiddinov07xz.workers.dev/
```

### 6. Проверить backend и Telegram

Откройте:

```text
https://vkmuzpremium-stars-payments.shamsiddinov07xz.workers.dev/health
https://vkmuzpremium-stars-payments.shamsiddinov07xz.workers.dev/health?check=telegram
```

Второй адрес выполняет read-only диагностику D1, токена через `getMe` и текущего webhook; он ничего не переключает. Ожидается `configured: true`, корректный username бота и `database: true`.

Если `webhookMatches` равно `false`, откройте `/setup` на Worker адресе. Сначала проверьте действующий webhook; переключайте его только если готовы заменить предыдущий webhook этого бота. Не подтверждайте переключение, если старый сервер ещё должен принимать обновления.

После совпадения webhook откройте Mini App **в Telegram** и проверьте сначала статусы `/health`, затем покупку ⭐99/⭐299. Stars — реальные платежи. Локальные тесты деньги не списывают.

## Структура

```text
index.html
style.css
app.js
payments-worker/
  worker.js
  schema.sql
  wrangler.toml
  test/
```

## Локальные проверки

В каталоге `payments-worker`:

```bash
npm test
npx wrangler deploy --dry-run
```

Тесты имитируют Bot API и D1; они не списывают Stars и не обращаются к настоящим пользователям.

## Безопасность

- Не добавляйте bot token, `.env`, приватные ключи или платёжные данные в Git.
- `BOT_TOKEN` хранится только в Cloudflare Worker Secret.
- Сначала проверьте текущий webhook перед заменой: у бота может быть другой активный сервер.
- Публичный health endpoint не выводит секреты.
