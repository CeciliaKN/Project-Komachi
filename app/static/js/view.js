/**
 * Project Komachi - 文書ビュー ページ
 */

// 品詞カラー
const posColors = {
    "名詞": "#4A90D9",
    "動詞": "#E74C3C",
    "形容詞": "#27AE60",
    "形状詞": "#2ECC71",
    "副詞": "#9B59B6",
    "連体詞": "#F39C12",
    "接続詞": "#1ABC9C",
    "感動詞": "#E91E63",
    "助詞": "#95A5A6",
    "助動詞": "#7F8C8D",
    "接頭辞": "#3498DB",
    "接尾辞": "#2980B9",
    "記号": "#BDC3C7",
    "補助記号": "#BDC3C7",
    "空白": "#ECF0F1"
};

// 特徴ラベルマッピング
const featureLabels = {
    0: "品詞大分類",
    1: "品詞中分類",
    2: "品詞小分類",
    3: "品詞細分類",
    4: "活用型",
    5: "活用形",
    6: "読み（現代）",
    7: "書字形（現代）",
    8: "書字形",
    9: "発音形書字形",
    10: "語形",
    11: "仮名",
    12: "語種",
    13: "語頭変化型",
    14: "語頭変化形",
    15: "語末変化型",
    16: "語末変化形",
    17: "キレコト",
    18: "語彙素読み",
    19: "用言/体言",
    20: "語彙素細分類"
};

// 状態
let colorEnabled = false;
let selectedToken = null;

// DOM 要素
const detailContent = document.getElementById('detail-content');
const colorToggle = document.getElementById('color-toggle');

// 初期化
document.addEventListener('DOMContentLoaded', init);

function init() {
    // トークンの下線色を設定
    document.querySelectorAll('.token').forEach(token => {
        const featuresStr = decodeHtmlEntities(token.dataset.features || '[]');
        const features = JSON.parse(featuresStr);
        const posValue = cleanFeatureValue(features[0]);
        const color = posColors[posValue] || '#333333';
        token.style.borderBottom = `2px solid ${color}`;
        token.dataset.color = color;
        
        // クリックイベント
        token.addEventListener('click', () => handleTokenClick(token, features));
    });
    
    // カラートグル
    colorToggle.addEventListener('change', (e) => {
        colorEnabled = e.target.checked;
        if (!colorEnabled) {
            clearSentenceColors();
        } else if (selectedToken) {
            highlightSentence(selectedToken);
        }
    });
}

function decodeHtmlEntities(str) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = str;
    return textarea.value;
}

function handleTokenClick(tokenEl, features) {
    // 前の選択を解除
    document.querySelectorAll('.token.selected').forEach(el => {
        el.classList.remove('selected');
    });
    
    // 選択状態を設定
    tokenEl.classList.add('selected');
    selectedToken = tokenEl;
    
    // カラー表示が有効なら文をハイライト
    if (colorEnabled) {
        highlightSentence(tokenEl);
    }
    
    // 詳細を表示
    showTokenDetail(tokenEl, features);
}

// 句読点
const sentenceDelimiters = ['。', '、', '！', '？', '\n'];

function highlightSentence(clickedToken) {
    clearSentenceColors();
    
    const paragraph = clickedToken.closest('.paragraph-content');
    const tokens = Array.from(paragraph.querySelectorAll('.token'));
    const tokenIdx = tokens.indexOf(clickedToken);
    
    // 前の句読点を探す
    let startIdx = tokenIdx;
    for (let i = tokenIdx - 1; i >= 0; i--) {
        const surface = tokens[i].dataset.surface;
        if (sentenceDelimiters.some(d => surface.includes(d))) {
            startIdx = i + 1;
            break;
        }
        if (i === 0) startIdx = 0;
    }
    
    // 次の句読点を探す
    let endIdx = tokenIdx;
    for (let i = tokenIdx; i < tokens.length; i++) {
        const surface = tokens[i].dataset.surface;
        if (sentenceDelimiters.some(d => surface.includes(d))) {
            endIdx = i;
            break;
        }
        if (i === tokens.length - 1) endIdx = i;
    }
    
    // カラーを適用
    for (let i = startIdx; i <= endIdx; i++) {
        tokens[i].classList.add('color-active');
    }
}

function clearSentenceColors() {
    document.querySelectorAll('.token.color-active').forEach(el => {
        el.classList.remove('color-active');
    });
}

function showTokenDetail(tokenEl, features) {
    const surface = tokenEl.dataset.surface;
    const posValue = cleanFeatureValue(features[0]);
    const color = posColors[posValue] || '#333333';
    
    let html = `<div class="detail-surface">${escapeHtml(surface)}</div>`;
    html += `<div class="detail-pos" style="background:${color}">${escapeHtml(posValue || '不明')}</div>`;
    html += `<table class="detail-table">`;
    
    // 主要な特徴
    const importantFeatures = [
        [0, "品詞"],
        [1, "品詞細分"],
        [4, "活用型"],
        [5, "活用形"],
        [7, "書字形（現代）"],
        [9, "発音"],
        [10, "語形"],
        [19, "体言/用言"]
    ];
    
    importantFeatures.forEach(([idx, label]) => {
        const value = features[idx];
        if (value && value !== '*' && value !== '') {
            const cleanedValue = cleanFeatureValue(value);
            if (cleanedValue && cleanedValue !== '*') {
                html += `<tr><th>${label}</th><td>${escapeHtml(cleanedValue)}</td></tr>`;
            }
        }
    });
    
    html += `</table>`;
    
    // 全ての特徴
    html += `<details style="margin-top:1rem;"><summary style="cursor:pointer;color:#8B4513;">全ての特徴</summary>`;
    html += `<table class="detail-table" style="margin-top:0.5rem;">`;
    
    features.forEach((feature, idx) => {
        if (feature && feature !== '*' && feature !== '') {
            const cleanedFeature = cleanFeatureValue(feature);
            if (cleanedFeature && cleanedFeature !== '*') {
                const label = featureLabels[idx] || `特徴${idx}`;
                html += `<tr><th>${label}</th><td>${escapeHtml(cleanedFeature)}</td></tr>`;
            }
        }
    });
    
    html += `</table></details>`;
    
    detailContent.innerHTML = html;
}

// ===== ユーティリティ =====
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function cleanFeatureValue(value) {
    if (!value) return '';
    let cleaned = value.toString().trim();
    cleaned = cleaned.replace(/^\(?['"]|['"]\)?$/g, '');
    cleaned = cleaned.replace(/^['"]|['"]$/g, '');
    return cleaned;
}
