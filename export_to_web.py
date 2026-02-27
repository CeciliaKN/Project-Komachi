"""
数据导出工具 - 从主应用数据库导出为JSON格式
用于Web版本的源数据
"""
import sys
import os
import json

# 添加主应用路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from app import document_manager


def export_document(doc_id: int, output_dir: str) -> dict:
    """导出单个文档为JSON"""
    doc = document_manager.get_document(doc_id)
    if not doc:
        return None
    
    # 生成源ID（使用原始ID的3位数格式）
    source_id = f"{doc_id:03d}"
    
    # 准备源数据
    source_data = {
        'content': doc.get('content', ''),
        'paragraphs': []
    }
    
    for para in doc.get('paragraphs', []):
        para_data = {
            'content': para.get('content', ''),
            'tokens': []
        }
        for token in para.get('tokens', []):
            para_data['tokens'].append({
                'surface': token['surface'],
                'features': token['features']
            })
        source_data['paragraphs'].append(para_data)
    
    # 保存JSON文件
    output_path = os.path.join(output_dir, f"{source_id}.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(source_data, f, ensure_ascii=False, indent=2)
    
    # 返回索引信息
    tag_categories = {}
    for tag in doc.get('tags', []):
        tag_categories[tag['name']] = tag.get('category', 'general')
    
    return {
        'id': source_id,
        'original_id': doc_id,
        'title': doc['title'],
        'dictionary': doc.get('dictionary', 'unidic-chuko'),
        'tags': [t['name'] for t in doc.get('tags', [])],
        'tag_categories': tag_categories,
        'metadata': doc.get('metadata', {})
    }


def export_all_documents():
    """导出所有文档"""
    # 输出目录
    output_dir = os.path.join(os.path.dirname(__file__), 'web-komachi', 'source', 'documents')
    os.makedirs(output_dir, exist_ok=True)
    
    # 获取所有文档
    documents = document_manager.list_documents()
    
    index = {'documents': []}
    
    for doc_info in documents:
        doc_id = doc_info['id']
        print(f"导出文档 {doc_id}: {doc_info['title']}...")
        
        doc_index = export_document(doc_id, output_dir)
        if doc_index:
            index['documents'].append(doc_index)
            print(f"  -> {doc_index['id']}.json")
    
    # 保存索引
    index_path = os.path.join(os.path.dirname(__file__), 'web-komachi', 'source', 'index.json')
    with open(index_path, 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
    
    print(f"\n导出完成！共 {len(index['documents'])} 个文档")
    print(f"索引文件: {index_path}")


if __name__ == '__main__':
    export_all_documents()
