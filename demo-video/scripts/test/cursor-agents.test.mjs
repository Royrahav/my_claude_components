// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
// Cursor setup: the agent frontmatter transform, installCursorAgents writing into a temp folder, the host
// choice and the skill-discovery line. Nothing here touches the real ~/.cursor or ~/.claude.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cursorAgentText, cursorHome, cursorSkillDiscovery, hostsFor, installCursorAgents } from "../lib/agents.mjs";

let root;
let src;
let dest;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dv-cursor-"));
  src = join(root, "src");
  dest = join(root, "cursor", "agents");
  mkdirSync(src);
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const agentFile = (name, extra = "") => `---\nname: ${name}\ndescription: "Does ${name}."\nmodel: sonnet\neffort: high\n${extra}---\n\nBody of ${name}.\n`;
const put = (dir, file, text) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, file), text);
};
const read = (file) => readFileSync(join(dest, file), "utf8");

// cursorHome -------------------------------------------------------------------------------------------

test("cursorHome_withoutOverride_isDotCursorInTheHomeFolder", () => {
  assert.equal(cursorHome({}), join(homedir(), ".cursor"));
});

test("cursorHome_overrideVariable_replacesIt", () => {
  assert.equal(cursorHome({ DEMO_VIDEO_CURSOR_HOME: "/tmp/fake-cursor" }), "/tmp/fake-cursor");
});

// cursorAgentText --------------------------------------------------------------------------------------

test("cursorAgentText_unknownRole_hasNoHostFlag", () => {
  assert.equal(cursorAgentText(agentFile("demo-other"), { name: "demo-other" }), `---\nname: demo-other\ndescription: "Does demo-other."\nmodel: inherit\n---\n\nBody of demo-other.\n`);
});

test("cursorAgentText_otherFrontmatterKeys_areDropped", () => {
  const text = cursorAgentText(agentFile("demo-checker", "tools: Read, Grep\n"), { name: "demo-checker" });

  assert.doesNotMatch(text, /effort|tools|model: sonnet/);
});

test("cursorAgentText_crlfSource_keepsTheBodyAndWritesLfFrontmatter", () => {
  const text = cursorAgentText(agentFile("demo-checker").replace(/\n/g, "\r\n"), { name: "demo-checker" });

  assert.deepEqual([text.startsWith("---\nname: demo-checker\ndescription:"), text.includes("Body of demo-checker.")], [true, true]);
});

test("cursorAgentText_frontmatterOnlyFile_endsAfterTheClosingFence", () => {
  const text = cursorAgentText("---\nname: demo-checker\ndescription: x\n---", { name: "demo-checker" });

  assert.equal(text, "---\nname: demo-checker\ndescription: x\nmodel: inherit\nreadonly: true\n---");
});

test("cursorAgentText_noFrontmatter_throwsNamingTheAgent", () => {
  assert.throws(() => cursorAgentText("Just a body.", { name: "demo-checker" }), /demo-checker: the agent file has no frontmatter/);
});

test("cursorAgentText_bodyContainingAFenceLine_isKeptWhole", () => {
  const text = cursorAgentText(`${agentFile("demo-checker")}\n---\n\nMore.\n`, { name: "demo-checker" });

  assert.ok(text.endsWith("Body of demo-checker.\n\n---\n\nMore.\n"));
});

// installCursorAgents ----------------------------------------------------------------------------------

test("installCursorAgents_demoAgents_areWrittenWithCursorFrontmatter", () => {
  put(src, "demo-checker.md", agentFile("demo-checker"));
  put(src, "demo-researcher.md", agentFile("demo-researcher"));

  installCursorAgents(src, dest);

  assert.deepEqual(
    [read("demo-checker.md"), read("demo-researcher.md")],
    [
      `---\nname: demo-checker\ndescription: "Does demo-checker."\nmodel: inherit\nreadonly: true\n---\n\nBody of demo-checker.\n`,
      `---\nname: demo-researcher\ndescription: "Does demo-researcher."\nmodel: inherit\nis_background: true\n---\n\nBody of demo-researcher.\n`,
    ],
  );
});

test("installCursorAgents_missingDestination_isCreatedAndReported", () => {
  put(src, "demo-checker.md", agentFile("demo-checker"));

  const result = installCursorAgents(src, dest);

  assert.deepEqual([result.created, existsSync(dest)], [true, true]);
});

test("installCursorAgents_existingDestination_isReportedNotCreated", () => {
  put(src, "demo-checker.md", agentFile("demo-checker"));
  mkdirSync(dest, { recursive: true });

  assert.equal(installCursorAgents(src, dest).created, false);
});

test("installCursorAgents_listsInstalledInWorkflowOrder", () => {
  put(src, "demo-checker.md", agentFile("demo-checker"));
  put(src, "demo-zeta.md", agentFile("demo-zeta"));
  put(src, "demo-researcher.md", agentFile("demo-researcher"));

  assert.deepEqual(installCursorAgents(src, dest).installed, ["demo-researcher", "demo-checker", "demo-zeta"]);
});

test("installCursorAgents_modelOption_isWrittenIntoEveryAgent", () => {
  put(src, "demo-checker.md", agentFile("demo-checker"));
  put(src, "demo-researcher.md", agentFile("demo-researcher"));

  installCursorAgents(src, dest, { model: "claude-4-sonnet" });

  assert.deepEqual([read("demo-checker.md").includes("model: claude-4-sonnet\n"), read("demo-researcher.md").includes("model: claude-4-sonnet\n")], [true, true]);
});

