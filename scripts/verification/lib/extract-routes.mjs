import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { pathToFileURL } from 'url';
import { repoRoot } from './paths.mjs';

let tsModule;

async function getTypeScript() {
  if (tsModule) return tsModule;
  const localPath = resolve(repoRoot(), 'node_modules/typescript/lib/typescript.js');
  tsModule = await import(pathToFileURL(localPath).href);
  return tsModule;
}

function firstExisting(candidates) {
  for (const candidate of candidates) {
    const fullPath = resolve(repoRoot(), candidate);
    if (existsSync(fullPath)) return fullPath;
  }
  return null;
}

export function extractWebRouterPath() {
  return firstExisting(['apps/web/src/router.tsx', 'apps/web/src/App.tsx']);
}

export function extractAdminRouterPath() {
  return firstExisting(['apps/admin/src/router.tsx', 'apps/admin/src/main.tsx', 'apps/admin/src/App.tsx']);
}

function joinRoutePath(parentPath, childPath) {
  if (childPath.startsWith('/')) return childPath;
  if (!parentPath || parentPath === '/') return `/${childPath}`;
  return `${parentPath.replace(/\/$/, '')}/${childPath}`;
}

function propertyName(property, ts) {
  if (!property.name) return '';
  if (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) return property.name.text;
  return '';
}

function stringLiteralValue(node, ts) {
  return node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : null;
}

function collectModuleBindings(sourceFile, ts) {
  const bindings = new Map();

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) && statement.importClause) {
      const modulePath = stringLiteralValue(statement.moduleSpecifier, ts);
      const clause = statement.importClause;
      if (clause.name) bindings.set(clause.name.text, { modulePath, lazy: false });
      if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const element of clause.namedBindings.elements) {
          bindings.set(element.name.text, { modulePath, lazy: false });
        }
      }
    }

    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
      let modulePath = null;

      function visit(node) {
        if (
          ts.isCallExpression(node)
          && node.expression.kind === ts.SyntaxKind.ImportKeyword
          && node.arguments.length === 1
        ) {
          modulePath = stringLiteralValue(node.arguments[0], ts);
        }
        if (!modulePath) ts.forEachChild(node, visit);
      }

      visit(declaration.initializer);
      if (modulePath) bindings.set(declaration.name.text, { modulePath, lazy: true });
    }
  }

  return bindings;
}

function inspectElement(initializer, sourceFile, moduleBindings, ts) {
  if (!initializer) {
    return {
      component: null,
      modulePath: null,
      guarded: false,
      permission: null,
      redirectTo: null,
    };
  }

  const text = initializer.getText(sourceFile);
  const componentNames = [];
  let permission = null;
  let redirectTo = null;

  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(sourceFile);
      componentNames.push(tagName);
      if (tagName === 'Navigate') {
        const toAttribute = node.attributes.properties.find(
          (attribute) => ts.isJsxAttribute(attribute) && attribute.name.text === 'to',
        );
        if (toAttribute && ts.isJsxAttribute(toAttribute) && toAttribute.initializer) {
          redirectTo = ts.isStringLiteral(toAttribute.initializer)
            ? toAttribute.initializer.text
            : toAttribute.initializer.getText(sourceFile);
        }
      }
      if (tagName === 'RequirePermission') {
        const permissionAttribute = node.attributes.properties.find(
          (attribute) => ts.isJsxAttribute(attribute)
            && ['permission', 'perm'].includes(attribute.name.text),
        );
        if (permissionAttribute && ts.isJsxAttribute(permissionAttribute) && permissionAttribute.initializer) {
          permission = ts.isStringLiteral(permissionAttribute.initializer)
            ? permissionAttribute.initializer.text
            : permissionAttribute.initializer.getText(sourceFile).replace(/[{}'"]/g, '');
        }
      }
    }

    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'gate') {
      permission = stringLiteralValue(node.arguments[0], ts) || permission;
    }
    ts.forEachChild(node, visit);
  }

  visit(initializer);
  const wrappers = new Set([
    'ProtectedRoute',
    'GuestRoute',
    'AdminProtectedRoute',
    'AdminGuestRoute',
    'RequirePermission',
    'Navigate',
    'Suspense',
  ]);
  const component = componentNames.find((name) => !wrappers.has(name)) || null;
  const binding = component ? moduleBindings.get(component) : null;

  return {
    component,
    modulePath: binding?.modulePath || null,
    isLazy: binding?.lazy || false,
    guarded: componentNames.some((name) => [
      'ProtectedRoute',
      'GuestRoute',
      'AdminProtectedRoute',
      'AdminGuestRoute',
      'RequirePermission',
    ].includes(name)) || /\bgate\s*\(/.test(text),
    permission,
    redirectTo,
  };
}

