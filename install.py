from pathlib import Path
import subprocess
import requests

path = Path(__file__).parent

def check():
    try:
        requests.get('https://github.com', timeout=3)
        return True
    except requests.RequestException as e:
        print(f'SD-Image-Scripts: {e}')
        return False

def git(*args):
    return subprocess.run(['git', *args], cwd=path, text=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL).stdout.strip()

def req():
    url = git('config', '--get', 'remote.origin.url')
    local = git('rev-parse', 'HEAD')
    remote = subprocess.run(['git', 'ls-remote', url, 'HEAD'], text=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL).stdout.split()[0]
    if local != remote: subprocess.run(['git', 'pull'], cwd=path, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

if check(): req()