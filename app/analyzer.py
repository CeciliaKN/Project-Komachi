"""
MeCab解析モジュール - fugashiを用いた日本語分かち書きと意味解析
"""
import os
import re
from typing import List, Dict, Any, Optional
from fugashi import GenericTagger

# プロジェクトルートディレクトリ
PROJECT_ROOT = os.path.dirname(os.path.dirname(__file__))

# デフォルト設定
DEFAULT_MECABRC = os.path.join(PROJECT_ROOT, "mecab", "mecabrc")
DEFAULT_DICTIONARY_DIR = os.path.join(PROJECT_ROOT, "mecab", "dic")

# 利用可能な辞書リスト
AVAILABLE_DICTIONARIES = {

    "unidic-chuko": {
        "name": "UniDic 中古",
        "description": "中古日本語辞書（平安時代）",
        "path": "unidic-chuko"
    },
    "unidic-kindaibungo": {
        "name": "UniDic 近代文語",
        "description": "近代文語辞書（明治～昭和）",
        "path": "unidic-kindaibungo"
    },
    "unidic-waka": {
        "name": "UniDic 和歌",
        "description": "和歌専用辞書",
        "path": "unidic-waka"
    }
}

# UniDic特徴フィールド説明 (中古/近世語用)
UNIDIC_FEATURE_LABELS = {
    0: "品詞大分類",      # 品詞
    1: "品詞中分類",      # 品詞細分
    2: "品詞小分類",      # 品詞さらに細分
    3: "品詞細分類",      # 品詞最細分
    4: "活用型",          # 活用タイプ
    5: "活用形",          # 活用形
    6: "読み（現代）",     # 現代読み
    7: "書字形（現代）",   # 現代書字形
    8: "発音形（基本形）",  # 発音形
    9: "書字形（基本形）",  # 書字形
    10: "語形（基本形）",   # 語形
    11: "仮名（基本形）",   # 仮名
    12: "語種",            # 語種（和語/漢語/外来語）
    13: "語頭変化型",      # 語頭変化
    14: "語頭変化形",      # 語頭変化形
    15: "語末変化型",      # 語末変化
    16: "語末変化形",      # 語末変化形
    17: "キレコト",        # 切れ事
    18: "語彙素読み",      # 語彙素読み
    19: "用言/体言",       # 用言/体言区分
    20: "語彙素細分類",    # 語彙素細分類
}

# 品詞カラーマッピング（フロントエンドのハイライト用）
POS_COLORS = {
    "名詞": "#4A90D9",       # 青
    "動詞": "#E74C3C",       # 赤
    "形容詞": "#27AE60",     # 緑
    "形状詞": "#2ECC71",     # 淡緑
    "副詞": "#9B59B6",       # 紫
    "連体詞": "#F39C12",     # オレンジ
    "接続詞": "#1ABC9C",     # シアン
    "感動詞": "#E91E63",     # ピンク
    "助詞": "#95A5A6",       # グレー
    "助動詞": "#7F8C8D",     # 濃いグレー
    "接頭辞": "#3498DB",     # 淡青
    "接尾辞": "#2980B9",     # 濃青
    "記号": "#BDC3C7",       # 淡いグレー
    "補助記号": "#BDC3C7",   # 淡いグレー
    "空白": "#ECF0F1",       # 白グレー
}

# グローバルtaggerキャッシュ
_tagger_cache: Dict[str, GenericTagger] = {}


def get_tagger(dictionary: str = "unidic-chuko") -> GenericTagger:
    """既存または新規のMeCab taggerインスタンスを取得"""
    if dictionary in _tagger_cache:
        return _tagger_cache[dictionary]
    
    if dictionary not in AVAILABLE_DICTIONARIES:
        raise ValueError(f"不明な辞書: {dictionary}. 利用可能な辞書: {list(AVAILABLE_DICTIONARIES.keys())}")
    
    dict_path = os.path.join(DEFAULT_DICTIONARY_DIR, AVAILABLE_DICTIONARIES[dictionary]["path"])
    
    if not os.path.exists(dict_path):
        raise FileNotFoundError(f"辞書パスが存在しません: {dict_path}")
    
    # MeCabパラメータを構築
    mecab_args = f'-r "{DEFAULT_MECABRC}" -d "{dict_path}"'
    
    tagger = GenericTagger(mecab_args)
    _tagger_cache[dictionary] = tagger
    
    return tagger


