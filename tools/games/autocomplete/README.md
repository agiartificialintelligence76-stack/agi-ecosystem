# AUTOCOMPLETE's dictionary

`build-words.mjs` makes the two files the game loads from `public/games/autocomplete/`:

- `words.bin`: every word the game accepts (170,865 words of 3 to 15 letters, a–z only), as a packed word graph
  (DAWG, 123,389 32-bit edges, 494 KB, about 335 KB gzipped). Its format is described in `src/games/autocomplete/dict.js`.
- `common.txt`: AGI-1's vocabulary, what she predicts and hints (42,648 words, most likely first; 156 KB gzipped).

## Sources and licenses

| Source | What it gives | License |
|---|---|---|
| **ENABLE** (Enhanced North American Benchmark Lexicon, M. Cooper and A. Beale), `enable1.txt` as copied in github.com/dolph/dictionary (sha256 `3f161302…`) | the main accept list | Public domain |
| **SCOWL** (Spell Checker Oriented Word Lists, Kevin Atkinson), via the npm package `wordlist-english` 1.2.1 | British and other spellings and newer words (sizes up to 60, every dialect); her vocabulary and its order (English and American, sizes 10, 20, 35, 40) | SCOWL's permissive license (copyright Kevin Atkinson; use, copy, modify, distribute and sell without fee, the notice kept); the package is MIT |
| **Project Gutenberg selections** (NLTK's `gutenberg` corpus: Austen, Carroll, Chesterton, Melville, Shakespeare, Whitman…, the King James Bible counted at a third) | how often a word appears, to order her vocabulary inside a SCOWL size | Public-domain texts (only word counts are used) |
| **List of Dirty, Naughty, Obscene, and Otherwise Bad Words** (npm `naughty-words` 1.2.0), `badwords-list` 2.0.1-4, `profane-words` 2.1.0 | words to review and block | CC BY 4.0, MIT, WTFPL |

How to play credits it: "Word list: ENABLE (public domain) and SCOWL by Kevin Atkinson, filtered for a family arcade."

## The rules (PG-13)

- `blocked.rot13.txt`: words never accepted, predicted or hinted (profanity, slurs, sexual and hateful words, with
  their forms), ROT13-encoded so the repository holds none of them in plain text. Rules: `word`, `word+` (its regular
  forms), `word*` (every word starting with it), `*word*` (every word containing it), `!word` (never caught).
- `allowed.txt`: words an outside list names that were reviewed and kept (ordinary English: a tool, a plant, a sport…).
  The build stops when a list names an accepted word that's in neither file, so a new list version is always reviewed.
- `quiet.txt`: accepted words AGI-1 never suggests (money talk, violence, drugs, insults, words about bodies, identity,
  religion or politics that could read as a taunt).

## Rebuilding

Get the sources into a scratch folder (never into the repository), then:

```sh
npm pack wordlist-english@1.2.1 naughty-words@1.2.0 badwords-list@2.0.1-4 profane-words@2.1.0   # then untar each
node tools/games/autocomplete/build-words.mjs --enable <enable1.txt> --scowl <wordlist-english/package> \
  --ldnoobw <naughty-words/package/en.json> --badwords <badwords-list/package/dist/array.js> \
  --profane <profane-words/package/words.json> --gutenberg <nltk gutenberg folder>
```

`--check` reports without writing. `tests/autocomplete.test.js` checks the shipped files (sorted, unique, a–z, 3–15
letters, the sizes, blocked examples absent, innocent look-alikes kept, her vocabulary free of money words).
