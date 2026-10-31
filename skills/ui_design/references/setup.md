# Playwright MCP: настройка

Планировщику нужен отрендеренный экран: без него иерархия, плотность и контраст остаются гипотезами. Билдеру тот же сервер нужен для проверки критериев приёмки из плана.

## Требования

- Node.js 18 или новее.
- Браузеры Playwright: `npx playwright install chromium`.
- Проверка пакета: `npx @playwright/mcp@latest --version`.

## Конфиг OpenCode v2

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "playwright": {
        "type": "local",
        "command": [
          "npx", "-y", "@playwright/mcp@latest",
          "--headless",
          "--browser", "chromium",
          "--isolated",
          "--viewport-size", "1440x900"
        ],
        "cwd": "."
      }
    }
  }
}
```

`--isolated` даёт чистый профиль на сессию. Для экранов за логином профиль не изолируй, а передай состояние: `--storage-state=<path>` или `--user-data-dir=<path>`.

## Проверка

- `opencode mcp list` — сервер виден как `playwright`.
- Инструменты: `playwright_browser_navigate`, `playwright_browser_snapshot`, `playwright_browser_take_screenshot`, `playwright_browser_console_messages`, `playwright_browser_network_requests`, `playwright_browser_resize`, `playwright_browser_find`.
- В Code Mode — `tools.playwright.*`.

## Права

Планировщику достаточно наблюдения; изменяющие инструменты ему не нужны:

```jsonc
"permissions": [
  { "action": "playwright_browser_evaluate", "resource": "*", "effect": "deny" },
  { "action": "playwright_browser_run_code_unsafe", "resource": "*", "effect": "deny" }
]
```

Билдеру разрешено всё: он проверяет результат, кликая по сценарию приёмки.

## Секреты

- `--secrets=<path>` подменяет значения из dotenv-файла в ответах инструментов.
- `--redact-url-params=access_token,code` скрывает токены в URL.
- `--allowed-origins` и `--blocked-origins` ограничивают домены; это не граница безопасности, а фильтр шума.

## Angular

- Запусти приложение до сессии: `ng serve` (обычно `http://localhost:4200`).
- Для самоподписанного сертификата стенда — `--ignore-https-errors`.
- Мобильную раскладку проверяй через `browser_resize`, а не отдельным браузером.

## Docker

Образ `mcr.microsoft.com/playwright/mcp` поддерживает только headless chromium. В своём образе ставь браузеры явно: `npx playwright install --with-deps chromium`.

## Если сервера нет

Планировщик работает по исходникам и помечает находки об иерархии, плотности и контрасте как `hypothesis`. Билдер проверяет приёмку вручную и указывает в отчёте, что рендер не использовался.
