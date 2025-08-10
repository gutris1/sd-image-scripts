from modules.script_callbacks import on_app_started
from fastapi import FastAPI, Request
from modules import cache
import gradio as gr
import httpx

API = 'https://civitai.com/api/v1'
H = f'{API}/model-versions/by-hash/{{}}'
S = 'https://civitai.com/search/models?sortBy=models_v9&query={}'

V = cache.cache('sd_image_scripts')

async def Fetch(n, h, cv=False):
    k = f"{n}|{h}|{cv}"
    if k in V: return V[k]

    nonlink = (f"<span class='sd-image-parser-nonlink'>{n}{'' if cv else f': {h}'}</span>")

    if not h:
        result = nonlink
        V[k] = result
        return result

    async with httpx.AsyncClient(timeout=10) as p:
        t = h
        while len(t) >= 8:
            try:
                r = await p.get(H.format(t))
                if r.status_code == 200:
                    d = r.json()
                    if d.get('model', {}).get('name'):
                        result = (
                            f"<a class='sd-image-parser-link' "
                            f"href='https://civitai.com/models/{d['modelId']}?modelVersionId={d['id']}' "
                            f"target='_blank'>{d['model']['name']}</a>"
                        )

                        V[k] = result
                        return result

            except Exception: pass
            t = t[:-2]

    result = nonlink if cv else f"<a class='sd-image-parser-link' href='{S.format(h)}' target='_blank'>{n}</a>"
    V[k] = result
    return result

def Result(l, m):
    return f"""
      <div class='sd-image-parser-modeloutput-line'>
        <div class='sd-image-parser-modeloutput-label'>{l}</div>
        <div class='sd-image-parser-modeloutput-hashes'>{" ".join(m)}</div>
      </div>
    """

def app(_: gr.Blocks, app: FastAPI):
    @app.post('/sd-image-scripts-models-link')
    async def models_link(request: Request):
        d = await request.json()
        f = ''

        for c, i in d.items():
            if not i:
                continue
            cv = not (c in ('embed', 'lora')) and (c in ('checkpoint', 'vae'))
            m = [await Fetch(v['n'], v['h'], cv) for v in i]
            f += Result(c, m)

        return {'html': f"<div id='SD-Image-Parser-Model-Output'>{f}</div>" if f else ''}

on_app_started(app)