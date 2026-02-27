"""
Project Komachi 起動スクリプト
実行: python run.py
"""
import os
import sys
import webbrowser
from threading import Timer

# プロジェクトパスを追加
sys.path.insert(0, os.path.dirname(__file__))

from app.app import app

def open_browser():
    """ブラウザを開く"""
    webbrowser.open('http://127.0.0.1:5000')


if __name__ == '__main__':
    print("=" * 50)
    print("  Project Komachi - 古典日本語・近世語文法解析プラットフォーム")
    print("  古典日本語・近世語文法解析ツール")
    print("=" * 50)
    print()
    print("  起動中...")
    print("  アクセスURL: http://127.0.0.1:5000")
    print("  Ctrl+C でサーバーを停止")
    print()
    
    # 2秒後に自動的にブラウザを開く
    Timer(2, open_browser).start()
    
    # Flaskアプリを起動
    app.run(host='127.0.0.1', port=5000, debug=False)
