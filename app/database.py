"""
データベースモジュール - SQLiteで解析結果を保存
"""
import sqlite3
import json
import hashlib
import os
from datetime import datetime
from typing import Optional, List, Dict, Any

DATABASE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "komachi.db")


def get_db_connection():
    """データベース接続を取得"""
    os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """データベーステーブルを初期化"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # ドキュメントテーブル - 原文を保存
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            content_hash TEXT UNIQUE NOT NULL,
            dictionary TEXT DEFAULT 'unidic-chuko',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 段落テーブル - 分割された段落を保存
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS paragraphs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            document_id INTEGER NOT NULL,
            paragraph_index INTEGER NOT NULL,
            content TEXT NOT NULL,
            FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
        )
    ''')
    
    # トークン解析結果テーブル
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
    
    # インデックスを作成
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(content_hash)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_paragraphs_doc ON paragraphs(document_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_tokens_para ON tokens(paragraph_id)')
    
    conn.commit()
    conn.close()


def compute_hash(content: str, dictionary: str) -> str:
    """コンテンツのハッシュ値を計算（辞書情報を含む）"""
    combined = f"{content}|{dictionary}"
    return hashlib.sha256(combined.encode('utf-8')).hexdigest()


def find_document_by_hash(content_hash: str) -> Optional[Dict[str, Any]]:
    """ハッシュで解析済みドキュメントを検索"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM documents WHERE content_hash = ?', (content_hash,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return dict(row)
    return None


def save_document(title: str, content: str, dictionary: str, paragraphs: List[Dict]) -> int:
    """ドキュメントと解析結果を保存"""
    content_hash = compute_hash(content, dictionary)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # ドキュメントを挿入
        cursor.execute('''
            INSERT INTO documents (title, content, content_hash, dictionary)
            VALUES (?, ?, ?, ?)
        ''', (title, content, content_hash, dictionary))
        document_id = cursor.lastrowid
        
        # 段落とトークンを挿入
        for para_idx, para in enumerate(paragraphs):
            cursor.execute('''
                INSERT INTO paragraphs (document_id, paragraph_index, content)
                VALUES (?, ?, ?)
            ''', (document_id, para_idx, para['content']))
            paragraph_id = cursor.lastrowid
            
            # トークンを挿入
            for token_idx, token in enumerate(para['tokens']):
                cursor.execute('''
                    INSERT INTO tokens (paragraph_id, token_index, surface, features)
                    VALUES (?, ?, ?, ?)
                ''', (paragraph_id, token_idx, token['surface'], json.dumps(token['features'], ensure_ascii=False)))
        
        conn.commit()
        return document_id
    except sqlite3.IntegrityError:
        # ハッシュ衝突、ドキュメントは既に存在
        conn.rollback()
        existing = find_document_by_hash(content_hash)
        return existing['id'] if existing else -1
    finally:
        conn.close()


def get_document_with_analysis(document_id: int) -> Optional[Dict[str, Any]]:
    """ドキュメントと完全な解析結果を取得"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # ドキュメントを取得
    cursor.execute('SELECT * FROM documents WHERE id = ?', (document_id,))
    doc_row = cursor.fetchone()
    if not doc_row:
        conn.close()
        return None
    
    document = dict(doc_row)
    document['paragraphs'] = []
    
    # 段落を取得
    cursor.execute('''
        SELECT * FROM paragraphs WHERE document_id = ? ORDER BY paragraph_index
    ''', (document_id,))
    para_rows = cursor.fetchall()
    
    for para_row in para_rows:
        paragraph = dict(para_row)
        paragraph['tokens'] = []
        
        # トークンを取得
        cursor.execute('''
            SELECT * FROM tokens WHERE paragraph_id = ? ORDER BY token_index
        ''', (para_row['id'],))
        token_rows = cursor.fetchall()
        
        for token_row in token_rows:
            token = dict(token_row)
            token['features'] = json.loads(token['features'])
            paragraph['tokens'].append(token)
        
        document['paragraphs'].append(paragraph)
    
    conn.close()
    return document


def list_documents() -> List[Dict[str, Any]]:
    """全ドキュメントを一覧表示"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, title, dictionary, created_at, 
               (SELECT COUNT(*) FROM paragraphs WHERE document_id = documents.id) as paragraph_count
        FROM documents 
        ORDER BY updated_at DESC
    ''')
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def delete_document(document_id: int) -> bool:
    """ドキュメントと関連データを削除"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # ON DELETE CASCADE が設定されているため、ドキュメントを削除するだけでよい
    cursor.execute('DELETE FROM documents WHERE id = ?', (document_id,))
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    
    return affected > 0


def check_existing_analysis(content: str, dictionary: str) -> Optional[Dict[str, Any]]:
    """同一コンテンツの解析結果が既にあるか確認"""
    content_hash = compute_hash(content, dictionary)
    doc = find_document_by_hash(content_hash)
    if doc:
        return get_document_with_analysis(doc['id'])
    return None


# データベースを初期化
init_db()
