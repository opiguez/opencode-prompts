# Angular: настройка окружения

Справочник к модулю `angular_expert`. Содержит только то, что зависит от конкретного проекта и версии фреймворка; сами правила кодирования — в `../SKILL.md` (нативный скил) и `../../angular_expert.xml` (профиль `system`).

## Версия фреймворка

Модуль описывает Angular v20–v22. Нижние границы API:

| API | Минимальная версия |
| :--- | :--- |
| `standalone: true` обязателен в декораторе | до v19 |
| `input()`, `output()` | v17.1 |
| `model()` | v17.2 |
| `linkedSignal()` | v19 |
| `OnPush` по умолчанию (не указывать явно) | v22 |
| `@Service` вместо `Injectable({providedIn: 'root'})` | v22 |
| Signal Forms (`@angular/forms/signals`) | v22 |

Источник истины — `package.json` и `tsconfig.json` проекта. Если версия ниже указанной, API не использовать.

## Вызов скила

- Автоматически: модель сопоставляет задачу с `description` и загружает скил инструментом `skill`.
- Принудительно: упомянуть `@angular_expert` в промпте.
- Только вручную: добавить в frontmatter `metadata: { opencode/autoinvoke: false }` — скил исчезнет из авто-списка, но останется доступен по ID.
- Всегда в контексте: подключить `{file:.../skills/angular_expert.xml}` в `system` агента.

## Angular CLI MCP Server

`ng mcp` даёт агенту действия, а не текст правил: `search_documentation`, `get_best_practices`, `list_projects`, `run_target`, `devserver.*`, `onpush_zoneless_migration`.

Конфиг OpenCode v2 (в проекте с `angular.json`):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "angular-cli": {
        "type": "local",
        "command": ["npx", "-y", "@angular/cli", "mcp"],
        "cwd": "."
      }
    }
  }
}
```

Проверка подключения — `opencode mcp list`. Имена инструментов: `angular_cli_search_documentation` и т. д.; в Code Mode они сгруппированы как `tools.angular_cli.*`.

`get_best_practices` отдаёт правила под установленную версию Angular и уточняет версионные guard'ы модуля; `search_documentation` снимает догадки по новым API (`@Service`, Signal Forms, `@defer`).

Обрезка шума — запрет ненужных инструментов:

```jsonc
{
  "permissions": [
    { "action": "angular_cli_ai_tutor", "resource": "*", "effect": "deny" },
    { "action": "angular_cli_devserver_*", "resource": "*", "effect": "deny" }
  ]
}
```

Режимы запуска: `["npx", "-y", "@angular/cli", "mcp", "--read-only"]` — только инструменты без изменений проекта; `--local-only` — без интернета (отключает `search_documentation`).

Сервер подключается в проекте с `angular.json`: `list_projects` читает этот файл, в не-Angular репозиториях сервер бесполезен.

## Смежные официальные ресурсы

- `npx skills add https://github.com/angular/skills` — официальные скилы `angular-developer` и `angular-new-app`. Не дублируют модуль: дают широкие рекомендации и генерацию нового приложения, тогда как `angular_expert` задаёт жёсткие рамки в существующем коде.
- `best-practices.md` и `llms-full.txt` с `angular.dev` — исходные материалы, на которых построен модуль.
