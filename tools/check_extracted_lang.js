const fs = require('fs');
const strings = JSON.parse(fs.readFileSync(
  'D:/SteamLibrary/steamapps/common/Esoteric Ebb/Esoteric Ebb_Data/_gamestringer/extracted_strings.json', 'utf-8'
));

let italian = 0, english = 0, mixed = 0;
const itWords = ['è','che','non','una','con','per','del','della','sono','questo','quella','gli','nel','sul','dei'];
const enWords = ['the','and','you','is','was','not','but','for','this','that','with','his','her','from'];

for (const s of strings) {
  const lower = s.toLowerCase();
  const itScore = itWords.filter(w => lower.includes(` ${w} `) || lower.startsWith(`${w} `)).length;
  const enScore = enWords.filter(w => lower.includes(` ${w} `) || lower.startsWith(`${w} `)).length;
  
  if (itScore > enScore) italian++;
  else if (enScore > itScore) english++;
  else mixed++;
}

console.log(`Totale stringhe: ${strings.length}`);
console.log(`Italiano: ${italian} (${(italian/strings.length*100).toFixed(1)}%)`);
console.log(`Inglese: ${english} (${(english/strings.length*100).toFixed(1)}%)`);
console.log(`Misto/Corto: ${mixed} (${(mixed/strings.length*100).toFixed(1)}%)`);

console.log('\n--- Campione stringhe ITALIANE ---');
let shown = 0;
for (const s of strings) {
  const lower = s.toLowerCase();
  const itScore = itWords.filter(w => lower.includes(` ${w} `)).length;
  if (itScore >= 3) { console.log(`  "${s.substring(0, 100)}"`); shown++; if (shown >= 3) break; }
}

console.log('\n--- Campione stringhe INGLESI ---');
shown = 0;
for (const s of strings) {
  const lower = s.toLowerCase();
  const enScore = enWords.filter(w => lower.includes(` ${w} `)).length;
  if (enScore >= 3) { console.log(`  "${s.substring(0, 100)}"`); shown++; if (shown >= 3) break; }
}
