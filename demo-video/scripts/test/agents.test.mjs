// Run: node --test "scripts/test/*.test.mjs"   (from the demo-video skill root)
// installAgents copies the skill's demo-*.md role agents into the user's agents folder and removes only the
// retired ones; the shipped agents and docs are checked against the contract SKILL.md relies on.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { installAgents } from "../lib/agents.mjs";

let root;
let src;
let dest;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "dv-agents-"));
  src = join(root, "src");
  dest = join(root, "home", "agents");
  mkdirSync(src);
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const put = (dir, file, text = file) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, file), text);
};
const read = (dir, file) => readFileSync(join(dir, file), "utf8");

// installAgents ------------------------------------------------------------------------------------

const RETIRED_AGENT_FILES = ["demo-writer.md", "demo-producer.md", "demo-qa.md"];

test("installAgents_missingDestination_createsItAndReportsCreated", () => {
  put(src, "demo-checker.md");

  const result = installAgents(src, dest);

  assert.deepEqual([result.created, existsSync(join(dest, "demo-checker.md"))], [true, true]);
});

test("installAgents_existingDestination_reportsNotCreated", () => {
  put(src, "demo-checker.md");
  mkdirSync(dest, { recursive: true });

  assert.equal(installAgents(src, dest).created, false);
});

test("installAgents_demoAgents_areCopiedWithTheirContent", () => {
  put(src, "demo-researcher.md", "researcher body");
  put(src, "demo-checker.md", "checker body");

  installAgents(src, dest);

  assert.deepEqual([read(dest, "demo-researcher.md"), read(dest, "demo-checker.md")], ["researcher body", "checker body"]);
});

test("installAgents_existingDemoAgentInDestination_isOverwritten", () => {
  put(src, "demo-checker.md", "new");
  put(dest, "demo-checker.md", "old");

  installAgents(src, dest);

  assert.equal(read(dest, "demo-checker.md"), "new");
});

test("installAgents_nonDemoFilesInDestination_areLeftUntouched", () => {
  put(src, "demo-checker.md");
  put(dest, "code-reviewer.md", "mine");
  put(dest, "demo-notes.txt", "not an agent file");

  installAgents(src, dest);

  assert.deepEqual([read(dest, "code-reviewer.md"), read(dest, "demo-notes.txt")], ["mine", "not an agent file"]);
});

test("installAgents_retiredAgentsInDestination_areRemoved", () => {
  put(src, "demo-researcher.md");
  put(src, "demo-checker.md");
  for (const retired of RETIRED_AGENT_FILES) put(dest, retired);

  installAgents(src, dest);

  assert.deepEqual(readdirSync(dest).sort(), ["demo-checker.md", "demo-researcher.md"]);
});

test("installAgents_removedAgents_areReportedSortedByName", () => {
  put(src, "demo-checker.md");
  for (const retired of RETIRED_AGENT_FILES) put(dest, retired);

  assert.deepEqual(installAgents(src, dest).removed, ["demo-producer", "demo-qa", "demo-writer"]);
});

test("installAgents_retiredAgentsMissingFromDestination_areSkippedWithoutError", () => {
  put(src, "demo-checker.md");
  put(dest, "demo-qa.md");

  assert.deepEqual(installAgents(src, dest).removed, ["demo-qa"]);
});

test("installAgents_usersOwnDemoAgent_isKeptAndNotReportedAsRemoved", () => {
  put(src, "demo-checker.md");
  put(dest, "demo-custom.md", "mine");

  const result = installAgents(src, dest);

  assert.deepEqual([read(dest, "demo-custom.md"), result.removed], ["mine", []]);
});

test("installAgents_shippedAgentAlreadyInDestination_isNotReportedAsRemoved", () => {
  put(src, "demo-checker.md", "new");
  put(dest, "demo-checker.md", "old");

  assert.deepEqual(installAgents(src, dest).removed, []);
});

test("installAgents_newDestination_removesNothing", () => {
  put(src, "demo-checker.md");

  assert.deepEqual(installAgents(src, dest).removed, []);
});

test("installAgents_sourceFilesThatAreNotDemoAgents_areNotInstalled", () => {
  put(src, "demo-checker.md");
  for (const other of ["README.md", "notes.txt", "demo-checker.txt", "demo-.md", "reviewer.md"]) put(src, other);

  const result = installAgents(src, dest);

  assert.deepEqual([result.installed, readdirSync(dest)], [["demo-checker"], ["demo-checker.md"]]);
});

