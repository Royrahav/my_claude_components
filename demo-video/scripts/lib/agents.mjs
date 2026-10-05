// Role agents: the skill ships agents/demo-*.md, and `setup` copies them into the user's Claude agents folder.
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const USER_AGENTS_DIR = join(homedir(), ".claude", "agents");

const AGENT_FILE = /^demo-.+\.md$/;
const WORKFLOW_ORDER = ["demo-researcher", "demo-checker"];
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
