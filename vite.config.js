import { resolve } from 'path';
import { defineConfig } from 'vite';
import { staticCopy } from './scripts/vite-static-copy.js';

// Extension source lives in src/; the HTML pages at its top level build to the root of dist/.
// `vite build` is the production build to dist/; `vite build --mode development` (npm run dev)
// watches and builds unminified, with source maps, to dist-dev/.
const srcDir = resolve(process.cwd(), 'src');

const inputs = {
  sidebar: resolve(srcDir, 'sidebar.html'),
  'tutorial-practice': resolve(srcDir, 'tutorial-practice.html'),
  options: resolve(srcDir, 'options.html'),
  'installation-onboarding': resolve(srcDir, 'installation-onboarding.html'),
  background: resolve(srcDir, 'background/background.js'),
  'sidebar-script': resolve(srcDir, 'sidebar/sidebar.js'),
  'options-script': resolve(srcDir, 'options/options.js'),
  'installation-onboarding-script': resolve(srcDir, 'onboarding/installation-onboarding.js'),
  offscreen: resolve(srcDir, 'offscreen.html'),
};

// Entry scripts keep fixed names at the top of dist/: the manifest points at background.js.
const entryNames = {
  background: 'background.js',
  'sidebar-script': 'sidebar.js',
  'options-script': 'options.js',
  'installation-onboarding-script': 'installation-onboarding.js',
};

function output(isDev) {
  return {
    entryFileNames: chunk => entryNames[chunk.name] || (isDev ? '[name].js' : 'assets/[name]-[hash].js'),
    chunkFileNames: isDev ? '[name].js' : 'assets/[name]-[hash].js',
    assetFileNames: asset => {
      if (asset.name?.endsWith('.css') || asset.name?.endsWith('.html')) return '[name][extname]';
      return isDev ? '[name][extname]' : 'assets/[name]-[hash][extname]';
    }
  };
}

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';
  const outDir = isDev ? 'dist-dev' : 'dist';
  return {
    root: srcDir,
    publicDir: resolve(process.cwd(), 'public'),
    build: {
      outDir: resolve(process.cwd(), outDir),
      emptyOutDir: true,
      rollupOptions: { input: inputs, output: output(isDev) },
      target: 'es2020',
      minify: !isDev,
      sourcemap: isDev,
      ...(isDev && {
        watch: { include: ['src/**/*.js', 'src/**/*.html', 'src/**/*.css', 'public/**', 'manifest.json'] }
      })
    },
    plugins: [staticCopy({ outDir })],
  };
});
