from pathlib import Path
import urllib.request
import subprocess
import requests

base = Path(__file__).parent

def check():
    try:
        requests.get('https://github.com', timeout=3)
        return True
    except requests.RequestException as e:
        print(f'SD-Image-Scripts: {e}')
        return False

def git(*args):
    return subprocess.run(['git', *args], cwd=base, text=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL).stdout.strip()

def req():
    exif = {
        (base / 'javascript/exif-reader.js'): 'https://raw.githubusercontent.com/mattiasw/ExifReader/main/dist/exif-reader.js',
        (base / 'javascript/exif-reader-LICENSE'): 'https://raw.githubusercontent.com/mattiasw/ExifReader/main/LICENSE'
    }

    for files, url in exif.items():
        if not files.exists():
            files.write_bytes(urllib.request.urlopen(url).read())

    url = git('config', '--get', 'remote.origin.url')
    local = git('rev-parse', 'HEAD')
    remote = subprocess.run(['git', 'ls-remote', url, 'HEAD'], text=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL).stdout.split()[0]
    if local != remote: subprocess.run(['git', 'pull'], cwd=base, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

if check(): req()
