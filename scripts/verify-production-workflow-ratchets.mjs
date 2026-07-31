import { readdir, readFile, realpath, stat } from "node:fs/promises";
import {
  dirname,
  extname,
  isAbsolute,
  join,
  posix,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const FULL_COMMIT_SHA = /^[0-9a-f]{40}$/;
export const RAILWAY_PROCESS_ADAPTER_PATH =
  "scripts/railway-command-adapter.mjs";
export const PRODUCTION_WORKFLOW_PATH =
  ".github/workflows/production-deploy.yml";
const DEFAULT_REPOSITORY_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  ".."
);
const PRODUCTION_MODULE_EXTENSIONS = Object.freeze([".mjs", ".js", ".ts"]);
const ALLOWED_PROCESS_PROPERTIES = Object.freeze([
  "argv",
  "env",
  "exitCode",
  "pid",
  "platform",
]);
const ALLOWED_PROCESS_PROPERTY_SET = new Set(ALLOWED_PROCESS_PROPERTIES);
const SYMBOL_RESOLUTION_DIAGNOSTICS = new Set([
  2300, 2304, 2305, 2306, 2307, 2440, 2451, 2688, 2724, 2792,
]);
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
      scripts.push({
        lines: block,
        line: index + 1,
        style: mapping.rawValue[0] === ">" ? "folded" : "literal",
      });
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
      lines: [
        {
          line: parseScalar(
            mapping.rawValue,
            `run at line ${index + 1}`
          ),
          lineNumber: index + 1,
        },
      ],
      style: "scalar",
    });
  }
  return scripts;
}

function hasShellLineContinuation(value) {
  let quote = null;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote === "'") {
      if (character === "'") quote = null;
      continue;
    }
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (quote === '"') {
      if (character === '"') quote = null;
      continue;
    }
    if (character === "'" || character === '"') quote = character;
  }
  return escaped && quote !== "'";
}

function logicalCommands(script) {
  if (script.style === "folded") {
    const first = script.lines[0]?.lineNumber ?? script.line;
    return [
      {
        command: script.lines.map(entry => entry.line.trim()).join(" "),
        lineNumber: first,
      },
    ];
  }

  const commands = [];
  let pending = "";
  let pendingLine = script.line;
  for (const entry of script.lines) {
    const line = entry.line.trim();
    if (!line) continue;
    if (!pending) pendingLine = entry.lineNumber;
    if (hasShellLineContinuation(line)) {
      pending += `${line.slice(0, -1).trimEnd()} `;
      continue;
    }
    commands.push({ command: `${pending}${line}`.trim(), lineNumber: pendingLine });
    pending = "";
  }
  if (pending) {
    fail(
      "UNSUPPORTED_PRODUCTION_NODE_ENTRYPOINT",
      `run at line ${pendingLine} has an unterminated continuation.`
    );
  }
  return commands;
}

function tokenizeShellCommand(command, lineNumber) {
  const tokens = [];
  let current = "";
  let dynamic = false;
  let quote = null;
  let escaped = false;
  let hasOperator = false;
  const finish = () => {
    if (current || dynamic) tokens.push({ dynamic, value: current });
    current = "";
    dynamic = false;
  };

  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];
    if (quote === "'") {
      if (character === "'") quote = null;
      else current += character;
      continue;
    }
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (quote === '"') {
      if (character === '"') quote = null;
      else {
        if (character === "$" || character === "`") dynamic = true;
        current += character;
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (/\s/.test(character)) {
      finish();
      continue;
    }
    if (";&|<>".includes(character)) {
      finish();
      hasOperator = true;
      continue;
    }
    if (character === "$" || character === "`") dynamic = true;
    current += character;
  }
  if (quote || escaped) {
    fail(
      "UNSUPPORTED_PRODUCTION_NODE_ENTRYPOINT",
      `run at line ${lineNumber} has unsupported shell quoting.`
    );
  }
  finish();
  return { hasOperator, tokens };
}

