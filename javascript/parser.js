async function SharedImageParser(img) {
  const decodeUserComment = (array) => {
    const result = [];
    let pos = 7;

    if (array[8] === 123) for (let i = pos; i < array.length; i += 2) { const a = array[i], b = array[i + 1]; result.push(a === 0 && b === 32 ? 32 : a * 256 + b); }
    else {
      for (let i = pos; i < array.length; i++) {
        if (i === 7 && array[i] === 0) continue;
        if (array[i] === 0) if (i + 1 < array.length && array[i + 1] === 0) { i++; continue; }
        if (i + 1 < array.length) { const a = array[i], b = array[i + 1]; result.push(a === 0 && b === 32 ? 32 : a * 256 + b); i++; continue; }
      }
    }

    const output = new TextDecoder('utf-16').decode(new Uint16Array(result)).trim();
    return output.replace(/^UNICODE[\x00-\x20]*/, '');
  },

  NovelAI = (input) => {
    const NAIround = v => Math.round(v * 10000) / 10000,
    NAIMultiplyRange = (start, multiplier) => res.slice(start).forEach(row => row[1] = NAIround(row[1] * multiplier)),
    re_attention = /\{|\[|\}|\]|[^\{\}\[\]]+/gmu,
    curly_bracket_multiplier = 1.05,
    square_bracket_multiplier = 1 / 1.05;
    let t = input.replaceAll('(', '\\(').replaceAll(')', '\\)').replace(/\\{2,}(\(|\))/gim, '\$1'),
    res = [], curly_brackets = [], square_brackets = [], result = '';

    for (const match of t.matchAll(re_attention)) {
      let w = match[0];
      if (w === '{') curly_brackets.push(res.length);
      else if (w === '[') square_brackets.push(res.length);
      else if (w === '}' && curly_brackets.length > 0) NAIMultiplyRange(curly_brackets.pop(), curly_bracket_multiplier);
      else if (w === ']' && square_brackets.length > 0) NAIMultiplyRange(square_brackets.pop(), square_bracket_multiplier);
      else res.push([w, 1.0]);
    }

    for (const pos of curly_brackets) NAIMultiplyRange(pos, curly_bracket_multiplier);
    for (const pos of square_brackets) NAIMultiplyRange(pos, square_bracket_multiplier);
    if (res.length === 0) res = [['', 1.0]];

    let i = 0;
    while (i + 1 < res.length) { if (res[i][1] === res[i + 1][1]) { res[i][0] += res[i + 1][0]; res.splice(i + 1, 1); } else { i++; }}
    for (let i = 0; i < res.length; i++) { if (res[i][1] === 1.0) { result += res[i][0]; } else { result += `(${res[i][0]}:${res[i][1]})`; }}
    return result;
  },

  swarmUI = (Sui, extraData = {}) => {
    const parts = [],

    Format = {
      prompt: v => `${v}\n`,
      negativeprompt: v => `Negative prompt: ${v}\n`,
      steps: v => `Steps: ${v}`,
      sampler: v => `Sampler: ${v.replace(/\beuler\b|\beuler(-\w+)?/gi, m => m.replace(/euler/i, 'Euler'))}`,
      scheduler: v => `Schedule type: ${v}`,
      cfgscale: v => `CFG scale: ${v}`,
      seed: v => `Seed: ${v}`,
      width: (_, obj) => obj.width && obj.height ? `Size: ${obj.width}x${obj.height}` : null,
      model: v => `Model: ${v}`,
      vae: v => `VAE: ${v.split('/').pop()}`
    };

    for (const [key, fn] of Object.entries(Format)) {
      if (Sui[key] != null) {
        const str = fn(Sui[key], Sui);
        if (str) parts.push(str.replace(/\n$/, ''));
      }
    }

    window.SharedParserSoftwareInfo = Sui?.swarm_version ? `SwarmUI ${Sui.swarm_version}` : '';

    const ignoreKeys = Object.keys(Format).concat('swarm_version'),
    otherParams = Object.entries(Sui).filter(([k]) => !ignoreKeys.includes(k)).map(([k, v]) => `${k}: ${v}`),
    extraParams = Object.entries(extraData).map(([k, v]) => `${k}: ${v}`);
    return [...parts, ...otherParams, ...extraParams].join(', ').trim();
  };

  ['EncryptInfo', 'Sha256Info', 'ExtrasInfo', 'PostProcessingInfo', 'NaiSourceInfo', 'SoftwareInfo']
    .forEach(k => window[`SharedParser${k}`] = '');

  let output = '', buff;

  if (img.src.startsWith('data:')) {
    const [prefix, base64] = img.src.split(','), b = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    buff = b.buffer;
    img.src = URL.createObjectURL(new Blob([b], { type: prefix.match(/data:(.*?);base64/)[1] }));
  } else {
    const src = (window.SDHubImg && window.SDHubImg.trim()) || img.src,
    res = await fetch(src), blob = await res.blob();
    buff = await blob.arrayBuffer();
    img.src = URL.createObjectURL(blob);
  }

  const tags = ExifReader.load(buff);

  if (tags) {
    window.SharedParserEncryptInfo = tags.Encrypt?.description || '';
    window.SharedParserSha256Info = tags.EncryptPwdSha?.description || '';

    const extra = tags.extras?.description || tags.postprocessing?.description || '';
    window.SharedParserExtrasInfo = tags.extras?.description ? extra : '';
    window.SharedParserPostProcessingInfo = tags.extras?.description ? '' : extra;

    if (tags.parameters?.description) {
      if (tags.parameters.description.includes('sui_image_params')) {
        const parSing = JSON.parse(tags.parameters.description);
        const Sui = parSing['sui_image_params'];
        output = swarmUI(Sui, {});
      } else {
        output = tags.parameters.description;
      }

    } else if (tags.UserComment?.value) {
      const array = tags.UserComment.value;
      const UserComments = decodeUserComment(array);
      if (UserComments.includes('sui_image_params')) {
        const rippin = UserComments.trim().replace(/[\x00-\x1F\x7F]/g, '');
        const parSing = JSON.parse(rippin);
        if (parSing['sui_image_params']) {
          const Sui = parSing['sui_image_params'];
          const SuiExtra = parSing['sui_extra_data'] || {};
          output = swarmUI(Sui, SuiExtra);
        }
      } else {
        if (UserComments.startsWith('Postprocess upscale')) {
          window.SharedParserExtrasInfo = UserComments;
          output = '';
        } else {
          output = UserComments;
        }
      }

    } else if (tags['Software']?.description === 'NovelAI' && tags.Comment?.description) {
      window.SharedParserSoftwareInfo = tags['Software']?.description || '';
      window.SharedParserNaiSourceInfo = tags['Source']?.description || '';
      const nai = JSON.parse(tags.Comment.description);
      nai.sampler = 'Euler';

      output = NovelAI(nai['prompt']) +
        '\nNegative prompt: ' + NovelAI(nai['uc']) +
        '\nSteps: ' + nai['steps'] +
        ', Sampler: ' + nai['sampler'] +
        ', CFG scale: ' + parseFloat(nai['scale']).toFixed(1) +
        ', Seed: ' + nai['seed'] +
        ', Size: ' + nai['width'] + 'x' + nai['height'] +
        ', Clip skip: 2, ENSD: 31337';

    } else if (tags.prompt?.description?.includes('"filename_prefix": "ComfyUI"')) {
      output = 'ComfyUI<br>Nothing To Read Here';

    } else if (tags.invokeai_graph?.description) {
      output = 'InvokeAI<br>Nothing To Read Here';

    } else {
      output = 'Nothing To See Here';
    }
  }

  return output;
}

