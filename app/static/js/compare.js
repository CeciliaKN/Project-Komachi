/**
 * Project Komachi - 文書比較機能
 */

// 选中的文档
let selectedDocuments = [];
let documentsData = {};
let colorsEnabled = false;

// DOM 元素
const elements = {
    docSelect: document.getElementById('doc-select'),
    btnAddDoc: document.getElementById('btn-add-doc'),
    selectedDocs: document.getElementById('selected-docs'),
    comparePanels: document.getElementById('compare-panels'),
    detailSidebar: document.getElementById('detail-sidebar'),
    detailContent: document.getElementById('detail-content'),
    toggleColors: document.getElementById('toggle-colors'),
};

// 特征标签映射
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

// ===== 初期化 =====
document.addEventListener('DOMContentLoaded', init);

function init() {
    // 添加文档按钮
    elements.btnAddDoc.addEventListener('click', addSelectedDocument);
    
    // 视图切换
    document.querySelectorAll('.view-toggle button').forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
    });
    
    // 颜色切换
    elements.toggleColors.addEventListener('change', (e) => {
        colorsEnabled = e.target.checked;
        updateColorsDisplay();
    });
    
    // URL 参数处理（预选文档）
    const urlParams = new URLSearchParams(window.location.search);
    const docIds = urlParams.get('docs');
    if (docIds) {
        docIds.split(',').forEach(id => {
            const option = elements.docSelect.querySelector(`option[value="${id}"]`);
            if (option) {
                addDocument(id, option.dataset.title);
            }
        });
    }
}

// ===== 添加文档 =====
function addSelectedDocument() {
    const docId = elements.docSelect.value;
    if (!docId) {
        alert('文書を選択してください');
        return;
    }
    
    if (selectedDocuments.includes(docId)) {
        alert('この文書は既に追加されています');
        return;
    }
    
    if (selectedDocuments.length >= 4) {
        alert('最大4つまで比較できます');
        return;
    }
    
    const option = elements.docSelect.querySelector(`option[value="${docId}"]`);
    addDocument(docId, option.dataset.title);
}

async function addDocument(docId, title) {
    selectedDocuments.push(docId);
    
    // 更新选中文档显示
    updateSelectedDocsDisplay();
    
    // 加载文档数据
    await loadDocument(docId);
    
    // 更新比较面板
    renderComparePanels();
}

function removeDocument(docId) {
    selectedDocuments = selectedDocuments.filter(id => id !== docId);
    delete documentsData[docId];
    
    updateSelectedDocsDisplay();
    renderComparePanels();
}

function updateSelectedDocsDisplay() {
    elements.selectedDocs.innerHTML = selectedDocuments.map(docId => {
        const doc = documentsData[docId];
        const title = doc ? doc.title : `文書 ${docId}`;
        return `
            <span class="selected-doc-tag">
                ${escapeHtml(title)}
                <span class="remove" data-id="${docId}">&times;</span>
            </span>
        `;
    }).join('');
    
    // 删除事件
    elements.selectedDocs.querySelectorAll('.remove').forEach(btn => {
        btn.addEventListener('click', () => removeDocument(btn.dataset.id));
    });
}

// ===== 加载文档数据 =====
async function loadDocument(docId) {
    try {
        const response = await fetch(`/api/library/documents/${docId}`);
        const data = await response.json();
        
        if (data.document) {
            documentsData[docId] = data.document;
        }
    } catch (error) {
        console.error('文書の読み込みに失敗:', error);
    }
}

// ===== 渲染比较面板 =====
function renderComparePanels() {
    if (selectedDocuments.length === 0) {
        elements.comparePanels.innerHTML = `
            <div class="empty-panel">
                <div class="icon">選択</div>
                <h3>文書を選択してください</h3>
                <p>上の選択メニューから比較したい文書を追加してください。<br>最大4つまで同時に比較できます。</p>
            </div>
        `;
        elements.detailSidebar.style.display = 'none';
        return;
    }
    
    elements.detailSidebar.style.display = 'block';
    
    const panels = selectedDocuments.map(docId => {
        const doc = documentsData[docId];
        if (!doc) return '';
        
        return `
            <div class="compare-panel ${colorsEnabled ? 'colored' : ''}" data-doc-id="${docId}">
                <div class="panel-header">
                    <h3>${escapeHtml(doc.title)}</h3>
                    <div class="panel-meta">
                        <span>${doc.dictionary}</span>
                        <span>${doc.paragraph_count}段落</span>
                        <span>${doc.token_count}語句</span>
                    </div>
                    ${doc.tags && doc.tags.length > 0 ? `
                    <div class="panel-tags">
                        ${doc.tags.map(tag => `<span class="panel-tag">${escapeHtml(tag.name)}</span>`).join('')}
                    </div>
                    ` : ''}
                </div>
                <div class="panel-body">
                    ${renderParagraphs(doc.paragraphs || [], docId)}
                </div>
            </div>
        `;
    }).join('');
    
    elements.comparePanels.innerHTML = panels;
    
    // 词元点击事件
    elements.comparePanels.querySelectorAll('.token').forEach(token => {
        token.addEventListener('click', () => showTokenDetail(token));
    });
}

function renderParagraphs(paragraphs, docId) {
    return paragraphs.map((para, paraIdx) => `
        <div class="paragraph" data-para-idx="${paraIdx}">
            <div class="paragraph-content">
                ${para.tokens.map((token, tokenIdx) => `
                    <span class="token" 
                          data-doc-id="${docId}"
                          data-para-idx="${paraIdx}" 
                          data-token-idx="${tokenIdx}"
                          data-pos="${token.features[0] || ''}"
                          data-features='${JSON.stringify(token.features)}'>
                        ${escapeHtml(token.surface)}
                    </span>
                `).join('')}
            </div>
        </div>
    `).join('');
}

// ===== 显示词元详情 =====
function showTokenDetail(tokenEl) {
    // 移除之前的高亮
    elements.comparePanels.querySelectorAll('.token.highlighted').forEach(el => {
        el.classList.remove('highlighted');
    });
    
    // 高亮当前
    tokenEl.classList.add('highlighted');
    
    const features = JSON.parse(tokenEl.dataset.features);
    const surface = tokenEl.textContent;
    
    let detailHtml = `
        <div class="detail-item">
            <div class="detail-label">表層形</div>
            <div class="detail-value" style="font-size: 1.5rem;">${escapeHtml(surface)}</div>
        </div>
    `;
    
    features.forEach((value, index) => {
        if (value && value !== '*') {
            const label = featureLabels[index] || `特徴${index}`;
            detailHtml += `
                <div class="detail-item">
                    <div class="detail-label">${label}</div>
                    <div class="detail-value">${escapeHtml(value)}</div>
                </div>
            `;
        }
    });
    
    elements.detailContent.innerHTML = detailHtml;
}

// ===== 视图切换 =====
function switchView(view) {
    document.querySelectorAll('.view-toggle button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    
    if (view === 'side') {
        elements.comparePanels.style.flexDirection = 'row';
        elements.comparePanels.querySelectorAll('.compare-panel').forEach(panel => {
            panel.style.flex = '1';
            panel.style.minWidth = '400px';
        });
    } else {
        // 重叠视图 - 可以后续实现更复杂的对比功能
        elements.comparePanels.style.flexDirection = 'row';
    }
}

// ===== 颜色显示 =====
function updateColorsDisplay() {
    elements.comparePanels.querySelectorAll('.compare-panel').forEach(panel => {
        panel.classList.toggle('colored', colorsEnabled);
    });
}

// ===== 工具函数 =====
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