function parseProductionNodeCommand(command, lineNumber) {
  const parsed = tokenizeShellCommand(command, lineNumber);
  const containsNode =
    parsed.tokens.some(token => token.value === "node") ||
    /\bnode\b/.test(command);
  if (!containsNode) return null;

  const [executable, entrypoint] = parsed.tokens;
  const validEntrypoint =
    executable?.value === "node" &&
    executable.dynamic === false &&
    entrypoint &&
    entrypoint.dynamic === false &&
    /^scripts\/[A-Za-z0-9._/-]+\.(?:mjs|js|ts)$/.test(entrypoint.value) &&
    !entrypoint.value.includes("\\") &&
    !entrypoint.value.split("/").some(part => part === "." || part === "..") &&
    !isAbsolute(entrypoint.value) &&
    !parsed.hasOperator;
  if (!validEntrypoint) {
    fail(
      "UNSUPPORTED_PRODUCTION_NODE_ENTRYPOINT",
      `run at line ${lineNumber} must invoke a literal scripts helper directly with Node.`
    );
  }
  return entrypoint.value;
}

export function discoverProductionNodeEntrypoints(source) {
  const entrypoints = new Set();
  for (const script of collectWorkflowRunScripts(source)) {
    for (const { command, lineNumber } of logicalCommands(script)) {
      const entrypoint = parseProductionNodeCommand(command, lineNumber);
      if (entrypoint) entrypoints.add(entrypoint);
    }
  }
  return [...entrypoints].sort();
}

export function validateProductionWorkflowRailwayCommands(source) {
  const scripts = collectWorkflowRunScripts(source);
  let pinnedInstallCount = 0;
  let helperCount = 0;
  for (const script of scripts) {
    for (const entry of logicalCommands(script)) {
      const command = entry.command.trim();
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
      if (/\brailway\b/.test(command)) {
        if (command === RAILWAY_NODE_HELPER) {
          helperCount += 1;
          continue;
        }
        fail(
          "UNSUPPORTED_WORKFLOW_RAILWAY_INVOCATION",
          `Direct or wrapped Railway invocation at line ${entry.lineNumber} is forbidden.`
        );
      }
      const nodeEntrypoint = parseProductionNodeCommand(
        command,
        entry.lineNumber
      );
      if (nodeEntrypoint) {
        continue;
      }
    }
  }
  return { helperCount, pinnedInstallCount, runCount: scripts.length };
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

function assertAdapterRunnerInvocation(node, path) {
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
      "UNSUPPORTED_CHILD_PROCESS_CALL_SHAPE",
      `${path} contains an unsupported Railway execFile runner invocation.`
    );
  }
}

function assertImportedChildProcessCall(node, path, name) {
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
        "UNSUPPORTED_CHILD_PROCESS_CALL_SHAPE",
        `${path} contains an unsupported Railway upload invocation.`
      );
    }
    return 1;
  }
  const owner = findAncestor(
    node,
    candidate => ts.isFunctionDeclaration(candidate)
  );
  const [executable, args, options, callback] = node.arguments;
  const valid =
    owner?.name?.text === "executeRailwayFile" &&
    ts.isIdentifier(executable) &&
    executable.text === "executable" &&
    ts.isIdentifier(args) &&
    args.text === "args" &&
    ts.isIdentifier(options) &&
    options.text === "options" &&
    (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback));
  if (!valid) {
    fail(
      "UNSUPPORTED_CHILD_PROCESS_CALL_SHAPE",
      `${path} must call execFile only through the approved Promise wrapper.`
    );
  }
  return 1;
}

function findAncestor(node, predicate) {
  let current = node.parent;
  while (current) {
    if (predicate(current)) return current;
    current = current.parent;
  }
  return null;
}

function bindingIdentifiers(name, result = []) {
  if (!name) return result;
  if (ts.isIdentifier(name)) result.push(name);
  else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
    for (const element of name.elements) {
      if (ts.isBindingElement(element)) bindingIdentifiers(element.name, result);
    }
  }
  return result;
}

function isAssignmentOperator(kind) {
  return kind >= ts.SyntaxKind.FirstAssignment && kind <= ts.SyntaxKind.LastAssignment;
}

function getRequiredSymbol(checker, node, path) {
  const symbol = checker.getSymbolAtLocation(node);
  if (!symbol) {
    fail(
      "TYPECHECKER_SYMBOL_RESOLUTION_FAILED",
      `${path} contains a symbol that TypeChecker could not resolve.`
    );
  }
  return symbol;
}

