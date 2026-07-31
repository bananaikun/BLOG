import re
import os

os.chdir(r'D:\mod\HaYenai\blog\XHBlogs\app\push\components')

for f in ['PushVersions.tsx', 'PushNewVersion.tsx', 'PushChangelog.tsx']:
    with open(f, 'r', encoding='utf-8') as fp:
        c = fp.read()

    # Remove token prop from function signature
    c = re.sub(r'export default function (\w+)\(\{ token \}: \{ token: string \}\)', r'export default function \1()', c)

    # Remove token from deps arrays
    c = re.sub(r', \[token\]', '', c)
    c = re.sub(r'\[token\]', '[]', c)

    # Replace token in Authorization header (multiple variants)
    c = c.replace("`Bearer ${token}`", "`Bearer hayenai-admin-2024`")

    with open(f, 'w', encoding='utf-8') as fp:
        fp.write(c)

    print(f'Modified: {f}')