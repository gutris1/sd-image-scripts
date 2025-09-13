async function SharedImageParser(img, imgSrc = false) {
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

  let output = '', buff, blob, tags;

  if (img.src.startsWith('data:')) {
    const [prefix, base64] = img.src.split(','), b = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    buff = b.buffer;
    blob = new Blob([b], { type: prefix.match(/data:(.*?);base64/)[1] });
  } else {
    const url = imgSrc ? img.src : (window.SDHubImg?.trim() || img.src);
    blob = await (await fetch(url)).blob();
    buff = await blob.arrayBuffer();
  }

  img.src = URL.createObjectURL(blob);
  tags = ExifReader.load(buff);

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

function SharedPromptParser(t) {
  const negativePromptIndex = t.indexOf('Negative prompt:'),
  stepsIndex = t.indexOf('Steps:'),
  hashesIndex = t.indexOf('Hashes:');

  let prompt = '', negativePrompt = '', params = '';

  if (negativePromptIndex !== -1) {
    prompt = t.substring(0, negativePromptIndex).trim();
  } else if (stepsIndex !== -1) {
    prompt = t.substring(0, stepsIndex).trim();
  } else {
    prompt = t.trim();
  }

  if (negativePromptIndex !== -1 && stepsIndex !== -1 && stepsIndex > negativePromptIndex) {
    negativePrompt = t.slice(negativePromptIndex + 'Negative prompt:'.length, stepsIndex).trim();
  }

  if (stepsIndex !== -1) {
    const paramsRAW = t.slice(stepsIndex).trim();
    params = paramsRAW.replace(/,\s*(Lora hashes|TI hashes):\s*"[^"]+"/g, '').trim();

    const h = t.slice(hashesIndex).match(/Hashes:\s*(\{.*?\})(,\s*)?/);
    if (h?.[1]) params = params.replace(h[0], '').trim();
    if (params.endsWith(',')) params = params.slice(0, -1).trim();

    return { prompt, negativePrompt, params, paramsRAW };
  } else {
    params = t.trim();
    return { prompt, negativePrompt, params, paramsRAW: null };
  }
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
      const Cat = { checkpoint: [], vae: [], lora: [], embed: [] },
      EmbedNames = new Set(),
      LoraNames = new Set(),
      HashesDict = {},

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
              if (!EmbedNames.has(n)) {
                EmbedNames.add(n);
                Cat.embed.push({ n, h });
              }
            } else if (k.startsWith('lora:')) {
              const n = k.slice(5);
              HashesDict[n] = h;
              if (!LoraNames.has(n)) {
                LoraNames.add(n);
                Cat.lora.push({ n, h });
              }
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
          if (h && !HashesDict[n] && !LoraNames.has(n)) {
            LoraNames.add(n);
            Cat.lora.push({ n, h });
          }
        }
      }

      if (tiHashEX) {
        const embedPairs = tiHashEX[1].split(',').map(pair => pair.trim());
        for (const p of embedPairs) {
          const [n, h] = p.split(':').map(x => x.trim());
          if (h && !HashesDict[n] && !EmbedNames.has(n)) {
            EmbedNames.add(n);
            Cat.embed.push({ n, h });
          }
        }
      }

      try {
        const r = await fetch('/sd-image-scripts-models-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Cat)
        });

        if (!r.ok) throw new Error(`Error ${r.status}`);

        const data = await r.json();

        setTimeout(() => {
          ['sd-image-parser-modeloutput-label', 'sd-image-parser-modeloutput-hashes'].forEach(C => {
            document.querySelectorAll(`.${C}`).forEach(el =>
              el.classList.add('sd-image-parser-display')
            );
          });
        }, 100);

        return data.html;
      } catch (err) {
        console.error('Fetch failed', err);
        return '';
      }
    })(),

    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
  ]);
}

document.addEventListener('DOMContentLoaded', () => {
  const css = `
    #SD-Image-Parser-Model-Output .sd-image-parser-modeloutput-hashes {
      backdrop-filter: none !important;
    }
  `;

  if (/firefox/i.test(navigator.userAgent)) {
    document.body.append(Object.assign(document.createElement('style'), { id: 'SD-Image-Scripts-Style', textContent: css }));
  }
});