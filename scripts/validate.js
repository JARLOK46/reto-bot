const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const TARGET_DIRECTORIES = ['src', 'test'];

function collectJavaScriptFiles(directoryPath) {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      return collectJavaScriptFiles(entryPath);
    }

    return entry.isFile() && entry.name.endsWith('.js') ? [entryPath] : [];
  });
}

const filesToValidate = TARGET_DIRECTORIES.flatMap((directory) => {
  const directoryPath = path.join(ROOT, directory);

  return fs.existsSync(directoryPath) ? collectJavaScriptFiles(directoryPath) : [];
});

if (filesToValidate.length === 0) {
  console.error('No se encontraron archivos .js para validar.');
  process.exit(1);
}

for (const filePath of filesToValidate) {
  const result = spawnSync(process.execPath, ['--check', filePath], {
    cwd: ROOT,
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
}

console.log(`Sintaxis verificada en ${filesToValidate.length} archivos.`);
