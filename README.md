# VKMuzPremium — Telegram Mini App и Telegram Stars

Русскоязычный Telegram Mini App для VKMuzPremium с оплатой цифровой подписки через Telegram Stars (`XTR`). В репозитории находятся статический Mini App и Cloudflare Worker с D1-базой данных.

## Что реализовано

- **PRO — ⭐99 за 30 дней** и **PREMIUM — ⭐299 за 30 дней**; подписки используют ежемесячное автопродление Telegram Stars.
- Mini App запрашивает счёт у Worker. Сервер проверяет подпись `Telegram.WebApp.initData` и создаёт invoice через Telegram Bot API; интерфейс не может сам сообщить серверу, что оплата прошла.
- Worker подтверждает `pre_checkout_query`, записывает `successful_payment` в D1 и только после этого активирует доступ. Повторные уведомления о том же платеже не должны продлевать доступ повторно.
- Статус подписки, срок действия и отключение автопродления доступны в Mini App. Также бот отвечает на `/start`, `/plan`, `/cancel`, `/terms` и `/paysupport`.
- Музыкальная лаборатория обрабатывает выбранный аудиофайл локально в браузере; файл не отправляется на сервер.

> Для цифровых товаров и услуг внутри Telegram Telegram требует оплату исключительно Stars (`XTR`). См. [официальные правила Telegram](https://core.telegram.org/bots/payments-stars).

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

## Cloudflare Worker и D1

В `payments-worker/wrangler.toml` указаны Worker `vkmuzpremium-stars-payments` и существующая база `vkmuzpremium_stars`. Не удаляйте и не пересоздавайте D1: она хранит историю заказов, платежей и подписок.

1. Установите Node.js и Wrangler, клонируйте репозиторий и войдите в Cloudflare:

   ```bash
   git clone https://github.com/Husniddin2006yil-cell/vkmuzpremium-stars.git
   cd vkmuzpremium-stars/payments-worker
   npx wrangler login
   ```

2. Если база ещё не инициализирована, примените схему. Команды `CREATE TABLE IF NOT EXISTS` безопасно оставляют существующие таблицы на месте:

   ```bash
   npx wrangler d1 execute vkmuzpremium_stars --remote --file=./schema.sql
   ```

3. Добавьте действующий токен `@VkMuzicXbot` как **Worker Secret**, а не как обычную переменную и не в GitHub:

   ```bash
   npx wrangler secret put BOT_TOKEN
   ```

   Введите токен только в приватном запросе Wrangler. При обновлении Worker уже существующий Secret остаётся секретным. Если токен когда-либо публиковался или отправлялся в чат, сначала отзовите его через BotFather, выпустите новый и обновите `BOT_TOKEN`.

4. Разверните Worker:

   ```bash
   npx wrangler deploy
   ```

   Ожидаемый endpoint: `https://vkmuzpremium-stars-payments.husniddin2006yil.workers.dev`.

5. Проверьте конфигурацию и Telegram-соединение:

   ```text
   https://vkmuzpremium-stars-payments.husniddin2006yil.workers.dev/health
   https://vkmuzpremium-stars-payments.husniddin2006yil.workers.dev/health?check=telegram
   ```

   Второй адрес выполняет только read-only проверку Bot API, D1 и совпадения webhook URL; он **не меняет webhook**.

6. Если `webhookMatches` равно `false`, откройте `/setup`. Сначала проверьте текущий webhook и число ожидающих обновлений. Только затем отметьте согласие на замену и подключите новый адрес. Замена webhook может остановить другой сервер/функции этого бота; не отключайте прежний сервер, пока не готовы.

## Cloudflare Pages и Mini App

Публикуйте корень репозитория как статический сайт: Framework preset `None`, Build command `exit 0`, Build output directory `.`. Убедитесь, что адрес сайта совпадает с `MINI_APP_URL` в `payments-worker/wrangler.toml`, а `PAYMENTS_API_URL` в `app.js` указывает на фактический Worker URL. После публикации укажите Pages URL в BotFather как URL Mini App (или откройте приложение кнопкой `/start`).

## Локальные проверки

В Worker-каталоге:

```bash
npm test
npx wrangler deploy --dry-run
```

Тесты имитируют Bot API и D1; они не списывают Stars и не обращаются к настоящим пользователям.

## Безопасность и границы

- Не добавляйте `.env`, bot token, приватные ключи или пользовательские платёжные данные в Git. `.env` и `.dev.vars` исключены через `.gitignore`.
- Секрет `BOT_TOKEN` нужен только Worker; он никогда не нужен в браузерном Mini App.
- Реальную покупку проверяйте только в Telegram и помните, что Stars — реальные средства. Локальные тесты платежи не проводят.
- Публичный health endpoint показывает только минимальный статус сервиса, не секреты.
- Токен бота не присылайте в чат. Владелец должен хранить его в Cloudflare Secrets.
