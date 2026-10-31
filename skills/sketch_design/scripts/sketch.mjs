#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function readZip(file) {
  const buf = fs.readFileSync(file);
  let eocd = -1;
  const min = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= min; i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('ZIP: end of central directory not found');

  const total = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const entries = [];
  let p = cdOffset;
  for (let i = 0; i < total; i += 1) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('ZIP: broken central directory');
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    entries.push({ name, method, compSize, size, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }

  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const read = (name) => {
    const entry = byName.get(name);
    if (!entry) return null;
    if (buf.readUInt32LE(entry.localOffset) !== 0x04034b50) {
      throw new Error(`ZIP: broken local header for ${name}`);
    }
    const nameLen = buf.readUInt16LE(entry.localOffset + 26);
    const extraLen = buf.readUInt16LE(entry.localOffset + 28);
    const start = entry.localOffset + 30 + nameLen + extraLen;
    const raw = buf.subarray(start, start + entry.compSize);
    return entry.method === 0 ? Buffer.from(raw) : zlib.inflateRawSync(raw);
  };

  return { entries, byName, read, names: entries.map((entry) => entry.name) };
}

function writeZip(files) {
  const parts = [];
  const central = [];
  let offset = 0;

  for (const [name, data] of files) {
    const nameBuf = Buffer.from(name, 'utf8');
    const compressed = zlib.deflateRawSync(data, { level: 9 });
    const checksum = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, nameBuf, compressed);

    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0x0800, 8);
    header.writeUInt16LE(8, 10);
    header.writeUInt32LE(checksum, 16);
    header.writeUInt32LE(compressed.length, 20);
    header.writeUInt32LE(data.length, 24);
    header.writeUInt16LE(nameBuf.length, 28);
    header.writeUInt32LE(offset, 42);
    central.push(header, nameBuf);

    offset += local.length + nameBuf.length + compressed.length;
  }

  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.size, 8);
  eocd.writeUInt16LE(files.size, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, centralBuf, eocd]);
}

const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

function slugify(value) {
  return value
    .toLowerCase()
    .split('')
    .map((char) => (TRANSLIT[char] !== undefined ? TRANSLIT[char] : char))
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'page';
}

function hex(color) {
  if (!color) return null;
  const to = (value) => Math.round(Math.max(0, Math.min(1, value ?? 0)) * 255).toString(16).padStart(2, '0');
  const alpha = color.alpha === undefined ? 1 : color.alpha;
  const base = `#${to(color.red)}${to(color.green)}${to(color.blue)}`;
  return alpha < 1 ? `${base} ${Math.round(alpha * 100)}%` : base;
}

function inc(map, key, by = 1) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + by);
}

function top(map, limit) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function layerName(layer) {
  return (layer.name ?? '').replace(/\s+/g, ' ').trim();
}

function collectLayer(layer, stats) {
  stats.classes.set(layer._class, (stats.classes.get(layer._class) ?? 0) + 1);

  const text = layer.attributedString?.string;
  if (typeof text === 'string' && text.trim()) stats.texts.add(text.trim().replace(/\s+\n/g, '\n'));

  const font = layer.style?.textStyle?.encodedAttributes?.MSAttributedStringFontAttribute?.attributes;
  if (font?.name) {
    const size = font.size ? `${Math.round(font.size)}px` : '?';
    inc(stats.fonts, `${font.name} · ${size}`);
  }

  const textColor = layer.style?.textStyle?.encodedAttributes?.MSAttributedStringColorAttribute;
  if (textColor) inc(stats.colors, hex(textColor));

  for (const fill of layer.style?.fills ?? []) {
    if (fill.isEnabled === false) continue;
    if (fill.color) inc(stats.colors, hex(fill.color));
  }
  for (const border of layer.style?.borders ?? []) {
    if (border.isEnabled === false) continue;
    if (border.color) inc(stats.colors, hex(border.color));
  }
  for (const shadow of layer.style?.shadows ?? []) {
    if (shadow.isEnabled === false) continue;
    if (shadow.color) inc(stats.colors, hex(shadow.color));
    if (shadow.blurRadius) {
      inc(stats.shadows, `blur ${Math.round(shadow.blurRadius)} · y ${Math.round(shadow.offsetY ?? 0)} · ${hex(shadow.color)}`);
    }
  }

  if (typeof layer.fixedRadius === 'number' && layer.fixedRadius > 0) {
    inc(stats.radii, `${Math.round(layer.fixedRadius)}px`);
  }

  if (layer._class === 'symbolInstance' && layer.symbolID) inc(stats.symbols, layer.symbolID);
}

