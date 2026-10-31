---
name: Sketch Design Parser
description: Локальный разбор .sketch без Sketch и Figma — страницы, артборды, тексты, символы, токены и инвентарь компонентов; нарезка на файлы для импорта в Figma. Загружай при работе с макетами .sketch, переносе дизайна в код и подготовке дизайн-спек.
---

<skill_module id="sketch_design" version="1.0" category="design" enforcement="STRICT">
  <meta>
    <name>Sketch Design Parser</name>
    <purpose>
      Достаёт из `.sketch` то, что нужно агенту: структуру страниц и артбордов, тексты, использованные символы,
      палитру, типографику и инвентарь компонентов. Работает на Windows и в Linux: файл — это ZIP с JSON,
      Sketch и macOS не нужны.
      Режет макет на файлы `Symbols + страница` для импорта в Figma в обход лимитов и падений на больших файлах.
    </purpose>
  </meta>

  <preconditions enforcement="STRICT">
    <rule id="NO_APP_REQUIRED">
      Не требуй установленного Sketch и не предлагай открыть файл на Mac. Читай ZIP напрямую.
    </rule>
    <rule id="SOURCE_NOT_IN_GIT">
      Исходный `.sketch` в репозиторий не кладётся: это десятки мегабайт. В git попадают только производные спеки.
    </rule>
    <rule id="GENERATED_IS_READ_ONLY">
      Файлы в `_generated/` не редактируются руками: их перезаписывает парсер. Правки — в ручных документах рядом.
    </rule>
  </preconditions>

  <commands>
    <command id="INFO">
      `node scripts/sketch.mjs info <file.sketch>` — версия Sketch, страницы, число артбордов.
    </command>
    <command id="PARSE">
      `node scripts/sketch.mjs parse <file.sketch> --out <dir> [--pages "A,B"]` — спеки страниц, брендбук, инвентарь компонентов, `design.json`.
    </command>
    <command id="SPLIT">
      `node scripts/sketch.mjs split <file.sketch> --out <dir> [--pages "A,B"]` — файлы `Symbols + страница` для Figma.
    </command>
  </commands>

  <outputs>
    <item>`screens/<page>.md` — артборды с размерами, структура, тексты, символы, цвета и шрифты.</item>
    <item>`brandbook.md` — цвета, типографика, радиусы и тени с частотой использования.</item>
    <item>`components.md` — символы, сгруппированные по префиксу имени.</item>
    <item>`design.json` — те же данные машинно-читаемо.</item>
    <item>`<page>.sketch` — нарезанные файлы: страница Symbols плюс одна страница макета.</item>
  </outputs>

  <rules>
    <rule id="SEMANTIC_NAMES">
      Парсер даёт сырые значения. Семантические имена токенов (`surface`, `text-muted`, `accent`) назначаются вручную
      в брендбуке: по макету видна частота, но не назначение.
    </rule>
    <rule id="FIGMA_STYLES">
      Figma не переносит стили Sketch при импорте. Источник токенов — `brandbook.md`, а не импортированный файл.
    </rule>
    <rule id="SYMBOLS_WITH_PAGE">
      Нарезанный файл всегда содержит страницу Symbols: без неё инстансы символов теряют мастер-компоненты.
    </rule>
    <rule id="PAGE_LIMIT">
      Держи в файле не больше трёх страниц: это лимит бесплатного Figma. Схема `Symbols + страница` даёт две.
    </rule>
    <rule id="NO_HEAVY_PAGES">
      Страницы-справочники на сотни артбордов режь отдельным файлом и импортируй только при необходимости.
    </rule>
  </rules>

  <references>
    Формат вывода, поля и примеры — `references/spec-format.md`.
    Работа с макетом в планировщике — `../ui_design/SKILL.md`.
  </references>
</skill_module>
