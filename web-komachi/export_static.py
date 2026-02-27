"""
静态数据导出脚本
将主应用的数据库导出为静态 JSON 文件，供纯静态网站使用。

用法（在主项目目录运行）:
    python web-komachi/export_static.py

更新数据库后需要重新运行此脚本以同步更新静态数据。
"""
import sqlite3
import json
import os
import sys
from pathlib import Path

# 路径配置
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
MAIN_DATA_DIR = os.path.join(PROJECT_ROOT, "data")
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "data")
OUTPUT_DOC_DIR = os.path.join(OUTPUT_DIR, "documents")


def get_registry_path():
    """获取主应用注册表路径"""
    return os.path.join(MAIN_DATA_DIR, "registry.db")


def get_document_db_path(db_filename):
    """获取文档数据库路径"""
    return os.path.join(MAIN_DATA_DIR, "documents", db_filename)


def export_document(doc_info):
    """导出单个文档的完整数据"""
    db_path = get_document_db_path(doc_info['db_filename'])
    
    if not os.path.exists(db_path):
        print(f"  ⚠ 警告: 数据库文件不存在: {db_path}")
        return None
    
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # 获取原文
    cursor.execute('SELECT original_text FROM content WHERE id = 1')
    content_row = cursor.fetchone()
    content = content_row['original_text'] if content_row else ''
    
    # 获取段落和词元
    paragraphs = []
    cursor.execute('SELECT * FROM paragraphs ORDER BY paragraph_index')
    
    for para_row in cursor.fetchall():
        paragraph = {
            'index': para_row['paragraph_index'],
            'content': para_row['content'],
            'tokens': []
        }
        
        cursor.execute(
            'SELECT * FROM tokens WHERE paragraph_id = ? ORDER BY token_index',
            (para_row['id'],)
        )
        for token_row in cursor.fetchall():
            token = {
                'surface': token_row['surface'],
                'features': json.loads(token_row['features'])
            }
            paragraph['tokens'].append(token)
        
        paragraphs.append(paragraph)
    
    conn.close()
    
    return {
        'content': content,
        'paragraphs': paragraphs
    }


def export_all():
    """导出所有数据"""
    registry_path = get_registry_path()
    
    if not os.path.exists(registry_path):
        print(f"✖ 错误: 注册表不存在: {registry_path}")
        print("  请确保主应用已创建并有文档数据")
        return False
    
    # 确保输出目录存在
    os.makedirs(OUTPUT_DOC_DIR, exist_ok=True)
    
    # 读取注册表
    conn = sqlite3.connect(registry_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # 获取所有文档基本信息
    cursor.execute('SELECT * FROM documents ORDER BY id')
    
    documents = []
    exported_count = 0
    
    for row in cursor.fetchall():
        doc_id = str(row['id'])
        doc_info = dict(row)
        
        print(f"📄 导出文档: {row['title']}")
        
        # 获取标签
        cursor.execute('''
            SELECT t.name, t.category FROM tags t
            JOIN document_tags dt ON t.id = dt.tag_id
            WHERE dt.document_id = ?
        ''', (row['id'],))
        tags = [{'name': r['name'], 'category': r['category']} for r in cursor.fetchall()]
        
        # 获取元数据
        cursor.execute(
            'SELECT key, value FROM document_metadata WHERE document_id = ?',
            (row['id'],)
        )
        metadata = {r['key']: r['value'] for r in cursor.fetchall()}
        
        # 导出文档详细数据
        doc_data = export_document(doc_info)
        if doc_data:
            # 合并所有信息
            full_doc = {
                'id': doc_id,
                'title': row['title'],
                'dictionary': row['dictionary'],
                'paragraph_count': row['paragraph_count'],
                'token_count': row['token_count'],
                'tags': tags,
                'metadata': metadata,
                'content': doc_data['content'],
                'paragraphs': doc_data['paragraphs']
            }
            
            # 保存单个文档 JSON
            doc_path = os.path.join(OUTPUT_DOC_DIR, f"{doc_id}.json")
            with open(doc_path, 'w', encoding='utf-8') as f:
                json.dump(full_doc, f, ensure_ascii=False, indent=2)
            
            # 添加到索引（不包含 content 和 paragraphs）
            documents.append({
                'id': doc_id,
                'title': row['title'],
                'dictionary': row['dictionary'],
                'paragraph_count': row['paragraph_count'],
                'token_count': row['token_count'],
                'tags': tags,
                'metadata': metadata
            })
            
            exported_count += 1
            print(f"  ✓ 已导出: data/documents/{doc_id}.json")
    
    conn.close()
    
    # 收集所有标签
    all_tags = {}
    for doc in documents:
        for tag in doc['tags']:
            key = tag['name']
            if key not in all_tags:
                all_tags[key] = {'name': tag['name'], 'category': tag['category'], 'count': 0}
            all_tags[key]['count'] += 1
    
    # 保存索引文件
    index = {
        'documents': documents,
        'tags': list(all_tags.values()),
        'stats': {
            'document_count': len(documents),
            'total_tokens': sum(d['token_count'] for d in documents)
        }
    }
    
    index_path = os.path.join(OUTPUT_DIR, "index.json")
    with open(index_path, 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
    
    print()
    print("=" * 50)
    print(f"✓ 导出完成!")
    print(f"  - 文档数: {exported_count}")
    print(f"  - 索引文件: data/index.json")
    print(f"  - 文档目录: data/documents/")
    print()
    print("下一步:")
    print("  1. 将 web-komachi 文件夹部署到静态托管服务")
    print("  2. 或者本地预览: 在 web-komachi 目录运行")
    print("     python -m http.server 8080")
    print("=" * 50)
    
    return True


if __name__ == '__main__':
    print("=" * 50)
    print("Project Komachi - 静态数据导出工具")
    print("=" * 50)
    print()
    export_all()
