# Angular: правила производительности

Адаптировано из `vercel-labs/agent-skills` → `skills/react-best-practices` (MIT, © Vercel, автор правил @shuding). Исходные правила React/Next переписаны под Angular v20–v22; RSC, Server Actions и механика React-хуков не переносились.

Справочник к модулю `angular_expert`. Базовые правила кодирования — в `../SKILL.md` и `../../angular_expert.xml`; настройка версий и MCP — в `setup.md`.

## Как применять

- Правила действуют для нового кода и для правок, входящих в задачу. Существующий стиль файла приоритетен.
- Нижние границы API: `@defer` — v17, `linkedSignal()` — v19, `resource()` — v19, `provideAppInitializer()` — v19. API, отсутствующего в `package.json` проекта, не использовать.
- Порядок разделов — порядок приоритета: каскады запросов и размер бандла раньше микрооптимизаций.
- Правка без измерения — гипотеза. Сначала профиль, Lighthouse или `ng build --stats-json`, потом изменение кода.

## 1. CRITICAL: каскады запросов

### 1.1 Независимые запросы выполняются параллельно

Последовательные `await` без зависимости по данным складываются в сумму задержек.

Плохо:

```ts
const user = await firstValueFrom(this.api.user());
const posts = await firstValueFrom(this.api.posts());
```

Хорошо:

```ts
const [user, posts] = await Promise.all([
  firstValueFrom(this.api.user()),
  firstValueFrom(this.api.posts()),
]);
```

Для потоков — `forkJoin` (один раз) или `combineLatest` (при обновлениях).

### 1.2 `await` остаётся в ветке, где значение используется

```ts
async load(showDetails: boolean) {
  const list = await this.api.list();
  if (!showDetails) return { list };

  const details = await this.api.details();
  return { list, details };
}
```

### 1.3 Дешёвая проверка выполняется до ожидания

```ts
async save(isDirty: boolean) {
  if (!isDirty) return;
  await this.api.save();
}
```

### 1.4 Оператор потока выбирается по семантике

`switchMap` — отменить предыдущий (поиск, смена фильтра), `concatMap` — сохранить порядок (очередь записи), `mergeMap` — параллельно, `exhaustMap` — игнорировать повторы (защита кнопки от двойного клика).

```ts
readonly results$ = this.query$.pipe(
  debounceTime(250),
  distinctUntilChanged(),
  switchMap((query) => this.api.search(query)),
);
```

### 1.5 Загрузка стартует на уровне маршрута

Данные, известные до создания компонента, запрашиваются резолвером маршрута или через `resource()` с параметром из `input()`, а не в `ngOnInit` после первого рендера.

```ts
readonly orderId = input.required<string>();
readonly order = resource({
  params: () => ({ id: this.orderId() }),
  loader: ({ params }) => firstValueFrom(this.api.order(params.id)),
});
```

`resource()` не зависит от транспорта: `loader` возвращает промис, поэтому подходит любой клиент — `HttpClient`, GraphQL/Apollo, обёртка над gRPC. `httpResource()` — сокращение только для `HttpClient`, к Apollo оно не применяется.

```ts
readonly order = resource({
  params: () => ({ id: this.orderId() }),
  loader: ({ params }) =>
    firstValueFrom(
      this.apollo.query<OrderQuery>({ query: ORDER_QUERY, variables: { id: params.id } }),
    ).then((result) => result.data),
});
```

Если нужен живой поток от Apollo (`watchQuery`, обновления из кэша), альтернатива — `toSignal(this.apollo.watchQuery(...).valueChanges)`; `resource()` остаётся для одноразовой загрузки с ручным `reload()`.

## 2. CRITICAL: размер бандла

### 2.1 Прямые импорты вместо barrel-файлов

Barrel (`index.ts` с реэкспортами) тянет в чанк весь модуль ради одной функции и ломает tree shaking.

Плохо:

```ts
import { formatMoney } from './shared';
```

Хорошо:

```ts
import { formatMoney } from './shared/format-money';
```

То же для пакетов: `@angular/material/button`, а не `@angular/material`. Namespace-импорт (`import * as lib`) запрещён.

### 2.2 Пути импортов статически анализируемы

`loadComponent: () => import('./feature/page')` — литерал. Шаблонные строки и вычисляемые пути лишают сборщик возможности построить чанк.

### 2.3 Тяжёлый виджет грузится лениво

```html
@defer (on interaction) {
  <app-rich-editor [doc]="doc()" />
} @placeholder {
  <div class="editor-skeleton"></div>
}
```

Модалки, графики, карты, календари и редакторы не должны попадать в начальный чанк.

### 2.4 Предзагрузка по намерению

```html
@defer (on viewport; prefetch on hover) {
  <app-heavy-report />
}
```

`prefetch on hover` / `prefetch on idle` подгружает код до открытия, но вне критического пути.

### 2.5 Условная загрузка по активации функции

Библиотека нужна только при первом использовании — импорт внутри метода, а не на верхнем уровне модуля.