function isChildProcessOrigin(checker, bindingSymbol, expectedName) {
  if (!(bindingSymbol.flags & ts.SymbolFlags.Alias)) return false;
  const target = checker.getAliasedSymbol(bindingSymbol);
  return (
    target.name === expectedName &&
    target.declarations?.some(declaration =>
      declaration
        .getSourceFile()
        .fileName.replaceAll("\\", "/")
        .includes("/@types/node/child_process.d.ts")
    )
  );
}

function isVariableAlias(parent, identifier) {
  return (
    (ts.isVariableDeclaration(parent) && parent.initializer === identifier) ||
    (ts.isBinaryExpression(parent) &&
      parent.right === identifier &&
      isAssignmentOperator(parent.operatorToken.kind))
  );
}

function validateGlobalProcessUse(identifier, path) {
  const parent = identifier.parent;
  if (
    ts.isPropertyAccessExpression(parent) &&
    parent.expression === identifier
  ) {
    if (ALLOWED_PROCESS_PROPERTY_SET.has(parent.name.text)) return;
    fail(
      "FORBIDDEN_PROCESS_PROPERTY",
      `${path} accesses forbidden process.${parent.name.text}.`
    );
  }
  if (
    ts.isElementAccessExpression(parent) &&
    parent.expression === identifier
  ) {
    if (ts.isBinaryExpression(parent.argumentExpression)) {
      fail(
        "FORBIDDEN_PROCESS_CAPABILITY_ACCESS",
        `${path} computes a process capability.`
      );
    }
    if (ts.isStringLiteral(parent.argumentExpression)) {
      fail(
        "DYNAMIC_PROCESS_PROPERTY_ACCESS",
        `${path} must access process properties directly.`
      );
    }
    fail(
      "DYNAMIC_PROCESS_PROPERTY_ACCESS",
      `${path} dynamically accesses a process property.`
    );
  }
  if (isVariableAlias(parent, identifier)) {
    fail(
      "PROCESS_OBJECT_ALIAS_FORBIDDEN",
      `${path} aliases the global process object.`
    );
  }
  fail(
    "PROCESS_OBJECT_ESCAPE_FORBIDDEN",
    `${path} lets the global process object escape its property allowlist.`
  );
}

