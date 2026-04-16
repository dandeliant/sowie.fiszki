const fs = require('fs');
const path = '/c/Users/Asus/Desktop/Sowie fiszki 2 — kopia/all_words.json';
const d = JSON.parse(fs.readFileSync(path, 'utf8'));
const books = ['brainy6','brainy7','together4','together5','together6','newpassword','czasowniki','englishA1'];
books.forEach(b => {
    if (d[b]) {
        const words = d[b].words;
        const lines = words.map(w => w.pl + '\t' + w.en);
        const outPath = '/c/Users/Asus/Desktop/Sowie fiszki 2 — kopia/words_' + b + '.txt';
        fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
        console.log(b + ': ' + words.length + ' words');
    }
});
