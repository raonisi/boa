import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import {
  ReleaseIdentityError,
  stampReleaseIdentity,
  validateReleaseSha,
  verifyReleaseIdentity,
} from "./stamp-release-identity.mjs";

const DEFAULT_OUTPUT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../server/generated/releaseIdentity.ts"
);

// Railway supplies these system variables to builds and deployments.
// https://docs.railway.com/variables/reference
const RAILWAY_BUILD_KEYS = [
  "RAILWAY_PROJECT_ID",
  "RAILWAY_SERVICE_ID",
  "RAILWAY_ENVIRONMENT_ID",
];

// Read syntax only: never execute the generated module or reprint its bytes.
export function readPreStampedReleaseIdentity(
  source,
  fileName = "releaseIdentity.ts"
) {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  if (sourceFile.parseDiagnostics.length || sourceFile.isDeclarationFile) {
    return { status: "invalid" };
  }

  const declarations = [];
  for (const statement of sourceFile.statements) {
    if (
      !ts.isVariableStatement(statement) ||
      !statement.modifiers?.some(
        modifier => modifier.kind === ts.SyntaxKind.ExportKeyword
      ) ||
      (statement.declarationList.flags & ts.NodeFlags.BlockScoped) !==
        ts.NodeFlags.Const
    )
      continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === "RELEASE_SHA"
      ) {
        declarations.push(declaration);
      }
    }
  }

  // Count declarations before validating values; never choose among duplicates.
  if (declarations.length > 1) return { status: "ambiguous" };
  if (declarations.length === 0) return { status: "missing" };
  // Keep ambient declarations in the syntactic count above, but never accept
  // one as a value: TypeScript erases it instead of emitting a runtime export.
  const declaration = declarations[0];
  if (
    declaration.parent.parent.modifiers?.some(
      modifier => modifier.kind === ts.SyntaxKind.DeclareKeyword
    ) ||
    ts.getCombinedModifierFlags(declaration) & ts.ModifierFlags.Ambient
  )
    return { status: "invalid" };
  const { name, initializer } = declarations[0];
  if (
    name.getText(sourceFile) !== "RELEASE_SHA" ||
    !initializer ||
    !ts.isStringLiteral(initializer)
  )
    return { status: "invalid" };

  // Validate the literal's raw contents, not TS's decoded/escaped string value.
  const rawSha = initializer.getText(sourceFile).slice(1, -1);
  try {
    return { status: "valid", releaseSha: validateReleaseSha(rawSha) };
  } catch (error) {
    if (error instanceof ReleaseIdentityError) return { status: "invalid" };
    throw error;
  }
}

export async function prepareReleaseIdentity({
  env = process.env,
  outputPath = DEFAULT_OUTPUT_PATH,
} = {}) {
  const railwaySha = env.RAILWAY_GIT_COMMIT_SHA;
  // A present but malformed value must not silently select another source.
  if (railwaySha !== undefined) {
    const releaseSha = validateReleaseSha(railwaySha);
    await stampReleaseIdentity({ releaseSha, outputPath });
    await verifyReleaseIdentity({ releaseSha, outputPath });
    return { source: "railway-git" };
  }

  const current = await readFile(outputPath, "utf8").catch(error => {
    if (error.code === "ENOENT") return "";
    throw error;
  });
  const preStamp = readPreStampedReleaseIdentity(current, outputPath);
  if (preStamp.status === "valid") {
    // Preserve the existing stamp, including its comment and line endings.
    return { source: "pre-stamped" };
  }

  if (RAILWAY_BUILD_KEYS.some(key => env[key]?.trim())) {
    throw new ReleaseIdentityError(
      preStamp.status === "ambiguous"
        ? "RAILWAY_RELEASE_IDENTITY_AMBIGUOUS"
        : "RAILWAY_RELEASE_IDENTITY_MISSING"
    );
  }
  return { source: "development-noop" };
}

async function runCli() {
  const args = process.argv.slice(2);
  if (
    args.length !== 0 &&
    (args.length !== 2 || args[0] !== "--output" || !args[1])
  ) {
    throw new ReleaseIdentityError("INVALID_PREPARATION_ARGUMENTS");
  }
  const result = await prepareReleaseIdentity({
    outputPath: args.length ? resolve(args[1]) : DEFAULT_OUTPUT_PATH,
  });
  console.log(JSON.stringify({ ok: true, source: result.source }));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runCli().catch(error => {
    const code =
      error instanceof ReleaseIdentityError
        ? error.code
        : "RELEASE_IDENTITY_PREPARATION_FAILED";
    console.error(JSON.stringify({ ok: false, code }));
    process.exitCode = 1;
  });
}
