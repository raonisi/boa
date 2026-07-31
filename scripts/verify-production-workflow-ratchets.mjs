import ts from "typescript";

const FULL_COMMIT_SHA = /^[0-9a-f]{40}$/;
export const RAILWAY_PROCESS_ADAPTER_PATH =
  "scripts/railway-command-adapter.mjs";
const PINNED_RAILWAY_INSTALL =
  "npm install --global @railway/cli@5.28.0";
const RAILWAY_NODE_HELPER =
  "node scripts/verify-railway-deployment.mjs";

export class ProductionWorkflowRatchetError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ProductionWorkflowRatchetError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new ProductionWorkflowRatchetError(code, message);
}

function stripYamlComment(line) {
  let quote = null;
  let escaped = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quote === '"') {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (quote === "'") {
      if (character === quote && line[index + 1] === quote) {
        index += 1;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "#" && (index === 0 || /\s/.test(line[index - 1]))) {
      return line.slice(0, index).trimEnd();
    }
  }

  return line.trimEnd();
}

function splitMappingEntry(content) {
  let quote = null;
  let escaped = false;
  let bracketDepth = 0;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (quote === '"') {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (quote === "'") {
      if (character === quote && content[index + 1] === quote) {
        index += 1;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "[") {
      bracketDepth += 1;
      continue;
    }
    if (character === "]") {
      bracketDepth -= 1;
      continue;
    }
    if (
      character === ":" &&
      bracketDepth === 0 &&
      (index === content.length - 1 || /\s/.test(content[index + 1]))
    ) {
      return {
        rawKey: content.slice(0, index).trim(),
        rawValue: content.slice(index + 1).trim(),
      };
    }
  }

  return null;
}

function parseScalar(rawValue, context) {
  const value = rawValue.trim();
  if (!value) {
    fail("EMPTY_SCALAR", `${context} must not be empty.`);
  }
  if (value.startsWith('"')) {
    if (!value.endsWith('"')) {
      fail("UNSUPPORTED_YAML", `${context} has an unterminated string.`);
    }
    try {
      return JSON.parse(value);
    } catch {
      fail("UNSUPPORTED_YAML", `${context} has an invalid quoted string.`);
    }
  }
  if (value.startsWith("'")) {
    if (!value.endsWith("'")) {
      fail("UNSUPPORTED_YAML", `${context} has an unterminated string.`);
    }
    return value.slice(1, -1).replaceAll("''", "'");
  }
  if (
    /^(?:null|~|true|false)$/i.test(value) ||
    /^[&*!|>{}]/.test(value) ||
    value.includes("${{")
  ) {
    fail("UNSUPPORTED_YAML", `${context} uses an unsupported YAML value.`);
  }
  return value;
}

function parseFlowSequence(rawValue, context) {
  const value = rawValue.trim();
  if (!value.startsWith("[") || !value.endsWith("]")) {
    fail("EXPECTED_SEQUENCE", `${context} must be a YAML sequence.`);
  }

  const body = value.slice(1, -1).trim();
  if (!body) {
    return [];
  }

  const items = [];
  let quote = null;
  let escaped = false;
  let start = 0;
  for (let index = 0; index <= body.length; index += 1) {
    const character = body[index];
    if (quote === '"') {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (quote === "'") {
      if (character === quote && body[index + 1] === quote) {
        index += 1;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "," || index === body.length) {
      items.push(parseScalar(body.slice(start, index), context));
      start = index + 1;
    }
  }

  if (quote) {
    fail("UNSUPPORTED_YAML", `${context} has an unterminated string.`);
  }
  return items;
}

function structuralLines(source) {
  if (typeof source !== "string") {
    fail("INVALID_WORKFLOW", "Workflow source must be a string.");
  }

  const result = [];
  let blockScalarIndent = null;
  for (const [zeroBasedLine, rawLine] of source
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .entries()) {
    if (/^\s*\t/.test(rawLine)) {
      fail(
        "UNSUPPORTED_YAML",
        `Tabs are not allowed at line ${zeroBasedLine + 1}.`
      );
    }
    const uncommented = stripYamlComment(rawLine);
    if (!uncommented.trim()) {
      continue;
    }
    const indent = uncommented.length - uncommented.trimStart().length;
    if (blockScalarIndent !== null && indent > blockScalarIndent) {
      continue;
    }
    blockScalarIndent = null;

    const content = uncommented.trimStart();
    const candidate = content.startsWith("- ") ? content.slice(2) : content;
    const mapping = splitMappingEntry(candidate);
    if (mapping && /^[|>][+-]?$/.test(mapping.rawValue)) {
      blockScalarIndent = indent;
    }
    result.push({ content, indent, line: zeroBasedLine + 1 });
  }
  return result;
}

function mappingFor(line) {
  const content = line.content.startsWith("- ")
    ? line.content.slice(2)
    : line.content;
  const mapping = splitMappingEntry(content);
  if (!mapping) {
    return null;
  }
  return {
    key: parseScalar(mapping.rawKey, `Key at line ${line.line}`),
    rawValue: mapping.rawValue,
  };
}

function containsUnparsedUsesKey(content) {
  if (/(?:^|[\s{,])(?:"uses"|'uses')\s*:/.test(content)) {
    return true;
  }
  let quote = null;
  let escaped = false;
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (quote === '"') {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (quote === "'") {
      if (character === quote && content[index + 1] === quote) {
        index += 1;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (
      content.startsWith("uses", index) &&
      /^\s*:/.test(content.slice(index + 4)) &&
      (index === 0 || /[\s{,]/.test(content[index - 1]))
    ) {
      return true;
    }
  }
  return false;
}

function descendants(lines, entryIndex) {
  const parentIndent = lines[entryIndex].indent;
  let end = entryIndex + 1;
  while (end < lines.length && lines[end].indent > parentIndent) {
    end += 1;
  }
  return lines.slice(entryIndex + 1, end);
}

function directChildIndent(lines, parentIndent) {
  const indents = lines
    .filter(line => line.indent > parentIndent)
    .map(line => line.indent);
  return indents.length ? Math.min(...indents) : null;
}

function parseBlockSequence(lines, parentIndent, context) {
  const childIndent = directChildIndent(lines, parentIndent);
  if (childIndent === null) {
    return [];
  }
  return lines
    .filter(line => line.indent === childIndent)
    .map(line => {
      if (!line.content.startsWith("- ")) {
        fail(
          "EXPECTED_SEQUENCE",
          `${context} must contain only sequence items.`
        );
      }
      const rawItem = line.content.slice(2).trim();
      if (splitMappingEntry(rawItem)) {
        fail("EXPECTED_SEQUENCE", `${context} must contain scalar items.`);
      }
      return parseScalar(rawItem, context);
    });
}

function assertExactValues(actual, expected, code, context) {
  const unique = new Set(actual);
  const exact =
    unique.size === actual.length &&
    actual.length === expected.length &&
    expected.every(value => unique.has(value));
  if (!exact) {
    fail(code, `${context} does not match the required policy.`);
  }
}

function collectWorkflowRunScripts(source) {
  if (typeof source !== "string") {
    fail("INVALID_WORKFLOW", "Workflow source must be a string.");
  }
  const rawLines = source.replace(/^\uFEFF/, "").split(/\r?\n/);
  const scripts = [];
  for (let index = 0; index < rawLines.length; index += 1) {
    const rawLine = rawLines[index];
    if (/^\s*\t/.test(rawLine)) {
      fail("UNSUPPORTED_YAML", `Tabs are not allowed at line ${index + 1}.`);
    }
    const uncommented = stripYamlComment(rawLine);
    if (!uncommented.trim()) continue;
    const indent = uncommented.length - uncommented.trimStart().length;
    const content = uncommented.trimStart();
    const candidate = content.startsWith("- ") ? content.slice(2) : content;
    const mapping = splitMappingEntry(candidate);
    if (!mapping) continue;
    const key = parseScalar(mapping.rawKey, `Key at line ${index + 1}`);
    if (key !== "run") continue;

    if (/^[|>][+-]?$/.test(mapping.rawValue)) {
      const block = [];
      let next = index + 1;
      for (; next < rawLines.length; next += 1) {
        const blockLine = rawLines[next];
        const blockIndent =
          blockLine.length - blockLine.trimStart().length;
        if (blockLine.trim() && blockIndent <= indent) break;
        const line = stripYamlComment(blockLine).trim();
        if (line) block.push({ line, lineNumber: next + 1 });
      }
      scripts.push({ lines: block, line: index + 1 });
      index = next - 1;
      continue;
    }
    if (!mapping.rawValue) {
      fail(
        "UNSUPPORTED_WORKFLOW_RAILWAY_INVOCATION",
        `run at line ${index + 1} must be a scalar or block scalar.`
      );
    }
    scripts.push({
      line: index + 1,
      lines: [{ line: mapping.rawValue, lineNumber: index + 1 }],
    });
  }
  return scripts;
}

export function validateProductionWorkflowRailwayCommands(source) {
  const scripts = collectWorkflowRunScripts(source);
  let pinnedInstallCount = 0;
  let helperCount = 0;
  for (const script of scripts) {
    for (const entry of script.lines) {
      const command = entry.line.trim();
      if (command.includes("@railway/cli")) {
        if (command !== PINNED_RAILWAY_INSTALL) {
          fail(
            "UNSUPPORTED_WORKFLOW_RAILWAY_INVOCATION",
            `Railway CLI install at line ${entry.lineNumber} is not the exact pinned command.`
          );
        }
        pinnedInstallCount += 1;
        continue;
      }
      if (command.includes("scripts/verify-railway-deployment.mjs")) {
        if (command !== RAILWAY_NODE_HELPER) {
          fail(
            "UNSUPPORTED_WORKFLOW_RAILWAY_INVOCATION",
            `Railway helper at line ${entry.lineNumber} must be invoked directly by Node.`
          );
        }
        helperCount += 1;
        continue;
      }
      if (/\brailway\b/.test(command)) {
        fail(
          "UNSUPPORTED_WORKFLOW_RAILWAY_INVOCATION",
          `Direct or wrapped Railway invocation at line ${entry.lineNumber} is forbidden.`
        );
      }
    }
  }
  return { helperCount, pinnedInstallCount, runCount: scripts.length };
}

function processCallName(expression) {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return null;
}

function isExactStringArray(node, expected) {
  return (
    ts.isArrayLiteralExpression(node) &&
    node.elements.length === expected.length &&
    node.elements.every(
      (element, index) =>
        ts.isStringLiteral(element) && element.text === expected[index]
    )
  );
}

function assertAdapterInvocation(node, path) {
  const name = processCallName(node.expression);
  if (name === "spawn") {
    const [executable, args] = node.arguments;
    const valid =
      ts.isIdentifier(executable) &&
      executable.text === "RAILWAY_CLI_EXECUTABLE" &&
      ts.isCallExpression(args) &&
      ts.isIdentifier(args.expression) &&
      args.expression.text === "buildRailwayUploadArgs";
    if (!valid) {
      fail(
        "UNSUPPORTED_PROCESS_INVOCATION_SHAPE",
        `${path} contains an unsupported Railway upload invocation.`
      );
    }
    return 1;
  }
  if (name !== "execFileImpl") return 0;
  const [executable, args] = node.arguments;
  const fixedBuilder =
    ts.isCallExpression(args) &&
    ts.isIdentifier(args.expression) &&
    args.expression.text === "buildRailwayDeploymentListArgs";
  const fixedHelp = [
    ["--version"],
    ["deployment", "list", "--help"],
    ["up", "--help"],
  ].some(expected => isExactStringArray(args, expected));
  if (
    !ts.isIdentifier(executable) ||
    executable.text !== "RAILWAY_CLI_EXECUTABLE" ||
    (!fixedBuilder && !fixedHelp)
  ) {
    fail(
      "UNSUPPORTED_PROCESS_INVOCATION_SHAPE",
      `${path} contains an unsupported Railway execFile invocation.`
    );
  }
  return 1;
}

export function validateRailwayProcessBoundary(
  sources,
  { adapterPath = RAILWAY_PROCESS_ADAPTER_PATH } = {}
) {
  if (!Array.isArray(sources) || sources.length === 0) {
    fail(
      "UNSUPPORTED_PROCESS_INVOCATION_SHAPE",
      "Production Railway sources must be provided explicitly."
    );
  }
  let adapterImportCount = 0;
  let adapterInvocationCount = 0;
  let adapterSeen = false;
  for (const entry of sources) {
    if (typeof entry?.path !== "string" || typeof entry?.source !== "string") {
      fail(
        "UNSUPPORTED_PROCESS_INVOCATION_SHAPE",
        "Every production Railway source must include a path and source."
      );
    }
    const isAdapter = entry.path.replaceAll("\\", "/") === adapterPath;
    adapterSeen ||= isAdapter;
    const tree = ts.createSourceFile(
      entry.path,
      entry.source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS
    );
    if (tree.parseDiagnostics.length > 0) {
      fail(
        "UNSUPPORTED_PROCESS_INVOCATION_SHAPE",
        `${entry.path} could not be parsed safely.`
      );
    }
    const visit = node => {
      const childProcessImport =
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        node.moduleSpecifier.text === "node:child_process";
      const childProcessRequire =
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "require" &&
        node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0]) &&
        node.arguments[0].text === "node:child_process";
      if (childProcessImport || childProcessRequire) {
        if (!isAdapter) {
          fail(
            "UNSUPPORTED_PROCESS_INVOCATION_SHAPE",
            `${entry.path} imports node:child_process outside the adapter.`
          );
        }
        adapterImportCount += 1;
      }
      if (ts.isFunctionDeclaration(node) && isAdapter) {
        const exported = node.modifiers?.some(
          modifier => modifier.kind === ts.SyntaxKind.ExportKeyword
        );
        if (
          exported &&
          node.parameters.some(parameter =>
            /\b(?:args|executable|subcommand|rawCommand)\b/.test(
              parameter.name.getText(tree)
            )
          )
        ) {
          fail(
            "UNSUPPORTED_PROCESS_INVOCATION_SHAPE",
            `${entry.path} exports a generic process runner parameter.`
          );
        }
      }
      if (ts.isCallExpression(node)) {
        if (
          node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          ts.isElementAccessExpression(node.expression)
        ) {
          fail(
            "UNSUPPORTED_PROCESS_INVOCATION_SHAPE",
            `${entry.path} contains a dynamic invocation shape.`
          );
        }
        if (
          ts.isIdentifier(node.expression) &&
          node.expression.text === "require" &&
          !childProcessRequire
        ) {
          fail(
            "UNSUPPORTED_PROCESS_INVOCATION_SHAPE",
            `${entry.path} contains an unsupported require invocation.`
          );
        }
        const callName = processCallName(node.expression);
        const isProcessCall = [
          "exec",
          "execFile",
          "execFileAsync",
          "execFileImpl",
          "spawn",
        ].includes(callName);
        if (isProcessCall) {
          if (!isAdapter) {
            fail(
              "UNSUPPORTED_PROCESS_INVOCATION_SHAPE",
              `${entry.path} invokes a process outside the adapter.`
            );
          }
          adapterInvocationCount += assertAdapterInvocation(node, entry.path);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }
  if (!adapterSeen || adapterImportCount !== 1 || adapterInvocationCount < 2) {
    fail(
      "UNSUPPORTED_PROCESS_INVOCATION_SHAPE",
      "Railway process execution must be owned by exactly one adapter."
    );
  }
  return { adapterImportCount, adapterInvocationCount, adapterPath };
}

export function validateProductionWorkflowTriggers(source) {
  const lines = structuralLines(source);
  const topLevelOn = lines
    .map((line, index) => ({ index, line, mapping: mappingFor(line) }))
    .filter(
      item =>
        item.line.indent === 0 && item.mapping && item.mapping.key === "on"
    );
  if (topLevelOn.length !== 1) {
    fail("INVALID_TRIGGER_ROOT", "Workflow must define one top-level on key.");
  }

  const { index: onIndex, line: onLine, mapping: onMapping } = topLevelOn[0];
  const onDescendants = descendants(lines, onIndex);
  let triggerKeys;
  let workflowRunEntry = null;

  if (onMapping.rawValue) {
    triggerKeys = onMapping.rawValue.trim().startsWith("[")
      ? parseFlowSequence(onMapping.rawValue, "Workflow triggers")
      : [parseScalar(onMapping.rawValue, "Workflow trigger")];
  } else {
    const triggerIndent = directChildIndent(onDescendants, onLine.indent);
    if (triggerIndent === null) {
      fail("INVALID_TRIGGERS", "Workflow triggers must not be empty.");
    }
    const directTriggers = onDescendants
      .map((line, index) => ({ index, line }))
      .filter(item => item.line.indent === triggerIndent);
    if (directTriggers.every(item => item.line.content.startsWith("- "))) {
      triggerKeys = directTriggers.map(item =>
        parseScalar(item.line.content.slice(2), "Workflow trigger")
      );
    } else {
      triggerKeys = directTriggers.map(item => {
        const mapping = mappingFor(item.line);
        if (!mapping) {
          fail("INVALID_TRIGGERS", "Workflow triggers must be mapping keys.");
        }
        if (mapping.key === "workflow_run") {
          workflowRunEntry = item;
        }
        return mapping.key;
      });
    }
  }

  assertExactValues(
    triggerKeys,
    ["workflow_run"],
    "UNSAFE_TRIGGER_SET",
    "Workflow trigger set"
  );
  if (!workflowRunEntry) {
    fail(
      "INVALID_WORKFLOW_RUN",
      "workflow_run must use a block mapping with an exact policy."
    );
  }

  const workflowRunMapping = mappingFor(workflowRunEntry.line);
  if (workflowRunMapping.rawValue) {
    fail("INVALID_WORKFLOW_RUN", "workflow_run must use a block mapping.");
  }
  const workflowRunLines = descendants(onDescendants, workflowRunEntry.index);
  const settingIndent = directChildIndent(
    workflowRunLines,
    workflowRunEntry.line.indent
  );
  if (settingIndent === null) {
    fail("INVALID_WORKFLOW_RUN", "workflow_run settings must not be empty.");
  }

  const settings = workflowRunLines
    .map((line, index) => ({ index, line, mapping: mappingFor(line) }))
    .filter(item => item.line.indent === settingIndent);
  const settingKeys = settings.map(item => item.mapping?.key);
  if (settingKeys.some(key => !key)) {
    fail("INVALID_WORKFLOW_RUN", "workflow_run settings must be mappings.");
  }
  assertExactValues(
    settingKeys,
    ["workflows", "types"],
    "INVALID_WORKFLOW_RUN_SETTINGS",
    "workflow_run setting keys"
  );

  const readSetting = key => {
    const entry = settings.find(item => item.mapping.key === key);
    return entry.mapping.rawValue
      ? parseFlowSequence(entry.mapping.rawValue, `workflow_run.${key}`)
      : parseBlockSequence(
          descendants(workflowRunLines, entry.index),
          entry.line.indent,
          `workflow_run.${key}`
        );
  };
  const workflows = readSetting("workflows");
  const types = readSetting("types");
  assertExactValues(
    workflows,
    ["Quality Gate"],
    "INVALID_WORKFLOW_RUN_WORKFLOWS",
    "workflow_run.workflows"
  );
  assertExactValues(
    types,
    ["completed"],
    "INVALID_WORKFLOW_RUN_TYPES",
    "workflow_run.types"
  );

  return { triggerKeys, workflowRun: { workflows, types } };
}

export function validateProductionWorkflowActions(
  source,
  { allowedDockerActions = [] } = {}
) {
  const allowedDocker = new Set(allowedDockerActions);
  const actions = [];

  for (const line of structuralLines(source)) {
    const mapping = mappingFor(line);
    if (!mapping || mapping.key !== "uses") {
      if (containsUnparsedUsesKey(line.content)) {
        fail(
          "UNSUPPORTED_USES_SYNTAX",
          `uses at line ${line.line} must be a standalone YAML mapping key.`
        );
      }
      continue;
    }
    const value = parseScalar(mapping.rawValue, `uses at line ${line.line}`);
    if (value.startsWith("./")) {
      actions.push({ kind: "local", line: line.line, value });
      continue;
    }
    if (value.startsWith("docker://")) {
      if (!allowedDocker.has(value)) {
        fail(
          "UNAPPROVED_DOCKER_ACTION",
          `Docker action at line ${line.line} is not allowlisted.`
        );
      }
      actions.push({ kind: "docker", line: line.line, value });
      continue;
    }

    const separator = value.lastIndexOf("@");
    if (separator <= 0 || separator === value.length - 1) {
      fail(
        "INVALID_EXTERNAL_ACTION",
        `External action at line ${line.line} has an invalid reference.`
      );
    }
    const action = value.slice(0, separator);
    const ref = value.slice(separator + 1);
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[^@\s]+)*$/.test(action)) {
      fail(
        "INVALID_EXTERNAL_ACTION",
        `External action at line ${line.line} has an invalid action path.`
      );
    }
    if (!FULL_COMMIT_SHA.test(ref)) {
      fail(
        "MUTABLE_EXTERNAL_ACTION",
        `External action at line ${line.line} is not pinned to a lowercase full commit SHA.`
      );
    }
    actions.push({ action, kind: "external", line: line.line, ref, value });
  }

  return {
    actions,
    dockerActions: actions.filter(action => action.kind === "docker"),
    externalActions: actions.filter(action => action.kind === "external"),
    localActions: actions.filter(action => action.kind === "local"),
  };
}

export function validateProductionWorkflowRatchets(source, options) {
  return {
    actions: validateProductionWorkflowActions(source, options),
    railwayCommands: validateProductionWorkflowRailwayCommands(source),
    triggers: validateProductionWorkflowTriggers(source),
  };
}
