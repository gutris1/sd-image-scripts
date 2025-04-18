from pathlib import Path
import subprocess

def _Req():
    def git(*args):
        return subprocess.run(['git', *args], cwd=path, text=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL).stdout.strip()

    path = Path(__file__).parent
    url = git('config', '--get', 'remote.origin.url')
    local = git('rev-parse', 'HEAD')
    remote = subprocess.run(['git', 'ls-remote', url, 'HEAD'], text=True, stdout=subprocess.PIPE).stdout.split()[0]

    if local != remote:
        subprocess.run(['git', 'pull'], cwd=path)

_Req()
