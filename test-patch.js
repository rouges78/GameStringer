console.log('Test script running...');

const fs = require('fs');
const path = require('path');

const decarnationPath = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Decarnation\\Decarnation_Data\\Example folder\\Decarnation_DataClean - dialogues-resources.assets-52.txt';

console.log('Checking if file exists:', fs.existsSync(decarnationPath));

if (fs.existsSync(decarnationPath)) {
  console.log('File found! Reading first 1000 characters...');
  const content = fs.readFileSync(decarnationPath, 'utf-8');
  console.log(content.substring(0, 1000));
} else {
  console.log('File not found at:', decarnationPath);
}
