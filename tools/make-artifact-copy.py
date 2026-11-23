#!/usr/bin/env python3
"""做一份發布到 Claude artifact 用的複本。

artifact 發布時會自動包上 <!DOCTYPE>、<html>、<head>、<body>，所以複本要先拿掉這些外框標籤，
其餘照原樣；標題改成這個方案的名字（例如「替身掃者・K」）。repo 裡的 index.html 不動。

用法：python3 tools/make-artifact-copy.py 輸出檔 [標題]
例如：python3 tools/make-artifact-copy.py /tmp/替身掃者K.html 替身掃者・K
"""
import re
import sys
from pathlib import Path

src = Path(__file__).resolve().parent.parent / 'index.html'
if len(sys.argv) < 2:
    sys.exit(__doc__)
out, title = Path(sys.argv[1]), (sys.argv[2] if len(sys.argv) > 2 else None)

s = src.read_text(encoding='utf-8')
for pat, repl in [(r'<!DOCTYPE html>\s*', ''), (r'<html[^>]*>\s*', ''), (r'\s*</html>\s*', ''),
                  (r'<head>\s*', ''), (r'\s*</head>\s*', '\n'), (r'<body[^>]*>\s*', ''), (r'\s*</body>', '')]:
    s, n = re.subn(pat, repl, s, count=1)
    if n != 1:
        sys.exit('找不到 ' + pat + '，index.html 的外框可能改過了')
if title:
    s, n = re.subn(r'<title>[^<]*</title>', '<title>' + title + '</title>', s, count=1)
    if n != 1:
        sys.exit('找不到 <title>')
left = [t for t in ['<!DOCTYPE', '<html', '<head>', '<body', '</body>', '</html>', '</head>'] if t in s]
if left:
    sys.exit('還有外框標籤沒拿掉：' + ', '.join(left))
out.write_text(s.strip() + '\n', encoding='utf-8')
print(out, len(s.encode('utf-8')), 'bytes')