function walk(layer, stats, depth = 0, structure = null, maxDepth = 3) {
  collectLayer(layer, stats);
  if (structure && depth < maxDepth) {
    structure.push(`${'  '.repeat(depth)}${layer._class} "${layerName(layer)}"`);
  }
  for (const child of layer.layers ?? []) walk(child, stats, depth + 1, structure, maxDepth);
}

function newStats() {
  return {
    classes: new Map(),
    texts: new Set(),
    symbols: new Map(),
    colors: new Map(),
    fonts: new Map(),
    radii: new Map(),
    shadows: new Map(),
  };
}

function pageIndex(meta) {
  return Object.entries(meta.pagesAndArtboards ?? {}).map(([id, page]) => ({
    id,
    name: page.name,
    artboards: page.artboards ?? {},
  }));
}

function symbolsPageId(pages) {
  const page = pages.find((item) => item.name.toLowerCase() === 'symbols');
  return page?.id ?? null;
}

function buildSymbolMap(zip, pages) {
  const id = symbolsPageId(pages);
  if (!id) return new Map();
  const page = JSON.parse(zip.read(`pages/${id}.json`).toString('utf8'));
  const map = new Map();
  const visit = (layer) => {
    if (layer._class === 'symbolMaster' && layer.symbolID) map.set(layer.symbolID, layerName(layer));
    for (const child of layer.layers ?? []) visit(child);
  };
  for (const layer of page.layers ?? []) visit(layer);
  return map;
}

function artboardStats(artboard, symbolMap) {
  const stats = newStats();
  const structure = [];
  walk(artboard, stats, 0, structure);
  return {
    name: layerName(artboard),
    class: artboard._class,
    width: Math.round(artboard.frame?.width ?? 0),
    height: Math.round(artboard.frame?.height ?? 0),
    classes: Object.fromEntries(top(stats.classes, 12)),
    texts: [...stats.texts].slice(0, 60),
    symbols: top(stats.symbols, 40).map(([id, count]) => ({ name: symbolMap.get(id) ?? id, count })),
    colors: top(stats.colors, 15).map(([value, count]) => ({ value, count })),
    fonts: top(stats.fonts, 10).map(([value, count]) => ({ value, count })),
    radii: top(stats.radii, 10).map(([value, count]) => ({ value, count })),
    shadows: top(stats.shadows, 10).map(([value, count]) => ({ value, count })),
    structure: structure.slice(0, 40),
  };
}

function parsePage(zip, id, symbolMap) {
  const page = JSON.parse(zip.read(`pages/${id}.json`).toString('utf8'));
  const artboards = (page.layers ?? []).map((layer) => artboardStats(layer, symbolMap));
  return { name: page.name, id, artboards };
}

function aggregate(pages) {
  const colors = new Map();
  const fonts = new Map();
  const radii = new Map();
  const shadows = new Map();
  for (const page of pages) {
    for (const artboard of page.artboards) {
      for (const item of artboard.colors) inc(colors, item.value, item.count);
      for (const item of artboard.fonts) inc(fonts, item.value, item.count);
      for (const item of artboard.radii ?? []) inc(radii, item.value, item.count);
      for (const item of artboard.shadows ?? []) inc(shadows, item.value, item.count);
    }
  }
  return {
    colors: top(colors, 60).map(([value, count]) => ({ value, count })),
    fonts: top(fonts, 40).map(([value, count]) => ({ value, count })),
    radii: top(radii, 20).map(([value, count]) => ({ value, count })),
    shadows: top(shadows, 20).map(([value, count]) => ({ value, count })),
  };
}

function groupName(name) {
  const first = name.split(/[/—–]/)[0] ?? name;
  return first.replace(/\s+-\s+.*$/, '').trim() || name;
}

function componentInventory(meta, pages) {
  const symbols = pages.find((page) => page.name.toLowerCase() === 'symbols');
  if (!symbols) return { total: 0, groups: [] };
  const names = Object.values(symbols.artboards).map((item) => item.name);
  const groups = new Map();
  for (const name of names) {
    const group = groupName(name);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(name);
  }
  return {
    total: names.length,
    groups: [...groups.entries()]
      .map(([name, items]) => ({ name, count: items.length, examples: items.slice(0, 8) }))
      .sort((a, b) => b.count - a.count),
  };
}

function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

