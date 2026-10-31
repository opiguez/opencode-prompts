---
name: Angular Expert
description: Идиоматичный Angular v20–v22 — сигналы, standalone-компоненты, типизированные и Signal Forms, inject(), современные шаблоны, ленивый роутинг и a11y. Загружай при любых правках Angular-кода (компоненты, директивы, сервисы, шаблоны, формы, маршруты, DI) и при ревью Angular-проекта.
---

<skill_module id="angular_expert" version="1.1" category="framework" enforcement="STRICT">
  <meta>
    <name>Angular Engineering Rules (v20–v22)</name>
    <purpose>
      Модуль идиоматичного Angular-кода: сигналы, standalone-компоненты, типизированные и signal-формы,
      функциональное внедрение зависимостей, современные шаблоны, доступность и производительность.
      Отсекает генерацию устаревших конструкций (NgModules, декораторы @Input/@Output, `*ngIf`,
      `@HostBinding`/`@HostListener`, `ngClass`/`ngStyle`, `mutate`).
    </purpose>
  </meta>

  <preconditions enforcement="STRICT">
    <rule id="VERSION_AWARENESS">
      Перед первой правкой прочитай версию Angular в `package.json` и `tsconfig.json`.
      Правила модуля описывают Angular v20–v22. Для более старых версий применяй только существующие там API:
      `standalone: true` обязателен до v19 включительно; `input()`/`output()`/`model()` — с v17.1+;
      `linkedSignal()` — с v19+; `@Service` и Signal Forms (`@angular/forms/signals`) — с v22.
      API, отсутствующего в версии проекта, не использовать даже если он описан ниже.
    </rule>
    <rule id="EXISTING_CODE_WINS">
      Существующий стиль файла имеет приоритет. Не переписывай NgModule, `*ngIf` или декораторные
      `@Input`/`@Output` в соседнем коде ради «модернизации»: современные соглашения применяй к новому коду
      и к тому, что явно входит в задачу. Смешение двух стилей в одном файле запрещено.
    </rule>
    <rule id="STRICT_TYPES">
      Строгий режим TypeScript не ослаблять (`strict`, `strictTemplates`). `any` запрещён —
      для неизвестных данных использовать `unknown` с сужением типа.
    </rule>
    <rule id="MCP_BRIDGE">
      Если в окружении доступен Angular CLI MCP-инструмент `get_best_practices`, вызови его один раз
      и используй ответ как уточнение правил под установленную версию Angular. Для незнакомого API
      вызывай `search_documentation` вместо догадок. Если MCP-инструментов нет — работай строго по правилам модуля.
    </rule>
  </preconditions>

  <references>
    Настройка под проект (границы версий API, вызов скила, Angular CLI MCP Server) — `references/setup.md`; читай при первичной настройке репозитория или при вопросе «почему не работает эта настройка».
    Каталог правил производительности с примерами и приоритетами — `references/performance.md`; читай при перф-задачах, ревью горячего пути и работе с `@defer`, SSR и размером бандла.
  </references>

  <principles>
    <principle id="COMPONENTS" name="Компоненты и директивы">
      <rule>
        Компонент — маленький, с одной ответственностью, на standalone-архитектуре.
      </rule>
      <directives>
        - Standalone — режим по умолчанию с v19/v20: НЕ указывай `standalone: true` в декораторе.
        - НЕ указывай `changeDetection: ChangeDetectionStrategy.OnPush` явно: в v22 это поведение по умолчанию.
        - Входы и выходы — функции `input()`, `output()`, двусторонняя связь — `model()`; декораторы `@Input`/`@Output` только в существующем коде.
        - Запросы к шаблону и контенту — `viewChild()`, `viewChildren()`, `contentChild()`, `contentChildren()` вместо `@ViewChild`/`@ContentChild`.
        - Слушатели и атрибуты хоста — объект `host: { ... }` в декораторе; `@HostBinding`/`@HostListener` запрещены.
        - Производное состояние — `computed()`; состояние, зависящее от нескольких реактивных источников, — `linkedSignal()`.
        - Шаблон и стили маленького компонента — инлайновые; при внешних файлах пути указывай относительно `.ts`-файла компонента.
        - Классы и стили — привязки `[class.x]`/`[style.x]`; `ngClass` и `ngStyle` запрещены.
      </directives>
    </principle>

    <principle id="TEMPLATES" name="Шаблоны">
      <rule>
        Шаблон декларативен: вычисления живут в классе компонента, а не в разметке.
      </rule>
      <directives>
        - Управляющие конструкции — `@if`, `@for`, `@switch`; `*ngIf`/`*ngFor`/`*ngSwitch` в новом коде запрещены.
        - В `@for` всегда указывай `track` по стабильному ключу (`track item.id`), а не по индексу.
        - Сложные выражения и цепочки вызовов выноси в `computed()`.
        - Observable в шаблоне разворачивай через `async`, а не ручной `subscribe` в компоненте.
        - Не полагайся на браузерные глобалы (`window`, `document`, `localStorage`, `new Date()` на этапе инициализации):
          при SSR/пререндере их нет — используй `isPlatformBrowser`, `afterNextRender` и инъекцию зависимостей вместо прямых обращений.
      </directives>
    </principle>

    <principle id="STATE" name="Состояние и реактивность">
      <rule>
        Единственный источник состояния — сигналы; преобразования чистые и предсказуемые.
      </rule>
      <directives>
        - Локальное состояние компонента и сервиса — `signal()`.
        - Производные значения — `computed()`, без дублирующих полей и ручной синхронизации.
        - Изменение сигнала — только `set()` или `update()`; `mutate()` запрещён.
        - Побочные эффекты — `effect()` только для синхронизации с внешним миром; бизнес-логику в `effect()` не помещай.
      </directives>
    </principle>

    <principle id="DI" name="Сервисы и внедрение зависимостей">
      <rule>
        Сервис — одна ответственность, зависимости запрашиваются в точке использования.
      </rule>
      <directives>
        - Синглтон-сервис — `providedIn: 'root'` (в v22+ предпочтительно декоратор `@Service`).
        - Внедрение — функция `inject()` в поле класса; внедрение через параметры конструктора в новом коде не использовать.
        - Гварды и резолверы — функциональные (`CanActivateFn`, `ResolveFn`) с `inject()` внутри.
        - Зависимость на инфраструктуру (HTTP, storage, время) скрывай за узким токеном или сервисом, чтобы логика оставалась тестируемой.
      </directives>
    </principle>

    <principle id="FORMS" name="Формы">
      <rule>
        Новые формы — типизированные и реактивные; источник истины — состояние класса, а не шаблон.
      </rule>
      <directives>
        - Предпочтительно Signal Forms (`@angular/forms/signals`, v22+): сигнальное состояние, типизированный доступ к полям, схемная валидация.
        - Иначе — Reactive Forms с явными типами (`FormControl&lt;T&gt;`, `FormGroup&lt;T&gt;`, `nonNullable: true` там, где значение не бывает `null`).
        - Template-driven формы (`ngModel`) в новом коде не создавать.
      </directives>
    </principle>

    <principle id="ROUTING" name="Маршрутизация">
      <rule>
        Границы функциональных разделов задаются ленивыми маршрутами.
      </rule>
      <directives>
        - Feature-раздел подключай через `loadChildren`, отдельный экран — через `loadComponent`.
        - Конфигурацию маршрутов держи декларативной, без побочных эффектов на этапе загрузки.
      </directives>
    </principle>

    <principle id="IMAGES" name="Изображения">
      <rule>
        Статические изображения проходят через `NgOptimizedImage`.
      </rule>
      <directives>
        - Задавай `ngSrc` и размеры; `src` для статических картинок не использовать.
        - `NgOptimizedImage` не применяется к inline base64 — там оставляй обычный `src`.
      </directives>
    </principle>

    <principle id="A11Y" name="Доступность">
      <rule>
        Разметка обязана проходить AXE-проверки и соответствовать WCAG AA.
      </rule>
      <directives>
        - Семантический нативный элемент предпочтительнее `div` с ARIA-ролью.
        - Управляй фокусом при открытии/закрытии оверлеев и смене маршрута; сохраняй видимый focus-ring.
        - Каждый интерактивный элемент доступен с клавиатуры и имеет доступное имя (label, `aria-label` или текст).
        - Контраст текста и иконок — не ниже WCAG AA.
      </directives>
    </principle>

    <principle id="PERF" name="Производительность">
      <rule>
        Сначала измерение, потом оптимизация: правка без профиля — гипотеза, а не основание менять архитектуру.
      </rule>
      <directives>
        - Независимые запросы — параллельно (`Promise.all`, `forkJoin`); `await` держи внутри ветки, где значение используется; оператор потока выбирай по семантике (`switchMap` — отмена, `concatMap` — порядок, `exhaustMap` — защита от повторов).
        - Тяжёлые виджеты (модалка, график, редактор, карта) — за `@defer` или `loadComponent`; предзагрузка — `@defer (prefetch on hover)`; сторонние скрипты — после `afterNextRender`.
        - Импортируй напрямую, без barrel-файлов и `import * as`; пути динамических импортов — статические литералы.
        - Производное состояние — `computed()`, зависимое со сбросом — `linkedSignal()`; `effect()` не записывает состояние и не заменяет обработчик события.
        - Частотные значения (координаты указателя, промежуточные состояния drag) — обычное поле класса, не сигнал; сигнал, нужный только в колбэке, читай через `untracked()`.
        - `@for` — всегда `track` по стабильному ключу; вычисления и цепочки вызовов — в `computed()`, не в шаблоне.
        - Список свыше ~100 строк — виртуализация (`@angular/cdk/scrolling`) или пагинация; длинные секции — `content-visibility: auto`.
        - Одинаковые GET дедуплицируй (`shareReplay({ bufferSize: 1, refCount: true })`), устаревшие отменяй (`switchMap`, `takeUntilDestroyed()`).
        - SSR: нет мутабельного состояния на уровне модуля (оно разделяется между запросами); данные, полученные на сервере, передавай через `TransferState`, а не повторным запросом.
        - Микрооптимизации (`Set`/`Map` вместо линейного поиска, один проход вместо `filter().map()`, hoisting RegExp) — только в горячем пути, подтверждённом профилем.
      </directives>
    </principle>
  </principles>

  <forbidden_patterns enforcement="STRICT">
    <item>`standalone: true` в декораторе компонента или директивы.</item>
    <item>Явный `changeDetection: ChangeDetectionStrategy.OnPush` на Angular v22+.</item>
    <item>Декораторы `@Input`, `@Output`, `@ViewChild`, `@ContentChild`, `@HostBinding`, `@HostListener` в новом коде.</item>
    <item>`*ngIf`, `*ngFor`, `*ngSwitch` в новом шаблоне.</item>
    <item>`ngClass`, `ngStyle` вместо привязок `class` и `style`.</item>
    <item>`signal.mutate()` вместо `set()`/`update()`.</item>
    <item>Внедрение зависимостей через параметры конструктора в новом коде.</item>
    <item>Новый NgModule, объявляющий standalone-компоненты или сервисы.</item>
    <item>`any`, `@ts-ignore`, небезопасные приведения типов.</item>
    <item>Ручной `subscribe()` в компоненте там, где достаточно `async` или `toSignal()`.</item>
  </forbidden_patterns>

  <verification enforcement="STRICT">
    <check>Сборка проекта проходит без ошибок типов, включая шаблоны (strictTemplates).</check>
    <check>Новые компоненты не содержат запрещённых конструкций из &lt;forbidden_patterns&gt;.</check>
    <check>Использованные API присутствуют в версии Angular из `package.json`.</check>
    <check>Изменённый шаблон не ломает доступность: имя, фокус и клавиатурная навигация сохранены.</check>
  </verification>
</skill_module>
