// Role agents: the skill ships agents/demo-*.md, and `setup` copies them into the user's Claude agents folder.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const USER_AGENTS_DIR = join(homedir(), ".claude", "agents");

const AGENT_FILE = /^demo-.+\.md$/;
const WORKFLOW_ORDER = ["demo-researcher", "demo-duck", "demo-checker"];
// Role agents earlier versions shipped.
const RETIRED_AGENTS = ["demo-writer", "demo-producer", "demo-qa"];

const workflowRank = (name) => {
  const rank = WORKFLOW_ORDER.indexOf(name);
  return rank < 0 ? WORKFLOW_ORDER.length : rank;
};

const agentNames = (dir) =>
  readdirSync(dir)
    .filter((file) => AGENT_FILE.test(file))
    .map((file) => file.slice(0, -".md".length));

const agentPath = (dir, name) => join(dir, `${name}.md`);

// Copies srcDir's demo-*.md into destDir (created if missing) and deletes the RETIRED_AGENTS found there;
// no other file is ever touched. Returns installed (workflow order), removed (sorted), created.
export function installAgents(srcDir, destDir) {
  const installed = agentNames(srcDir).sort((a, b) => workflowRank(a) - workflowRank(b) || a.localeCompare(b));
  const created = !existsSync(destDir);
  mkdirSync(destDir, { recursive: true });
  for (const name of installed) copyFileSync(agentPath(srcDir, name), agentPath(destDir, name));
  const removed = RETIRED_AGENTS.filter((name) => existsSync(agentPath(destDir, name))).sort();
  for (const name of removed) rmSync(agentPath(destDir, name));
  return { installed, removed, created };
}

// Cursor ------------------------------------------------------------------------------------------------
// Cursor reads subagents from ~/.cursor/agents. Its frontmatter has name, description, model (inherit or a
// Cursor model id), readonly and is_background, and no effort.

const CURSOR_MODEL_DEFAULT = "inherit";
const CURSOR_FLAGS = { "demo-checker": "readonly: true", "demo-duck": "readonly: true", "demo-researcher": "is_background: true" };
const HOSTS = ["claude", "cursor", "both"];
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n[\s\S]*)?$/;

// Where Cursor keeps its folders; DEMO_VIDEO_CURSOR_HOME replaces ~/.cursor (tests, odd installs).
export const cursorHome = (env = process.env) => env.DEMO_VIDEO_CURSOR_HOME ?? join(homedir(), ".cursor");

// The agent file rewritten for Cursor: its name and description, the model, the host flag for its role,
// and the body as it was. A file without frontmatter is a mistake, so it throws.
export function cursorAgentText(markdown, { name, model = CURSOR_MODEL_DEFAULT }) {
  const parts = markdown.match(FRONTMATTER);
  if (!parts) throw new Error(`${name}: the agent file has no frontmatter`);
  const kept = parts[1].split(/\r?\n/).filter((line) => /^(name|description):/.test(line));
  return `---\n${[...kept, `model: ${model}`, ...(CURSOR_FLAGS[name] ? [CURSOR_FLAGS[name]] : [])].join("\n")}\n---${parts[2] ?? ""}`;
}

// Writes Cursor copies of srcDir's demo-*.md into destDir (created if missing). Returns installed, created.
export function installCursorAgents(srcDir, destDir, { model = CURSOR_MODEL_DEFAULT } = {}) {
  const installed = agentNames(srcDir).sort((a, b) => workflowRank(a) - workflowRank(b) || a.localeCompare(b));
  const created = !existsSync(destDir);
  mkdirSync(destDir, { recursive: true });
  for (const name of installed) writeFileSync(agentPath(destDir, name), cursorAgentText(readFileSync(agentPath(srcDir, name), "utf8"), { name, model }));
  return { installed, created };
}

// Which hosts `setup` installs helpers for: --host claude|cursor|both, else Claude Code plus Cursor when
// its folder exists.
export function hostsFor(hostFlag, { cursorExists }) {
  if (hostFlag !== undefined && !HOSTS.includes(hostFlag)) throw new Error(`--host must be one of ${HOSTS.join(", ")}, got ${JSON.stringify(hostFlag)}`);
  const host = hostFlag ?? (cursorExists ? "both" : "claude");
  return { claude: host !== "cursor", cursor: host !== "claude" };
}

// How Cursor finds this skill: through ~/.claude/skills (its compat read) or ~/.cursor/skills, else a hint.
export function cursorSkillDiscovery({ home = homedir(), cursorDir = join(home, ".cursor") } = {}) {
  const places = [join(home, ".claude", "skills", "demo-video"), join(cursorDir, "skills", "demo-video")];
  const found = places.find((dir) => existsSync(join(dir, "SKILL.md")));
  return found ? `cursor skill: found at ${found}` : `cursor skill: not found; link or copy this skill folder to ${places[1]}`;
}