```ts
async openPreview() {
  const { renderPreview } = await import('./preview/render-preview');
  renderPreview(this.document());
}
```

### 2.6 Сторонние скрипты — после интерактивности

```ts
afterNextRender(() => {
  void import('analytics').then((module) => module.init());
});
```

Аналитика и логирование не должны задерживать гидрацию.

## 3. HIGH: SSR и гидрация

### 3.1 Нет мутабельного состояния на уровне модуля

Модульная переменная живёт столько же, сколько процесс сервера, и разделяется между запросами разных пользователей.

Плохо:

```ts
let currentUser: User | null = null;
```

Хорошо:

```ts
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly user = signal<User | null>(null);
}
```

Константы и иммутабельные справочники на уровне модуля допустимы.

### 3.2 Данные сервера передаются через `TransferState`

Повторный запрос после гидрации — лишний round trip. Для `HttpClient` перенос настраивается автоматически:

```ts
provideClientHydration(withHttpTransferCacheOptions({ includePostRequests: false }));
```

Для Apollo SSR данные переносятся кэшем, а не HTTP-перехватчиком: на сервере `apollo.cache.extract()` кладётся в `TransferState`, на клиенте — `apollo.cache.restore(...)` до первого запроса. Для прочих не-HTTP источников — `makeStateKey` + `TransferState.get/set`.

### 3.3 Payload `TransferState` минимален

Передавай только то, что нужно первому рендеру; тяжёлые списки и вложения догружаются на клиенте.

### 3.4 Статические данные поднимаются на уровень модуля

Конфигурация, словари и константы создаются один раз, а не в конструкторе каждого экземпляра.

### 3.5 Авторизация проверяется на сервере

Клиентский гвард — UX, а не защита. Проверка прав живёт в серверном маршруте или `CanMatchFn`, выполняемом на сервере.

### 3.6 Браузерные глобалы доступны только после рендера

`window`, `document`, `localStorage`, `matchMedia` отсутствуют при SSR. Используй `isPlatformBrowser(inject(PLATFORM_ID))`, `afterNextRender` или инъекцию обёртки.

## 4. MEDIUM-HIGH: клиентские данные

### 4.1 Одинаковые запросы дедуплицируются

```ts
readonly catalog$ = this.http.get<Catalog[]>('/api/catalog').pipe(
  shareReplay({ bufferSize: 1, refCount: true }),
);
```

`shareReplay` без `refCount` удерживает подписку и данные после ухода всех подписчиков.

GraphQL-клиент с нормализованным кэшем (`Apollo InMemoryCache`, политика `cache-first`) дедуплицирует одинаковые запросы сам: `shareReplay` нужен только для транспорта без кэша или для вызовов, которые кэш обходят (`fetchPolicy: 'no-cache'`).

### 4.2 Один делегированный слушатель вместо N

Слушатель на контейнере с проверкой `event.target` дешевле слушателя на каждом элементе списка.

### 4.3 `passive` для scroll и touch

`{ passive: true }` на `scroll`, `touchstart`, `touchmove` убирает блокировку прокрутки ожиданием обработчика.

### 4.4 `localStorage` версионируется и минимизируется

Ключ содержит версию схемы, значение — только необходимые поля. Чтение кэшируется в памяти: синхронный доступ к storage в горячем пути блокирует поток.

## 5. MEDIUM: реактивность и шаблон

### 5.1 Производное состояние — `computed()`

`effect()`, записывающий один сигнал из другого, создаёт лишний цикл, а порядок обновлений начинает зависеть от подписки.

Плохо:

```ts
readonly items = signal<Item[]>([]);
readonly total = signal(0);

constructor() {
  effect(() => this.total.set(this.items().length));
}
```

Хорошо:

```ts
readonly items = signal<Item[]>([]);
readonly total = computed(() => this.items().length);
```

### 5.2 Зависимое состояние со сбросом — `linkedSignal()`

Значение, которое пользователь может менять, но которое обязано сбрасываться при смене источника:

```ts
readonly filter = signal<Filter>(initialFilter);
readonly page = linkedSignal(() => ({ filter: this.filter(), index: 0 }));
```

### 5.3 Действие пользователя обрабатывается в обработчике, а не в `effect()`

`effect()` — синхронизация с внешним миром (DOM, storage, логирование). Сохранение, навигация и вызовы API живут в обработчике события.

### 5.4 Изменение сигнала — `update()` с предыдущим значением

```ts
toggle(id: string) {
  this.selected.update((ids) =>
    ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id],
  );
}
```

`set()` с внешней копией теряет изменения при конкурентных обновлениях.

### 5.5 Ленивое вычисление вместо раннего

Дорогое значение считается в `computed()` — оно вычисляется при первом чтении и кэшируется, а не в конструкторе.

### 5.6 Сигнал, нужный только в колбэке, читается через `untracked()`

```ts
effect(() => {
  const id = this.activeId();
  logger.debug('active', untracked(this.debugLabel));
});
```

