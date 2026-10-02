# Payments Worker

Cloudflare Worker для проверки Telegram Mini App, создания recurring Telegram Stars invoice, обработки Telegram webhook и хранения заказов/подписок в D1.

## Первое развертывание

1. Выполните `npx wrangler login` и войдите в Cloudflare аккаунт, которому принадлежит `shamsiddinov07xz.workers.dev`.
2. База `vkmuzpremium_stars` уже создана; её ID уже сохранён в `wrangler.toml`. Не запускайте `wrangler d1 create` повторно.
3. Инициализируйте таблицы: `npx wrangler d1 execute vkmuzpremium_stars --remote --file=./schema.sql`.
4. Добавьте токен бота как Secret: `npx wrangler secret put BOT_TOKEN`.
5. Разверните Worker: `npx wrangler deploy`.

Ожидаемый адрес: `https://vkmuzpremium-stars-payments.shamsiddinov07xz.workers.dev`. Mini App и `/start` настроены на `https://vkmuzpremium-stars.shamsiddinov07xz.workers.dev/`.

## Безопасная проверка webhook

`GET /health?check=telegram` проверяет D1, токен через `getMe` и соответствие текущего webhook — он не меняет настройки. Если webhook нужно переключить, `/setup` сначала показывает текущий адрес и ожидающие обновления; замену необходимо подтвердить явно, потому что она может отключить предыдущий сервер бота.

Не публикуйте токен бота. Секрет хранится в Cloudflare как `BOT_TOKEN`.

## Тесты

```bash
npm test
npx wrangler deploy --dry-run
```

Локальные тесты имитируют Bot API и D1; реальные платежи не проводят.