function SharedVersionParser(i) {
  const m = i.match(/(?:,\s*)?Version:\s*([^\s,]+)/);
  if (m) {
    const v = m[1], T = 'Stable Diffusion WebUI'

    d = [
      {
        n: (v) => /^v?(\d)\.(\d{1,2})\.(\d)(-RC)?$/.test(v),
        l: 'https://github.com/AUTOMATIC1111/stable-diffusion-webui',
        t: (v) => `${T} — ${v}`,
      },
      {
        n: (v) => v.includes('f2.0.1v1.10.1'),
        l: 'https://github.com/lllyasviel/stable-diffusion-webui-forge',
        t: (v) => `${T} Forge — ${v.split(/[\s,]/)[0]}`,
      },
      {
        n: (v) => v.includes('f1.0.0v2-v1.10.1'),
        l: 'https://github.com/Panchovix/stable-diffusion-webui-reForge',
        t: (v) => `${T} ReForge — ${v.split(/[\s,]/)[0]}`,
      },
      {
        n: (v) => v === 'classic',
        l: 'https://github.com/Haoming02/sd-webui-forge-classic',
        t: (v) => `${T} Forge Classic — ${v.split(/[\s,]/)[0]}`,
      },
    ],

    w = d.find(({ n }) => n(v));

    if (w) {
      const { l, t } = w, f = typeof t === 'function' ? t(v) : `${t} ${v}`;
      window.SharedParserSoftwareInfo = `
        <a href='${l}' class='sd-image-parser-software' target='_blank' rel='noopener noreferrer'>
          ${f}
        </a>
      `;
    }
  }

  return i;
}

