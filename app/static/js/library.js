/**
 * Project Komachi - 文書ライブラリ管理
 */

// 选中的筛选标签
let selectedFilters = [];
let currentEditDocId = null;
let editTags = [];
let importTags = [];

// DOM 元素
const elements = {
    searchInput: document.getElementById('search-input'),
    documentsGrid: document.getElementById('documents-grid'),
    editModal: document.getElementById('edit-modal'),
    importModal: document.getElementById('import-modal'),
    btnImport: document.getElementById('btn-import'),
    btnClearFilters: document.getElementById('btn-clear-filters'),
};

// ===== 初期化 =====
document.addEventListener('DOMContentLoaded', init);

function init() {
    // 筛选标签点击
    document.querySelectorAll('.filter-tag').forEach(tag => {
        tag.addEventListener('click', () => toggleFilter(tag));
    });
    
    // 搜索
    elements.searchInput.addEventListener('input', debounce(filterDocuments, 300));
    
    // 清除筛选
    elements.btnClearFilters.addEventListener('click', clearFilters);
    
    // 导入按钮
    elements.btnImport.addEventListener('click', () => showModal('import-modal'));
    
    // 文档操作按钮 - 使用事件委托
    elements.documentsGrid.addEventListener('click', handleDocumentAction);
    
    // 模态框关闭
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => hideAllModals());
    });
    
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) hideAllModals();
        });
    });
    
    // 编辑模态框
    document.getElementById('btn-cancel-edit').addEventListener('click', hideAllModals);
    document.getElementById('btn-save-edit').addEventListener('click', saveDocumentEdit);
    setupTagInput('edit-tags-container', 'edit-tags-input', editTags);
    
    // 导入模态框
    document.getElementById('btn-cancel-import').addEventListener('click', hideAllModals);
    document.getElementById('btn-do-import').addEventListener('click', doImport);
    document.getElementById('import-file').addEventListener('change', handleImportFileSelect);
    setupTagInput('import-tags-container', 'import-tags-input', importTags);
}

// ===== 筛选功能 =====
function toggleFilter(tagElement) {
    const tagName = tagElement.dataset.tag;
    
    if (tagElement.classList.contains('active')) {
        tagElement.classList.remove('active');
        selectedFilters = selectedFilters.filter(t => t !== tagName);
    } else {
        tagElement.classList.add('active');
        selectedFilters.push(tagName);
    }
    
    filterDocuments();
}

function clearFilters() {
    selectedFilters = [];
    document.querySelectorAll('.filter-tag.active').forEach(tag => {
        tag.classList.remove('active');
    });
    elements.searchInput.value = '';
    filterDocuments();
}