function validateProcessCapabilities(
  tree,
  path,
  { checker, globalObjectSymbol, globalProcessSymbol, globalThisSymbol }
) {
  const visit = node => {
    if (ts.isIdentifier(node) && node.text === "process") {
      const symbol = checker.getSymbolAtLocation(node);
      if (symbol === globalProcessSymbol) validateGlobalProcessUse(node, path);
    }
    if (ts.isIdentifier(node) && node.text === "globalThis") {
      const symbol = checker.getSymbolAtLocation(node);
      if (symbol === globalThisSymbol) {
        fail(
          "FORBIDDEN_PROCESS_CAPABILITY_ACCESS",
          `${path} cannot access process capabilities through globalThis.`
        );
      }
    }
    if (ts.isIdentifier(node) && node.text === "global") {
      const symbol = checker.getSymbolAtLocation(node);
      if (symbol === globalObjectSymbol) {
        fail(
          "FORBIDDEN_PROCESS_CAPABILITY_ACCESS",
          `${path} cannot access process capabilities through the Node global object.`
        );
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
}

function validateAdapterTree(tree, path, checker) {
  let adapterImportCount = 0;
  let adapterInvocationCount = 0;
  let runnerInvocationCount = 0;

  const exactImports = tree.statements.filter(
    statement =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      ["node:child_process", "child_process"].includes(
        statement.moduleSpecifier.text
      )
  );
  if (exactImports.length !== 1) {
    fail(
      "UNSUPPORTED_CHILD_PROCESS_IMPORT_SHAPE",
      `${path} must have exactly one child_process import.`
    );
  }
  const clause = exactImports[0].importClause;
  const elements = clause?.namedBindings;
  const validImport =
    exactImports[0].moduleSpecifier.text === "node:child_process" &&
    clause &&
    !clause.name &&
    elements &&
    ts.isNamedImports(elements) &&
    elements.elements.length === 2 &&
    elements.elements.every(element => !element.propertyName) &&
    ["execFile", "spawn"].every(name =>
      elements.elements.some(element => element.name.text === name)
    );
  if (!validImport) {
    fail(
      "UNSUPPORTED_CHILD_PROCESS_IMPORT_SHAPE",
      `${path} must import non-aliased execFile and spawn bindings.`
    );
  }
  adapterImportCount = 1;

  const importedBindings = new Map();
  for (const element of elements.elements) {
    const symbol = getRequiredSymbol(checker, element.name, path);
    if (!isChildProcessOrigin(checker, symbol, element.name.text)) {
      fail(
        "UNSUPPORTED_CHILD_PROCESS_IMPORT_SHAPE",
        `${path} child_process import does not resolve to the canonical Node symbol.`
      );
    }
    importedBindings.set(element.name.text, symbol);
  }

  const runnerSymbols = new Set();
  const collectRunnerSymbols = node => {
    if (
      ts.isBindingElement(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "execFileImpl"
    ) {
      const owner = findAncestor(node, candidate =>
        ts.isFunctionDeclaration(candidate)
      );
      if (
        [
          "executeRailwayDeploymentList",
          "verifyRailwayCliHelpContract",
        ].includes(owner?.name?.text)
      ) {
        runnerSymbols.add(getRequiredSymbol(checker, node.name, path));
      }
    }
    ts.forEachChild(node, collectRunnerSymbols);
  };
  collectRunnerSymbols(tree);
  if (runnerSymbols.size !== 2) {
    fail(
      "UNSUPPORTED_CHILD_PROCESS_CALL_SHAPE",
      `${path} must expose exactly two constrained execFile runner bindings.`
    );
  }

  const visit = node => {
    if (
      ts.isImportDeclaration(node) &&
      node !== exactImports[0] &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      ["node:child_process", "child_process"].includes(
        node.moduleSpecifier.text
      )
    ) {
      fail(
        "UNSUPPORTED_CHILD_PROCESS_IMPORT_SHAPE",
        `${path} contains an additional child_process import.`
      );
    }
    const declared = [];
    if (ts.isVariableDeclaration(node)) bindingIdentifiers(node.name, declared);
    else if (ts.isParameter(node)) bindingIdentifiers(node.name, declared);
    else if (
      (ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isClassExpression(node)) &&
      node.name
    ) {
      declared.push(node.name);
    } else if (ts.isCatchClause(node) && node.variableDeclaration) {
      bindingIdentifiers(node.variableDeclaration.name, declared);
    } else if (ts.isImportSpecifier(node) && node.parent.parent !== clause) {
      declared.push(node.name);
    }
    if (declared.some(identifier => importedBindings.has(identifier.text))) {
      fail(
        "CHILD_PROCESS_BINDING_SHADOWED",
        `${path} shadows an imported child_process binding.`
      );
    }

    if (ts.isFunctionDeclaration(node)) {
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
          "UNSUPPORTED_CHILD_PROCESS_CALL_SHAPE",
          `${path} exports a generic process runner parameter.`
        );
      }
    }

    if (ts.isIdentifier(node)) {
      const symbol = checker.getSymbolAtLocation(node);
      const importedName = [...importedBindings].find(
        ([, bindingSymbol]) => bindingSymbol === symbol
      )?.[0];
      const runnerBinding = symbol && runnerSymbols.has(symbol);
      const parent = node.parent;
      const inApprovedImport =
        ts.isImportSpecifier(parent) && parent.name === node && parent.parent === elements;
      const directApprovedCall =
        ts.isCallExpression(parent) && parent.expression === node;
      if (importedName && !inApprovedImport && !directApprovedCall) {
        if (
          ts.isBinaryExpression(parent) &&
          parent.left === node &&
          isAssignmentOperator(parent.operatorToken.kind)
        ) {
          fail(
            "CHILD_PROCESS_BINDING_REASSIGNED",
            `${path} reassigns an imported child_process binding.`
          );
        }
        fail(
          "UNSUPPORTED_CHILD_PROCESS_CALL_SHAPE",
          `${path} aliases or indirectly accesses an imported child_process binding.`
        );
      }
      if (importedName && directApprovedCall) {
        adapterInvocationCount += assertImportedChildProcessCall(
          parent,
          path,
          importedName
        );
      }
      if (runnerBinding) {
        const declarationName =
          ts.isBindingElement(parent) && parent.name === node;
        if (!declarationName && !directApprovedCall) {
          fail(
            ts.isElementAccessExpression(parent)
              ? "DYNAMIC_PROTECTED_MEMBER_ACCESS"
              : "UNSUPPORTED_CHILD_PROCESS_CALL_SHAPE",
            `${path} indirectly accesses a constrained Railway runner.`
          );
        }
        if (directApprovedCall) {
          assertAdapterRunnerInvocation(parent, path);
          runnerInvocationCount += 1;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  if (adapterInvocationCount !== 2 || runnerInvocationCount !== 4) {
    fail(
      "UNSUPPORTED_CHILD_PROCESS_CALL_SHAPE",
      `${path} must retain the exact Railway process invocation set.`
    );
  }
  return { adapterImportCount, adapterInvocationCount };
}

function parseProductionSource(path, source) {
  const kind = path.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const tree = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    kind
  );
  if (tree.parseDiagnostics.length > 0) {
    fail(
      "TYPECHECKER_SYNTACTIC_DIAGNOSTIC",
      `${path} has a TypeScript syntactic diagnostic.`
    );
  }
  return tree;
}

function childProcessSpecifier(node) {
  return (
    ts.isStringLiteral(node) &&
    ["node:child_process", "child_process"].includes(node.text)
  );
}

function validateNonAdapterTree(tree, path) {
  const visit = node => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      childProcessSpecifier(node.moduleSpecifier)
    ) {
      fail(
        "CHILD_PROCESS_OUTSIDE_RAILWAY_ADAPTER",
        `${path} imports child_process outside the Railway adapter.`
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
}

function collectStaticRelativeImports(tree, path) {
  const imports = [];
  const visit = node => {
    if (ts.isImportEqualsDeclaration(node)) {
      fail(
        "IMPORT_EQUALS_FORBIDDEN",
        `${path} uses forbidden ImportEquals module loading.`
      );
    }
    if (ts.isCallExpression(node)) {
      const dynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const requireCall =
        ts.isIdentifier(node.expression) && node.expression.text === "require";
      const dynamicChildProcessImport =
        (dynamicImport || requireCall) &&
        node.arguments.length === 1 &&
        childProcessSpecifier(node.arguments[0]);
      if (dynamicChildProcessImport) {
        fail(
          path === RAILWAY_PROCESS_ADAPTER_PATH
            ? "UNSUPPORTED_CHILD_PROCESS_IMPORT_SHAPE"
            : "CHILD_PROCESS_OUTSIDE_RAILWAY_ADAPTER",
          `${path} cannot dynamically load child_process.`
        );
      }
      let loaderName = null;
      if (ts.isIdentifier(node.expression)) loaderName = node.expression.text;
      else if (ts.isPropertyAccessExpression(node.expression)) {
        loaderName = node.expression.name.text;
      } else if (
        ts.isElementAccessExpression(node.expression) &&
        ts.isStringLiteral(node.expression.argumentExpression)
      ) {
        loaderName = node.expression.argumentExpression.text;
      }
      const unsupportedCall = [
        "Function",
        "createRequire",
        "eval",
        "require",
      ].includes(loaderName);
      if (dynamicImport || unsupportedCall) {
        fail(
          "UNSUPPORTED_PRODUCTION_MODULE_LOADING",
          `${path} contains unsupported dynamic module loading.`
        );
      }
    }
    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "Function"
    ) {
      fail(
        "UNSUPPORTED_PRODUCTION_MODULE_LOADING",
        `${path} contains unsupported dynamic code loading.`
      );
    }
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier
    ) {
      if (!ts.isStringLiteral(node.moduleSpecifier)) {
        fail(
          "UNSUPPORTED_PRODUCTION_MODULE_LOADING",
          `${path} has a non-literal module specifier.`
        );
      }
      const specifier = node.moduleSpecifier.text;
      if (["node:process", "process"].includes(specifier)) {
        fail(
          "FORBIDDEN_PROCESS_CAPABILITY_ACCESS",
          `${path} imports the Node process capability.`
        );
      }
      if (["module", "node:module"].includes(specifier)) {
        fail(
          "UNSUPPORTED_PRODUCTION_MODULE_LOADING",
          `${path} imports a forbidden Node loader module.`
        );
      }
      if (specifier.startsWith(".")) imports.push(specifier);
      else if (
        specifier.startsWith("/") ||
        /^[A-Za-z]:[\\/]/.test(specifier) ||
        /^(?:file|https?):/.test(specifier)
      ) {
        fail(
          "PRODUCTION_MODULE_PATH_ESCAPE",
          `${path} imports an absolute or remote module.`
        );
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return imports;
}

function isInside(root, candidate) {
  const result = relative(root, candidate);
  return result === "" || (!result.startsWith(`..${sep}`) && result !== ".." && !isAbsolute(result));
}

async function probeExactFile(root, relativePath) {
  let cursor = root;
  for (const segment of relativePath.split("/")) {
    let entries;
    try {
      entries = await readdir(cursor);
    } catch {
      return { status: "missing" };
    }
    if (!entries.includes(segment)) {
      const caseMatch = entries.some(
        entry => entry.toLocaleLowerCase("en-US") === segment.toLocaleLowerCase("en-US")
      );
      return { status: caseMatch ? "case-mismatch" : "missing" };
    }
    cursor = join(cursor, segment);
  }
  try {
    if (!(await stat(cursor)).isFile()) return { status: "missing" };
    return { absolutePath: cursor, realPath: await realpath(cursor), status: "ok" };
  } catch {
    return { status: "missing" };
  }
}

async function resolveProductionModule({
  importer,
  repositoryRoot,
  repositoryRealPath,
  scriptsRealPath,
  specifier,
}) {
  if (specifier.includes("\\") || specifier.split("/").includes("..")) {
    fail(
      "PRODUCTION_MODULE_PATH_ESCAPE",
      `${importer} contains a forbidden module path.`
    );
  }
  const base = posix.normalize(posix.join(posix.dirname(importer), specifier));
  if (!base.startsWith("scripts/") || base.includes("../")) {
    fail(
      "PRODUCTION_MODULE_PATH_ESCAPE",
      `${importer} imports outside scripts.`
    );
  }
  const extension = extname(base);
  const candidates = extension
    ? [base]
    : PRODUCTION_MODULE_EXTENSIONS.map(candidate => `${base}${candidate}`);
  if (extension && !PRODUCTION_MODULE_EXTENSIONS.includes(extension)) {
    fail(
      "UNRESOLVED_PRODUCTION_MODULE",
      `${importer} imports an unsupported module extension.`
    );
  }
  const probes = await Promise.all(
    candidates.map(candidate => probeExactFile(repositoryRoot, candidate))
  );
  if (probes.some(probe => probe.status === "case-mismatch")) {
    fail(
      "PRODUCTION_MODULE_CASE_MISMATCH",
      `${importer} imports a path with incorrect casing.`
    );
  }
  const matches = candidates
    .map((candidate, index) => ({ candidate, ...probes[index] }))
    .filter(candidate => candidate.status === "ok");
  if (matches.length === 0) {
    fail(
      "UNRESOLVED_PRODUCTION_MODULE",
      `${importer} imports a missing module.`
    );
  }
  if (matches.length !== 1) {
    fail(
      "AMBIGUOUS_PRODUCTION_MODULE",
      `${importer} imports an ambiguous extensionless module.`
    );
  }
  const [match] = matches;
  if (
    !isInside(repositoryRealPath, match.realPath) ||
    !isInside(scriptsRealPath, match.realPath)
  ) {
    fail(
      "PRODUCTION_MODULE_PATH_ESCAPE",
      `${importer} resolves through a symlink outside scripts.`
    );
  }
  return match.candidate;
}

async function readProductionFile({
  path,
  repositoryRoot,
  repositoryRealPath,
  scriptsRealPath,
}) {
  const extension = extname(path);
  if (
    !path.startsWith("scripts/") ||
    path.includes("\\") ||
    path.split("/").some(part => part === "." || part === "..") ||
    !PRODUCTION_MODULE_EXTENSIONS.includes(extension)
  ) {
    fail(
      "PRODUCTION_MODULE_PATH_ESCAPE",
      `${path} is not a supported scripts entrypoint.`
    );
  }
  const probe = await probeExactFile(repositoryRoot, path);
  if (probe.status === "case-mismatch") {
    fail("PRODUCTION_MODULE_CASE_MISMATCH", `${path} has incorrect casing.`);
  }
  if (probe.status !== "ok") {
    fail("UNRESOLVED_PRODUCTION_MODULE", `${path} does not exist.`);
  }
  if (
    !isInside(repositoryRealPath, probe.realPath) ||
    !isInside(scriptsRealPath, probe.realPath)
  ) {
    fail("PRODUCTION_MODULE_PATH_ESCAPE", `${path} escapes scripts.`);
  }
  return readFile(probe.absolutePath, "utf8");
}

function normalizedFileName(value) {
  const normalized = resolve(value).replaceAll("\\", "/");
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function findProgramSourceFile(program, absolutePath) {
  const expected = normalizedFileName(absolutePath);
  return program
    .getSourceFiles()
    .find(sourceFile => normalizedFileName(sourceFile.fileName) === expected);
}

function findAmbientGlobalSymbol(program, checker, name, filePredicate) {
  const symbols = new Set();
  for (const sourceFile of program.getSourceFiles()) {
    if (!sourceFile.isDeclarationFile || !filePredicate(sourceFile.fileName)) {
      continue;
    }
    const visit = node => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === name
      ) {
        const symbol = checker.getSymbolAtLocation(node.name);
        if (symbol) symbols.add(symbol);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  if (symbols.size !== 1) {
    fail(
      "TYPECHECKER_SYMBOL_RESOLUTION_FAILED",
      `TypeChecker could not identify the canonical global ${name} symbol.`
    );
  }
  return [...symbols][0];
}

function resolveIntrinsicGlobalSymbol(program, checker, name) {
  const location = program
    .getSourceFiles()
    .find(sourceFile =>
      sourceFile.fileName
        .replaceAll("\\", "/")
        .endsWith("/typescript/lib/lib.es5.d.ts")
    );
  const symbol =
    location &&
    checker.resolveName(name, location, ts.SymbolFlags.Value, false);
  if (!symbol) {
    fail(
      "TYPECHECKER_SYMBOL_RESOLUTION_FAILED",
      `TypeChecker could not identify the intrinsic global ${name} symbol.`
    );
  }
  return symbol;
}

function createProductionTypeAnalysis(repositoryRoot, sourcePaths) {
  const rootNames = sourcePaths.map(path =>
    resolve(repositoryRoot, ...path.split("/"))
  );
  const options = {
    allowJs: true,
    checkJs: true,
    forceConsistentCasingInFileNames: true,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ESNext,
    typeRoots: [join(DEFAULT_REPOSITORY_ROOT, "node_modules", "@types")],
    types: ["node"],
  };
  const program = ts.createProgram({ options, rootNames });
  const optionDiagnostics = [
    ...program.getOptionsDiagnostics(),
    ...program.getGlobalDiagnostics(),
  ];
  if (optionDiagnostics.length > 0) {
    fail(
      "TYPECHECKER_PROGRAM_INVALID",
      "TypeScript Program options or global types are invalid."
    );
  }
  const checker = program.getTypeChecker();
  const sourceFiles = new Map();
  for (const path of sourcePaths) {
    const sourceFile = findProgramSourceFile(
      program,
      resolve(repositoryRoot, ...path.split("/"))
    );
    if (!sourceFile) {
      fail(
        "TYPECHECKER_SYMBOL_RESOLUTION_FAILED",
        `${path} is missing from the TypeScript Program.`
      );
    }
    sourceFiles.set(path, sourceFile);
  }
  const globalProcessSymbol = findAmbientGlobalSymbol(
    program,
    checker,
    "process",
    fileName =>
      fileName.replaceAll("\\", "/").includes("/@types/node/globals.d.ts")
  );
  const globalObjectSymbol = findAmbientGlobalSymbol(
    program,
    checker,
    "global",
    fileName =>
      fileName.replaceAll("\\", "/").includes("/@types/node/globals.d.ts")
  );
  const globalThisSymbol = resolveIntrinsicGlobalSymbol(
    program,
    checker,
    "globalThis"
  );
  return {
    checker,
    globalObjectSymbol,
    globalProcessSymbol,
    globalThisSymbol,
    options,
    program,
    sourceFiles,
  };
}

function validateTypeAnalysisDiagnostics({ program, sourceFiles }) {
  for (const [path, sourceFile] of sourceFiles) {
    if (program.getSyntacticDiagnostics(sourceFile).length > 0) {
      fail(
        "TYPECHECKER_SYNTACTIC_DIAGNOSTIC",
        `${path} has a TypeScript syntactic diagnostic.`
      );
    }
    const invalidatingDiagnostic = program
      .getSemanticDiagnostics(sourceFile)
      .find(diagnostic => SYMBOL_RESOLUTION_DIAGNOSTICS.has(diagnostic.code));
    if (invalidatingDiagnostic) {
      fail(
        "TYPECHECKER_SYMBOL_RESOLUTION_FAILED",
        `${path} has a semantic diagnostic that invalidates symbol analysis.`
      );
    }
  }
}

export async function analyzeProductionRailwayBoundary({
  adapterPath = RAILWAY_PROCESS_ADAPTER_PATH,
  repositoryRoot = DEFAULT_REPOSITORY_ROOT,
  workflowPath = PRODUCTION_WORKFLOW_PATH,
} = {}) {
  const repositoryRealPath = await realpath(repositoryRoot);
  const scriptsRealPath = await realpath(join(repositoryRoot, "scripts"));
  if (!isInside(repositoryRealPath, scriptsRealPath)) {
    fail("PRODUCTION_MODULE_PATH_ESCAPE", "scripts resolves outside the repository.");
  }
  const workflowProbe = await probeExactFile(repositoryRoot, workflowPath);
  if (workflowProbe.status === "case-mismatch") {
    fail("PRODUCTION_MODULE_CASE_MISMATCH", `${workflowPath} has incorrect casing.`);
  }
  if (workflowProbe.status !== "ok" || !isInside(repositoryRealPath, workflowProbe.realPath)) {
    fail("UNRESOLVED_PRODUCTION_MODULE", `${workflowPath} does not exist safely.`);
  }
  const workflowSource = await readFile(workflowProbe.absolutePath, "utf8");
  validateProductionWorkflowRailwayCommands(workflowSource);
  const entrypoints = discoverProductionNodeEntrypoints(workflowSource);
  const queue = [...entrypoints];
  const sources = new Map();
  while (queue.length > 0) {
    const path = queue.shift();
    if (sources.has(path)) continue;
    const source = await readProductionFile({
      path,
      repositoryRoot,
      repositoryRealPath,
      scriptsRealPath,
    });
    const tree = parseProductionSource(path, source);
    const imports = collectStaticRelativeImports(tree, path);
    sources.set(path, { source, tree });
    for (const specifier of imports) {
      const dependency = await resolveProductionModule({
        importer: path,
        repositoryRoot,
        repositoryRealPath,
        scriptsRealPath,
        specifier,
      });
      if (!sources.has(dependency)) queue.push(dependency);
    }
  }

  const typeAnalysis = createProductionTypeAnalysis(
    repositoryRoot,
    [...sources.keys()]
  );
  let adapterImportCount = 0;
  let adapterInvocationCount = 0;
  for (const [path, tree] of typeAnalysis.sourceFiles) {
    validateProcessCapabilities(tree, path, typeAnalysis);
    if (path === adapterPath) {
      const result = validateAdapterTree(tree, path, typeAnalysis.checker);
      adapterImportCount += result.adapterImportCount;
      adapterInvocationCount += result.adapterInvocationCount;
    } else {
      validateNonAdapterTree(tree, path);
    }
  }
  if (!sources.has(adapterPath) || adapterImportCount !== 1) {
    fail(
      "UNSUPPORTED_CHILD_PROCESS_IMPORT_SHAPE",
      "Railway process execution must be owned by exactly one discovered adapter."
    );
  }
  validateTypeAnalysisDiagnostics(typeAnalysis);
  return {
    adapterImportCount,
    adapterInvocationCount,
    adapterPath,
    entrypoints,
    files: [...sources.keys()].sort(),
    processProperties: [...ALLOWED_PROCESS_PROPERTIES],
    typeChecked: true,
  };
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
