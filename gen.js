const fs = require('fs');
const d = JSON.parse(fs.readFileSync('/c/Users/Asus/Desktop/Sowie fiszki 2 — kopia/all_words.json', 'utf8'));
const books = ['brainy6','brainy7','together4','together5','together6','newpassword','czasowniki','englishA1'];
const result = {};
books.forEach(b => {
    if (d[b]) {
        result[b] = d[b].words.map(w => w.pl + '\t' + w.en);
        console.log(b + ': ' + result[b].length);
    }
});
// Write each book to a separate file
books.forEach(b => {
    if (result[b]) {
        fs.writeFileSync('/c/Users/Asus/Desktop/Sowie fiszki 2 — kopia/words_' + b + '.txt', result[b].join('\n'), 'utf8');
    }
});
console.log('Done');