test("installAgents_installedNames_followTheWorkflowOrderWithUnknownAgentsLast", () => {
  for (const name of ["zeta", "checker", "alpha", "researcher"]) put(src, `demo-${name}.md`);

  const result = installAgents(src, dest);

  assert.deepEqual(result.installed, ["demo-researcher", "demo-checker", "demo-alpha", "demo-zeta"]);
});

test("installAgents_sourceWithoutDemoAgents_installsNothing", () => {
  put(src, "README.md");

  assert.deepEqual(installAgents(src, dest).installed, []);
});

test("installAgents_missingSourceFolder_throwsBeforeCreatingTheDestination", () => {
  assert.throws(() => installAgents(join(root, "nope"), dest), { code: "ENOENT" });
  assert.equal(existsSync(dest), false);
});

// shipped role agents and docs -----------------------------------------------------------------------

const SKILL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const AGENTS_DIR = join(SKILL_ROOT, "agents");
const REFERENCES_DIR = join(SKILL_ROOT, "references");
const ROLES = {
  "demo-researcher": { model: "sonnet", effort: "high", brief: "research.md" },
  "demo-checker": { model: "sonnet", effort: "high", brief: "checker.md" },
};

function frontmatter(file) {
  const block = read(AGENTS_DIR, file).match(/^---\r?\n([\s\S]*?)\r?\n---/)[1];
  const pairs = block.split(/\r?\n/).map((line) => [line.slice(0, line.indexOf(":")).trim(), line.slice(line.indexOf(":") + 1).trim().replace(/^"|"$/g, "")]);
  return Object.fromEntries(pairs);
}

const skillDocs = () => [
  join(SKILL_ROOT, "SKILL.md"),
  join(SKILL_ROOT, "README.md"),
  ...readdirSync(AGENTS_DIR).map((f) => join(AGENTS_DIR, f)),
  ...readdirSync(REFERENCES_DIR).map((f) => join(REFERENCES_DIR, f)),
];

test("roleAgents_shippedFolder_hasExactlyTheTwoHelperRoles", () => {
  const shipped = readdirSync(AGENTS_DIR).filter((file) => /^demo-.+\.md$/.test(file));

  assert.deepEqual(shipped.sort(), Object.keys(ROLES).map((name) => `${name}.md`).sort());
});

for (const [name, role] of Object.entries(ROLES)) {
  test(`roleAgent_${name}_declaresItsNameModelAndEffort`, () => {
    const meta = frontmatter(`${name}.md`);

    assert.deepEqual([meta.name, meta.model, meta.effort], [name, role.model, role.effort]);
  });

  test(`roleAgent_${name}_describesItsRoleInTheSkillPattern`, () => {
    const { description } = frontmatter(`${name}.md`);

    assert.match(description, /^demo-video skill role: .+, used when the demo-video skill delegates /);
  });

  test(`roleAgent_${name}_leavesToolsOutSoItInheritsAllOfThem`, () => {
    assert.equal("tools" in frontmatter(`${name}.md`), false);
  });

  test(`roleAgent_${name}_pointsAtItsBriefWhichExists`, () => {
    const body = read(AGENTS_DIR, `${name}.md`);

    assert.match(body, new RegExp(`references/${role.brief.replace(".", "\\.")}`));
    assert.equal(existsSync(join(REFERENCES_DIR, role.brief)), true);
  });
}

test("skillDocs_nameOnlyTheShippedRoleAgents", () => {
  const named = skillDocs().flatMap((file) => readFileSync(file, "utf8").match(/\bdemo-[a-z]+\b/g) ?? []);

  const unknown = [...new Set(named)].filter((name) => !(name in ROLES) && !/^demo-videos?$/.test(name));

  assert.deepEqual(unknown, []);
});

test("skillDocs_containNoEmOrEnDashes", () => {
  const emOrEnDash = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);

  const withDashes = skillDocs().filter((file) => emOrEnDash.test(readFileSync(file, "utf8")));

  assert.deepEqual(withDashes, []);
});

const SKILL_MD_MAX_BYTES = 14500;
const WRITER_PLUS_SCENES_MAX_BYTES = 37000;
const sizeOf = (...parts) => statSync(join(...parts)).size;

test("skillDocs_stayWithinByteCeilings", () => {
  const skillMd = sizeOf(SKILL_ROOT, "SKILL.md");
  const writerAndScenes = sizeOf(REFERENCES_DIR, "writer.md") + sizeOf(REFERENCES_DIR, "scenes.md");

  assert.deepEqual([skillMd <= SKILL_MD_MAX_BYTES, writerAndScenes <= WRITER_PLUS_SCENES_MAX_BYTES], [true, true]);
});
