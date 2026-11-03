import js from '@eslint/js';
import globals from 'globals';

// Folder boundaries (see AGENTS.md): a context may import shared/, shared/ imports no context,
// and contexts never import each other.
const contexts = ['background', 'sidebar', 'options', 'onboarding', 'offscreen'];
const boundary = (allowed = []) => ({
  'no-restricted-imports': ['error', {
    patterns: [{
      group: contexts.filter(name => !allowed.includes(name)).map(name => `**/${name}/**`),
      message: 'Extension contexts only import their own folder and src/shared/ (see AGENTS.md).'
    }]
  }]
});

export default [
  { ignores: ['dist/', 'dist-dev/', 'node_modules/', 'coverage/'] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    rules: {
      // Existing code predates linting; these stay visible as warnings rather than blocking CI.
      'no-unused-vars': 'warn',
      'no-useless-assignment': 'warn',
      'no-control-regex': 'warn'
    }
  },
  {
    files: ['src/**/*.js'],
    languageOptions: { globals: { ...globals.browser, ...globals.webextensions } }
  },
  {
    files: ['src/background/**/*.js'],
    languageOptions: { globals: { ...globals.serviceworker, ...globals.webextensions } },
    rules: boundary(['background'])
  },
  { files: ['src/sidebar/**/*.js'], rules: boundary(['sidebar']) },
  { files: ['src/options/**/*.js'], rules: boundary(['options']) },
  { files: ['src/onboarding/**/*.js'], rules: boundary(['onboarding']) },
  { files: ['src/offscreen/**/*.js'], rules: boundary(['offscreen']) },
  {
    files: ['src/shared/**/*.js'],
    languageOptions: { globals: { ...globals.browser, ...globals.serviceworker, ...globals.webextensions } },
    rules: boundary()
  },
  {
    files: ['*.js', 'scripts/**/*.js', 'tests/**/*.js'],
    languageOptions: { globals: { ...globals.node } }
  },
  {
    // Browser tests: Jest globals, and page callbacks that run inside the extension.
    files: ['tests/e2e/**/*.js'],
    languageOptions: { globals: { ...globals.jest, ...globals.browser, ...globals.webextensions } }
  },
  {
    files: ['tests/unit/**/*.js'],
    languageOptions: { globals: { ...globals.webextensions } }
  }
];
