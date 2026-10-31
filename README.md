# Модульная система промтов и скилов для кодинг-агентов (Plan / Build / Review / Refactor)

Репозиторий содержит чистую, модульную систему XML-инструкций и подключаемых скилов для встроенных кодинг-агентов (OpenCode v2, Cursor, Cline, Roo Code, Windsurf и др.), работающих по конвейеру **Plan → Build → Review**, плюс режим **Refactor** для разбора fat files.

> **Ключевой принцип:** Эти промты **не создают агента с нуля** — они выступают внешней системной надстройкой (System Override / Custom Instructions) над встроенными агентами среды разработки, задавая жёсткие инженерные рамки **SOLID**, **DRY**, **KISS** и **абсолютную чистоту контекста** (полное выжигание ссылок на `issue #123`, тикеты, историю изменений и `TODO`-мусор, чем особенно грешат быстрые модели класса `DeepSeek Flash`).

---

## Архитектура репозитория (Repository Blueprint)

```text
opencode-prompts/
├── README.md                      # Инструкция по подключению и архитектуре
├── install.mjs                    # Скрипт глобальной установки в ~/.config/opencode (без правки проектов)
├── prompts/
│   ├── plan_core.xml              # Надстройка фазы Plan (Архитектор + Селектор Скилов)
│   ├── build_core.xml             # Надстройка фазы Build (Строгий Исполнитель кода)
│   ├── review_core.xml            # Надстройка фазы Review (независимый ревьюер до/после рефакторинга)
│   ├── refactor_core.xml          # Надстройка Refactor (аудит fat files → модульная структура)
│   ├── audit_common.xml           # Общее ядро аудитов: read-only, доказательства, severity, формат отчёта
│   ├── perf_core.xml              # Runtime-аудит: ререндеры, частотные события, гонки, утечки
│   ├── bundle_core.xml            # Bundle-аудит: tree shaking, code splitting, зависимости, ассеты
│   ├── ui_core.xml                # UI-аудит: a11y, клавиатура и фокус, формы, анимация, i18n
│   └── ui_designer_core.xml       # Планировщик UI: аудит поверхности, новое направление, motion → design-plans/
├── commands/
│   ├── review.md                  # Команда /review: diff в контекст + запуск ревьюера в дочерней сессии
│   ├── refactor.md                # Команда /refactor: запуск рефакторинга в текущей сессии
│   ├── perf.md                    # Команда /perf: runtime-аудит в дочерней сессии
│   ├── bundle.md                  # Команда /bundle: bundle-аудит в дочерней сессии
│   ├── ui-audit.md                # Команда /ui-audit: UI-аудит в дочерней сессии
│   └── design.md                  # Команда /design: планировщик UI в текущей сессии
└── skills/
    ├── context_hygiene.xml        # [АКТИВЕН ВСЕГДА] Антидот против мета-контекста и мусорных комментариев
    ├── solid_compliance.xml       # Модуль архитектурной дисциплины и ООП (SOLID)
    ├── dry_kiss_clean.xml         # Модуль чистоты, простоты и читаемости кода (DRY/KISS/YAGNI)
    ├── angular_expert.xml         # Модуль идиоматичного Angular (сигналы, standalone, формы, DI, a11y, перф)
    ├── context_hygiene/SKILL.md   # Нативный пакет скила для инструмента `skill` в OpenCode v2
    ├── solid_compliance/SKILL.md  # Нативный пакет скила для инструмента `skill` в OpenCode v2
    ├── dry_kiss_clean/SKILL.md    # Нативный пакет скила для инструмента `skill` в OpenCode v2
    ├── angular_expert/SKILL.md    # Нативный пакет скила для инструмента `skill` в OpenCode v2
    ├── angular_expert/references/{setup,performance}.md  # Настройка проекта и каталог правил производительности
    ├── ui_design.xml              # Правила дизайна: токены, иерархия, состояния, motion
    ├── ui_design/SKILL.md         # Нативный пакет скила для инструмента `skill` в OpenCode v2
    └── ui_design/references/      # plan-template.md и motion.md
```

### Роли модулей в пайплайне

