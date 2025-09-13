from pathlib import Path
import urllib.request

from modules.launch_utils import run_git

base = Path(__file__).parent

def req():
    js = {
        (base / 'javascript/exif-reader.js'): 'https://raw.githubusercontent.com/mattiasw/ExifReader/main/dist/exif-reader.js',
        (base / 'javascript/exif-reader-LICENSE'): 'https://raw.githubusercontent.com/mattiasw/ExifReader/main/LICENSE'
    }

    for f, u in js.items():
        if not f.exists():
            f.write_bytes(urllib.request.urlopen(u).read())

    run_git(str(base), base.name, 'pull', desc='', errdesc='')

req()