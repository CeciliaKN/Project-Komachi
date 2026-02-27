/**
 * Web Komachi - 文档库页面
 */

(async function() {
    // 当前筛选状态
    let activeTags = [];
    let allDocuments = [];
    let allTags = [];
    
    // DOM 元素
    const elements = {
        documentsGrid: document.getElementById('documents-grid'),
        searchInput: document.getElementById('search-input'),
        filterEra: document.getElementById('filter-era'),
        filterStyle: document.getElementById('filter-style'),
        filterGeneral: document.getElementById('filter-general'),
        btnClearFilters: document.getElementById('btn-clear-filters'),
        statDocs: document.getElementById('stat-docs'),
        statTokens: document.getElementById('stat-tokens')
    };
    
    /**
     * 初始化
     */
    async function init() {
        const index = await App.loadIndex();
        allDocuments = index.documents || [];
        allTags = index.tags || [];
        
        // 显示统计
        if (index.stats) {
            elements.statDocs.textContent = index.stats.document_count || 0;
            elements.statTokens.textContent = (index.stats.total_tokens || 0).toLocaleString();
        }
        
        // 渲染筛选标签
        renderFilterTags();
        
        // 渲染文档
        renderDocuments(allDocuments);
        
        // 绑定事件
        bindEvents();
    }
    
    /**
     * 渲染筛选标签
     */
    function renderFilterTags() {
        const categories = {
            era: elements.filterEra,
            style: elements.filterStyle,
            general: elements.filterGeneral
        };
        
        for (const [category, container] of Object.entries(categories)) {
            const tags = allTags.filter(t => t.category === category);
            container.innerHTML = tags.map(tag => `
                <span class="filter-tag" data-tag="${App.escapeHtml(tag.name)}" data-category="${category}">
                    ${App.escapeHtml(tag.name)}<span class="count">(${tag.count})</span>
                </span>
            `).join('');
        }
    }
    
    /**
     * 渲染文档列表
     */
    function renderDocuments(documents) {
        if (documents.length === 0) {
            elements.documentsGrid.innerHTML = `
                <div class="empty-state">
                    <h3>文書がありません</h3>
                    <p>条件に一致する文書が見つかりませんでした。</p>
                </div>
            `;
            return;
        }
        
        elements.documentsGrid.innerHTML = documents.map(doc => `
            <div class="document-card" data-id="${doc.id}">
                <div class="doc-header">
                    <h3 class="doc-title">${App.escapeHtml(doc.title)}</h3>
                    <span class="doc-dictionary">${App.escapeHtml(doc.dictionary)}</span>
                </div>
                
                <div class="doc-tags">
                    ${(doc.tags || []).map(tag => `
                        <span class="doc-tag ${tag.category}">${App.escapeHtml(tag.name)}</span>
                    `).join('')}
                </div>
                
                ${doc.metadata ? `
                <div class="doc-metadata">
                    ${doc.metadata.author ? `<span>${App.escapeHtml(doc.metadata.author)}</span>` : ''}
                    ${doc.metadata.era ? `<span>${App.escapeHtml(doc.metadata.era)}</span>` : ''}
                </div>
                ` : ''}
                
                <div class="doc-stats">
                    <span>${doc.paragraph_count}段落</span>
                    <span>${doc.token_count}語句</span>
                </div>
                
                <div class="doc-actions">
                    <a href="view.html?id=${doc.id}" class="btn btn-primary">詳細を見る</a>
                </div>
            </div>
        `).join('');
    }
    
    /**
     * 筛选文档
     */
    function filterDocuments() {
        const searchTerm = elements.searchInput.value.toLowerCase().trim();
        
        let filtered = allDocuments;
        
        // 标签筛选
        if (activeTags.length > 0) {
            filtered = filtered.filter(doc => {
                const docTagNames = (doc.tags || []).map(t => t.name);
                return activeTags.every(tag => docTagNames.includes(tag));
            });
        }
        
        // 搜索筛选
        if (searchTerm) {
            filtered = filtered.filter(doc => {
                const title = (doc.title || '').toLowerCase();
                const author = (doc.metadata?.author || '').toLowerCase();
                const era = (doc.metadata?.era || '').toLowerCase();
                return title.includes(searchTerm) || 
                       author.includes(searchTerm) ||
                       era.includes(searchTerm);
            });
        }
        
        renderDocuments(filtered);
    }
    
    /**
     * 绑定事件
     */
    function bindEvents() {
        // 搜索
        elements.searchInput.addEventListener('input', filterDocuments);
        
        // 筛选标签点击
        document.querySelectorAll('.filter-list').forEach(list => {
            list.addEventListener('click', (e) => {
                const tag = e.target.closest('.filter-tag');
                if (!tag) return;
                
                const tagName = tag.dataset.tag;
                
                if (tag.classList.contains('active')) {
                    tag.classList.remove('active');
                    activeTags = activeTags.filter(t => t !== tagName);
                } else {
                    tag.classList.add('active');
                    activeTags.push(tagName);
                }
                
                filterDocuments();
            });
        });
        
        // 清除筛选
        elements.btnClearFilters.addEventListener('click', () => {
            activeTags = [];
            document.querySelectorAll('.filter-tag.active').forEach(el => {
                el.classList.remove('active');
            });
            elements.searchInput.value = '';
            filterDocuments();
        });
    }
    
    // 启动
    init();
})();
