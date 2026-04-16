import json
import os

base = r'C:\Users\Asus\Desktop\Sowie fiszki 2 — kopia'
with open(os.path.join(base, 'all_words.json'), 'r', encoding='utf-8') as f:
    d = json.load(f)

books = ['brainy6','brainy7','together4','together5','together6','newpassword','czasowniki','englishA1']

for b in books:
    if b in d:
        words = d[b]['words']
        out_path = os.path.join(base, f'words_{b}.txt')
        with open(out_path, 'w', encoding='utf-8') as out:
            for w in words:
                pl = w.get('pl','')
                en = w.get('en','')
                out.write(f'{pl}\t{en}\n')
        print(f'{b}: {len(words)} words -> {out_path}')
