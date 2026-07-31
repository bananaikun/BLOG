import json, os

path = r'D:\mod\HaYenai\blog\XHBlogs\data\push\changelog.json'
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)
filtered = [c for c in data['changelog'] if c.get('version') and c.get('version') != '']
print(f'过滤前: {len(data["changelog"])} 条')
print(f'过滤后: {len(filtered)} 条')
data['changelog'] = filtered
data['total'] = len(filtered)
with open(path, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print('OK')
for c in filtered[:5]:
    print(f'  v{c["version"]} ({c.get("category","?")}): {(c.get("title") or c.get("changelog",""))[:50]}')