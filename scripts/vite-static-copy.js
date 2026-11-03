import fs from 'fs-extra';

/**
 * Copies the files Vite does not process into the build: the manifest and the legal
 * texts. Images and the font come from public/ through Vite's own publicDir copy.
 */
export function staticCopy({ outDir }) {
  return {
    name: 'sidecove-static-copy',
    writeBundle: async () => {
      for (const file of ['manifest.json', 'LICENSE', 'README.md', 'THIRD_PARTY_NOTICES.md']) {
        await fs.copy(file, `${outDir}/${file}`);
      }

      console.log(`✅ Main extension files built to ${outDir}/`);
      console.log(`🎉 Sidecove extension build complete!`);
    }
  };
}
