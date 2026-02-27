/**
 * Web Komachi - 文档比较页面
 */

(async function() {
    let selectedDocuments = [];
    let documentsData = {};
    let colorsEnabled = false;
    let allDocuments = [];
    
    // DOM 元素
    const elements = {
        docSelect: document.getElementById('doc-select'),
        btnAddDoc: document.getElementById('btn-add-doc'),
        selectedDocs: document.getElementById('selected-docs'),
        comparePanels: document.getElementById('compare-panels'),
        detailSidebar: document.getElementById('detail-sidebar'),
        detailContent: document.getElementById('detail-content'),
        toggleColors: document.getElementById('toggle-colors')
    };
    
    /**
     * 初始化
     */
    async function init() {
        // 加载索引
        const index = await App.loadIndex();
        allDocuments = index.documents || [];
        
        // 填充选择器
        elements.docSelect.innerHTML = '<option value="">-- 文書を選択 --</option>' +
            allDocuments.map(doc => `
                <option value="${doc.id}" data-title="${App.escapeHtml(doc.title)}">
                    ${App.escapeHtml(doc.title)} (${App.escapeHtml(doc.dictionary)})
                </option>
            `).join('');
        
        // 绑定事件
        bindEvents();
        
        // 处理 URL 参数
        const urlDocs = App.getUrlParam('docs');
        if (urlDocs) {
            const ids = urlDocs.split(',');
            for (const id of ids) {
                if (allDocuments.find(d => d.id === id)) {
                    await addDocument(id);
                }
            }
        }
    }
    
    /**
     * 绑定事件
     */
    function bindEvents() {
        // 添加文档
        elements.btnAddDoc.addEventListener('click', addSelectedDocument);
        
        // 颜色切换
        elements.toggleColors.addEventListener('change', (e) => {
            colorsEnabled = e.target.checked;
            updateColorsDisplay();
        });
    }
    
    /**
     * 添加选中的文档
     */
    async function addSelectedDocument() {
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
        
        await addDocument(docId);
    }
    
    /**
     * 添加文档
     */
    async function addDocument(docId) {
        selectedDocuments.push(docId);
        
        // 加载文档数据
        const doc = await App.loadDocument(docId);
        if (doc) {
            documentsData[docId] = doc;
        }
        
        updateSelectedDocsDisplay();
        renderComparePanels();
    }
    
    /**
     * 移除文档
     */
    function removeDocument(docId) {
        selectedDocuments = selectedDocuments.filter(id => id !== docId);
        delete documentsData[docId];
        
        updateSelectedDocsDisplay();
        renderComparePanels();
    }
    
    /**
     * 更新已选文档显示
     */
    function updateSelectedDocsDisplay() {
        elements.selectedDocs.innerHTML = selectedDocuments.map(docId => {
            const doc = documentsData[docId];
            const title = doc ? doc.title : `文書 ${docId}`;
            return `
                <span class="selected-doc-tag">
                    ${App.escapeHtml(title)}
                    <span class="remove" data-id="${docId}">&times;</span>
                </span>
            `;
        }).join('');
        
        // 删除事件
        elements.selectedDocs.querySelectorAll('.remove').forEach(btn => {
            btn.addEventListener('click', () => removeDocument(btn.dataset.id));
        });
    }
    
    /**
     * 渲染比较面板
     */
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
                        <h3>${App.escapeHtml(doc.title)}</h3>
                        <div class="panel-meta">
                            <span>${App.escapeHtml(doc.dictionary)}</span>
                            <span>${doc.paragraph_count}段落</span>
                            <span>${doc.token_count}語句</span>
                        </div>
                        ${doc.tags && doc.tags.length > 0 ? `
                        <div class="panel-tags">
                            ${doc.tags.map(tag => `<span class="panel-tag">${App.escapeHtml(tag.name)}</span>`).join('')}
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
    
    /**
     * 渲染段落
     */
    function renderParagraphs(paragraphs, docId) {
        return paragraphs.map((para, paraIdx) => `
            <div class="paragraph" data-para-idx="${paraIdx}">
                <div class="paragraph-content">
                    ${para.tokens.map((token, tokenIdx) => {
                        const pos = App.getPosFromFeatures(token.features);
                        return `
                            <span class="token" 
                                  data-doc-id="${docId}"
                                  data-para-idx="${paraIdx}" 
                                  data-token-idx="${tokenIdx}"
                                  data-pos="${App.escapeHtml(pos)}"
                                  data-features='${App.escapeHtml(JSON.stringify(token.features || {}))}'>
                                ${App.escapeHtml(token.surface)}
                            </span>
                        `;
                    }).join('')}
                </div>
            </div>
        `).join('');
    }
    
    /**
     * 显示词元详情
     */
    function showTokenDetail(tokenEl) {
        // 移除之前的高亮
        elements.comparePanels.querySelectorAll('.token.highlighted').forEach(el => {
            el.classList.remove('highlighted');
        });
        
        tokenEl.classList.add('highlighted');
        
        let features;
        try {
            features = JSON.parse(tokenEl.dataset.features);
        } catch (e) {
            features = {};
        }
        
        const surface = tokenEl.textContent.trim();
        
        let html = `
            <div class="detail-item">
                <strong>表層形</strong>
                <span class="detail-value" style="font-size: 1.5rem;">${App.escapeHtml(surface)}</span>
            </div>
        `;
        
        // 处理不同格式
        if (Array.isArray(features)) {
            features.forEach((value, i) => {
                if (value && value !== '*' && App.featureLabelsArray[i]) {
                    html += `
                        <div class="detail-item">
                            <strong>${App.featureLabelsArray[i]}</strong>
                            <span class="detail-value">${App.escapeHtml(value)}</span>
                        </div>
                    `;
                }
            });
        } else if (features.feature) {
            const parts = features.feature.split(',');
            parts.forEach((value, i) => {
                if (value && value !== '*' && App.featureLabelsArray[i]) {
                    html += `
                        <div class="detail-item">
                            <strong>${App.featureLabelsArray[i]}</strong>
                            <span class="detail-value">${App.escapeHtml(value)}</span>
                        </div>
                    `;
                }
            });
        } else {
            for (const [key, label] of Object.entries(App.featureLabels)) {
                if (features[key] && features[key] !== '*') {
                    html += `
                        <div class="detail-item">
                            <strong>${label}</strong>
                            <span class="detail-value">${App.escapeHtml(features[key])}</span>
                        </div>
                    `;
                }
            }
        }
        
        elements.detailContent.innerHTML = html;
    }
    
    /**
     * 更新颜色显示
     */
    function updateColorsDisplay() {
        elements.comparePanels.querySelectorAll('.compare-panel').forEach(panel => {
            panel.classList.toggle('colored', colorsEnabled);
        });
    }
    
    // 启动
    init();
})();
