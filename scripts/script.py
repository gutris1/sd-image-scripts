from fastapi import FastAPI, Request
import gradio as gr
import httpx

from modules.script_callbacks import on_app_started
from modules import cache

API = 'https://civitai.com/api/v1'
H = f'{API}/model-versions/by-hash/{{}}'
S = 'https://civitai.com/search/models?sortBy=models_v9&query={}'

V = cache.cache('sd-image-scripts')

async def Fetch(n, h, cv=False):
    k = f'{n}|{h}|{cv}'
    if k in V: return V[k]

    nonlink = f"<span class='sd-image-scripts-nonlink'>{n}{'' if cv else f': {h}'}</span>"

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
                    fN = d.get('model', {}).get('name')
                    sN = d.get('name')
                    if fN and sN:
                        name = f'{fN} - {sN}'
                        result = (
                            f"<a class='sd-image-scripts-link' "
                            f"href='https://civitai.com/models/{d['modelId']}?modelVersionId={d['id']}' "
                            f"target='_blank' tabindex='-1'>{name}</a>"
                        )
                        V[k] = result
                        return result

            except Exception: pass
            t = t[:-2]

    result = nonlink if cv else f"<a class='sd-image-scripts-link' href='{S.format(h)}' target='_blank' tabindex='-1'>{n}</a>"
    V[k] = result
    return result


def Result(l, m):
    return f"""
      <div class='sd-image-scripts-modeloutput-line'>
        <div class='sd-image-scripts-modeloutput-label'>{l}</div>
        <div class='sd-image-scripts-modeloutput-hashes'>{" ".join(m)}</div>
      </div>
    """

def app(_: gr.Blocks, app: FastAPI):
    @app.post('/sd-image-scripts-models-link')
    async def _(req: Request):
        d = await req.json()
        f = ''

        for c, i in d.items():
            if not i: continue
            cv = not (c in ('embed', 'lora')) and (c in ('checkpoint', 'vae'))
            m = [await Fetch(v['n'], v['h'], cv) for v in i]
            f += Result(c, m)

        return {'html': f"<div id='SD-Image-Scripts-Model-Output'>{f}</div>" if f else ''}

on_app_started(app)