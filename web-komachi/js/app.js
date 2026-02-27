/**
 * Web Komachi - 通用工具模块
 */

const App = {
    // 数据基础路径
    dataPath: 'data/',
    
    // 缓存
    cache: {
        index: null,
        documents: {}
    },
    
    /**
     * 加载索引数据
     */
    async loadIndex() {
        if (this.cache.index) {
            return this.cache.index;
        }
        
        try {
            const response = await fetch(this.dataPath + 'index.json');
            if (!response.ok) throw new Error('索引加载失败');
            this.cache.index = await response.json();
            return this.cache.index;
        } catch (error) {
            console.error('加载索引失败:', error);
            return { documents: [], tags: [], stats: {} };
        }
    },
    
    /**
     * 加载单个文档
     */
    async loadDocument(docId) {
        if (this.cache.documents[docId]) {
            return this.cache.documents[docId];
        }
        
        try {
            const response = await fetch(this.dataPath + 'documents/' + docId + '.json');
            if (!response.ok) throw new Error('文档加载失败');
            const doc = await response.json();
            this.cache.documents[docId] = doc;
            return doc;
        } catch (error) {
            console.error('加载文档失败:', error);
            return null;
        }
    },
    
    /**
     * 获取 URL 参数
     */
    getUrlParam(name) {
        const params = new URLSearchParams(window.location.search);
        return params.get(name);
    },
    
    /**
     * HTML 转义
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    /**
     * 从 features 获取品词
     */
    getPosFromFeatures(features) {
        if (!features) return '';
        
        if (features.pos1) {
            return features.pos1;
        }
        if (features.feature) {
            const parts = features.feature.split(',');
            return parts[0] || '';
        }
        if (Array.isArray(features) && features.length > 0) {
            return features[0];
        }
        return '';
    },
    
    /**
     * 品词颜色映射
     */
    posColorMap: {
        '名詞': '#4A90D9',
        '動詞': '#E74C3C',
        '形容詞': '#27AE60',
        '副詞': '#9B59B6',
        '連体詞': '#F39C12',
        '助詞': '#95A5A6',
        '助動詞': '#7F8C8D',
        '接続詞': '#1ABC9C',
        '感動詞': '#E67E22',
        '記号': '#BDC3C7',
        '代名詞': '#3498DB'
    },
    
    /**
     * 获取品词对应颜色
     */
    getColorForPos(pos) {
        for (const [key, color] of Object.entries(this.posColorMap)) {
            if (pos && pos.includes(key)) {
                return color;
            }
        }
        return '#666';
    },
    
    /**
     * 特征标签映射 (UniDic)
     */
    featureLabels: {
        'lemma': '基本形',
        'pos1': '品詞',
        'pos2': '品詞細分類1',
        'pos3': '品詞細分類2',
        'pos4': '品詞細分類3',
        'cType': '活用型',
        'cForm': '活用形',
        'goshu': '語種',
        'kana': '読み',
        'orthBase': '語彙素表記',
        'pronBase': '発音基本形'
    },
    
    /**
     * 特征标签映射 (ipadic / 数组格式)
     */
    featureLabelsArray: [
        '品詞', '品詞細分類1', '品詞細分類2', '品詞細分類3',
        '活用型', '活用形', '基本形', '読み', '発音'
    ]
};
