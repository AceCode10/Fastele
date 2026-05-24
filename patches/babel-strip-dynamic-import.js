/**
 * Hermes' JS parser rejects dynamic `import(VAR)` calls (only string-literal
 * arguments are supported). `@supabase/supabase-js` ships an OpenTelemetry
 * tracing helper that does `import(OTEL_PKG)` which causes a hard
 * "Invalid expression encountered" error during Android Hermes bytecode
 * compilation in release builds.
 *
 * This plugin rewrites every dynamic `import(EXPR)` whose argument is not a
 * string literal / template literal into `Promise.resolve(null)`. The OTel
 * helper already has a `.catch(() => null)` fallback, so this is a safe no-op.
 *
 * NOTE: keep this minimal and broad — only kicks in for non-string args, so
 * it does not affect normal code-splitting via `import('./module')`.
 */
module.exports = function ({ types: t }) {
  return {
    name: 'strip-dynamic-import-with-identifier',
    visitor: {
      CallExpression(path) {
        const { callee, arguments: args } = path.node;
        if (!t.isImport(callee)) return;
        if (args.length !== 1) return;
        const arg = args[0];
        if (t.isStringLiteral(arg)) return;
        if (t.isTemplateLiteral(arg) && arg.expressions.length === 0) return;

        path.replaceWith(
          t.callExpression(
            t.memberExpression(t.identifier('Promise'), t.identifier('resolve')),
            [t.nullLiteral()]
          )
        );
      },
    },
  };
};