def split_paragraphs(text: str) -> List[str]:
    """
    テキストを段落に分割
    複数の改行形式と日本語特有の段落分けに対応
    """
    # 改行コードを統一
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    
    # 空行または複数の改行で分割
    paragraphs = re.split(r'\n\s*\n|\n{2,}', text)
    
    # 空の段落を除外し、前後の空白を削除
    paragraphs = [p.strip() for p in paragraphs if p.strip()]
    
    # 段落がない場合、全体を1つの段落として扱う
    if not paragraphs and text.strip():
        paragraphs = [text.strip()]
    
    return paragraphs


def analyze_text(text: str, dictionary: str = "unidic-chuko") -> List[Dict[str, Any]]:
    """
    テキストを解析し、段落とトークンの解析結果を返す
    """
    tagger = get_tagger(dictionary)
    paragraphs = split_paragraphs(text)
    
    results = []
    
    for para_content in paragraphs:
        tokens = []
        
        for word in tagger(para_content):
            # 全ての特徴を取得
            features = []
            
            # fugashiのfeatureはタプルまたはNamedTupleとして取得
            if hasattr(word, 'feature') and word.feature:
                # タプルとして直接アクセス
                if hasattr(word.feature, '__iter__'):
                    feature_tuple = tuple(word.feature) if not isinstance(word.feature, tuple) else word.feature
                    for i in range(25):  # UniDicは通常20以上のフィールドを持つ
                        if i < len(feature_tuple):
                            val = feature_tuple[i]
                            # Noneや空文字列を適切に処理
                            features.append(str(val) if val is not None else "")
                        else:
                            features.append("")
                else:
                    # 文字列として返された場合のフォールバック
                    feature_raw = str(word.feature).split(',')
                    for i in range(25):
                        if i < len(feature_raw):
                            # 引号と括弧を削除
                            val = feature_raw[i].strip().strip("('").strip("')")
                            features.append(val)
                        else:
                            features.append("")
            else:
                features = [""] * 25
            
            token_data = {
                "surface": word.surface,  # 表層形
                "features": features,
                "pos": features[0] if features else "",  # 品詞
                "pos_detail": features[1] if len(features) > 1 else "",  # 品詞細分
                "conjugation_type": features[4] if len(features) > 4 else "",  # 活用型
                "conjugation_form": features[5] if len(features) > 5 else "",  # 活用形
                "reading": features[8] if len(features) > 8 else "",  # 読み
                "base_form": features[9] if len(features) > 9 else "",  # 基本形
                "kana": features[11] if len(features) > 11 else "",  # 仮名
                "origin": features[12] if len(features) > 12 else "",  # 語種
                "taigen_yougen": features[19] if len(features) > 19 else "",  # 体言/用言
                "color": POS_COLORS.get(features[0], "#333333") if features else "#333333"
            }
            
            tokens.append(token_data)
        
        results.append({
            "content": para_content,
            "tokens": tokens
        })
    
    return results


def get_token_details(features: List[str], dictionary: str = "unidic-chuko") -> Dict[str, str]:
    """
    トークンの詳細情報をラベル付きで取得
    """
    details = {}
    
    # 辞書タイプに応じたラベルを選択
    labels = UNIDIC_FEATURE_LABELS
    
    for i, feature in enumerate(features):
        if feature and feature != "*":  # 空値とアスタリスクを無視
            label = labels.get(i, f"特徴{i}")
            details[label] = feature
    
    return details


def get_available_dictionaries() -> Dict[str, Dict[str, str]]:
    """利用可能な辞書リストを取得"""
    available = {}
    
    for key, info in AVAILABLE_DICTIONARIES.items():
        dict_path = os.path.join(DEFAULT_DICTIONARY_DIR, info["path"])
        if os.path.exists(dict_path):
            available[key] = info
    
    return available


def get_pos_color(pos: str) -> str:
    """品詞に対応する色を取得"""
    return POS_COLORS.get(pos, "#333333")
