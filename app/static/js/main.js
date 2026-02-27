/**
 * Project Komachi - フロントエンドインタラクションロジック
 */

// DOM要素
const elements = {
    fileInput: document.getElementById('file-input'),
    uploadArea: document.getElementById('upload-area'),
    docTitle: document.getElementById('doc-title'),
    dictionarySelect: document.getElementById('dictionary-select'),
    textInput: document.getElementById('text-input'),
    btnAnalyze: document.getElementById('btn-analyze'),
    btnNew: document.getElementById('btn-new'),
    btnHistory: document.getElementById('btn-history'),
    resultContainer: document.getElementById('result-container'),
    resultTitle: document.getElementById('result-title'),
    resultInfo: document.getElementById('result-info'),
    detailContent: document.getElementById('detail-content'),
    historyModal: document.getElementById('history-modal'),
    modalClose: document.getElementById('modal-close'),
    documentList: document.getElementById('document-list'),
    loading: document.getElementById('loading'),
    colorToggle: document.getElementById('color-toggle')
};

// 現在のドキュメントデータ
let currentDocument = null;
let selectedToken = null;
let colorEnabled = false;  // カラー表示状態

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

// ===== 初期化 =====
document.addEventListener('DOMContentLoaded', init);

function init() {
    // イベントをバインド
    elements.uploadArea.addEventListener('click', () => elements.fileInput.click());
    elements.uploadArea.addEventListener('dragover', handleDragOver);
    elements.uploadArea.addEventListener('dragleave', handleDragLeave);
    elements.uploadArea.addEventListener('drop', handleDrop);
    elements.fileInput.addEventListener('change', handleFileSelect);
    
    elements.btnAnalyze.addEventListener('click', analyzeText);
    elements.btnNew.addEventListener('click', resetForm);
    elements.btnHistory.addEventListener('click', showHistoryModal);
    elements.modalClose.addEventListener('click', hideHistoryModal);
    elements.historyModal.addEventListener('click', (e) => {
        if (e.target === elements.historyModal) hideHistoryModal();
    });
    
    // ショートカットキー
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            analyzeText();
        }
        if (e.key === 'Escape') {
            hideHistoryModal();
        }
    });
    
    // カラートグル
    elements.colorToggle.addEventListener('change', (e) => {
        colorEnabled = e.target.checked;
        if (!colorEnabled) {
            // カラーを無効にした場合、全てのカラー表示をクリア
            clearSentenceColors();
        } else if (selectedToken) {
            // カラーを有効にし、既に選択されたトークンがある場合、その文をハイライト
            const selectedEl = document.querySelector('.token.selected');
            if (selectedEl) {
                highlightSentence(selectedEl);
            }
        }
    });
}

// ===== ファイルアップロード =====
function handleDragOver(e) {
    e.preventDefault();
    elements.uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    elements.uploadArea.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    elements.uploadArea.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        uploadFile(files[0]);
    }
}

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        uploadFile(files[0]);
    }
}

async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    showLoading();
    
    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            elements.docTitle.value = data.title;
            elements.textInput.value = data.content;
        } else {
            alert('アップロード失敗: ' + data.error);
        }
    } catch (error) {
        alert('アップロードエラー: ' + error.message);
    } finally {
        hideLoading();
    }
}

// ===== テキスト解析 =====
async function analyzeText() {
    const text = elements.textInput.value.trim();
    if (!text) {
        alert('解析するテキストを入力してください');
        return;
    }
    
    const title = elements.docTitle.value.trim() || '名称未設定';
    const dictionary = elements.dictionarySelect.value;
    
    showLoading();
    
    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text, title, dictionary })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentDocument = data.document;
            renderResult(data.document, data.cached);
            updateDocumentList();
        } else {
            alert('解析失敗: ' + data.error);
        }
    } catch (error) {
        alert('解析エラー: ' + error.message);
    } finally {
        hideLoading();
    }
}

