"""
文档管理器 - 管理多个独立文档数据库
每个文档有自己的SQLite数据库，主索引数据库存储元数据
"""
import sqlite3
import json
import hashlib
import os
import shutil
from datetime import datetime
from typing import Optional, List, Dict, Any

# 数据目录
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
DOCUMENTS_DIR = os.path.join(DATA_DIR, "documents")
REGISTRY_PATH = os.path.join(DATA_DIR, "registry.db")


def ensure_directories():
    """确保数据目录存在"""
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(DOCUMENTS_DIR, exist_ok=True)


def get_registry_connection():
    """获取主索引数据库连接"""
    ensure_directories()
    conn = sqlite3.connect(REGISTRY_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_registry():
    """初始化主索引数据库"""
    conn = get_registry_connection()
    cursor = conn.cursor()
    
    # 文档元数据表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            db_filename TEXT UNIQUE NOT NULL,
            content_hash TEXT UNIQUE NOT NULL,
            dictionary TEXT DEFAULT 'unidic-chuko',
            paragraph_count INTEGER DEFAULT 0,
            token_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 标签表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            category TEXT DEFAULT 'general'
        )
    ''')
    
    # 预设标签类别
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tag_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            display_name TEXT NOT NULL,
            description TEXT
        )
    ''')
    
    # 文档-标签关联表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS document_tags (
            document_id INTEGER NOT NULL,
            tag_id INTEGER NOT NULL,
            PRIMARY KEY (document_id, tag_id),
            FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
            FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        )
    ''')
    
    # 文档自定义属性（如作者、年代等）
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS document_metadata (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            document_id INTEGER NOT NULL,
            key TEXT NOT NULL,
            value TEXT,
            UNIQUE (document_id, key),
            FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
        )
    ''')
    
    # 创建索引
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_docs_hash ON documents(content_hash)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_doc_tags ON document_tags(document_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_tag_docs ON document_tags(tag_id)')
    
    # 插入预设标签类别
    default_categories = [
        ('era', '时代', '文本所属的历史时代'),
        ('style', '文体', '文本的文体风格'),
        ('author', '作者', '文本的作者'),
        ('genre', '类型', '文本的体裁类型'),
        ('source', '出典', '文本的出处来源'),
    ]
    
    for cat_name, display_name, desc in default_categories:
        cursor.execute('''
            INSERT OR IGNORE INTO tag_categories (name, display_name, description)
            VALUES (?, ?, ?)
        ''', (cat_name, display_name, desc))
    
    # 插入一些预设标签
    default_tags = [
        # 时代
        ('上代', 'era'), 
        ('平安前期(781-900)', 'era'), 
        ('平安中期(901-1072)', 'era'),
        ('平安後期(1073-1159)', 'era'), 
        ('源平時代(1160-1221)', 'era'),
        ('鎌倉時代', 'era'), 
        ('室町時代', 'era'), 
        ('戦国時代', 'era'),
        ('江戸時代', 'era'), 
        ('近代', 'era'),
        # 文体
        ('和歌', 'style'), ('物語', 'style'), ('日記', 'style'),
        ('随筆', 'style'), ('漢文', 'style'), ('仮名文', 'style'),
        ('説話', 'style'), ('軍記', 'style'),
    ]
    
    for tag_name, category in default_tags:
        cursor.execute('''
            INSERT OR IGNORE INTO tags (name, category)
            VALUES (?, ?)
        ''', (tag_name, category))
    
    # 删除旧的时代标签（只删除未被使用的）
    old_era_tags = ['奈良時代', '平安時代', '明治時代', '中古', '中世', '近世']
    for old_tag in old_era_tags:
        cursor.execute('''
            DELETE FROM tags WHERE name = ? AND id NOT IN (
                SELECT tag_id FROM document_tags
            )
        ''', (old_tag,))
    
    # 删除旧的类型标签（genre类别已移除）
    cursor.execute('''
        DELETE FROM tags WHERE category = 'genre' AND id NOT IN (
            SELECT tag_id FROM document_tags
        )
    ''')
    
    conn.commit()
    conn.close()


def compute_hash(content: str, dictionary: str) -> str:
    """计算文档内容哈希"""
    combined = f"{content}|{dictionary}"
    return hashlib.sha256(combined.encode('utf-8')).hexdigest()


def generate_db_filename(title: str, doc_id: int) -> str:
    """生成文档数据库文件名"""
    # 安全的文件名
    import re
    safe_title = re.sub(r'[^\w\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]', '_', title)
    safe_title = safe_title[:50]  # 限制长度
    return f"doc_{doc_id}_{safe_title}.db"


def create_document_db(db_path: str):
    """创建单个文档的数据库结构"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 文档内容表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS content (
            id INTEGER PRIMARY KEY,
            original_text TEXT NOT NULL
        )
    ''')
    
    # 段落表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS paragraphs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            paragraph_index INTEGER NOT NULL,
            content TEXT NOT NULL
        )
    ''')
    
    # 词元分析结果表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            paragraph_id INTEGER NOT NULL,
            token_index INTEGER NOT NULL,
            surface TEXT NOT NULL,
            features TEXT NOT NULL,
            FOREIGN KEY (paragraph_id) REFERENCES paragraphs(id) ON DELETE CASCADE
        )
    ''')
    
    # 索引
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_tokens_para ON tokens(paragraph_id)')
    
    conn.commit()
    conn.close()


def save_document(title: str, content: str, dictionary: str, paragraphs: List[Dict],
                  tags: List[str] = None, metadata: Dict[str, str] = None) -> int:
    """
    保存文档到独立数据库
    
    Args:
        title: 文档标题
        content: 原文内容
        dictionary: 使用的辞书
        paragraphs: 解析后的段落数据
        tags: 标签列表
        metadata: 元数据字典 (如 author, era 等)
    
    Returns:
        文档ID
    """
    content_hash = compute_hash(content, dictionary)
    
    # 检查是否已存在
    conn = get_registry_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id FROM documents WHERE content_hash = ?', (content_hash,))
    existing = cursor.fetchone()
    if existing:
        conn.close()
        return existing['id']
    
    # 计算统计信息
    paragraph_count = len(paragraphs)
    token_count = sum(len(p.get('tokens', [])) for p in paragraphs)
    
    # 先插入主索引记录获取ID
    cursor.execute('''
        INSERT INTO documents (title, db_filename, content_hash, dictionary, paragraph_count, token_count)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (title, 'temp', content_hash, dictionary, paragraph_count, token_count))
    doc_id = cursor.lastrowid
    
    # 生成并更新数据库文件名
    db_filename = generate_db_filename(title, doc_id)
    cursor.execute('UPDATE documents SET db_filename = ? WHERE id = ?', (db_filename, doc_id))
    
    # 添加标签
    if tags:
        for tag_name in tags:
            # 确保标签存在
            cursor.execute('INSERT OR IGNORE INTO tags (name, category) VALUES (?, ?)', 
                         (tag_name, 'general'))
            cursor.execute('SELECT id FROM tags WHERE name = ?', (tag_name,))
            tag_row = cursor.fetchone()
            if tag_row:
                cursor.execute('INSERT OR IGNORE INTO document_tags (document_id, tag_id) VALUES (?, ?)',
                             (doc_id, tag_row['id']))
    
    # 添加元数据
    if metadata:
        for key, value in metadata.items():
            if value:
                cursor.execute('''
                    INSERT OR REPLACE INTO document_metadata (document_id, key, value)
                    VALUES (?, ?, ?)
                ''', (doc_id, key, value))
    
    conn.commit()
    conn.close()
    
    # 创建文档数据库
    db_path = os.path.join(DOCUMENTS_DIR, db_filename)
    create_document_db(db_path)
    
    # 保存文档内容和分析结果
    doc_conn = sqlite3.connect(db_path)
    doc_cursor = doc_conn.cursor()
    
    doc_cursor.execute('INSERT INTO content (id, original_text) VALUES (1, ?)', (content,))
    
    for para_idx, para in enumerate(paragraphs):
        doc_cursor.execute('''
            INSERT INTO paragraphs (paragraph_index, content) VALUES (?, ?)
        ''', (para_idx, para['content']))
        para_id = doc_cursor.lastrowid
        
        for token_idx, token in enumerate(para.get('tokens', [])):
            doc_cursor.execute('''
                INSERT INTO tokens (paragraph_id, token_index, surface, features)
                VALUES (?, ?, ?, ?)
            ''', (para_id, token_idx, token['surface'], json.dumps(token['features'], ensure_ascii=False)))
    
    doc_conn.commit()
    doc_conn.close()
    
    return doc_id


def get_document(doc_id: int) -> Optional[Dict[str, Any]]:
    """获取文档的完整信息（元数据 + 分析结果）"""
    conn = get_registry_connection()
    cursor = conn.cursor()
    
    # 获取文档元数据
    cursor.execute('SELECT * FROM documents WHERE id = ?', (doc_id,))
    doc_row = cursor.fetchone()
    if not doc_row:
        conn.close()
        return None
    
    doc = dict(doc_row)
    
    # 获取标签
    cursor.execute('''
        SELECT t.name, t.category FROM tags t
        JOIN document_tags dt ON t.id = dt.tag_id
        WHERE dt.document_id = ?
    ''', (doc_id,))
    doc['tags'] = [{'name': row['name'], 'category': row['category']} for row in cursor.fetchall()]
    
    # 获取元数据
    cursor.execute('SELECT key, value FROM document_metadata WHERE document_id = ?', (doc_id,))
    doc['metadata'] = {row['key']: row['value'] for row in cursor.fetchall()}
    
    conn.close()
    
    # 获取分析结果
    db_path = os.path.join(DOCUMENTS_DIR, doc['db_filename'])
    if os.path.exists(db_path):
        doc_conn = sqlite3.connect(db_path)
        doc_conn.row_factory = sqlite3.Row
        doc_cursor = doc_conn.cursor()
        
        # 获取原文
        doc_cursor.execute('SELECT original_text FROM content WHERE id = 1')
        content_row = doc_cursor.fetchone()
        doc['content'] = content_row['original_text'] if content_row else ''
        
        # 获取段落和词元
        doc['paragraphs'] = []
        doc_cursor.execute('SELECT * FROM paragraphs ORDER BY paragraph_index')
        para_rows = doc_cursor.fetchall()
        
        for para_row in para_rows:
            paragraph = dict(para_row)
            paragraph['tokens'] = []
            
            doc_cursor.execute('''
                SELECT * FROM tokens WHERE paragraph_id = ? ORDER BY token_index
            ''', (para_row['id'],))
            
            for token_row in doc_cursor.fetchall():
                token = dict(token_row)
                token['features'] = json.loads(token['features'])
                paragraph['tokens'].append(token)
            
            doc['paragraphs'].append(paragraph)
        
        doc_conn.close()
    
    return doc


def list_documents(tag_filter: List[str] = None, category_filter: str = None) -> List[Dict[str, Any]]:
    """
    列出所有文档
    
    Args:
        tag_filter: 按标签筛选
        category_filter: 按标签类别筛选
    """
    conn = get_registry_connection()
    cursor = conn.cursor()
    
    query = '''
        SELECT DISTINCT d.id, d.title, d.dictionary, d.paragraph_count, d.token_count, 
               d.created_at, d.updated_at
        FROM documents d
    '''
    
    params = []
    
    if tag_filter or category_filter:
        query += ' JOIN document_tags dt ON d.id = dt.document_id'
        query += ' JOIN tags t ON dt.tag_id = t.id'
        
        conditions = []
        if tag_filter:
            placeholders = ','.join('?' * len(tag_filter))
            conditions.append(f't.name IN ({placeholders})')
            params.extend(tag_filter)
        if category_filter:
            conditions.append('t.category = ?')
            params.append(category_filter)
        
        query += ' WHERE ' + ' AND '.join(conditions)
    
    query += ' ORDER BY d.updated_at DESC'
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    documents = []
    for row in rows:
        doc = dict(row)
        
        # 获取该文档的所有标签
        cursor.execute('''
            SELECT t.name, t.category FROM tags t
            JOIN document_tags dt ON t.id = dt.tag_id
            WHERE dt.document_id = ?
        ''', (doc['id'],))
        doc['tags'] = [{'name': r['name'], 'category': r['category']} for r in cursor.fetchall()]
        
        # 获取元数据
        cursor.execute('SELECT key, value FROM document_metadata WHERE document_id = ?', (doc['id'],))
        doc['metadata'] = {r['key']: r['value'] for r in cursor.fetchall()}
        
        documents.append(doc)
    
    conn.close()
    return documents


def delete_document(doc_id: int) -> bool:
    """删除文档及其数据库文件"""
    conn = get_registry_connection()
    cursor = conn.cursor()
    
    # 获取数据库文件名
    cursor.execute('SELECT db_filename FROM documents WHERE id = ?', (doc_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return False
    
    db_filename = row['db_filename']
    
    # 删除索引记录（会级联删除标签关联和元数据）
    cursor.execute('DELETE FROM documents WHERE id = ?', (doc_id,))
    conn.commit()
    conn.close()
    
    # 删除数据库文件
    db_path = os.path.join(DOCUMENTS_DIR, db_filename)
    if os.path.exists(db_path):
        os.remove(db_path)
    
    return True


def update_document_title(doc_id: int, title: str) -> bool:
    """更新文档标题"""
    conn = get_registry_connection()
    cursor = conn.cursor()
    
    cursor.execute('UPDATE documents SET title = ?, updated_at = ? WHERE id = ?',
                  (title, datetime.now().isoformat(), doc_id))
    
    conn.commit()
    conn.close()
    return True


def update_document_metadata(doc_id: int, metadata: Dict[str, str]) -> bool:
    """更新文档元数据"""
    conn = get_registry_connection()
    cursor = conn.cursor()
    
    for key, value in metadata.items():
        cursor.execute('''
            INSERT OR REPLACE INTO document_metadata (document_id, key, value)
            VALUES (?, ?, ?)
        ''', (doc_id, key, value))
    
    cursor.execute('UPDATE documents SET updated_at = ? WHERE id = ?', 
                  (datetime.now().isoformat(), doc_id))
    
    conn.commit()
    conn.close()
    return True


def update_document_tags(doc_id: int, tags: List[str]) -> bool:
    """更新文档标签"""
    conn = get_registry_connection()
    cursor = conn.cursor()
    
    # 删除现有标签关联
    cursor.execute('DELETE FROM document_tags WHERE document_id = ?', (doc_id,))
    
    # 添加新标签
    for tag_name in tags:
        cursor.execute('INSERT OR IGNORE INTO tags (name, category) VALUES (?, ?)',
                      (tag_name, 'general'))
        cursor.execute('SELECT id FROM tags WHERE name = ?', (tag_name,))
        tag_row = cursor.fetchone()
        if tag_row:
            cursor.execute('INSERT INTO document_tags (document_id, tag_id) VALUES (?, ?)',
                         (doc_id, tag_row['id']))
    
    cursor.execute('UPDATE documents SET updated_at = ? WHERE id = ?',
                  (datetime.now().isoformat(), doc_id))
    
    conn.commit()
    conn.close()
    return True


def ensure_era_tag(era_name: str) -> None:
    """确保era标签存在且类别正确"""
    conn = get_registry_connection()
    cursor = conn.cursor()
    
    # 检查标签是否存在
    cursor.execute('SELECT id, category FROM tags WHERE name = ?', (era_name,))
    row = cursor.fetchone()
    
    if row:
        # 如果存在但类别不是era，更新为era
        if row['category'] != 'era':
            cursor.execute('UPDATE tags SET category = ? WHERE id = ?', ('era', row['id']))
    else:
        # 不存在则创建
        cursor.execute('INSERT INTO tags (name, category) VALUES (?, ?)', (era_name, 'era'))
    
    conn.commit()
    conn.close()


def get_all_tags() -> List[Dict[str, Any]]:
    """获取所有标签"""
    conn = get_registry_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT t.id, t.name, t.category, COUNT(dt.document_id) as doc_count
        FROM tags t
        LEFT JOIN document_tags dt ON t.id = dt.tag_id
        GROUP BY t.id
        ORDER BY t.category, t.name
    ''')
    
    tags = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return tags


def get_tag_categories() -> List[Dict[str, Any]]:
    """获取所有标签类别"""
    conn = get_registry_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM tag_categories ORDER BY id')
    categories = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return categories


def check_existing_analysis(content: str, dictionary: str) -> Optional[Dict[str, Any]]:
    """检查是否已有相同内容的分析"""
    content_hash = compute_hash(content, dictionary)
    
    conn = get_registry_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT id FROM documents WHERE content_hash = ?', (content_hash,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return get_document(row['id'])
    return None


def create_tag(name: str, category: str = 'general') -> int:
    """创建新标签"""
    conn = get_registry_connection()
    cursor = conn.cursor()
    
    cursor.execute('INSERT OR IGNORE INTO tags (name, category) VALUES (?, ?)', (name, category))
    cursor.execute('SELECT id FROM tags WHERE name = ?', (name,))
    tag_id = cursor.fetchone()['id']
    
    conn.commit()
    conn.close()
    return tag_id


# 初始化数据库
init_registry()