| Модуль | Фаза | Назначение |
| :--- | :---: | :--- |
| `prompts/plan_core.xml` | **Plan** | Работает в режиме `read-only`. Исследует кодовую базу, выбирает нужные скилы из `skills/` (Skill Selector) и формирует атомарный архитектурный план (Blueprint). |
| `prompts/build_core.xml` | **Build** | Исполняет план или прямую задачу. Вносит хирургические изменения в код, прогоняет каждую правку через `pre_commit_gate` и запускает проверки (`typecheck`/`tests`). |
| `prompts/review_core.xml` | **Review** | Независимая инспекция «до/после»: инвентарь исходника, карта переноса, поиск потерянных веток и валидаций, оценка SRP/coupling, DRY и сложности. Только чтение, никаких правок. |
| `prompts/refactor_core.xml` | **Refactor** | Аудит fat files по метрикам (размер файла, длина функции, вложенность, цикломатика, число аргументов), проектирование целевой структуры и поэтапное извлечение модулей с проверкой сборки на каждом шаге. |
| `prompts/perf_core.xml` | **Audit (runtime)** | Ререндеры и производные вычисления, стабильность ссылок, частотные события, структуры данных, гонки запросов, утечки, виртуализация списков. Только чтение. |
| `prompts/bundle_core.xml` | **Audit (bundle)** | Tree shaking и barrel-файлы, route/component-level splitting, вес зависимостей и полифилов, CSS и ассеты, дубли пакетов. Только чтение. |
| `prompts/ui_core.xml` | **Audit (UI)** | A11y и семантика, клавиатура и фокус, формы, анимация, контент, локаль, гидрация. Только чтение. |
| `prompts/ui_designer_core.xml` | **Design (planner)** | Аудит существующей поверхности, направление для новой, motion. Пишет только `design-plans/`, код не трогает. |
| `skills/context_hygiene.xml` | **Plan + Build (Всегда)** | Высший приоритет (`CRITICAL`). Запрещает любые упоминания тикетов (`#123`, `issue`), PR, дат инцидентов, старого кода, `TODO`/`FIXME` и мусорных комментариев. |
| `skills/solid_compliance.xml` | **Build (по выбору Plan)** | Контролирует SRP (отделение чистой логики от I/O), OCP (реестры/маппинги вместо `if/else`), LSP, ISP (узкие `Deps`-интерфейсы) и DIP. |
| `skills/dry_kiss_clean.xml` | **Build (по выбору Plan)** | Контролирует единый источник истины (DRY), простоту решений (KISS), отсутствие кода «на будущее» (YAGNI), Guard Clauses и строгую типизацию без `any`. |
| `skills/angular_expert.xml` | **Build (по выбору Plan)** | Идиоматичный Angular v20–v22: сигналы, standalone, типизированные формы, `inject()`, нативные шаблоны, a11y и производительность. Версионные guard'ы и настройка окружения — в `skills/angular_expert/references/`. |

### Два формата одного модуля

Любой модуль из `skills/` существует в двух формах — это **не дубликат, а два режима подключения**:

- `<module>/SKILL.md` — нативный скил OpenCode v2: грузится по требованию инструментом `skill` и не занимает контекст постоянно. Рекомендуемый режим.
- `<module>.xml` — тот же текст без frontmatter: для `system`-профиля агента, сред без инструмента `skill` (Cursor, Windsurf, Cline) и случаев, когда правила нужны всегда.

Модуль, который нужен постоянно, подключается в `system` агента:

```jsonc
{
  "agents": {
    "build": {
      "system": "{file:~/.config/opencode/prompts/build_core.xml}\n{file:~/.config/opencode/skills/context_hygiene.xml}\n{file:~/.config/opencode/skills/solid_compliance.xml}\n{file:~/.config/opencode/skills/dry_kiss_clean.xml}"
    }
  }
}
```

### Как скил попадает в работу (механика OpenCode v2)

1. **Discovery** — `~/.config/opencode/skills/<module>/SKILL.md` или `.opencode/skills/<module>/SKILL.md`; ID скила — имя каталога (frontmatter `name` — только подпись).
2. **Advertise** — на каждом шаге модели показываются лишь `ID + name + description`; тело модуля в контексте не висит.
3. **Load** — модель сопоставляет задачу с `description` и вызывает инструмент `skill` с точным ID.

Выбор **семантический**: привязки к glob-путям, как в `.cursor/rules`, в OpenCode нет, поэтому 100% гарантии авто-вызова не существует.

