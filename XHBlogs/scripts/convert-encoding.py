"""将原推送服务的 GBK JSON 文件转换为 UTF-8"""
import os
import json

SRC_DIR = r'D:\mod\HaYenai\推送更新程序（应用构建不代入此文件夹）\server\data'
DST_DIR = r'D:\mod\HaYenai\blog\XHBlogs\data\push'

os.makedirs(DST_DIR, exist_ok=True)

for fname in os.listdir(SRC_DIR):
    src_path = os.path.join(SRC_DIR, fname)
    dst_path = os.path.join(DST_DIR, fname)
    if not os.path.isfile(src_path):
        continue

    with open(src_path, 'rb') as f:
        raw = f.read()

    # 尝试 UTF-8
    try:
        text = raw.decode('utf-8')
    except UnicodeDecodeError:
        # 尝试 GBK
        try:
            text = raw.decode('gbk')
        except:
            print(f'Cannot decode {fname}')
            continue

    # 解析并重新写入（规范化格式 + UTF-8）
    try:
        if fname.endswith('.json'):
            obj = json.loads(text)
            with open(dst_path, 'w', encoding='utf-8', newline='\n') as f:
                json.dump(obj, f, ensure_ascii=False, indent=2)
            print(f'Converted: {fname}')
        else:
            with open(dst_path, 'w', encoding='utf-8') as f:
                f.write(text)
            print(f'Copied text: {fname}')
    except json.JSONDecodeError:
        # 非 JSON 文件直接复制
        with open(dst_path, 'wb') as f:
            f.write(text.encode('utf-8'))
        print(f'Binary copy: {fname}')