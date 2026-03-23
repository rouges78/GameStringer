const fs = require('fs');
const path = require('path');

const inputPath = 'C:\\dev\\GameStringer\\tools\\esoteric_ebb_strings\\level_strings\\all_ui_strings.json';
const outputPath = 'C:\\dev\\GameStringer\\tools\\esoteric_ebb_strings\\level_strings\\ui_to_translate.json';

const all = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
const keys = Object.keys(all);
console.log(`Totale estratte: ${keys.length}`);

// Filter out non-translatable strings
const filtered = {};
let skipped = { technical: 0, short: 0, code: 0, duplicate: 0, numbers: 0, internal: 0 };

for (const key of keys) {
  // Skip very short strings (< 3 chars)
  if (key.length < 3) { skipped.short++; continue; }
  
  // Skip pure numbers/symbols
  if (/^[\d\s.,:;!?%+\-=*\/\\()[\]{}]+$/.test(key)) { skipped.numbers++; continue; }
  
  // Skip code/technical patterns
  if (/[{}();\[\]].*[{}();\[\]]/.test(key)) { skipped.code++; continue; }
  if (/^\s*(var|const|let|function|class|import|export|return|if|else|for|while)\s/.test(key)) { skipped.code++; continue; }
  if (/\.(png|jpg|jpeg|gif|svg|wav|mp3|ogg|fbx|obj|anim|controller|ttf|otf|json|xml|yaml|txt|csv|tpk)$/i.test(key)) { skipped.technical++; continue; }
  
  // Skip Unity internal field names
  if (/^m_[A-Z]/.test(key)) { skipped.internal++; continue; }
  if (/^[a-z]+[A-Z][a-z]+[A-Z]/.test(key) && !key.includes(' ')) { skipped.internal++; continue; } // camelCase
  if (key.startsWith('_') || key.startsWith('#')) { skipped.internal++; continue; }
  
  // Skip hex colors, hashes, GUIDs  
  if (/^[0-9a-f]{6,}$/i.test(key)) { skipped.technical++; continue; }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(key)) { skipped.technical++; continue; }
  
  // Skip asset paths
  if (key.includes('/') && !key.includes(' ')) { skipped.technical++; continue; }
  if (key.includes('\\') && !key.includes(' ')) { skipped.technical++; continue; }
  
  // Skip strings that are already Italian
  const italianPatterns = /^(il|lo|la|le|gli|un|una|del|della|dei|delle|nel|nella|sul|sulla|con|per|che|non|sono|questo|questa|anche|come|più|fra|tra|alle|alle|dai|dai)\s/i;
  if (italianPatterns.test(key)) { skipped.duplicate++; continue; }
  
  // Skip if no alphabetic characters at all
  if (!/[a-zA-Z]{2,}/.test(key)) { skipped.technical++; continue; }
  
  // Skip common Unity/engine terms that aren't player-visible
  const engineTerms = ['Sprite', 'Renderer', 'Canvas', 'EventSystem', 'Camera', 'Light', 'Shader',
    'Material', 'Texture', 'Animator', 'Animation', 'Collider', 'Rigidbody', 'Transform',
    'AudioSource', 'AudioClip', 'Particle', 'NavMesh', 'ScriptableObject', 'MonoBehaviour',
    'GameObject', 'Component', 'Inspector', 'SerializeField', 'namespace', 'using'];
  if (engineTerms.some(t => key === t || key.startsWith(t + ' ') && key.split(' ').length <= 2)) { 
    skipped.internal++; continue; 
  }
  
  // Skip single-word strings that look like identifiers (all lowercase, no spaces)
  if (!key.includes(' ') && key.length < 20 && /^[a-z_]+$/.test(key)) { skipped.internal++; continue; }
  
  // Skip strings that look like variable/function names (mixedCase without spaces)
  if (!key.includes(' ') && /[a-z][A-Z]/.test(key) && key.length < 40) { skipped.internal++; continue; }
  
  filtered[key] = '';
}

const filteredKeys = Object.keys(filtered);
console.log(`\nFiltrate: ${filteredKeys.length}`);
console.log('Skipped:', JSON.stringify(skipped));

// Categorize for review
const categories = {
  menu_ui: [],
  stats_labels: [],
  settings: [],
  short_labels: [],  // < 30 chars, likely buttons/labels
  descriptions: [],  // > 80 chars, game content
  medium_text: [],   // 30-80 chars
};

for (const key of filteredKeys) {
  const lower = key.toLowerCase();
  if (['new game','load','save','options','credits','exit','continue','return','quit','back','apply','cancel','confirm','ok','yes','no'].some(m => lower === m || lower.includes(m))) {
    categories.menu_ui.push(key);
  } else if (['strength','dexterity','constitution','intelligence','wisdom','charisma','proficient','hit point','armor class','saving throw','spell','level','damage','attack','defense','health'].some(m => lower.includes(m))) {
    categories.stats_labels.push(key);
  } else if (['volume','resolution','display','quality','refresh','colorblind','borderless','fullscreen','vsync','font','size','mode'].some(m => lower.includes(m))) {
    categories.settings.push(key);
  } else if (key.length > 80) {
    categories.descriptions.push(key);
  } else if (key.length <= 30) {
    categories.short_labels.push(key);
  } else {
    categories.medium_text.push(key);
  }
}

console.log('\nCategorie finali:');
for (const [cat, items] of Object.entries(categories)) {
  console.log(`  ${cat}: ${items.length}`);
  items.slice(0, 5).forEach(s => console.log(`    "${s.substring(0, 80)}"`));
}

// Save
fs.writeFileSync(outputPath, JSON.stringify(filtered, null, 2), 'utf-8');
console.log(`\nSalvato: ${outputPath}`);