async function SharedModelsFetch(i, timeout = 60000) {
  const err = console.error;
  console.error = function(...args) {
    const msg = args.toString();
    if (msg) return;
    err.apply(console, args);
  };

  return await Promise.race([
    (async () => {
      let FetchedModels = '';

      const Cat = { checkpoint: [], vae: [], lora: [], embed: [] },

      EmbedNames = new Set(),
      LoraNames = new Set(),
      HashesDict = {},

      Link = 'sd-image-parser-link',
      nonLink = 'sd-image-parser-nonlink',

      TIHashesSearchLink = async (n, h) => h
        ? `<a class='${Link}' href='https://civitai.com/search/models?sortBy=models_v9&query=${h}' target='_blank'>${n}</a>`
        : `<span class='${nonLink}'>${n}: ${h}</span>`,

      FetchingModels = async (n, h, isThat = false) => {
        const N = `<span class='${nonLink}'>${n}${isThat ? '' : `: ${h}`}</span>`;
        if (!h) return N;
        try {
          const r = await fetch(`https://civitai.com/api/v1/model-versions/by-hash/${h}`);
          if (!r.ok) return N;
          const d = await r.json();
          if (!d.model?.name) return N;
          return `<a class='${Link}' href='https://civitai.com/models/${d.modelId}?modelVersionId=${d.id}' target='_blank'>${d.model.name}</a>`;
        } catch {
          return N;
        }
      },

      FetchLora = async (n, h) => {
        if (!n || !h || LoraNames.has(n)) return;
        LoraNames.add(n);
        const Hashes = async () => {
          let t = h;
          while (t.length >= 8) {
            const r = await FetchingModels(n, t, false);
            if (!r.includes(nonLink)) return r;
            t = t.slice(0, -2);
          }
          return await TIHashesSearchLink(n, h);
        };
        const f = await Hashes();
        Cat.lora.push(f);
      },

      FetchEmbed = async (n, h) => {
        if (!n || !h || EmbedNames.has(n)) return;
        EmbedNames.add(n);
        const Hashes = async () => {
          let t = h;
          while (t.length >= 8) {
            const r = await FetchingModels(n, t, false);
            if (!r.includes(nonLink)) return r;
            t = t.slice(0, -2);
          }
          return await TIHashesSearchLink(n, h);
        };
        const f = await Hashes();
        Cat.embed.push(f);
      },

      FetchResult = (l, m) => {
        return `
          <div class='sd-image-parser-modeloutput-line'>
            <div class='sd-image-parser-modeloutput-label'>${l}</div>
            <div class='sd-image-parser-modeloutput-hashes'>${m.join(' ')}</div>
          </div>
        `;
      },

      modelEX = i.includes('Model: "') ? i.match(/Model:\s*"?([^"]+)"/) : i.match(/Model:\s*([^,]+)/),
      modelHashEX = i.match(/Model hash:\s*([^,]+)/),
      vaeEX = i.match(/VAE:\s*([^,]+)/),
      vaeHashEX = i.match(/VAE hash:\s*([^,]+)/),
      loraHashEX = i.match(/Lora hashes:\s*"([^"]+)"/),
      tiHashEX = i.match(/TI hashes:\s*"([^"]+)"/),
      hashesIndex = i.indexOf('Hashes:'),
      hashesEX = hashesIndex !== -1 ? i.slice(hashesIndex).match(/Hashes:\s*(\{.*?\})(,\s*)?/) : null;

      if (modelEX) {
        const modelValue = modelEX[1],
        modelHash = modelHashEX ? modelHashEX[1] : null,
        vaeValue = vaeEX ? vaeEX[1] : null,
        vaeHash = vaeHashEX ? vaeHashEX[1] : null;

        if (modelHash || vaeValue || vaeHash) Cat.checkpoint.push({ n: modelValue, h: modelHash });
        if (vaeValue || vaeHash) Cat.vae.push({ n: vaeValue, h: vaeHash });
      }

      if (hashesEX && hashesEX[1]) {
        try {
          const s = JSON.parse(hashesEX[1].trim());
          for (const [k, h] of Object.entries(s)) {
            if (k.startsWith('embed:')) {
              const n = k.slice(6);
              HashesDict[n] = h;
              await FetchEmbed(n, h);
            } else if (k.startsWith('lora:')) {
              const n = k.slice(5);
              HashesDict[n] = h;
              await FetchLora(n, h);
            }
          }
        } catch (e) {
          console.warn('Failed to parse Hashes:', e);
        }
      }

      if (loraHashEX) {
        const loraPairs = loraHashEX[1].split(',').map(pair => pair.trim());
        for (const p of loraPairs) {
          const [n, h] = p.split(':').map(x => x.trim());
          if (h && !HashesDict[n]) await FetchLora(n, h);
        }
      }

      if (tiHashEX) {
        const embedPairs = tiHashEX[1].split(',').map(pair => pair.trim());
        for (const p of embedPairs) {
          const [n, h] = p.split(':').map(x => x.trim());
          if (h && !HashesDict[n]) await FetchEmbed(n, h);
        }
      }

      for (const [category, items] of Object.entries(Cat)) {
        if (items.length > 0) {
          let models;
          if (category === 'embed' || category === 'lora') models = items;
          else {
            const isThat = category === 'checkpoint' || category === 'vae';
            models = await Promise.all(items.map(({ n, h }) => FetchingModels(n, h, isThat)));
          }
          FetchedModels += FetchResult(category, models);

          setTimeout(() => {
            ['sd-image-parser-modeloutput-label', 'sd-image-parser-modeloutput-hashes'].forEach(C => {
              document.querySelectorAll(`.${C}`).forEach(el => el.classList.add('sd-image-parser-modeloutput-display'));
            });
          }, 100);
        }
      }

      return FetchedModels.trim() ? `<div id='SD-Image-Parser-Model-Output'>${FetchedModels}</div>` : '';
    })(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
  ]);
}