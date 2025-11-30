from pathlib import Path
import urllib.request
import subprocess
import requests

p = Path(__file__).parent

def req():
    try:
        requests.get('https://github.com', timeout=3)
    except requests.RequestException:
        return

    e = {
        p / 'javascript/exif-reader.js': 'https://raw.githubusercontent.com/mattiasw/ExifReader/main/dist/exif-reader.js',
        p / 'javascript/exif-reader-LICENSE': 'https://raw.githubusercontent.com/mattiasw/ExifReader/main/LICENSE'
    }

    for f, u in e.items():
        if not f.exists():
            f.write_bytes(urllib.request.urlopen(u).read())

    subprocess.run(['git', 'pull', 'origin'], cwd=p, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

req()