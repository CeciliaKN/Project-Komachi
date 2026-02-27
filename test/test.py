from fugashi import GenericTagger
tagger = GenericTagger(
    r'-r "F:/Cecilia Ni/github/Project-Komachi/mecab/mecabrc" ' # you can change it.
    r'-d "F:/Cecilia Ni/github/Project-Komachi/mecab/dic/unidic-chuko"' # you can change it too.
)

text = "行く川のながれは絶えずして、しかも本の水にあらず。" # from Houjouki

tagger.parse(text)
# features from the dictionary can be accessed by field numbers
for word in tagger(text):
    print(word.surface, word.feature[0], word.feature[1], word.feature[4], word.feature[5], word.feature[8], word.feature[9], word.feature[10], word.feature[11], word.feature[12],  word.feature[19])
    # この辞書の特性に限定されます。
    # surface: 語そのもの、0: 品詞、1: 品詞タイプ、1-3: 可能なタグ、4: 動詞タイプ、5: 活用形、
    # 6: 現代基本形読み、7: 現代基本形漢字、8-9: 本語の漢字と読み、10-11: 古文基本形漢字と読み、
    # 12: 和語か外来語か、13-18: その他のタグ、19: 体言/用言の区分、20以降は通常使用しない。