function screenMarkdown(page) {
  const artboards = page.artboards.filter((item) => item.class === 'artboard').length;
  const others = page.artboards.length - artboards;
  const summary = others ? `Артбордов: ${artboards}, прочих элементов верхнего уровня: ${others}.` : `Артбордов: ${artboards}.`;
  const lines = [`# ${page.name}`, '', summary, ''];

  for (const artboard of page.artboards) {
    lines.push(`## ${artboard.name || artboard.class}`, '');
    lines.push(`Размер: ${artboard.width}×${artboard.height}. Слои: ${Object.entries(artboard.classes).map(([k, v]) => `${k} ${v}`).join(', ')}.`, '');
    if (artboard.structure.length) {
      lines.push('Структура:', '', '```', ...artboard.structure, '```', '');
    }
    if (artboard.texts.length) {
      lines.push('Тексты:', '', ...artboard.texts.map((text) => `- ${text.replace(/\n/g, ' ')}`), '');
    }
    if (artboard.symbols.length) {
      lines.push('Символы:', '', ...artboard.symbols.map((item) => `- ${item.name} ×${item.count}`), '');
    }
    if (artboard.colors.length) {
      lines.push(`Цвета: ${artboard.colors.map((item) => `${item.value} ×${item.count}`).join(', ')}.`, '');
    }
    if (artboard.fonts.length) {
      lines.push(`Шрифты: ${artboard.fonts.map((item) => `${item.value} ×${item.count}`).join(', ')}.`, '');
    }
  }
  return `${lines.join('\n')}\n`;
}

function brandbookMarkdown(tokens, source) {
  const lines = ['# Брендбук: черновик из макета', '', `Источник: \`${source}\`. Значения собраны из слоёв; семантические имена назначить вручную.`, ''];
  lines.push('## Цвета', '', '| Цвет | Использований |', '| :--- | ---: |');
  for (const item of tokens.colors) lines.push(`| \`${item.value}\` | ${item.count} |`);
  lines.push('', '## Типографика', '', '| Шрифт и размер | Использований |', '| :--- | ---: |');
  for (const item of tokens.fonts) lines.push(`| \`${item.value}\` | ${item.count} |`);
  if (tokens.radii.length) {
    lines.push('', '## Радиусы', '', '| Радиус | Использований |', '| :--- | ---: |');
    for (const item of tokens.radii) lines.push(`| \`${item.value}\` | ${item.count} |`);
  }
  if (tokens.shadows.length) {
    lines.push('', '## Тени', '', '| Тень | Использований |', '| :--- | ---: |');
    for (const item of tokens.shadows) lines.push(`| \`${item.value}\` | ${item.count} |`);
  }
  return `${lines.join('\n')}\n`;
}

function componentsMarkdown(inventory) {
  const lines = ['# Компоненты (страница Symbols)', '', `Всего символов: ${inventory.total}.`, '', '| Группа | Символов | Примеры |', '| :--- | ---: | :--- |'];
  for (const group of inventory.groups) {
    const examples = group.examples.map((name) => name.replace(/\|/g, '\\|')).join('<br>');
    lines.push(`| ${group.name.replace(/\|/g, '\\|')} | ${group.count} | ${examples} |`);
  }
  return `${lines.join('\n')}\n`;
}

function screenIndexMarkdown(pages) {
  const lines = ['# Экраны', '', '| Страница | Артбордов | Файл |', '| :--- | ---: | :--- |'];
  for (const page of pages) {
    const count = page.artboards.filter((item) => item.class === 'artboard').length;
    lines.push(`| ${page.name} | ${count} | \`screens/${slugify(page.name)}.md\` |`);
  }
  return `${lines.join('\n')}\n`;
}

function commandInfo(file) {
  const zip = readZip(file);
  const meta = JSON.parse(zip.read('meta.json').toString('utf8'));
  const pages = pageIndex(meta);
  let total = 0;
  console.log(`file: ${file}`);
  console.log(`sketch: ${meta.app} version ${meta.version} build ${meta.build}`);
  for (const page of pages) {
    const count = Object.keys(page.artboards).length;
    total += count;
    console.log(`page ${page.id.slice(0, 8)} | ${page.name} | artboards ${count}`);
  }
  console.log(`pages: ${pages.length} | artboards: ${total}`);
}

