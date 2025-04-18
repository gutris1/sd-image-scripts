from pathlib import Path
import subprocess

path = Path(__file__).parent

def git(*args):
    return subprocess.run(['git', *args], cwd=path, text=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL).stdout.strip()

def req():
    url = git('config', '--get', 'remote.origin.url')
    local = git('rev-parse', 'HEAD')
    remote = subprocess.run(['git', 'ls-remote', url, 'HEAD'], text=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL).stdout.split()[0]
    if local != remote: subprocess.run(['git', 'pull'], cwd=path, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

req()