Иначе изменение `debugLabel` перезапускает эффект без причины.

### 5.7 Частотные значения — обычное поле класса

Координаты указателя, промежуточные значения drag и счётчики кадров не должны быть сигналами: каждое `set()` запускает проверку изменений. Реактивным остаётся только то, что видно в шаблоне.

### 5.8 `@for` — `track` по стабильному ключу

```html
@for (row of rows(); track row.id) {
  <app-row [row]="row" />
}
```

`track $index` пересоздаёт элементы при вставке в начало списка.

### 5.9 Компонент не объявляется внутри компонента

Класс, созданный в теле другого класса, получает новый тип при каждом создании родителя: Angular уничтожает и создаёт поддерево заново.

### 5.10 Статический фрагмент шаблона не пересобирается

Неизменяемые списки опций, меню и разметка выносятся в `ng-template` или статический шаблон, а не собираются вызовами методов в разметке.

### 5.11 Ветвление — `@if` и `@switch`

Вложенные тернарники и `&&` внутри привязки нечитаемы; `@if` даёт явные ветки, `@else` и алиас `as`.

```html
@if (user(); as user) {
  <app-profile [user]="user" />
} @else {
  <app-guest />
}
```

## 6. MEDIUM: рендеринг

### 6.1 `content-visibility` для длинных секций

```css
.report-section {
  content-visibility: auto;
  contain-intrinsic-size: 0 320px;
}
```

Секция вне вьюпорта не раскладывается до прокрутки.

### 6.2 Анимируется обёртка, а не SVG

`transform` и `opacity` на контейнере компонуются GPU; анимация атрибутов SVG или `filter` вызывает перерисовку.

### 6.3 Точность координат SVG снижается

Лишние знаки после запятой в `path` увеличивают разметку без визуальной разницы.

### 6.4 Сторонние скрипты — `defer` или `async`

```html
<script src="https://widget.example/sdk.js" defer></script>
```

### 6.5 Resource hints для критичных ресурсов

`preconnect` для домена API и шрифтов, `NgOptimizedImage` с `priority` для изображения первого экрана.

### 6.6 `@defer` с `@placeholder` вместо ручного флага загрузки

```html
@defer (on viewport) {
  <app-analytics-chart [data]="data()" />
} @placeholder {
  <div class="chart-skeleton"></div>
} @loading (minimum 200ms) {
  <app-spinner />
}
```

Флаг `isLoading` в компоненте дублирует состояние, которое уже есть у загрузчика чанка.

### 6.7 Клиентский фрагмент помечается явно

Разметка, зависящая от браузера (карты, сторонние виджеты, случайные значения), либо создаётся в `afterNextRender`, либо помечается `ngSkipHydration`, иначе гидрация сообщает о расхождении.

### 6.8 Список свыше ~100 строк виртуализируется

`@angular/cdk/scrolling` (`cdkVirtualFor`) или серверная пагинация. Рендер всех строк в DOM — основная причина долгих задач.

## 7. LOW-MEDIUM: JavaScript в горячем пути

Применяются там, где профиль показал проблему. В холодном коде читаемость важнее.

| Правило | Действие |
| :--- | :--- |
| Поиск по коллекции | `Set`/`Map` вместо `Array.find` в цикле |
| Повторные `find` | Индекс `Map<id, item>` строится один раз |
| Цепочка проходов | Один цикл вместо `filter().map().filter()` |
| Отображение с отбраковкой | `flatMap` вместо `map().filter()` |
| Регулярное выражение | Создаётся на уровне модуля, не в цикле |
| Свойство объекта | Кэшируется в локальную переменную в цикле |
| Дорогая чистая функция | Module-level `Map` как кэш с ограничением размера |
| Чтение `localStorage` | Кэш в памяти, storage читается один раз |
| Запись стилей | Класс или `[class.x]`, а не серия записей `style.*` |
| Минимум и максимум | Один проход, не `sort()` |
| Дорогое сравнение | Проверка `length` до сравнения элементов |
| Некритичная работа | `requestIdleCallback` или `afterNextRender` |
| Иммутабельная сортировка | `toSorted()` вместо `sort()` на общем массиве |

Ранний выход из функции через guard clauses уже задан модулем `dry_kiss_clean` и здесь не дублируется.

## 8. LOW: инициализация

### 8.1 Одноразовая инициализация — `provideAppInitializer()`

```ts
provideAppInitializer(() => inject(ConfigService).load());
```

Инициализация выполняется один раз на загрузку приложения, а не в конструкторе первого компонента.

## Что не переносится

Правила, привязанные к React/Next runtime, в каталог не включены: RSC и Server Actions (`React.cache`, сериализация props, `after()`), `SWR`, `<Activity>`, подавление предупреждений гидрации, `useEffectEvent`, refs для обработчиков, `memo`/`useCallback`/`useMemo` как механика. В Angular их роль выполняют сигналы, `@defer`, `TransferState` и планировщик рендера.