// ===== 結果をレンダリング =====
function renderResult(docData, cached) {
    elements.resultTitle.textContent = docData.title;
    
    const info = [];
    info.push(docData.dictionary);
    info.push(`${docData.paragraphs.length}段`);
    if (cached) info.push('(キャッシュ)');
    elements.resultInfo.textContent = info.join(' · ');
    
    let html = '';
    
    docData.paragraphs.forEach((para, paraIdx) => {
        html += `<div class="paragraph" data-para="${paraIdx}">`;
        html += `<div class="paragraph-index">第${paraIdx + 1}段</div>`;
        html += `<div class="paragraph-content">`;
        
        para.tokens.forEach((token, tokenIdx) => {
            const posValue = cleanFeatureValue(token.features[0]);
            const color = posColors[posValue] || '#333333';
            // デフォルトで下線を表示、data-colorに色を保存
            html += `<span class="token" 
                          data-para="${paraIdx}" 
                          data-token="${tokenIdx}"
                          data-color="${color}"
                          data-surface="${escapeHtml(token.surface)}"
                          style="border-bottom: 2px solid ${color};">`;
            html += escapeHtml(token.surface);
            html += `</span>`;
        });
        
        html += `</div></div>`;
    });
    
    elements.resultContainer.innerHTML = html;
    
    // トークンクリックイベントをバインド
    document.querySelectorAll('.token').forEach(el => {
        el.addEventListener('click', handleTokenClick);
    });
    
    // 詳細パネルをリセット
    resetDetailPanel();
}

function handleTokenClick(e) {
    const paraIdx = parseInt(e.target.dataset.para);
    const tokenIdx = parseInt(e.target.dataset.token);
    
    // 前の選択状態を削除
    document.querySelectorAll('.token.selected').forEach(el => {
        el.classList.remove('selected');
    });
    
    // 選択状態を追加
    e.target.classList.add('selected');
    
    // カラー表示が有効なら、文をハイライト
    if (colorEnabled) {
        highlightSentence(e.target);
    }
    
    // トークンデータを取得
    const token = currentDocument.paragraphs[paraIdx].tokens[tokenIdx];
    showTokenDetail(token);
}

// 文節区切り文字（句読点）
const sentenceDelimiters = ['。', '、', '！', '？', '\n'];

function highlightSentence(clickedToken) {
    // まず全てのカラーをクリア
    clearSentenceColors();
    
    const paraIdx = parseInt(clickedToken.dataset.para);
    const tokenIdx = parseInt(clickedToken.dataset.token);
    const paragraph = clickedToken.closest('.paragraph-content');
    const tokens = Array.from(paragraph.querySelectorAll('.token'));
    
    // 前の句読点を探す（後ろ向き）
    let startIdx = tokenIdx;
    for (let i = tokenIdx - 1; i >= 0; i--) {
        const surface = tokens[i].dataset.surface || tokens[i].textContent;
        if (sentenceDelimiters.some(d => surface.includes(d))) {
            startIdx = i + 1;
            break;
        }
        if (i === 0) startIdx = 0;
    }
    
    // 次の句読点を探す（前向き）
    let endIdx = tokenIdx;
    for (let i = tokenIdx; i < tokens.length; i++) {
        const surface = tokens[i].dataset.surface || tokens[i].textContent;
        if (sentenceDelimiters.some(d => surface.includes(d))) {
            endIdx = i;
            break;
        }
        if (i === tokens.length - 1) endIdx = i;
    }
    
    // 該当範囲のトークンにカラーを適用（高亮効果）
    for (let i = startIdx; i <= endIdx; i++) {
        const token = tokens[i];
        token.classList.add('color-active');
    }
}

function clearSentenceColors() {
    document.querySelectorAll('.token.color-active').forEach(el => {
        el.classList.remove('color-active');
    });
}

function showTokenDetail(token) {
    selectedToken = token;
    
    const posValue = cleanFeatureValue(token.features[0]);
    const color = posColors[posValue] || '#333333';
    
    let html = `<div class="detail-surface">${escapeHtml(token.surface)}</div>`;
    html += `<div class="detail-pos" style="background:${color}">${escapeHtml(posValue || '不明')}</div>`;
    html += `<table class="detail-table">`;
    
    // 主要な特徴を表示
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
        const value = token.features[idx];
        if (value && value !== '*' && value !== '') {
            const cleanedValue = cleanFeatureValue(value);
            if (cleanedValue && cleanedValue !== '*') {
                html += `<tr><th>${label}</th><td>${escapeHtml(cleanedValue)}</td></tr>`;
            }
        }
    });
    
    html += `</table>`;
    
    // 全ての特徴を表示（展開可能）
    html += `<details style="margin-top:1rem;"><summary style="cursor:pointer;color:#8B4513;">全ての特徴</summary>`;
    html += `<table class="detail-table" style="margin-top:0.5rem;">`;
    
    token.features.forEach((feature, idx) => {
        if (feature && feature !== '*' && feature !== '') {
            const cleanedFeature = cleanFeatureValue(feature);
            if (cleanedFeature && cleanedFeature !== '*') {
                const label = featureLabels[idx] || `特徴${idx}`;
                html += `<tr><th>${label}</th><td>${escapeHtml(cleanedFeature)}</td></tr>`;
            }
        }
    });
    
    html += `</table></details>`;
    
    elements.detailContent.innerHTML = html;
}

