"""
Flaskメインアプリ - Project Komachi 日本語意味解析プラットフォーム
"""
import os
from flask import Flask, render_template, request, jsonify, send_from_directory

from werkzeug.utils import secure_filename

from . import analyzer
from . import database
from . import document_manager

# Flaskアプリを作成
app = Flask(__name__, 
            template_folder=os.path.join(os.path.dirname(__file__), 'templates'),
            static_folder=os.path.join(os.path.dirname(__file__), 'static'))

app.config['SECRET_KEY'] = 'komachi-secret-key-change-in-production'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 最大16MB

# 許可されたファイル拡張子
ALLOWED_EXTENSIONS = {'txt', 'text'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def get_stats():
    """获取统计信息"""
    documents = document_manager.list_documents()
    return {
        'document_count': len(documents),
        'total_tokens': sum(doc.get('token_count', 0) for doc in documents),
        'dictionary_count': len(analyzer.get_available_dictionaries())
    }


# ===== 页面路由 =====

@app.route('/')
def index():
    """首页 - Landing Page"""
    dictionaries = analyzer.get_available_dictionaries()
    stats = get_stats()
    return render_template('home.html', dictionaries=dictionaries, stats=stats)


@app.route('/analyzer')
def analyzer_page():
    """テキスト解析ページ"""
    dictionaries = analyzer.get_available_dictionaries()
    documents = database.list_documents()
    return render_template('index.html', dictionaries=dictionaries, documents=documents)


@app.route('/library')
def library():
    """文書ライブラリページ"""
    dictionaries = analyzer.get_available_dictionaries()
    documents = document_manager.list_documents()
    tags = document_manager.get_all_tags()
    return render_template('library.html', 
                         dictionaries=dictionaries, 
                         documents=documents, 
                         tags=tags)


@app.route('/compare')
def compare():
    """文書比較ページ"""
    documents = document_manager.list_documents()
    return render_template('compare.html', documents=documents)


@app.route('/library/view/<int:doc_id>')
def library_view(doc_id):
    """文書詳細ビューページ"""
    try:
        document = document_manager.get_document(doc_id)
        if document:
            # 确保paragraphs存在
            if 'paragraphs' not in document:
                document['paragraphs'] = []
            return render_template('view.html', document=document)
        return "文書が見つかりません", 404
    except Exception as e:
        import traceback
        traceback.print_exc()
        return f"エラー: {str(e)}", 500


@app.route('/dictionaries')
def dictionaries():
    """辞書情報ページ"""
    dicts = analyzer.get_available_dictionaries()
    return render_template('dictionaries.html', dictionaries=dicts)


@app.route('/api/analyze', methods=['POST'])
def api_analyze():
    """テキスト解析API"""
    try:
        data = request.get_json()
        text = data.get('text', '').strip()
        title = data.get('title', '名称未設定').strip()
        dictionary = data.get('dictionary', 'unidic-chuko')
        
        if not text:
            return jsonify({'error': '解析するテキストを入力してください'}), 400
        
        # キャッシュがあるか確認
        existing = database.check_existing_analysis(text, dictionary)
        if existing:
            return jsonify({
                'success': True,
                'cached': True,
                'document': existing
            })
        
        # 解析を実行
        paragraphs = analyzer.analyze_text(text, dictionary)
        
        # データベースに保存
        doc_id = database.save_document(title, text, dictionary, paragraphs)
        
        # 完全なドキュメントを取得
        document = database.get_document_with_analysis(doc_id)
        
        return jsonify({
            'success': True,
            'cached': False,
            'document': document
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/upload', methods=['POST'])
def api_upload():
    """ファイルアップロードAPI"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'ファイルがアップロードされていません'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'ファイルが選択されていません'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'サポートされていないファイル形式です。txtファイルをアップロードしてください'}), 400
        
        # ファイル内容を読み込み
        filename = secure_filename(file.filename)
        content = file.read()
        
        # 異なるエンコーディングを試行
        text = None
        for encoding in ['utf-8', 'utf-8-sig', 'shift_jis', 'euc-jp', 'cp932', 'iso-2022-jp']:
            try:
                text = content.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        
        if text is None:
            return jsonify({'error': 'ファイルのエンコーディングを解析できません'}), 400
        
        # タイトルを取得（拡張子を除去）
        title = os.path.splitext(filename)[0]
        
        return jsonify({
            'success': True,
            'title': title,
            'content': text
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/documents', methods=['GET'])
def api_list_documents():
    """ドキュメント一覧を取得"""
    documents = database.list_documents()
    return jsonify({'documents': documents})


@app.route('/api/documents/<int:doc_id>', methods=['GET'])
def api_get_document(doc_id):
    """単一ドキュメントを取得"""
    document = database.get_document_with_analysis(doc_id)
    if document:
        return jsonify({'document': document})
    return jsonify({'error': 'ドキュメントが存在しません'}), 404


@app.route('/api/documents/<int:doc_id>', methods=['DELETE'])
def api_delete_document(doc_id):
    """ドキュメントを削除"""
    if database.delete_document(doc_id):
        return jsonify({'success': True})
    return jsonify({'error': '削除に失敗しました'}), 404


@app.route('/api/dictionaries', methods=['GET'])
def api_get_dictionaries():
    """利用可能な辞書リストを取得"""
    dictionaries = analyzer.get_available_dictionaries()
    return jsonify({'dictionaries': dictionaries})


@app.route('/api/token/details', methods=['POST'])
def api_token_details():
    """トークン詳細情報を取得"""
    data = request.get_json()
    features = data.get('features', [])
    dictionary = data.get('dictionary', 'unidic-chuko')
    
    details = analyzer.get_token_details(features, dictionary)
    return jsonify({'details': details})


@app.route('/api/feature-labels', methods=['GET'])
def api_feature_labels():
    """特徴ラベル説明を取得"""
    return jsonify({'labels': analyzer.UNIDIC_FEATURE_LABELS})


# ===== ライブラリAPI =====

@app.route('/api/library/documents', methods=['GET'])
def api_library_list():
    """ライブラリ文書一覧を取得（フィルタリング対応）"""
    tags = request.args.get('tags', '')
    search = request.args.get('search', '')
    
    tag_filter = [t.strip() for t in tags.split(',') if t.strip()] if tags else None
    
    documents = document_manager.list_documents(tag_filter=tag_filter)
    
    # 検索フィルタ
    if search:
        search_lower = search.lower()
        documents = [
            doc for doc in documents
            if search_lower in doc['title'].lower() or
               any(search_lower in (meta_val or '').lower() 
                   for meta_val in doc.get('metadata', {}).values())
        ]
    
    return jsonify({'documents': documents})


@app.route('/api/library/documents/<int:doc_id>', methods=['GET'])
def api_library_get(doc_id):
    """ライブラリから単一文書を取得"""
    document = document_manager.get_document(doc_id)
    if document:
        return jsonify({'document': document})
    return jsonify({'error': '文書が存在しません'}), 404


@app.route('/api/library/documents/<int:doc_id>', methods=['PUT'])
def api_library_update(doc_id):
    """文書のメタデータとタグを更新"""
    try:
        data = request.get_json()
        title = data.get('title')
        metadata = data.get('metadata', {})
        tags = data.get('tags', [])
        
        # 更新标题
        if title:
            document_manager.update_document_title(doc_id, title)
        
        # 更新元数据
        if metadata:
            document_manager.update_document_metadata(doc_id, metadata)
            # 如果选择了时代，自动添加era标签
            if metadata.get('era'):
                era_tag = metadata['era']
                # 确保era标签存在且类别正确
                document_manager.ensure_era_tag(era_tag)
                if era_tag not in tags:
                    tags.append(era_tag)
        
        # 更新标签
        if tags is not None:
            document_manager.update_document_tags(doc_id, tags)
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/library/documents/<int:doc_id>', methods=['DELETE'])
def api_library_delete(doc_id):
    """ライブラリから文書を削除"""
    if document_manager.delete_document(doc_id):
        return jsonify({'success': True})
    return jsonify({'error': '削除に失敗しました'}), 404


@app.route('/api/library/import', methods=['POST'])
def api_library_import():
    """新しい文書をインポートして解析"""
    try:
        data = request.get_json()
        title = data.get('title', '名称未設定').strip()
        content = data.get('content', '').strip()
        dictionary = data.get('dictionary', 'unidic-chuko')
        tags = data.get('tags', [])
        metadata = data.get('metadata', {})
        
        if not content:
            return jsonify({'error': 'コンテンツを入力してください'}), 400
        
        # 既存のチェック
        existing = document_manager.check_existing_analysis(content, dictionary)
        if existing:
            return jsonify({
                'success': True,
                'cached': True,
                'document': existing
            })
        
        # 解析を実行
        paragraphs = analyzer.analyze_text(content, dictionary)
        
        # 新しいデータベースに保存
        doc_id = document_manager.save_document(
            title=title,
            content=content,
            dictionary=dictionary,
            paragraphs=paragraphs,
            tags=tags,
            metadata=metadata
        )
        
        # 完全なドキュメントを取得
        document = document_manager.get_document(doc_id)
        
        return jsonify({
            'success': True,
            'cached': False,
            'document': document
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/library/tags', methods=['GET'])
def api_library_tags():
    """全タグを取得"""
    tags = document_manager.get_all_tags()
    return jsonify({'tags': tags})


@app.route('/api/library/tags', methods=['POST'])
def api_library_create_tag():
    """新しいタグを作成"""
    try:
        data = request.get_json()
        name = data.get('name', '').strip()
        category = data.get('category', 'general')
        
        if not name:
            return jsonify({'error': 'タグ名を入力してください'}), 400
        
        tag_id = document_manager.create_tag(name, category)
        return jsonify({'success': True, 'tag_id': tag_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/library/categories', methods=['GET'])
def api_library_categories():
    """タグカテゴリを取得"""
    categories = document_manager.get_tag_categories()
    return jsonify({'categories': categories})


# エラーハンドリング
@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'リソースが存在しません'}), 404


@app.errorhandler(500)
def server_error(e):
    return jsonify({'error': 'サーバー内部エラー'}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)