async function filterDocuments() {
    const searchTerm = elements.searchInput.value.toLowerCase();
    
    try {
        let url = '/api/library/documents';
        const params = new URLSearchParams();
        
        if (selectedFilters.length > 0) {
            params.append('tags', selectedFilters.join(','));
        }
        if (searchTerm) {
            params.append('search', searchTerm);
        }
        
        if (params.toString()) {
            url += '?' + params.toString();
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        renderDocuments(data.documents);
    } catch (error) {
        console.error('フィルタリング失敗:', error);
    }
}

function renderDocuments(documents) {
    if (documents.length === 0) {
        elements.documentsGrid.innerHTML = `
            <div class="empty-state">
                <div class="icon">検</div>
                <h3>該当する文書がありません</h3>
                <p>フィルター条件を変更してお試しください。</p>
            </div>
        `;
        return;
    }
    
    elements.documentsGrid.innerHTML = documents.map(doc => `
        <div class="document-card" data-id="${doc.id}">
            <div class="doc-header">
                <h3 class="doc-title">${escapeHtml(doc.title)}</h3>
                <span class="doc-dictionary">${doc.dictionary}</span>
            </div>
            
            <div class="doc-tags">
                ${doc.tags.map(tag => `
                    <span class="doc-tag ${tag.category}">${escapeHtml(tag.name)}</span>
                `).join('')}
            </div>
            
            ${doc.metadata && Object.keys(doc.metadata).length > 0 ? `
            <div class="doc-metadata">
                ${doc.metadata.author ? `<span>${escapeHtml(doc.metadata.author)}</span>` : ''}
                ${doc.metadata.era ? `<span>${escapeHtml(doc.metadata.era)}</span>` : ''}
                ${doc.metadata.source ? `<span>${escapeHtml(doc.metadata.source)}</span>` : ''}
            </div>
            ` : ''}
            
            <div class="doc-stats">
                <span>${doc.paragraph_count}段落</span>
                <span>${doc.token_count}語句</span>
            </div>
            
            <div class="doc-actions">
                <button class="btn btn-primary btn-view" data-id="${doc.id}">詳細を見る</button>
                <button class="btn btn-secondary btn-edit" data-id="${doc.id}">編集</button>
                <button class="btn btn-secondary btn-delete" data-id="${doc.id}">削除</button>
            </div>
        </div>
    `).join('');
}

// ===== 文档操作 =====
function handleDocumentAction(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    
    const docId = btn.dataset.id;
    
    if (btn.classList.contains('btn-view')) {
        viewDocument(docId);
    } else if (btn.classList.contains('btn-edit')) {
        editDocument(docId);
    } else if (btn.classList.contains('btn-delete')) {
        deleteDocument(docId);
    }
}

function viewDocument(docId) {
    // 跳转到专用的文档查看页面
    window.location.href = `/library/view/${docId}`;
}

async function editDocument(docId) {
    try {
        const response = await fetch(`/api/library/documents/${docId}`);
        const data = await response.json();
        
        if (data.document) {
            currentEditDocId = docId;
            const doc = data.document;
            
            document.getElementById('edit-doc-id').value = docId;
            document.getElementById('edit-title').value = doc.title || '';
            document.getElementById('edit-author').value = doc.metadata?.author || '';
            document.getElementById('edit-era').value = doc.metadata?.era || '';
            document.getElementById('edit-source').value = doc.metadata?.source || '';
            document.getElementById('edit-notes').value = doc.metadata?.notes || '';
            
            // 设置标签
            editTags = doc.tags ? doc.tags.map(t => t.name) : [];
            renderTags('edit-tags-container', 'edit-tags-input', editTags);
            
            showModal('edit-modal');
        }
    } catch (error) {
        alert('文書情報の取得に失敗しました');
    }
}

async function saveDocumentEdit() {
    const docId = document.getElementById('edit-doc-id').value;
    const title = document.getElementById('edit-title').value;
    
    const metadata = {
        author: document.getElementById('edit-author').value,
        era: document.getElementById('edit-era').value,
        source: document.getElementById('edit-source').value,
        notes: document.getElementById('edit-notes').value,
    };
    
    try {
        const response = await fetch(`/api/library/documents/${docId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: title,
                metadata: metadata,
                tags: editTags
            })
        });
        
        if (response.ok) {
            hideAllModals();
            // 刷新整个页面以更新左侧的筛选器
            window.location.reload();
        } else {
            alert('保存に失敗しました');
        }
    } catch (error) {
        alert('保存に失敗しました: ' + error.message);
    }
}

async function deleteDocument(docId) {
    if (!confirm('この文書を削除してもよろしいですか？この操作は取り消せません。')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/library/documents/${docId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            // 删除成功，从DOM中移除
            const card = document.querySelector(`.document-card[data-id="${docId}"]`);
            if (card) {
                card.remove();
            }
            
            // 检查是否还有文档
            if (elements.documentsGrid.querySelectorAll('.document-card').length === 0) {
                elements.documentsGrid.innerHTML = `
                    <div class="empty-state">
                        <div class="icon">空</div>
                        <h3>文書がありません</h3>
                        <p>テキスト解析ページで新しい文書を作成するか、txtファイルをインポートしてください。</p>
                    </div>
                `;
            }
        } else {
            alert('削除に失敗しました');
        }
    } catch (error) {
        alert('削除に失敗しました: ' + error.message);
    }
}

// ===== 导入功能 =====
async function handleImportFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // 自动设置标题为文件名
    const title = file.name.replace(/\.(txt|text)$/i, '');
    document.getElementById('import-title').value = title;
}

async function doImport() {
    const fileInput = document.getElementById('import-file');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('ファイルを選択してください');
        return;
    }
    
    const title = document.getElementById('import-title').value || file.name.replace(/\.(txt|text)$/i, '');
    const dictionary = document.getElementById('import-dictionary').value;
    const author = document.getElementById('import-author').value;
    const era = document.getElementById('import-era').value;
    
    // 先上传文件获取内容
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const uploadResponse = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        const uploadData = await uploadResponse.json();
        
        if (!uploadResponse.ok) {
            alert(uploadData.error || 'アップロードに失敗しました');
            return;
        }
        
        // 然后进行解析
        const analyzeResponse = await fetch('/api/library/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: title,
                content: uploadData.content,
                dictionary: dictionary,
                tags: importTags,
                metadata: {
                    author: author,
                    era: era
                }
            })
        });
        
        const analyzeData = await analyzeResponse.json();
        
        if (analyzeResponse.ok) {
            hideAllModals();
            // 清空表单
            fileInput.value = '';
            document.getElementById('import-title').value = '';
            document.getElementById('import-author').value = '';
            document.getElementById('import-era').value = '';
            importTags = [];
            renderTags('import-tags-container', 'import-tags-input', importTags);
            
            // 刷新列表
            filterDocuments();
            
            alert('インポートが完了しました');
        } else {
            alert(analyzeData.error || '解析に失敗しました');
        }
    } catch (error) {
        alert('インポートに失敗しました: ' + error.message);
    }
}

// ===== 标签输入 =====
function setupTagInput(containerId, inputId, tagsArray) {
    const container = document.getElementById(containerId);
    const input = document.getElementById(inputId);
    
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && input.value.trim()) {
            e.preventDefault();
            const tag = input.value.trim();
            if (!tagsArray.includes(tag)) {
                tagsArray.push(tag);
                renderTags(containerId, inputId, tagsArray);
            }
            input.value = '';
        }
    });
}

function renderTags(containerId, inputId, tagsArray) {
    const container = document.getElementById(containerId);
    const input = document.getElementById(inputId);
    
    // 移除现有标签
    container.querySelectorAll('.tag').forEach(el => el.remove());
    
    // 添加新标签
    tagsArray.forEach((tag, index) => {
        const tagEl = document.createElement('span');
        tagEl.className = 'tag';
        tagEl.innerHTML = `${escapeHtml(tag)}<span class="remove" data-index="${index}">&times;</span>`;
        container.insertBefore(tagEl, input);
    });
    
    // 标签删除事件
    container.querySelectorAll('.tag .remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            tagsArray.splice(index, 1);
            renderTags(containerId, inputId, tagsArray);
        });
    });
}

// ===== 模态框 =====
function showModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function hideAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
}

// ===== 工具函数 =====
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
