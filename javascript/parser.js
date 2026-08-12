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
      tiHashEX = i.match(/TI hashes:\s*"([^"]+)"/) || i.match(/TI:\s*"([^"]+)"/),
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
          ['sd-image-scripts-modeloutput-label', 'sd-image-scripts-modeloutput-hashes'].forEach(C => {
            document.querySelectorAll(`.${C}`).forEach(el =>
              el.classList.add('sd-image-scripts-display')
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

const SharedImageInfoReg = {},

SharedImageInfo = (k, c) => SharedImageInfoReg[k] = c;

async function SharedPlainTextToHTML(k, inputs) {
  const P = 'sd-image-scripts',
  outputDisplay = `${P}-display-output-panel`,
  outputFail = `${P}-display-output-fail`,
  columnOverflow = `${P}-column-overflow`,

  SharedImageInfoFallbacks = {
    prompt: 'Prompt', copy_prompt: 'Copy Prompt',
    negative_prompt: 'Negative Prompt', copy_negative_prompt: 'Copy Negative Prompt',
    parameters: 'Parameters', copy_parameters: 'Copy Parameters',
    post_processing: 'Post Processing',
    Encrypt: 'Encrypt',
    EncryptPwdSha: 'EncryptPwdSha',
    software: 'Software',
    source: 'Source',
    copy_seed: 'Copy Seed'
  },

  v = SharedImageInfoReg[k],
  { SharedParserExtrasInfo: ExtrasInfo, SharedParserPostProcessingInfo: PostProcessingInfo,
    SharedParserEncryptInfo: EncryptInfo, SharedParserSha256Info: Sha256Info, SharedParserNaiSourceInfo: NaiSourceInfo,
  } = window,

  { column, sendButton, outputPanel } = v.elements(),

  translate = (k) => v.translate(k, SharedImageInfoFallbacks[k] || k),

  createTitle = (f, l, b = false) => {
    const L = translate(l), C = b ? translate(`copy_${l}`) : '',
    att = [
      b && `data-copy-field='${f}'`,
      `class='${P}-output-title${b ? ` ${P}-copybutton` : ''}'`,
      b && `title='${C}'`,
      b && `onclick='SharedImageInfoCopyButton(event, "${k}")'`
    ].filter(Boolean).join(' ');

    return `<div ${att}>${L}</div>`;
  },

  titles = {
    prompt: createTitle('prompt', 'prompt', true),
    negativePrompt: createTitle('negativePrompt', 'negative_prompt', true),
    params: createTitle('params', 'parameters', true),
    postProcessing: createTitle('postProcessing', 'post_processing'),
    encrypt: createTitle('encrypt', 'Encrypt'),
    sha: createTitle('sha', 'EncryptPwdSha'),
    software: createTitle('software', 'software'),
    source: createTitle('source', 'source'),
    models: ''
  },

  createSection = (t, c) => {
    if (!c?.trim()) return '';
    const empty = t === 'nothing', model = t === titles.models, wrapper = !empty && !model,
    text = wrapper ? `<div class='${P}-output-wrapper'><div class='${P}-output-content'>${c}</div></div>` : c,
    extra = model ? ` ${P}-output-models-section` : '';
    return `<div class='${P}-output-section${extra}'${empty ? " style='height: 100%'" : ''}>${empty ? '' : t}${text}</div>`;
  };

  if (!inputs?.trim() && !(window.SharedParserExtrasInfo?.trim() || window.SharedParserPostProcessingInfo?.trim())) {
    column?.classList.remove(columnOverflow);
    outputPanel.classList.remove(outputDisplay, outputFail);
    sendButton.classList.remove(outputDisplay);
    return '';
  }

  column?.classList.add(columnOverflow);
  outputPanel.classList.add(outputDisplay);

  if (inputs.trim().includes('Nothing To See Here') || inputs.trim().includes('Nothing To Read Here')) {
    outputPanel.classList.add(outputFail);
    sendButton.classList.remove(outputDisplay);
    const failContent = `<div class='${P}-output-failed' style='position: absolute; bottom: 0;'>${inputs}</div>`;
    return createSection('nothing', failContent);
  }

  if (inputs.trim().startsWith('OPPAI:')) {
    let output = '';
    if (EncryptInfo?.trim()) output += createSection(titles.encrypt, EncryptInfo);
    if (Sha256Info?.trim()) output += createSection(titles.sha, Sha256Info);
    output += createSection('', inputs);
    return output;
  }

  sendButton.classList.add(outputDisplay);

  let text = inputs
    .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>').replace(/Seed:\s?(\d+),/gi, (_, seedNumber) =>
      `<span class='${P}-seed-button' data-copy-field='seed' title='${translate("copy_seed")}' onclick='SharedImageInfoCopyButton(event, "${k}")'>Seed</span>: ${seedNumber},`
    ),

  svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="100" height="100">
      <path fill="currentColor" d="M 24.3 17.1 C 24.3 25.9 31.5 33.1 40.3 33.1 C 41.3 33.1 42.3 33 43.3 32.8 L 44 36.7 C 42.8 37 41.6 37.1 40.3 37.1 C 29.2 37.1
        20.3 28.1 20.3 17.1 C 20.3 12.3 22 7.6 25.1 4 L 28.1 6.6 C 25.8 9.5 24.3 13.1 24.3 17.1 Z" style="transform-origin: 32.15px 20.55px;" transform="matrix(-1, 0, 0, -1, 0.000002, 0)"/>
      <path fill="currentColor" d="M 23.2 43.8 L 20.1 41.3 C 22.3 38.5 23.7 35 23.7 31.1 C 23.7 22.3 16.5 15.1 7.7 15.1
        C 6.7 15.1 5.7 15.2 4.7 15.4 L 4 11.6 C 5.3 11.4 6.5 11.3 7.7 11.3 C 18.8 11.3 27.7 20.2 27.7 31.3 C 27.7 35.7 26.1 40.3 23.2 43.8 Z"
        style="transform-origin: 15.85px 27.55px;" transform="matrix(-1, 0, 0, -1, 0.000003, 0.000001)"/>
      <polygon fill="currentColor" points="4 19 17 17.3 6.3 7" style="transform-origin: 10.5px 13px;" transform="matrix(-1, 0, 0, -1, -0.000003, 0.000001)"/>
      <polygon fill="currentColor" points="44 29 31 30.7 41.7 41" style="transform-origin: 37.5px 35px;" transform="matrix(-1, 0, 0, -1, -0.000005, -0.000003)"/>
    </svg>
  `,

  spinner = `<div id='SD-Image-Scripts-Spinner-Wrapper'><div id='SD-Image-Scripts-Spinner'>${svg}</div></div>`;

  const { prompt, negativePrompt, params, paramsRAW } = SharedPromptParser(text);

  if (paramsRAW) {
    setTimeout(async () => {
      const modelsBox = outputPanel.querySelector(`.${P}-output-models-section`);
      if (modelsBox) {
        try {
          modelsBox.style.height = '70px';

          const links = await SharedModelsFetch(paramsRAW);
          if (!links?.trim()) return modelsBox.remove();

          modelsBox.innerHTML = links;

          const m = modelsBox.querySelector('#SD-Image-Scripts-Model-Output');
          if (m) {
            const height = m.offsetHeight;
            requestAnimationFrame(() => modelsBox.style.height = `${height}px`);
            setTimeout(() => modelsBox.style.height = '', 300);
          }
        } catch {
          modelsBox.innerHTML = `<div class='${P}-output-failed'>Failed to fetch...</div>`;
        }
      }
      setTimeout(() => v.onUpdate?.(), 300);
    }, 500);
  }

  const sections = [
    [titles.prompt, prompt], [titles.negativePrompt, negativePrompt], [titles.params, params], [titles.models, spinner],
    [titles.postProcessing, ExtrasInfo], [titles.postProcessing, PostProcessingInfo], [titles.software, window.SharedParserSoftwareInfo],
    [titles.encrypt, EncryptInfo], [titles.sha, Sha256Info], [titles.source, NaiSourceInfo]
  ],

  body = sections.filter(([_, content]) => content?.trim()).map(([title, content]) => createSection(title, content)).join('');

  return `<div id='SD-Image-Scripts-Output'>${body}</div>`;
}

function SharedImageInfoCopyButton(e, k) {
  const P = 'sd-image-scripts',

  v = SharedImageInfoReg[k],
  f = e.target?.dataset?.copyField;
  if (!f) return;

  const raw = v.rawOutput(),
  stepsStart = raw.indexOf('Steps:'),
  negStart = raw.indexOf('Negative prompt:'),
  seedMatch = raw.match(/Seed:\s?(\d+),/i),

  text = {
    prompt: () => raw.substring(0, [negStart, stepsStart].find(i => i !== -1) || raw.length).trim(),
    negativePrompt: () => negStart !== -1 && stepsStart > negStart ? raw.slice(negStart + 16, stepsStart).trim() : null,
    params: () => stepsStart !== -1 ? raw.slice(stepsStart).trim() : null,
    seed: () => seedMatch?.[1]?.trim() || null
  }[f]?.();

  if (!text) return;

  navigator.clipboard.writeText(text);

  const content = e.target.closest(`.${P}-output-section`)?.querySelector(`.${P}-output-content`);
  content?.classList.add(`${P}-style`);
  setTimeout(() => content?.classList.remove(`${P}-style`), 2000);
}