| Способ включения | Гарантия | Цена |
| :--- | :---: | :--- |
| Упоминание `@<skill-id>` в промпте | 100% | один токен ввода |
| Selector в `plan_core.xml` → пункт в плане | высокая | работает только через фазу Plan |
| Правило в `build_core.xml` | высокая | шаг вызова остаётся за моделью |
| `{file:...<module>.xml}` в `system` агента | 100% | объём модуля в каждом запросе |
| `metadata.opencode/autoinvoke: false` | ручной режим | скил скрыт из авто-списка, вызывается только явно |

Фреймворк-специфичная настройка (MCP-серверы, версии, миграции) в этом README не описывается: она лежит в `skills/<module>/references/` рядом с модулем и подгружается по необходимости.

### Роли Review, Refactor и аудиты: почему агенты, а не скилы

Ревью требует изолированного контекста (чтобы не оценивать собственные правки) и права только читать, поэтому роль оформлена агентом `reviewer` (`mode: subagent`). Рефакторинг меняет файлы и должен уметь вести диалог по плану, поэтому `refactorer` — агент с `mode: all`. Аудиты производительности, бандла и интерфейса тоже только читают и потому живут как субагенты. Планировщик UI — primary-агент `ui-designer`: он ведёт дизайн-диалог и пишет план, поэтому его выбирают вручную, как `plan`. Команды `/review`, `/refactor`, `/perf`, `/bundle`, `/ui-audit`, `/design` — ярлыки запуска.

| Механизм | Что даёт | Ограничение |
| :--- | :--- | :--- |
| Скил | правила в текущей сессии, дёшево | нет изоляции: ревьюер видит историю правок и рассуждений |
| Агент (`subagent`) | свежий контекст, свои права и модель | собственного `@`-синтаксиса для агентов в OpenCode нет |
| Команда | шаблон + аргументы + `agent:` + подстановка diff | сама по себе роль не изолирует |

Способы вызова:

- `/review` — подставляет `git status`, `git diff --stat` и `git diff`, затем запускает `reviewer` в дочерней сессии.
- `/refactor <путь>` — запускает `refactorer` в текущей сессии, чтобы план и правки шли в одном диалоге. Без аргумента выбираются самые крупные файлы.
- `/perf [цель]` и `/bundle [цель]` — дочерняя сессия с аудитором; без аргумента аудит идёт по изменениям в рабочем дереве.
- `/ui-audit [цель]` — дочерняя сессия с UI-аудитором.
- `/design [поверхность]` — планировщик UI в текущей сессии: разбор, находки, план в `design-plans/`.
- «Запусти ревьюера на текущий диф» — primary-агент сам вызовет субагента.
- `@` в OpenCode адресует файлы и скилы (`@angular_expert`), но не агентов: `@reviewer` не сработает.

### Почему аудиты разделены

Это разные вопросы, разные инструменты и разные симптомы:

| | Runtime (`/perf`) | Bundle (`/bundle`) | UI (`/ui-audit`) |
| :--- | :--- | :--- | :--- |
| Вопрос | почему лагает | почему долго грузится | почему сценарий недоступен |
| Инструмент | профайлер, Web Vitals | build + анализатор | axe/Lighthouse, обход с клавиатуры |
| Вывод | debounce, `Promise.all`, отмена | dynamic import, splitting | имя контрола, `:focus-visible`, `label` |

Склеенный промт смешивает методики: `memo` вместо размера чанка, ленивую загрузку вместо устранения гонки, `aria-label` вместо виртуализации. Поэтому — три тонких промта на общем ядре `prompts/audit_common.xml`: read-only, `path:line`, severity, единый формат. Ядро меняется один раз и действует на все аудиты.

`install.mjs` копирует `commands/` в `~/.config/opencode/commands` и регистрирует агентов: `reviewer`, `perf-auditor`, `bundle-auditor` и `ui-auditor` — с запретом `edit`; `ui-designer` — primary с записью только в `design-plans/`; `refactorer` — со скилами SOLID и DRY в системном промте.

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

## Источники

Каталог производительности — адаптация [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) (MIT, © Vercel); чеклист UI — [web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines) (MIT, © Vercel); планировщик — по мотивам [ibelick/ui-skills](https://github.com/ibelick/ui-skills), [emilkowalski/skills](https://github.com/emilkowalski/skills) (MIT) и [anthropics/skills](https://github.com/anthropics/skills) (Apache-2.0); API и версии Angular — [angular.dev](https://angular.dev).