function extractRouteObjects(arrayNode, context, state, sourceFile, moduleBindings, ts) {
  const siblingPaths = new Set();

  for (const element of arrayNode.elements) {
    if (!ts.isObjectLiteralExpression(element)) continue;

    let rawPath = null;
    let index = false;
    let children = null;
    let elementInitializer = null;
    let line = sourceFile.getLineAndCharacterOfPosition(element.getStart(sourceFile)).line + 1;

    for (const property of element.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      const name = propertyName(property, ts);
      if (name === 'path') {
        rawPath = stringLiteralValue(property.initializer, ts);
        line = sourceFile.getLineAndCharacterOfPosition(property.getStart(sourceFile)).line + 1;
      } else if (name === 'index' && property.initializer.kind === ts.SyntaxKind.TrueKeyword) {
        index = true;
      } else if (name === 'children' && ts.isArrayLiteralExpression(property.initializer)) {
        children = property.initializer;
      } else if (name === 'element') {
        elementInitializer = property.initializer;
      }
    }

    const elementMetadata = inspectElement(elementInitializer, sourceFile, moduleBindings, ts);
    const routePath = index
      ? (context.parentPath || '/')
      : rawPath === null
        ? null
        : joinRoutePath(context.parentPath, rawPath);
    const guarded = context.guarded || elementMetadata.guarded;
    const permission = elementMetadata.permission || context.permission || null;

    if (routePath !== null) {
      const duplicateKey = `${routePath}|${index ? 'index' : 'route'}`;
      const isDuplicate = siblingPaths.has(duplicateKey);
      siblingPaths.add(duplicateKey);
      state.routes.push({
        path: routePath,
        rawPath,
        line,
        source: state.filePath,
        isIndex: index,
        isCatchAll: rawPath === '*',
        isDuplicate,
        guarded,
        permission,
        component: elementMetadata.component,
        modulePath: elementMetadata.modulePath,
        isLazy: elementMetadata.isLazy,
        isRedirect: Boolean(elementMetadata.redirectTo),
        redirectTo: elementMetadata.redirectTo,
      });
    }

    if (children) {
      extractRouteObjects(
        children,
        {
          parentPath: routePath || context.parentPath,
          guarded,
          permission,
        },
        state,
        sourceFile,
        moduleBindings,
        ts,
      );
    }
  }
}

export async function extractRoutes(filePath) {
  if (!filePath || !existsSync(filePath)) {
    return { error: 'Router file not found', routes: [], sourceFile: filePath || null, totalRoutes: 0 };
  }

  const ts = await getTypeScript();
  const content = readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const moduleBindings = collectModuleBindings(sourceFile, ts);
  const state = { routes: [], filePath };

  function visit(node) {
    if (
      ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && node.expression.text === 'createBrowserRouter'
      && node.arguments[0]
      && ts.isArrayLiteralExpression(node.arguments[0])
    ) {
      extractRouteObjects(
        node.arguments[0],
        { parentPath: '', guarded: false, permission: null },
        state,
        sourceFile,
        moduleBindings,
        ts,
      );
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return {
    routes: state.routes,
    sourceFile: filePath,
    routerDirectory: dirname(filePath),
    totalRoutes: state.routes.length,
  };
}

export default { extractWebRouterPath, extractAdminRouterPath, extractRoutes };
