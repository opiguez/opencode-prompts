# Формат вывода парсера

Все команды принимают `.sketch` и пишут в `--out`. Путь по умолчанию — `./sketch-out`.

## info

```text
file: path/to/file.sketch
sketch: com.bohemiancoding.sketch3 version 146 build 178462
page AB76EA7A | Symbols | artboards 1429
page CD8D0053 | ИТ-Проба: Редактор виджетов | artboards 12
pages: 8 | artboards: 1646
```

## parse

```text
<out>/
├── screens/
│   ├── index.md
│   └── <page-slug>.md
├── brandbook.md
├── components.md
└── design.json
```

### screens/&lt;page&gt;.md

Заголовок страницы, число артбордов, затем по каждому артборду:

- размер и распределение слоёв по классам;
- структура первых трёх уровней;
- уникальные тексты (до 60);
- использованные символы с частотой;
- цвета и шрифты с частотой.

### brandbook.md

Сырые токены с частотой: цвета, шрифты и размеры, радиусы, тени. Семантические имена не выводятся.

### components.md

Символы страницы Symbols, сгруппированные по первому сегменту имени (`/` или тире). Для каждой группы — число и примеры.

### design.json

```json
{
  "source": "file.sketch",
  "sketch": { "version": 146, "build": 178462 },
  "pages": [{ "name": "…", "id": "…", "artboards": [{ "name": "…", "width": 1920, "height": 1000, "classes": {}, "texts": [], "symbols": [], "colors": [], "fonts": [], "radii": [], "shadows": [], "structure": [] }] }],
  "tokens": { "colors": [], "fonts": [], "radii": [], "shadows": [] },
  "components": { "total": 0, "groups": [] }
}
```

## split

```text
<out>/
├── symbols.sketch
├── <page-slug>.sketch
└── …
```

Каждый файл содержит страницу `Symbols` и одну страницу макета; `currentPageIndex` указывает на страницу макета. Внутри остаются только изображения и шрифты, на которые ссылаются выбранные страницы.

## Ограничения

- Парсер не рендерит макет: превью и скриншоты не создаются.
- Расстояния и сетки не вычисляются: они видны в структуре слоёв, но не сводятся в spacing-шкалу.
- Градиенты и маски читаются как слои, но не преобразуются в CSS.
