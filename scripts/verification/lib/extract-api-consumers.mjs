import { existsSync, readFileSync, readdirSync } from 'fs';
import { relative, resolve } from 'path';
import { pathToFileURL } from 'url';
import { repoRoot } from './paths.mjs';

let tsModule;

async function typescript() {
  if (!tsModule) {
    tsModule = await import(pathToFileURL(
      resolve(repoRoot(), 'node_modules/typescript/lib/typescript.js'),
    ).href);
  }
  return tsModule;
}

function sourceFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name) ? [path] : [];
  });
}

function templatePath(node, ts) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (!ts.isTemplateExpression(node)) return null;
  return node.head.text + node.templateSpans
    .map((span) => `:${parameterName(span.expression, ts)}${span.literal.text}`)
    .join('');
}

function parameterName(expression, ts) {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isCallExpression(expression) && expression.arguments[0]) {
    return parameterName(expression.arguments[0], ts);
  }
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return 'param';
}

function canonicalPath(path) {
  const withPrefix = path.startsWith('/api/v1/') ? path : `/api/v1${path.startsWith('/') ? path : `/${path}`}`;
  return withPrefix.replace(/\/+/g, '/').replace(/\{([^}]+)\}/g, ':$1');
}

export async function extractApiConsumers() {
  const ts = await typescript();
  const roots = [
    { application: 'web', path: resolve(repoRoot(), 'apps/web/src') },
    { application: 'admin', path: resolve(repoRoot(), 'apps/admin/src') },
  ];
  const consumers = [];

  for (const root of roots) {
    for (const filePath of sourceFiles(root.path)) {
      const source = ts.createSourceFile(
        filePath,
        readFileSync(filePath, 'utf-8'),
        ts.ScriptTarget.Latest,
        true,
        filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );

      function visit(node) {
        if (
          ts.isCallExpression(node)
          && ts.isPropertyAccessExpression(node.expression)
          && ts.isIdentifier(node.expression.expression)
          && ['api', 'publicApi', 'adminApi'].includes(node.expression.expression.text)
          && ['get', 'post', 'put', 'patch', 'delete'].includes(node.expression.name.text)
          && node.arguments[0]
        ) {
          const path = templatePath(node.arguments[0], ts);
          if (path) {
            consumers.push({
              application: root.application,
              method: node.expression.name.text.toUpperCase(),
              path: canonicalPath(path),
              source: relative(repoRoot(), filePath).replace(/\\/g, '/'),
              line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
            });
          }
        }
        ts.forEachChild(node, visit);
      }

      visit(source);
    }
  }

  return consumers;
}

export function pathsMatch(left, right) {
  const normalize = (value) => canonicalPath(value).replace(/:[^/]+/g, ':param');
  return normalize(left) === normalize(right);
}
