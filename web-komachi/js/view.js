/**
 * Web Komachi - 文档详情页
 */

(async function() {
    let currentDoc = null;
    let currentToken = null;
    let colorsEnabled = false;
    
    // DOM 元素
    const elements = {
        docTitle: document.getElementById('doc-title'),
        metaDictionary: document.getElementById('meta-dictionary'),
        metaParagraphs: document.getElementById('meta-paragraphs'),
        metaTokens: document.getElementById('meta-tokens'),
        metaAuthor: document.getElementById('meta-author'),
        metaAuthorRow: document.getElementById('meta-author-row'),
        metaEra: document.getElementById('meta-era'),
        metaEraRow: document.getElementById('meta-era-row'),
        docTags: document.getElementById('doc-tags'),
        analysisInfo: document.getElementById('analysis-info'),
        resultContainer: document.getElementById('result-container'),
        detailContent: document.getElementById('detail-content'),
        colorToggle: document.getElementById('color-toggle')
    };
    
    /**
     * 初始化
     */
    async function init() {
        const docId = App.getUrlParam('id');
        
        if (!docId) {
            showError('文書IDが指定されていません');
            return;
        }
        
        currentDoc = await App.loadDocument(docId);
        
        if (!currentDoc) {
            showError('文書が見つかりません');
            return;
        }
        
        renderDocument();
        bindEvents();
    }
    
    /**
     * 显示错误
     */
    function showError(message) {
        elements.docTitle.textContent = 'エラー';
        elements.resultContainer.innerHTML = `
            <div class="empty-state">
                <h3>${App.escapeHtml(message)}</h3>
                <p><a href="index.html">ライブラリに戻る</a></p>
            </div>
        `;
    }
    
    /**
     * 渲染文档
     */
    function renderDocument() {
        // 标题
        elements.docTitle.textContent = currentDoc.title;
        document.title = currentDoc.title + ' - Web Komachi';
        
        // 元信息
        elements.metaDictionary.textContent = currentDoc.dictionary;
        elements.metaParagraphs.textContent = currentDoc.paragraph_count;
        elements.metaTokens.textContent = currentDoc.token_count;
        
        if (currentDoc.metadata?.author) {
            elements.metaAuthor.textContent = currentDoc.metadata.author;
            elements.metaAuthorRow.style.display = 'flex';
        }
        
        if (currentDoc.metadata?.era) {
            elements.metaEra.textContent = currentDoc.metadata.era;
            elements.metaEraRow.style.display = 'flex';
        }
        
        // 标签
        if (currentDoc.tags && currentDoc.tags.length > 0) {
            elements.docTags.innerHTML = currentDoc.tags.map(tag => `
                <span class="doc-tag ${tag.category}">${App.escapeHtml(tag.name)}</span>
            `).join('');
        }
        
        // 解析信息
        elements.analysisInfo.textContent = `${currentDoc.dictionary} · ${currentDoc.paragraph_count}段落`;
        
        // 渲染段落
        renderParagraphs();
    }
    
    /**
     * 渲染段落
     */
    function renderParagraphs() {
        const paragraphs = currentDoc.paragraphs || [];
        
        elements.resultContainer.innerHTML = paragraphs.map((para, paraIdx) => `
            <div class="paragraph" data-para="${paraIdx}">
                <div class="paragraph-index">第${paraIdx + 1}段</div>
                <div class="paragraph-content">${renderTokens(para.tokens, paraIdx)}</div>
            </div>
        `).join('');
    }
    
    /**
     * 渲染词元
     */
    function renderTokens(tokens, paraIdx) {
        return tokens.map((token, tokenIdx) => {
            const pos = App.getPosFromFeatures(token.features);
            const featuresJson = JSON.stringify(token.features || {});
            return `<span class="token" data-para="${paraIdx}" data-token="${tokenIdx}" data-pos="${App.escapeHtml(pos)}" data-features='${App.escapeHtml(featuresJson)}' data-surface="${App.escapeHtml(token.surface)}">${App.escapeHtml(token.surface)}</span>`;
        }).join('');
    }
    
    /**
     * 绑定事件
     */
    function bindEvents() {
        // 词元点击
        elements.resultContainer.addEventListener('click', (e) => {
            const token = e.target.closest('.token');
            if (!token) return;
            
            // 高亮当前词元
            if (currentToken) {
                currentToken.classList.remove('active');
            }
            token.classList.add('active');
            currentToken = token;
            
            // 高亮句子
            highlightSentence(token);
            
            // 显示详情
            showTokenDetail(token);
        });
        
        // 颜色切换
        elements.colorToggle.addEventListener('change', (e) => {
            colorsEnabled = e.target.checked;
            applyColors();
        });
    }
    
    /**
     * 高亮句子
     */
    function highlightSentence(token) {
        // 清除之前的高亮
        document.querySelectorAll('.token.sentence-highlight').forEach(t => {
            t.classList.remove('sentence-highlight');
        });
        
        const paraContent = token.closest('.paragraph-content');
        if (!paraContent) return;
        
        const tokens = Array.from(paraContent.querySelectorAll('.token'));
        const tokenIndex = tokens.indexOf(token);
        
        // 句子结束符
        const sentenceEnders = ['。', '？', '！', '?', '!'];
        let start = tokenIndex;
        let end = tokenIndex;
        
        // 找开始
        for (let i = tokenIndex - 1; i >= 0; i--) {
            const surface = tokens[i].dataset.surface || tokens[i].textContent;
            if (sentenceEnders.includes(surface)) break;
            start = i;
        }
        
        // 找结束
        for (let i = tokenIndex; i < tokens.length; i++) {
            end = i;
            const surface = tokens[i].dataset.surface || tokens[i].textContent;
            if (sentenceEnders.includes(surface)) break;
        }
        
        // 高亮
        for (let i = start; i <= end; i++) {
            tokens[i].classList.add('sentence-highlight');
        }
    }
    
    /**
     * 显示词元详情
     */
    function showTokenDetail(token) {
        const surface = token.dataset.surface || token.textContent;
        let features;
        
        try {
            features = JSON.parse(token.dataset.features);
        } catch (e) {
            features = {};
        }
        
        let html = `<div class="detail-item"><strong>表層形</strong><span class="detail-value">${App.escapeHtml(surface)}</span></div>`;
        
        // 处理不同格式的特征
        if (Array.isArray(features)) {
            // 数组格式
            features.forEach((value, i) => {
                if (value && value !== '*' && App.featureLabelsArray[i]) {
                    html += `<div class="detail-item"><strong>${App.featureLabelsArray[i]}</strong><span class="detail-value">${App.escapeHtml(value)}</span></div>`;
                }
            });
        } else if (features.feature) {
            // feature 字符串格式
            const parts = features.feature.split(',');
            parts.forEach((value, i) => {
                if (value && value !== '*' && App.featureLabelsArray[i]) {
                    html += `<div class="detail-item"><strong>${App.featureLabelsArray[i]}</strong><span class="detail-value">${App.escapeHtml(value)}</span></div>`;
                }
            });
        } else {
            // 对象格式 (UniDic)
            for (const [key, label] of Object.entries(App.featureLabels)) {
                if (features[key] && features[key] !== '*') {
                    html += `<div class="detail-item"><strong>${label}</strong><span class="detail-value">${App.escapeHtml(features[key])}</span></div>`;
                }
            }
        }
        
        elements.detailContent.innerHTML = html;
    }
    
    /**
     * 应用颜色
     */
    function applyColors() {
        document.querySelectorAll('.token').forEach(token => {
            if (colorsEnabled) {
                const pos = token.dataset.pos || '';
                const color = App.getColorForPos(pos);
                token.style.color = color;
                token.style.borderBottomColor = color;
            } else {
                token.style.color = '';
                token.style.borderBottomColor = '';
            }
        });
    }
    
    // 启动
    init();
})();
