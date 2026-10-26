# Модульная система промтов и скилов для кодинг-агентов (Plan / Build)

Репозиторий содержит чистую, модульную систему XML-инструкций и подключаемых скилов для встроенных кодинг-агентов (OpenCode v2, Cursor, Cline, Roo Code, Windsurf и др.), работающих по двухфазному конвейеру **Plan → Build**.

> **Ключевой принцип:** Эти промты **не создают агента с нуля** — они выступают внешней системной надстройкой (System Override / Custom Instructions) над встроенными агентами среды разработки, задавая жёсткие инженерные рамки **SOLID**, **DRY**, **KISS** и **абсолютную чистоту контекста** (полное выжигание ссылок на `issue #123`, тикеты, историю изменений и `TODO`-мусор, чем особенно грешат быстрые модели класса `DeepSeek Flash`).

---

## Архитектура репозитория (Repository Blueprint)

```text
opencode-prompts/
├── README.md                      # Инструкция по подключению и архитектуре
├── install.mjs                    # Скрипт глобальной установки в ~/.config/opencode (без правки проектов)
├── prompts/
│   ├── plan_core.xml              # Надстройка фазы Plan (Архитектор + Селектор Скилов)
│   └── build_core.xml             # Надстройка фазы Build (Строгий Исполнитель кода)
└── skills/
    ├── context_hygiene.xml        # [АКТИВЕН ВСЕГДА] Антидот против мета-контекста и мусорных комментариев
    ├── solid_compliance.xml       # Модуль архитектурной дисциплины и ООП (SOLID)
    ├── dry_kiss_clean.xml         # Модуль чистоты, простоты и читаемости кода (DRY/KISS/YAGNI)
    ├── context_hygiene/SKILL.md   # Нативный пакет скила для инструмента `skill` в OpenCode v2
    ├── solid_compliance/SKILL.md  # Нативный пакет скила для инструмента `skill` в OpenCode v2
    └── dry_kiss_clean/SKILL.md    # Нативный пакет скила для инструмента `skill` в OpenCode v2
```

### Роли модулей в пайплайне

| Модуль | Фаза | Назначение |
| :--- | :---: | :--- |
| `prompts/plan_core.xml` | **Plan** | Работает в режиме `read-only`. Исследует кодовую базу, выбирает нужные скилы из `skills/` (Skill Selector) и формирует атомарный архитектурный план (Blueprint). |
| `prompts/build_core.xml` | **Build** | Исполняет план или прямую задачу. Вносит хирургические изменения в код, прогоняет каждую правку через `pre_commit_gate` и запускает проверки (`typecheck`/`tests`). |
| `skills/context_hygiene.xml` | **Plan + Build (Всегда)** | Высший приоритет (`CRITICAL`). Запрещает любые упоминания тикетов (`#123`, `issue`), PR, дат инцидентов, старого кода, `TODO`/`FIXME` и мусорных комментариев. |
| `skills/solid_compliance.xml` | **Build (по выбору Plan)** | Контролирует SRP (отделение чистой логики от I/O), OCP (реестры/маппинги вместо `if/else`), LSP, ISP (узкие `Deps`-интерфейсы) и DIP. |
| `skills/dry_kiss_clean.xml` | **Build (по выбору Plan)** | Контролирует единый источник истины (DRY), простоту решений (KISS), отсутствие кода «на будущее» (YAGNI), Guard Clauses и строгую типизацию без `any`. |

---

## Быстрое подключение к OpenCode v2

### Вариант 1 (Рекомендуемый): Глобальная установка в `~/.config/opencode` (без правки проектов)

Чтобы **не менять локальный `opencode.json` в каждом проекте** и не зависеть от того, в какой папке лежат проекты, установите промты и скилы один раз в глобальную конфигурацию OpenCode (`~/.config/opencode`):

```bash
git clone https://github.com/opiguez/opencode-prompts.git
cd opencode-prompts
node install.mjs
opencode service restart
```

Что делает `node install.mjs`:
1. Копирует `prompts/` и `skills/` напрямую в `~/.config/opencode/prompts` и `~/.config/opencode/skills` (OpenCode v2 автоматически находит все скилы в `~/.config/opencode/skills` для любого проекта на диске).
2. Бережно обновляет глобальный `~/.config/opencode/opencode.jsonc` (сохраняя ваши `provider`/`model`), подключая надстройку `plan` и `build` через пути `~/.config/opencode/...`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "instructions": [
    "~/.config/opencode/skills/context_hygiene.xml"
  ],
  "agents": {
    "plan": {
      "hidden": false,
      "system": "{file:~/.config/opencode/prompts/plan_core.xml}\n{file:~/.config/opencode/skills/context_hygiene.xml}"
    },
    "build": {
      "hidden": false,
      "system": "{file:~/.config/opencode/prompts/build_core.xml}\n{file:~/.config/opencode/skills/context_hygiene.xml}\n{file:~/.config/opencode/skills/solid_compliance.xml}\n{file:~/.config/opencode/skills/dry_kiss_clean.xml}"
    }
  }
}
```

Локальные `opencode.json` ваших проектов трогать не нужно — OpenCode v2 автоматически объединяет глобальный конфиг с проектным.

### Вариант 2: Локальное подключение в конкретный проект

Если нужно подключить правила только к одному проекту (без глобальной установки), добавьте в `opencode.json` проекта:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "instructions": [
    "../opencode-prompts/skills/context_hygiene.xml"
  ],
  "skills": [
    "../opencode-prompts/skills"
  ],
  "agents": {
    "plan": {
      "hidden": false,
      "system": "{file:../opencode-prompts/prompts/plan_core.xml}\n{file:../opencode-prompts/skills/context_hygiene.xml}"
    },
    "build": {
      "hidden": false,
      "system": "{file:../opencode-prompts/prompts/build_core.xml}\n{file:../opencode-prompts/skills/context_hygiene.xml}\n{file:../opencode-prompts/skills/solid_compliance.xml}\n{file:../opencode-prompts/skills/dry_kiss_clean.xml}"
    }
  }
}
```

> **Почему `context_hygiene.xml` указан и в `instructions`, и в `system`?**
> - Поле `system` у `agents.plan` и `agents.build` задаёт ядро поведения конкретного режима.
> - Поле `instructions` гарантирует, что антидот против мета-контекста (`context_hygiene.xml`) автоматически инжектится **во все сессии и субагенты** (`general`, `explore` и пользовательские агенты) поверх любых проектных `AGENTS.md`.

После сохранения конфигурации перезапустите фоновый сервис OpenCode v2 (или dev-сервер):

```bash
opencode service restart
```

---

## Подключение в другие среды (Cursor / Windsurf / Cline / Roo Code)

Так как все файлы используют чистую самодостаточную XML-разметку, их можно скопировать в настройки любого встроенного кодинг-агента:

1. **Глобальные правила (Always-On Rules / Custom Instructions):**
   Скопируйте содержимое `skills/context_hygiene.xml` в секцию глобальных правил IDE — это навсегда отключит генерацию `TODO`, ссылок на `#issue` и избыточных комментариев.
2. **Режим Plan / Architect:**
   Вставьте в системное дополнение режима планирования:
   `prompts/plan_core.xml` + `skills/context_hygiene.xml`.
3. **Режим Build / Code / Act:**
   Вставьте в системное дополнение режима написания кода:
   `prompts/build_core.xml` + `skills/context_hygiene.xml` + `skills/solid_compliance.xml` + `skills/dry_kiss_clean.xml`.
