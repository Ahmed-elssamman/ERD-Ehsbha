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

function controllerFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return controllerFiles(path);
    return entry.name.endsWith('.controller.ts') ? [path] : [];
  });
}

function decorators(node, ts) {
  return ts.canHaveDecorators(node) ? ts.getDecorators(node) || [] : [];
}

function decoratorCall(node, name, ts) {
  const expression = node.expression;
  return ts.isCallExpression(expression)
    && ts.isIdentifier(expression.expression)
    && expression.expression.text === name
    ? expression
    : null;
}

function argumentText(call, ts) {
  const argument = call?.arguments[0];
  return argument && (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument))
    ? argument.text
    : '';
}

function validationSchemaName(parameter, bindingName, ts) {
  for (const decorator of decorators(parameter, ts)) {
    const binding = decoratorCall(decorator, bindingName, ts);
    if (!binding) continue;
    const pipe = binding.arguments.find((argument) =>
      ts.isNewExpression(argument)
      && ts.isIdentifier(argument.expression)
      && argument.expression.text === 'ZodValidationPipe',
    );
    const schema = pipe?.arguments?.[0];
    return schema && ts.isIdentifier(schema) ? schema.text : null;
  }
  return null;
}

function endpointPath(prefix, methodPath) {
  return `/api/v1/${[prefix, methodPath].filter(Boolean).join('/')}`.replace(/\/+/g, '/');
}

export async function extractApiEndpoints(directory = resolve(repoRoot(), 'apps/api/src')) {
  const ts = await typescript();
  const endpoints = [];
  const methodDecorators = ['Get', 'Post', 'Put', 'Patch', 'Delete'];

  for (const filePath of controllerFiles(directory)) {
    const source = ts.createSourceFile(
      filePath,
      readFileSync(filePath, 'utf-8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    for (const statement of source.statements) {
      if (!ts.isClassDeclaration(statement)) continue;
      const controller = decorators(statement, ts)
        .map((decorator) => decoratorCall(decorator, 'Controller', ts))
        .find(Boolean);
      if (!controller) continue;
      const prefix = argumentText(controller, ts);

      for (const member of statement.members) {
        if (!ts.isMethodDeclaration(member)) continue;
        for (const decorator of decorators(member, ts)) {
          for (const method of methodDecorators) {
            const call = decoratorCall(decorator, method, ts);
            if (!call) continue;
            endpoints.push({
              method: method.toUpperCase(),
              path: endpointPath(prefix, argumentText(call, ts)),
              source: relative(repoRoot(), filePath).replace(/\\/g, '/'),
              line: source.getLineAndCharacterOfPosition(member.getStart(source)).line + 1,
              controller: statement.name?.text || null,
              handler: ts.isIdentifier(member.name) ? member.name.text : null,
              requestSchemas: Object.fromEntries(
                [
                  ['body', member.parameters.map((parameter) =>
                    validationSchemaName(parameter, 'Body', ts)).find(Boolean)],
                  ['query', member.parameters.map((parameter) =>
                    validationSchemaName(parameter, 'Query', ts)).find(Boolean)],
                ].filter(([, schema]) => schema),
              ),
            });
          }
        }
      }
    }
  }
  return endpoints;
}
