"""AGI Studio's meme fonts (2026-10-11): the six fonts the meme editor draws words with, and an emoji font, subset to what a
meme's words may use and saved as WOFF into public/fonts/meme/ (the page draws them with opentype.js, and our server draws the
same paths with sharp: src/studio/meme-layout.js). Each font is free: the SIL Open Font License (Anton, Bangers, Comic Neue,
Archivo Black, Noto Sans, Noto Emoji) or the Apache License 2.0 (Permanent Marker); their license files sit beside them.

Run (fonttools; the fonts from Google Fonts, here as the npm packages @expo-google-fonts/<family> 0.4.x, which ship them
unchanged):
    python3 tools/studio/meme-fonts.py <folder with node_modules/@expo-google-fonts>
A changed font gets a new file name (public/fonts is cached a year): raise VERSION, and MEME_FONTS in src/studio/memes.js.
"""
import sys, os
from fontTools import subset
from fontTools.ttLib import TTFont

VERSION = 'v1'
ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'fonts', 'meme')

# What a meme's words may use: Latin (with Vietnamese), Greek and Cyrillic letters, punctuation and a few signs. The display
# fonts only have Latin: anything else is drawn with Noto Sans Bold (the "Clean" font), letter by letter.
LATIN = [(0x20, 0x7E), (0xA0, 0x17F), (0x18F, 0x18F), (0x192, 0x192), (0x1A0, 0x1B0), (0x218, 0x21B), (0x237, 0x237),
         (0x2BC, 0x2BC), (0x2C6, 0x2C7), (0x2D8, 0x2DD), (0x300, 0x304), (0x306, 0x30C), (0x323, 0x323), (0x1E00, 0x1EFF),
         (0x2010, 0x2027), (0x2030, 0x203A), (0x2044, 0x2044), (0x2070, 0x2079), (0x20AC, 0x20AC), (0x2122, 0x2122),
         (0x2190, 0x2193), (0x2212, 0x2212)]
GREEK_CYRILLIC = [(0x370, 0x3FF), (0x400, 0x52F)]

FONTS = {
    'anton': ('anton/400Regular/Anton_400Regular.ttf', LATIN, 'Anton-OFL.txt'),
    'bangers': ('bangers/400Regular/Bangers_400Regular.ttf', LATIN, 'Bangers-OFL.txt'),
    'marker': ('permanent-marker/400Regular/PermanentMarker_400Regular.ttf', LATIN, 'PermanentMarker-Apache-2.0.txt'),
    'comicneue': ('comic-neue/700Bold/ComicNeue_700Bold.ttf', LATIN, 'ComicNeue-OFL.txt'),
    'archivo': ('archivo-black/400Regular/ArchivoBlack_400Regular.ttf', LATIN, 'ArchivoBlack-OFL.txt'),
    'notosans': ('noto-sans/800ExtraBold/NotoSans_800ExtraBold.ttf', LATIN + GREEK_CYRILLIC, 'NotoSans-OFL.txt'),
    'emoji': ('noto-emoji/700Bold/NotoEmoji_700Bold.ttf', None, 'NotoEmoji-OFL.txt'),
}

# The emoji a meme's words may use: everyday faces, hearts, hands and things (drawn in the words' own color). Never ones
# about money or with a crude meaning in posts (the words' rules: src/studio/memes.js); nor ZWJ sequences, skin tones or
# flags (a single emoji only).
EMOJI = (
    '😀😃😄😁😆😅🤣😂🙂🙃😉😊😇🥰😍🤩😘😗😚😙😋😛😜🤪😝🤗🤭🤫🤔🤐🤨😐😑😶😏😒🙄😬😌😔😪🤤😴😷🤒🤕🤢🤮🥵🥶🥴😵🤯🤠🥳'
    '😎🤓🧐😕😟🙁😮😯😲😳🥺😦😧😨😰😥😢😭😱😖😣😞😓😩😫🥱😤😡😠🤬😈💀☠👻👽🤖😺😸😹😻😼😽🙀😿😾🙈🙉🙊'
    '💋💌💘💝💖💗💓💞💕💟❣💔❤🧡💛💚💙💜🤎🖤🤍💯💢💥💫💭💤👋🤚✋🖖👌🤌🤏✌🤞🤟🤘🤙👈👉👆👇☝👍👎✊👊🤛🤜👏🙌👐🤲🤝🙏'
    '💪👀👁👅🧠🫶🙋🙆🙅🤷🤦🙇💃🕺👑🎉🎊🎈🎁🎂🍰🧁🍕🍔🍟🌮🍿🍩🍪🍫🍬🍭🍓🍉🍌🍍🥑☕🧋🥤🍵🔥✨⭐🌟💡⚡☀🌙🌈☁❄🌸🌹🌻🌺🌷'
    '🍀🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🐔🐧🐦🦄🐝🦋🐢🐍🐙🐬🐳🐟🦀📸📱💻⌚🎧🎮🎤🎵🎶📚✏📌📍🔒🔑⏰⏳⌛🛌🚗✈🏠🏖'
    '⚽🏀🏆🥇✅❌❓❗‼⁉💬🗯👉👈👀🎯🤡🧸🪩🫠🫡🫢🫣🥹🥲'
)

# Layout features a font keeps, unless it's named here. opentype.js 2.0.0 (the page's and our server's) can't apply
# Bangers' ccmp: a class-based chaining substitution (GSUB lookup type 6, format 2), so every word of two letters or more
# threw in it (2026-10-14). A meme's words are composed (NFKC: src/studio/memes.js), so ccmp has nothing to do there.
FEATURES = ['kern', 'liga', 'ccmp', 'mark', 'mkmk']
NOT_FEATURES = {'bangers': ['ccmp']}

def unicodes(ranges):
    out = []
    for a, b in ranges:
        out.extend(range(a, b + 1))
    return out

def main(src):
    os.makedirs(ROOT, exist_ok=True)
    for key, (rel, ranges, lic) in FONTS.items():
        path = os.path.join(src, 'node_modules', '@expo-google-fonts', rel)
        font = TTFont(path)
        cmap = font.getBestCmap()
        wanted = sorted({ord(c) for c in EMOJI if ord(c) > 0x7F} | {0x20}) if ranges is None else unicodes(ranges)
        have = [u for u in wanted if u in cmap]
        opts = subset.Options()
        opts.flavor = 'woff'
        opts.layout_features = [f for f in FEATURES if f not in NOT_FEATURES.get(key, [])]
        opts.hinting = False
        opts.desubroutinize = True
        opts.name_IDs = ['*']
        opts.name_languages = ['*']
        opts.notdef_outline = True
        opts.drop_tables += ['DSIG']
        s = subset.Subsetter(opts)
        s.populate(unicodes=have)
        s.subset(font)
        out = os.path.join(ROOT, f'{key}-{VERSION}.woff')
        font.flavor = 'woff'
        font.save(out)
        missing = [hex(u) for u in wanted if u not in cmap] if ranges is None else []
        print(f'{key}: {len(have)} characters, {os.path.getsize(out)} bytes' + (f' (not in the font: {missing})' if missing else ''))
        # its license, beside it
        pkg = os.path.join(src, 'node_modules', '@expo-google-fonts', rel.split('/')[0], 'LICENSE_FONT')
        with open(pkg, 'rb') as f, open(os.path.join(ROOT, lic), 'wb') as g:
            g.write(f.read())

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '.')