function resetDetailPanel() {
    elements.detailContent.innerHTML = '<p class="hint">文中の語句をクリックして詳細を確認</p>';
    selectedToken = null;
}

// ===== 履歴 =====
function showHistoryModal() {
    elements.historyModal.classList.add('active');
    updateDocumentList();
}

function hideHistoryModal() {
    elements.historyModal.classList.remove('active');
}

async function updateDocumentList() {
    try {
        const response = await fetch('/api/documents');
        const data = await response.json();
        
        let html = '';
        
        if (data.documents && data.documents.length > 0) {
            data.documents.forEach(doc => {
                html += `<div class="document-item" data-id="${doc.id}">
                    <div class="doc-info">
                        <h3 class="doc-title">${escapeHtml(doc.title)}</h3>
                        <p class="doc-meta">${escapeHtml(doc.dictionary)} · ${doc.paragraph_count}段 · ${doc.created_at}</p>
                    </div>
                    <div class="doc-actions">
                        <button class="btn-load" onclick="loadDocument(${doc.id})">読み込み</button>
                        <button class="btn-delete" onclick="deleteDocument(${doc.id})">削除</button>
                    </div>
                </div>`;
            });
        } else {
            html = '<p class="no-documents">履歴がありません</p>';
        }
        
        elements.documentList.innerHTML = html;
    } catch (error) {
        console.error('ドキュメント一覧の取得に失敗:', error);
    }
}

async function loadDocument(docId) {
    showLoading();
    
    try {
        const response = await fetch(`/api/documents/${docId}`);
        const data = await response.json();
        
        if (data.document) {
            currentDocument = data.document;
            elements.docTitle.value = data.document.title;
            elements.textInput.value = data.document.content;
            elements.dictionarySelect.value = data.document.dictionary;
            
            renderResult(data.document, true);
            hideHistoryModal();
        } else {
            alert('読み込み失敗: ドキュメントが存在しません');
        }
    } catch (error) {
        alert('読み込みエラー: ' + error.message);
    } finally {
        hideLoading();
    }
}

async function deleteDocument(docId) {
    if (!confirm('このドキュメントを削除してもよろしいですか？')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/documents/${docId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            updateDocumentList();
            
            // 削除したのが現在のドキュメントの場合、表示をクリア
            if (currentDocument && currentDocument.id === docId) {
                resetForm();
            }
        } else {
            alert('削除に失敗しました');
        }
    } catch (error) {
        alert('削除エラー: ' + error.message);
    }
}

// ===== ユーティリティ関数 =====
function resetForm() {
    elements.docTitle.value = '';
    elements.textInput.value = '';
    elements.dictionarySelect.selectedIndex = 0;
    elements.resultContainer.innerHTML = `
        <div class="placeholder">
            <span class="placeholder-icon">文</span>
            <p>テキストを入力して「解析開始」をクリック</p>
        </div>
    `;
    elements.resultTitle.textContent = '解析結果';
    elements.resultInfo.textContent = '';
    resetDetailPanel();
    currentDocument = null;
}

function showLoading() {
    elements.loading.classList.add('active');
}

function hideLoading() {
    elements.loading.classList.remove('active');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 引号や括弧をクリーンアップ
function cleanFeatureValue(value) {
    if (!value) return '';
    // 先頭と末尾の引号、括弧を削除
    let cleaned = value.toString().trim();
    // Pythonタプル形式の先頭 ('value や ("value
    cleaned = cleaned.replace(/^\(?['"]|['"]\)?$/g, '');
    // 単純な先頭/末尾の引号
    cleaned = cleaned.replace(/^['"]|['"]$/g, '');
    return cleaned;
}

// グローバル関数をHTMLから呼び出し可能にする
window.loadDocument = loadDocument;
window.deleteDocument = deleteDocument;
