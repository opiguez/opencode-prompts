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

fs.mkdirSync(configHome, { recursive: true });
fs.cpSync(path.join(rootDir, 'prompts'), targetPrompts, {
  recursive: true,
  force: true,
});
fs.cpSync(path.join(rootDir, 'skills'), targetSkills, {
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
};

fs.writeFileSync(
  configFile,
  `${JSON.stringify(currentConfig, null, 2)}\n`,
  'utf8',
);

console.log(`Installed prompts and skills into: ${configHome}`);
console.log(`Updated global config: ${configFile}`);