function commandParse(file, outDir, pageNames) {
  const zip = readZip(file);
  const meta = JSON.parse(zip.read('meta.json').toString('utf8'));
  const pages = pageIndex(meta);
  const symbolMap = buildSymbolMap(zip, pages);
  const targets = pages.filter((page) => {
    if (page.name.toLowerCase() === 'symbols') return false;
    return !pageNames || pageNames.includes(page.name);
  });

  const parsed = [];
  for (const page of targets) {
    const result = parsePage(zip, page.id, symbolMap);
    parsed.push(result);
    writeFile(path.join(outDir, 'screens', `${slugify(result.name)}.md`), screenMarkdown(result));
    const count = result.artboards.filter((item) => item.class === 'artboard').length;
    console.log(`parsed ${result.name}: ${count} artboards`);
  }

  const tokens = aggregate(parsed);
  const inventory = componentInventory(meta, pages);
  writeFile(path.join(outDir, 'brandbook.md'), brandbookMarkdown(tokens, path.basename(file)));
  writeFile(path.join(outDir, 'components.md'), componentsMarkdown(inventory));
  writeFile(path.join(outDir, 'screens', 'index.md'), screenIndexMarkdown(parsed));
  writeFile(
    path.join(outDir, 'design.json'),
    `${JSON.stringify({ source: path.basename(file), sketch: { version: meta.version, build: meta.build }, pages: parsed, tokens, components: inventory }, null, 2)}\n`,
  );
  console.log(`written: ${outDir}`);
}

function commandSplit(file, outDir, pageNames) {
  const zip = readZip(file);
  const doc = JSON.parse(zip.read('document.json').toString('utf8'));
  const meta = JSON.parse(zip.read('meta.json').toString('utf8'));
  const user = zip.read('user.json');
  const pages = pageIndex(meta);
  const symbols = pages.find((page) => page.name.toLowerCase() === 'symbols');
  const targets = pages.filter((page) => {
    if (page.name.toLowerCase() === 'symbols') return false;
    return !pageNames || pageNames.includes(page.name);
  });

  fs.mkdirSync(outDir, { recursive: true });

  const build = (selected, currentIndex) => {
    const ids = new Set(selected.map((page) => page.id));
    const nextDoc = {
      ...doc,
      pages: (doc.pages ?? []).filter((ref) => ids.has(ref._ref.split('/').pop())),
      currentPageIndex: currentIndex,
    };
    const nextMeta = {
      ...meta,
      pagesAndArtboards: Object.fromEntries(Object.entries(meta.pagesAndArtboards ?? {}).filter(([id]) => ids.has(id))),
    };
    const nextUser = user
      ? JSON.stringify(Object.fromEntries(Object.entries(JSON.parse(user.toString('utf8'))).filter(([key]) => key === 'document' || ids.has(key))))
      : null;

    const text = selected.map((page) => zip.read(`pages/${page.id}.json`).toString('utf8')).join('\n');
    const images = new Set([...text.matchAll(/images\\?\/([0-9a-f]{40}\.[a-z0-9]+)/g)].map((match) => match[1]));

    const files = new Map();
    files.set('document.json', Buffer.from(JSON.stringify(nextDoc)));
    files.set('meta.json', Buffer.from(JSON.stringify(nextMeta)));
    if (nextUser) files.set('user.json', Buffer.from(nextUser));
    for (const page of selected) files.set(`pages/${page.id}.json`, zip.read(`pages/${page.id}.json`));
    for (const name of zip.names) {
      if (name.startsWith('images/') && images.has(name.slice('images/'.length))) files.set(name, zip.read(name));
      if (name.startsWith('fonts/')) files.set(name, zip.read(name));
    }
    return writeZip(files);
  };

  if (symbols) {
    const symbolsFile = path.join(outDir, 'symbols.sketch');
    fs.writeFileSync(symbolsFile, build([symbols], 0));
    console.log(`split symbols.sketch: ${symbolsFile}`);
  }

  for (const page of targets) {
    const selected = symbols ? [symbols, page] : [page];
    const target = path.join(outDir, `${slugify(page.name)}.sketch`);
    fs.writeFileSync(target, build(selected, symbols ? 1 : 0));
    console.log(`split ${page.name}: ${target}`);
  }
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item.startsWith('--')) {
      const [key, inline] = item.slice(2).split('=');
      if (inline !== undefined) args[key] = inline;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) args[key] = argv[++i];
      else args[key] = true;
    } else {
      args._.push(item);
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const [command, file] = args._;

if (!command || !file) {
  console.error('usage: sketch.mjs <info|parse|split> <file.sketch> [--out dir] [--pages "A,B"]');
  process.exit(1);
}

const out = args.out ?? path.join(process.cwd(), 'sketch-out');
const pageNames = typeof args.pages === 'string' ? args.pages.split(',').map((name) => name.trim()).filter(Boolean) : null;

if (command === 'info') commandInfo(file);
else if (command === 'parse') commandParse(file, out, pageNames);
else if (command === 'split') commandSplit(file, out, pageNames);
else {
  console.error(`unknown command: ${command}`);
  process.exit(1);
}
