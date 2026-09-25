import js from '@eslint/js';
import jsdoc from 'eslint-plugin-jsdoc';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node
    },
    rules: {
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-arrow-callback': 'error'
    }
  },
  {
    // Every function in plain JS needs typed JSDoc — it's the only source of types for `npm run typecheck`.
    files: ['**/*.js'],
    ignores: ['tests/**', 'eslint.config.js'],
    plugins: { jsdoc },
    rules: {
      'jsdoc/require-jsdoc': [
        'error',
        { require: { FunctionDeclaration: true, ArrowFunctionExpression: true, FunctionExpression: true } }
      ],
      'jsdoc/require-param': 'error',
      'jsdoc/require-param-type': 'error',
      'jsdoc/require-returns': 'error',
      'jsdoc/require-returns-type': 'error',
      'jsdoc/check-param-names': 'error',
      'jsdoc/check-types': 'error'
    }
  },
  {
    ignores: ['node_modules/**']
  }
];
