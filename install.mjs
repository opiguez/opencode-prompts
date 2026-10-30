import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const configHome = process.env.XDG_CONFIG_HOME
  ? path.join(process.env.XDG_CONFIG_HOME, 'opencode')
  : path.join(os.homedir(), '.config', 'opencode');

const targetPrompts = path.join(configHome, 'prompts');
const targetSkills = path.join(configHome, 'skills');
const targetCommands = path.join(configHome, 'commands');

fs.mkdirSync(configHome, { recursive: true });
fs.cpSync(path.join(rootDir, 'prompts'), targetPrompts, {
  recursive: true,
  force: true,
});
fs.cpSync(path.join(rootDir, 'skills'), targetSkills, {
  recursive: true,
  force: true,
});
fs.cpSync(path.join(rootDir, 'commands'), targetCommands, {
  recursive: true,
  force: true,
});

const jsoncPath = path.join(configHome, 'opencode.jsonc');
const jsonPath = path.join(configHome, 'opencode.json');
const configFile = fs.existsSync(jsoncPath)
  ? jsoncPath
  : fs.existsSync(jsonPath)
    ? jsonPath
    : jsoncPath;

let currentConfig = { $schema: 'https://opencode.ai/config.json' };
if (fs.existsSync(configFile)) {
  const raw = fs.readFileSync(configFile, 'utf8');
  const stripped = raw
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/,(\s*[}\]])/g, '$1');
  currentConfig = JSON.parse(stripped);
}

const hygieneInstruction = '~/.config/opencode/skills/context_hygiene.xml';
const existingInstructions = Array.isArray(currentConfig.instructions)
  ? currentConfig.instructions.filter(
      (item) => !String(item).endsWith('skills/context_hygiene.xml'),
    )
  : [];

currentConfig.instructions = [...existingInstructions, hygieneInstruction];
delete currentConfig.skills;

currentConfig.agents = {
  ...(currentConfig.agents ?? {}),
  plan: {
    ...(currentConfig.agents?.plan ?? {}),
    hidden: false,
    system:
      '{file:~/.config/opencode/prompts/plan_core.xml}\n{file:~/.config/opencode/skills/context_hygiene.xml}',
  },
  build: {
    ...(currentConfig.agents?.build ?? {}),
    hidden: false,
    system:
      '{file:~/.config/opencode/prompts/build_core.xml}\n{file:~/.config/opencode/skills/context_hygiene.xml}\n{file:~/.config/opencode/skills/solid_compliance.xml}\n{file:~/.config/opencode/skills/dry_kiss_clean.xml}',
  },
  reviewer: {
    ...(currentConfig.agents?.reviewer ?? {}),
    hidden: false,
    mode: 'subagent',
    description:
      'Independent Senior Code Reviewer for before/after refactors: logic parity, SRP, coupling, DRY, complexity. Read-only.',
    system:
      '{file:~/.config/opencode/prompts/review_core.xml}\n{file:~/.config/opencode/skills/context_hygiene.xml}',
    permissions: [
      { action: 'edit', resource: '*', effect: 'deny' },
    ],
  },
  refactorer: {
    ...(currentConfig.agents?.refactorer ?? {}),
    hidden: false,
    mode: 'all',
    description:
      'Refactors fat files into cohesive modules by measured metrics: SRP boundaries, DIP seams, DRY, guard clauses. Preserves behavior.',
    system:
      '{file:~/.config/opencode/prompts/refactor_core.xml}\n{file:~/.config/opencode/skills/context_hygiene.xml}\n{file:~/.config/opencode/skills/solid_compliance.xml}\n{file:~/.config/opencode/skills/dry_kiss_clean.xml}',
  },
  'perf-auditor': {
    ...(currentConfig.agents?.['perf-auditor'] ?? {}),
    hidden: false,
    mode: 'subagent',
    description:
      'Runtime performance audit: re-renders, unstable references, async races, data structures, leaks. Read-only, evidence-based.',
    system:
      '{file:~/.config/opencode/prompts/audit_common.xml}\n{file:~/.config/opencode/prompts/perf_core.xml}\n{file:~/.config/opencode/skills/context_hygiene.xml}',
    permissions: [
      { action: 'edit', resource: '*', effect: 'deny' },
    ],
  },
  'bundle-auditor': {
    ...(currentConfig.agents?.['bundle-auditor'] ?? {}),
    hidden: false,
    mode: 'subagent',
    description:
      'Bundle audit: tree shaking, code splitting, dependency weight, CSS and assets. Read-only, report-driven.',
    system:
      '{file:~/.config/opencode/prompts/audit_common.xml}\n{file:~/.config/opencode/prompts/bundle_core.xml}\n{file:~/.config/opencode/skills/context_hygiene.xml}',
    permissions: [
      { action: 'edit', resource: '*', effect: 'deny' },
    ],
  },
};

fs.writeFileSync(
  configFile,
  `${JSON.stringify(currentConfig, null, 2)}\n`,
  'utf8',
);

console.log(`Installed prompts and skills into: ${configHome}`);
console.log(`Updated global config: ${configFile}`);