test("installCursorAgents_filesThatAreNotDemoAgents_areNeitherReadNorWritten", () => {
  put(src, "demo-checker.md", agentFile("demo-checker"));
  put(src, "notes.md", "no frontmatter at all");
  put(src, "other-agent.md", agentFile("other-agent"));

  const result = installCursorAgents(src, dest);

  assert.deepEqual([result.installed, readdirSync(dest)], [["demo-checker"], ["demo-checker.md"]]);
});

test("installCursorAgents_otherFilesInTheDestination_areLeftAlone", () => {
  put(src, "demo-checker.md", agentFile("demo-checker"));
  put(dest, "my-agent.md", "mine");
  put(dest, "demo-writer.md", "retired but not ours to remove here");

  installCursorAgents(src, dest);

  assert.deepEqual([read("my-agent.md"), read("demo-writer.md")], ["mine", "retired but not ours to remove here"]);
});

test("installCursorAgents_existingDemoAgentInDestination_isOverwritten", () => {
  put(src, "demo-checker.md", agentFile("demo-checker"));
  put(dest, "demo-checker.md", "old");

  installCursorAgents(src, dest);

  assert.match(read("demo-checker.md"), /^---\nname: demo-checker/);
});

test("installCursorAgents_noDemoAgentsInSource_installsNothing", () => {
  const result = installCursorAgents(src, dest);

  assert.deepEqual([result.installed, readdirSync(dest)], [[], []]);
});

test("installCursorAgents_agentWithoutFrontmatter_throwsAndWritesNothingForIt", () => {
  put(src, "demo-checker.md", "no frontmatter");

  assert.throws(() => installCursorAgents(src, dest), /demo-checker: the agent file has no frontmatter/);
  assert.equal(existsSync(join(dest, "demo-checker.md")), false);
});

test("installCursorAgents_shippedAgents_getCursorFrontmatterWithoutEffort", () => {
  const shipped = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "agents");

  const result = installCursorAgents(shipped, dest);

  assert.ok(result.installed.length >= 2);
  for (const name of result.installed) {
    const frontmatter = read(`${name}.md`).split("\n---")[0];
    assert.match(frontmatter, new RegExp(`^---\\nname: ${name}\\n`));
    assert.doesNotMatch(frontmatter, /effort:/);
    assert.match(frontmatter, /\nmodel: inherit(\n|$)/);
  }
});

// hostsFor ---------------------------------------------------------------------------------------------

test("hostsFor_bothOverride_installsForBothEvenWithoutACursorFolder", () => {
  assert.deepEqual(hostsFor("both", { cursorExists: false }), { claude: true, cursor: true });
});

test("hostsFor_cursorOverrideWithACursorFolder_skipsClaude", () => {
  assert.deepEqual(hostsFor("cursor", { cursorExists: true }), { claude: false, cursor: true });
});

test("hostsFor_emptyStringHost_isRejectedRatherThanTreatedAsUnset", () => {
  assert.throws(() => hostsFor("", { cursorExists: true }), /--host must be one of claude, cursor, both, got ""/);
});

test("hostsFor_unknownHost_namesTheValueAndTheChoices", () => {
  assert.throws(() => hostsFor("Cursor", { cursorExists: false }), /--host must be one of claude, cursor, both, got "Cursor"/);
});

// cursorSkillDiscovery ---------------------------------------------------------------------------------

const skillAt = (...parts) => put(join(root, ...parts), "SKILL.md", "# skill");

test("cursorSkillDiscovery_skillUnderClaudeSkills_isFoundThere", () => {
  skillAt("home", ".claude", "skills", "demo-video");

  const line = cursorSkillDiscovery({ home: join(root, "home") });

  assert.equal(line, `cursor skill: found at ${join(root, "home", ".claude", "skills", "demo-video")}`);
});

test("cursorSkillDiscovery_skillUnderCursorSkills_isFoundThere", () => {
  skillAt("cursor", "skills", "demo-video");

  const line = cursorSkillDiscovery({ home: join(root, "home"), cursorDir: join(root, "cursor") });

  assert.equal(line, `cursor skill: found at ${join(root, "cursor", "skills", "demo-video")}`);
});

test("cursorSkillDiscovery_foundInBothPlaces_prefersTheClaudeCompatFolder", () => {
  skillAt("home", ".claude", "skills", "demo-video");
  skillAt("home", ".cursor", "skills", "demo-video");

  assert.match(cursorSkillDiscovery({ home: join(root, "home") }), /\.claude/);
});

test("cursorSkillDiscovery_notFound_givesTheLinkHintWithTheCursorPath", () => {
  const line = cursorSkillDiscovery({ home: join(root, "home"), cursorDir: join(root, "cursor") });

  assert.equal(line, `cursor skill: not found; link or copy this skill folder to ${join(root, "cursor", "skills", "demo-video")}`);
});

test("cursorSkillDiscovery_folderWithoutSkillMd_countsAsNotFound", () => {
  mkdirSync(join(root, "home", ".claude", "skills", "demo-video"), { recursive: true });

  assert.match(cursorSkillDiscovery({ home: join(root, "home") }), /^cursor skill: not found/);
});
