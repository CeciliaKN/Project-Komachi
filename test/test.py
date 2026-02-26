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
    # 这里只限于这个词典的性质。
    # surface词本身，0词性，1词的类型，1-3词可能的tag，4动词的类型，5动词变位，
    # 6现代基本形读法，7现代基本形汉字化，8-9本词的汉字及读法，10-11古文基本形汉字及读法，
    # 12是本土词还是外来词， 13-18是其它tag，19是体言用言等区分，20以后平时用不到。

