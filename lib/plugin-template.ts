/**
 * Plugin Template Generator
 *
 * Generates scaffold code for community-created patcher plugins.
 * Users can create new game engine support without modifying GameStringer core.
 *
 * Usage:
 *   const template = generatePatcherTemplate({
 *     engineName: 'MyEngine',
 *     author: 'CommunityDev',
 *     extensions: ['.dat', '.bin'],
 *   });
 *   // Returns a complete .gsplugin manifest + entrypoint code
 */

export interface PluginTemplateConfig {
  engineName: string;
  pluginId?: string;
  author: string;
  description?: string;
  version?: string;
  extensions: string[];
  homepage?: string;
  license?: string;
}

export interface GeneratedPlugin {
  manifest: string;   // JSON manifest
  entrypoint: string; // JavaScript code
  readme: string;     // Documentation
}

/**
 * Generate a complete patcher plugin scaffold.
 */
export function generatePatcherTemplate(config: PluginTemplateConfig): GeneratedPlugin {
  const pluginId = config.pluginId || `community-${config.engineName.toLowerCase().replace(/\s+/g, '-')}`;
  const exts = config.extensions.map(e => e.startsWith('.') ? e : `.${e}`);

  const manifest = JSON.stringify({
    id: pluginId,
    name: `${config.engineName} Patcher`,
    version: config.version || '1.0.0',
    type: 'engine',
    description: config.description || `GameStringer patcher plugin for ${config.engineName} engine`,
    author: config.author,
    minAppVersion: '1.8.0',
    homepage: config.homepage || '',
    license: config.license || 'MIT',
    entrypoint: 'plugin.js',
    config: {
      backupEnabled: { type: 'boolean', default: true, label: 'Create backups before patching' },
      encoding: { type: 'string', default: 'utf-8', label: 'Text encoding' },
    },
  }, null, 2);

  const entrypoint = `// ${config.engineName} Patcher Plugin for GameStringer
// Author: ${config.author}
//
// This plugin adds support for ${config.engineName} games.
// Implement the detect/extract/patch lifecycle below.

// --- Plugin Metadata ---
exports.engineName = '${config.engineName}';
exports.supportedExtensions = ${JSON.stringify(exts)};

// --- Detection ---

/**
 * Detect if a list of files belongs to a ${config.engineName} game.
 * @param {string[]} files - List of file paths in the game directory
 * @returns {boolean} true if this engine is detected
 */
exports.detectEngine = function(files) {
  // TODO: Check for engine-specific files
  // Example: return files.some(f => f.endsWith('.myengine'));
  return files.some(function(f) {
    return ${exts.map(e => `f.endsWith('${e}')`).join(' || ')};
  });
};

/**
 * Detailed game detection with metadata.
 * @param {string} gamePath - Path to the game directory
 * @returns {Promise<object>} Detection result
 */
exports.detectGame = async function(gamePath) {
  // TODO: Implement game-specific detection
  return {
    detected: true,
    engineName: '${config.engineName}',
    engineVersion: '1.0',
    gameTitle: gamePath.split(/[\\/\\\\]/).pop() || 'Unknown',
    localizationFiles: [],
    totalStrings: 0,
    metadata: {},
  };
};

// --- Extraction ---

/**
 * Extract translatable strings from a single file.
 * @param {string} filePath - Path to the file
 * @param {string} content - File content as string
 * @returns {object} Parsed content with entries
 */
exports.extractStrings = function(filePath, content) {
  var entries = [];

  // TODO: Parse the file format and extract strings
  // Example for a simple key=value format:
  var lines = content.split('\\n');
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (line && line.indexOf('=') > 0) {
      var parts = line.split('=');
      var key = parts[0].trim();
      var value = parts.slice(1).join('=').trim();
      if (value) {
        entries.push({
          key: key,
          source: value,
          line: i + 1,
        });
      }
    }
  }

  return { entries: entries, metadata: { format: '${config.engineName.toLowerCase()}' } };
};

/**
 * Extract ALL translatable strings from the entire game.
 * @param {string} gamePath - Path to the game directory
 * @returns {Promise<object>} All extracted strings
 */
exports.extractAll = async function(gamePath) {
  // TODO: Scan game directory for localization files
  // and call extractStrings for each one
  return {
    success: true,
    entries: [],
    files: [],
    totalStrings: 0,
  };
};

// --- Injection / Patching ---

/**
 * Inject translated strings back into a single file.
 * @param {string} filePath - Original file path
 * @param {string} original - Original file content
 * @param {object} translated - Translated content with entries
 * @returns {string} Modified file content
 */
exports.injectStrings = function(filePath, original, translated) {
  var content = original;

  // TODO: Replace original strings with translations
  // Example for key=value format:
  if (translated && translated.entries) {
    for (var i = 0; i < translated.entries.length; i++) {
      var entry = translated.entries[i];
      if (entry.target) {
        content = content.replace(
          entry.key + '=' + entry.source,
          entry.key + '=' + entry.target
        );
      }
    }
  }

  return content;
};

/**
 * Apply all translations to the game.
 * @param {string} gamePath - Path to the game directory
 * @param {Array} translations - Array of {key, source, target} entries
 * @returns {Promise<object>} Patch result
 */
exports.applyPatch = async function(gamePath, translations) {
  // TODO: Apply translations to all game files
  // 1. Backup original files
  // 2. Write translated content
  // 3. Return result
  return {
    success: true,
    patchedFiles: 0,
    totalFiles: 0,
    backupCreated: true,
    method: 'override',
  };
};

/**
 * Verify patch integrity.
 * @param {string} gamePath - Path to the game directory
 * @returns {Promise<object>} Verification result
 */
exports.verifyPatch = async function(gamePath) {
  return {
    success: true,
    integrityOk: true,
    issues: [],
  };
};

/**
 * Restore original files from backup.
 * @param {string} gamePath - Path to the game directory
 * @returns {Promise<object>} Restore result
 */
exports.restoreBackup = async function(gamePath) {
  // TODO: Find .original backup files and restore them
  return {
    success: true,
    message: 'Backup ripristinato con successo',
  };
};
`;

  const readme = `# ${config.engineName} Patcher Plugin

A GameStringer plugin that adds translation support for **${config.engineName}** games.

## Installation

1. Open GameStringer
2. Go to **Settings > Plugins**
3. Click **Install Plugin** and select the \`.gsplugin\` folder
4. Enable the plugin

## Supported File Types

${exts.map(e => `- \`${e}\``).join('\n')}

## How It Works

1. **Detection**: Scans game directory for ${config.engineName}-specific files
2. **Extraction**: Parses localization files and extracts translatable strings
3. **Translation**: Uses GameStringer's AI translation pipeline
4. **Patching**: Writes translated strings back to game files (with automatic backup)
5. **Verification**: Validates patch integrity
6. **Restore**: Can restore original files from backup

## Development

Edit \`plugin.js\` to customize the detection, extraction, and patching logic.

### Plugin Lifecycle

\`\`\`
detectGame(gamePath)     -> Is this a ${config.engineName} game?
extractAll(gamePath)     -> Get all translatable strings
applyPatch(gamePath, tr) -> Write translations back
verifyPatch(gamePath)    -> Check patch integrity
restoreBackup(gamePath)  -> Undo all changes
\`\`\`

## Author

${config.author}

## License

${config.license || 'MIT'}
`;

  return { manifest, entrypoint, readme };
}
