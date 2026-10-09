// Grammar City — rozmowy z mieszkańcami (NPC).
// Każda rozmowa: 3 kroki. NPC pyta PO POLSKU, gracz odpowiada PO ANGIELSKU.
// ok: lista wyrażeń regularnych — wystarczy jedno pasujące (any);
// all: wszystkie muszą pasować (np. „podziękuj i pożegnaj się").
// Odpowiedź jest normalizowana: małe litery, ’→', bez interpunkcji, pojedyncze spacje.
(function () {
  const NUM = '(\\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(-?[a-z]+)?';
  const BE = "(i am|i'm|im)";
  window.NPC_TALKS = [
    { id: 'emma', name: 'Emma', role: 'turystka', look: { hairStyle: 'long', hair: 0xc9a25a, shirt: 0x3fb5b0, pants: 0x2d3a5a, skirt: true }, steps: [
      { pl: 'Cześć! Jak masz na imię?', ok: [/\b(my name is|my name's|i am|i'm|im|call me)\s+[a-ząćęłńóśźż]+/], hint: 'My name is …', ex: 'My name is Tom.', en: "Nice to meet you! I'm Emma.", enPl: 'Miło cię poznać! Jestem Emma.' },
      { pl: 'Ile masz lat?', ok: [new RegExp('\\b' + BE + '\\s+' + NUM + '\\b'), new RegExp('\\b' + NUM + ' years old\\b')], hint: "I'm … years old.", ex: "I'm twelve years old.", en: "Cool! I'm twenty.", enPl: 'Super! Ja mam dwadzieścia lat.' },
      { pl: 'Skąd jesteś?', ok: [new RegExp('\\b' + BE + ' from [a-z]+'), /\bi come from [a-z]+/], hint: "I'm from …", ex: "I'm from Poland.", en: "Great! I'm from Canada.", enPl: 'Świetnie! Ja jestem z Kanady.' },
    ] },
    { id: 'brown', name: 'Mr Brown', role: 'kelner w kawiarni', look: { hairStyle: 'bald', shirt: 0xf5f5f5, pants: 0x111111, jacket: 0x111111 }, steps: [
      { pl: 'Dzień dobry! Co podać? Poproś o kawę.', ok: [/\b(can|could|may) i (have|get) (a |an |some |one )?(coffee|cup of coffee)/, /\bi'?d like (a |some |one )?(coffee|cup of coffee)/, /\bi would like (a |some |one )?(coffee|cup of coffee)/, /\b(a )?coffee,? please/], hint: 'Can I have a coffee, please?', ex: 'Can I have a coffee, please?', en: 'Sure! Anything else?', enPl: 'Jasne! Coś jeszcze?' },
      { pl: 'Zapytaj, ile to kosztuje.', ok: [/\bhow much (is|does|do|are|will)\b/, /\bhow much\b.*\bcost/, /\bwhat('s| is) the price/], hint: 'How much is it?', ex: 'How much is it?', en: "It's three pounds fifty.", enPl: 'Trzy funty pięćdziesiąt.' },
      { pl: 'Podziękuj i pożegnaj się.', all: [/\b(thank you|thanks|thank u)\b/, /\b(bye|goodbye|good bye|see you|have a (nice|good|great) day)\b/], hint: 'Thank you! Goodbye!', ex: 'Thank you! Goodbye!', en: 'Bye! Have a nice day!', enPl: 'Pa! Miłego dnia!' },
    ] },
    { id: 'kevin', name: 'Kevin', role: 'zagubiony turysta', look: { hairStyle: 'short', hair: 0x8a4b24, shirt: 0xf2b632, pants: 0x5a4a3a, hat: 'cap', hatColor: 0xb23a48 }, steps: [
      { pl: 'Przepraszam, gdzie jest dworzec? Powiedz mu, żeby szedł prosto.', ok: [/\b(go|walk) straight( on| ahead)?\b/], hint: 'Go straight on.', ex: 'Go straight on.', en: 'Straight on. OK!', enPl: 'Prosto. Dobrze!' },
      { pl: 'Powiedz mu, żeby skręcił w lewo przy banku.', all: [/\bturn left\b/, /\bbank\b/], hint: 'Turn left at the bank.', ex: 'Turn left at the bank.', en: 'Turn left at the bank. Got it!', enPl: 'W lewo przy banku. Rozumiem!' },
      { pl: 'Powiedz, że dworzec jest naprzeciwko parku.', ok: [/\bopposite (the )?park\b/], hint: "It's opposite the park.", ex: "It's opposite the park.", en: 'Thank you so much!', enPl: 'Bardzo dziękuję!' },
    ] },
    { id: 'lily', name: 'Lily', role: 'dziewczynka z psem', look: { hairStyle: 'bun', hair: 0x2b1d14, shirt: 0xc94f8a, pants: 0x3b5a8a, skirt: true }, steps: [
      { pl: 'Masz zwierzątko? Odpowiedz pełnym zdaniem.', ok: [new RegExp("\\bi( have|'ve|ve)( got)? (a|an|two|three|four|five|\\d+) [a-z]+"), /\bno,? i (don't|do not|dont) have (a |any )?(pet|pets)/, /\bi (haven't|have not|havent) got (a |any )?(pet|pets)/], hint: "I have got a dog. / No, I don't have a pet.", ex: 'I have got a cat.', en: 'My dog is called Max!', enPl: 'Mój pies nazywa się Max!' },
      { pl: 'Jakiego koloru jest twoje ulubione zwierzę? Powiedz np. „Jest brązowy".', ok: [/\b(it is|it's|its|he is|he's|she is|she's|my [a-z]+ is|they are|they're) (very |really )?(black|white|brown|grey|gray|orange|ginger|yellow|green|blue|red|pink|golden|spotty)\b/], hint: "It's brown.", ex: "It's black and white.", en: 'Aww, lovely!', enPl: 'Ojej, uroczy!' },
      { pl: 'Zapytaj ją, jak ma na imię jej pies.', ok: [/\bwhat('s| is) (your|the) dog'?s name/, /\bwhat('s| is) your dog called/, /\bwhat('s| is) (his|its) name/, /\bwhat do you call your dog/], hint: "What's your dog's name?", ex: "What's your dog's name?", en: 'His name is Max!', enPl: 'Ma na imię Max!' },
    ] },
    { id: 'jones', name: 'Officer Jones', role: 'policjantka', look: { hairStyle: 'bun', hair: 0x5a3a1e, shirt: 0x1e3a8a, pants: 0x1e3a8a, hat: 'cap', hatColor: 0x111827, sleeves: 'long' }, steps: [
      { pl: 'Gdzie byłeś wczoraj wieczorem? Odpowiedz w czasie przeszłym.', ok: [/\bi was (at|in|on|with)\b/, /\bi stayed (at|in) /, /\bi went to /], hint: 'I was at home.', ex: 'I was at home.', en: 'Hmm. And what did you do?', enPl: 'Hmm. A co robiłeś?' },
      { pl: 'Co robiłeś? Np. „Oglądałem telewizję".', ok: [/\bi (watched|played|read|did|cooked|listened|studied|went|visited|saw|ate|drank|wrote|cleaned|met|talked|called|walked|slept|made|learned|learnt|helped|danced|sang|rode|drew|painted|baked)\b/], hint: 'I watched TV.', ex: 'I watched TV.', en: 'OK, that sounds normal.', enPl: 'Dobrze, to brzmi normalnie.' },
      { pl: 'Czy widziałeś coś dziwnego? Odpowiedz: „Nie, nie widziałem".', ok: [/\bno,? i (didn't|did not|didnt)\b/, /\bno,? i saw nothing\b/, /\bi didn't see anything\b/, /\bi did not see anything\b/], hint: "No, I didn't.", ex: "No, I didn't.", en: 'Thank you for your help!', enPl: 'Dziękuję za pomoc!' },
    ] },
    { id: 'rose', name: 'Grandma Rose', role: 'starsza pani na ławce', look: { hairStyle: 'bun', hair: 0xd8d8d8, shirt: 0x7a4fc9, pants: 0x6b6b6b, skirt: true, glasses: 'sun' }, steps: [
      { pl: 'Jaka jest dziś pogoda? Powiedz, że jest słonecznie.', ok: [/\b(it is|it's|its) (very |really |so )?sunny\b/], hint: "It's sunny.", ex: "It's sunny today.", en: 'Yes, lovely weather!', enPl: 'Tak, piękna pogoda!' },
      { pl: 'Powiedz, że jutro będzie padać.', ok: [/\b(it will|it'll|itll|it is going to|it's going to|its going to|it's gonna) rain\b/], hint: 'It will rain tomorrow.', ex: 'It will rain tomorrow.', en: 'Oh no! I need my umbrella.', enPl: 'O nie! Potrzebuję parasola.' },
      { pl: 'Zapytaj, czy ma parasol.', ok: [/\b(do you have|have you got|have you|do you've got) (an |a |your )?umbrella/], hint: 'Do you have an umbrella?', ex: 'Have you got an umbrella?', en: 'Yes, I always have one!', enPl: 'Tak, zawsze mam!' },
    ] },
    { id: 'mike', name: 'Coach Mike', role: 'trener w parku', look: { hairStyle: 'short', hair: 0x111111, shirt: 0xd64545, pants: 0x222222, sleeves: 'short', shoes: 0xf2f2f2 }, steps: [
      { pl: 'Co lubisz robić w wolnym czasie?', ok: [/\bi (like|love|enjoy) [a-z]+/, /\bmy (hobby|favourite hobby|favorite hobby) is /], hint: 'I like playing football.', ex: 'I like playing football.', en: 'Me too! Sport is great.', enPl: 'Ja też! Sport jest super.' },
      { pl: 'Czy umiesz pływać? Odpowiedz pełnym zdaniem.', ok: [/\byes,? i can\b/, /\bno,? i (can't|cannot|cant|can not)\b/, /\bi can swim\b/, /\bi (can't|cannot|cant) swim\b/], hint: "Yes, I can. / No, I can't.", ex: 'Yes, I can.', en: 'Swimming is good for you!', enPl: 'Pływanie jest zdrowe!' },
      { pl: 'Jak często uprawiasz sport? Np. „dwa razy w tygodniu".', ok: [/\b(once|twice|three times|four times|five times|\d+ times|every day|every week|every weekend|every morning|every evening|on (mondays|tuesdays|wednesdays|thursdays|fridays|saturdays|sundays))\b/], hint: 'Twice a week.', ex: 'Twice a week.', en: 'Great! Keep it up!', enPl: 'Świetnie! Tak trzymaj!' },
    ] },
    { id: 'sophie', name: 'Sophie', role: 'sprzedawczyni ubrań', look: { hairStyle: 'long', hair: 0x111111, shirt: 0xeeeeee, pants: 0x222831, jacket: 0x7a1f2b }, steps: [
      { pl: 'Szukasz czegoś? Powiedz, że szukasz kurtki.', ok: [/\b(i'm|i am|im) looking for (a |an |some )?jacket/, /\bi need (a |an )?jacket/, /\bi want (a |to buy a )?jacket/], hint: "I'm looking for a jacket.", ex: "I'm looking for a jacket.", en: 'What size are you?', enPl: 'Jaki masz rozmiar?' },
      { pl: 'Jaki rozmiar? Powiedz, że średni (M).', ok: [/\bmedium\b/, /\bsize m\b/, /^m( please)?$/], hint: 'Medium, please.', ex: 'Medium, please.', en: 'Here you are. Do you want to try it on?', enPl: 'Proszę. Chcesz przymierzyć?' },
      { pl: 'Zapytaj, czy możesz ją przymierzyć.', ok: [/\b(can|could|may) i try (it|this|this jacket|the jacket|it) on\b/, /\b(can|could|may) i try on (it|this|this jacket|the jacket)\b/], hint: 'Can I try it on?', ex: 'Can I try it on?', en: 'Of course! The changing room is there.', enPl: 'Oczywiście! Przymierzalnia jest tam.' },
    ] },
    { id: 'patel', name: 'Dr Patel', role: 'lekarz', look: { hairStyle: 'short', hair: 0x2b1d14, shirt: 0xf5f5f5, pants: 0x3b5a8a, jacket: 0xf5f5f5, glasses: 'sun' }, steps: [
      { pl: 'Co ci dolega? Powiedz, że boli cię głowa.', ok: [/\bi (have|'ve got|have got|ve got|got) (a )?headache/, /\bmy head (hurts|is hurting)/], hint: 'I have got a headache.', ex: 'I have got a headache.', en: 'Oh dear. Did you drink enough water?', enPl: 'Ojej. Piłeś wystarczająco dużo wody?' },
      { pl: 'Odpowiedz, że nie — wypiłeś tylko jedną szklankę.', all: [/\bno\b/, /\b(one|1) glass\b/], hint: 'No, I only drank one glass.', ex: 'No, I only drank one glass.', en: 'You should drink more water.', enPl: 'Powinieneś pić więcej wody.' },
      { pl: 'Podziękuj za radę.', ok: [/\b(thank you|thanks|thank u)\b/], hint: 'Thank you for the advice.', ex: 'Thank you for your advice.', en: "You're welcome. Get well soon!", enPl: 'Nie ma za co. Szybko wracaj do zdrowia!' },
    ] },
    { id: 'jack', name: 'Jack', role: 'uczeń przed szkołą', look: { hairStyle: 'short', hair: 0xc9a25a, shirt: 0x2fa36b, pants: 0x2d3a5a, hat: 'beanie', hatColor: 0x1e3a5f }, steps: [
      { pl: 'Jaki jest twój ulubiony przedmiot?', ok: [/\bmy (favourite|favorite) (subject|lesson) is [a-z]+/, /\bi (like|love) (maths|math|english|history|art|music|pe|science|biology|geography|polish|chemistry|physics|it|computer science)\b/, /^(maths|math|english|history|art|music|pe|science|biology|geography|polish|chemistry|physics)$/], hint: 'My favourite subject is English.', ex: 'My favourite subject is English.', en: 'Nice! I love Art.', enPl: 'Fajnie! Ja uwielbiam plastykę.' },
      { pl: 'O której zaczynasz lekcje? Np. „O ósmej".', ok: [/\b(at|start at|starts at|begin at|begins at)\s*(\d{1,2}([:.]\d{2})?|seven|eight|nine|ten|half past [a-z]+|quarter (past|to) [a-z]+)/], hint: "At eight o'clock.", ex: "At eight o'clock.", en: "That's early!", enPl: 'Wcześnie!' },
      { pl: 'Zapytaj go, czy ma dużo pracy domowej.', ok: [/\b(do you have|have you got|have you|do you've got) (a lot of|lots of|much|many|a lot) homework/], hint: 'Do you have a lot of homework?', ex: 'Do you have a lot of homework?', en: 'Yes, too much!', enPl: 'Tak, za dużo!' },
    ] },
    { id: 'luigi', name: 'Chef Luigi', role: 'kucharz z pizzerii', look: { hairStyle: 'short', hair: 0x111111, shirt: 0xf5f5f5, pants: 0x6b6b6b, sleeves: 'long', hat: 'beanie', hatColor: 0xf5f5f5 }, steps: [
      { pl: 'Co lubisz jeść? Powiedz, że lubisz pizzę.', ok: [/\bi (like|love|enjoy|really like) pizza/], hint: 'I like pizza.', ex: 'I love pizza.', en: 'Mamma mia! Me too!', enPl: 'Mamma mia! Ja też!' },
      { pl: 'Czego nie lubisz? Powiedz, że nie lubisz grzybów.', ok: [/\bi (don't|do not|dont|really don't) like mushrooms/, /\bi hate mushrooms/], hint: "I don't like mushrooms.", ex: "I don't like mushrooms.", en: 'No mushrooms. OK!', enPl: 'Bez grzybów. Dobrze!' },
      { pl: 'Zamów dużą pizzę z serem.', ok: [/\b(can|could|may) i (have|get|order) a (large|big) (cheese pizza|pizza with cheese)/, /\bi'?d like a (large|big) (cheese pizza|pizza with cheese)/, /\bi would like a (large|big) (cheese pizza|pizza with cheese)/, /\b(a )?(large|big) (cheese pizza|pizza with cheese),? please/], hint: 'Can I have a large cheese pizza, please?', ex: 'Can I have a large cheese pizza, please?', en: 'Coming right up!', enPl: 'Już się robi!' },
    ] },
    { id: 'mia', name: 'Mia', role: 'youtuberka', look: { hairStyle: 'long', hair: 0xb5501f, shirt: 0xf2b632, pants: 0x222222, glasses: 'sun' }, steps: [
      { pl: 'Co będziesz robić w weekend? Użyj „going to".', ok: [/\b(i'm|i am|im) going to [a-z]+/], hint: "I'm going to visit my grandma.", ex: "I'm going to play football.", en: 'Sounds fun!', enPl: 'Brzmi fajnie!' },
      { pl: 'Zapytaj ją, co teraz robi (Present Continuous).', ok: [/\bwhat (are you|r you|you are) doing\b/], hint: 'What are you doing now?', ex: 'What are you doing now?', en: "I'm recording a video!", enPl: 'Nagrywam film!' },
      { pl: 'Powiedz, że jej filmy są lepsze niż telewizja.', ok: [/\byour (videos|films|vlogs|movies) are better than (the )?(tv|television)\b/], hint: 'Your videos are better than TV.', ex: 'Your videos are better than TV.', en: "Thank you! You're so kind!", enPl: 'Dziękuję! Jesteś bardzo miły!' },
    ] },
    { id: 'sam', name: 'Sam', role: 'taksówkarz', look: { hairStyle: 'short', hair: 0x9a9a9a, shirt: 0x222831, pants: 0x2d3a5a, hat: 'fedora', hatColor: 0x3a2f28 }, steps: [
      { pl: 'Dokąd jedziemy? Powiedz: „Na lotnisko, proszę".', ok: [/\b(to )?the airport,? please\b/, /\bairport,? please\b/, /\bi (want|need|would like|'d like) to go to the airport/, /\bto the airport\b/], hint: 'To the airport, please.', ex: 'To the airport, please.', en: 'No problem!', enPl: 'Nie ma problemu!' },
      { pl: 'Zapytaj, ile czasu zajmie jazda.', ok: [/\bhow long (will|does|is|would) (it|the journey|the trip|the ride|the drive)( take)?\b/, /\bhow long does it take\b/], hint: 'How long will it take?', ex: 'How long will it take?', en: 'About twenty minutes.', enPl: 'Około dwudziestu minut.' },
      { pl: 'Poproś, żeby jechał wolniej.', ok: [/\b(can|could) you (please )?(drive|go) (more )?slow(er|ly)\b/, /\bplease (drive|go) (more )?slow(er|ly)\b/, /\b(drive|go) (more )?slow(er|ly),? please\b/, /\bslow down,? please\b/, /\bplease slow down\b/, /\b(can|could) you (please )?slow down\b/], hint: 'Could you drive more slowly, please?', ex: 'Could you drive more slowly, please?', en: "Sorry! I'll slow down.", enPl: 'Przepraszam! Zwolnię.' },
    ] },
    { id: 'oliver', name: 'Oliver', role: 'sąsiad', look: { hairStyle: 'short', hair: 0x5a3a1e, shirt: 0x2e86de, pants: 0x5a4a3a, sleeves: 'long' }, steps: [
      { pl: 'Masz rodzeństwo?', ok: [new RegExp("\\bi( have|'ve|ve)( got)? (a|an|one|two|three|four|\\d+) (older |younger |little |big )?(brother|brothers|sister|sisters)"), /\bno,? i (don't|do not|dont) have (any )?(brothers|sisters|siblings)/, /\b(i'm|i am|im) an only child/, /\bi (haven't|have not) got (any )?(brothers|sisters|siblings)/], hint: "I have got a sister. / I'm an only child.", ex: 'I have got a brother.', en: 'Cool!', enPl: 'Super!' },
      { pl: 'Opisz mamę lub tatę — jaka/jaki jest? Np. „Moja mama jest miła".', ok: [/\b(my (mum|mom|mother|dad|father|mummy|daddy) is|she is|she's|he is|he's) (very |really |quite |so )?(tall|short|kind|funny|nice|friendly|clever|smart|beautiful|handsome|strict|young|old|happy|busy|great|helpful|patient|calm|cool)\b/], hint: 'My mum is kind.', ex: 'My mum is kind.', en: "That's lovely.", enPl: 'To miłe.' },
      { pl: 'Zapytaj go, ile osób jest w jego rodzinie.', ok: [/\bhow many people (are there )?(are )?in your family/, /\bhow many people do you have in your family/, /\bhow big is your family/], hint: 'How many people are there in your family?', ex: 'How many people are there in your family?', en: "Five! It's a big family.", enPl: 'Pięć! To duża rodzina.' },
    ] },
  ];
  window.NPC_NORM = s => String(s || '').toLowerCase().replace(/[’‘`´]/g, "'").replace(/[.,!?;:"„”()]/g, ' ').replace(/\s+/g, ' ').trim();
  window.NPC_CHECK = (step, answer) => {
    const a = window.NPC_NORM(answer);
    if (!a) return false;
    if (step.all) return step.all.every(r => r.test(a));
    return (step.ok || []).some(r => r.test(a));
  };
})();
