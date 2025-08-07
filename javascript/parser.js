async function SharedImageParser(img) {
  [
    'EncryptInfo',
    'Sha256Info',
    'ExtrasInfo',
    'PostProcessingInfo',
    'NaiSourceInfo',
    'SoftwareInfo'
  ].forEach(k => window[`SharedParser${k}`] = '');

  const [prefix, base64] = img.src.split(','), b = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  img.src = URL.createObjectURL(new Blob([b], { type: prefix.match(/data:(.*?);base64/)[1] }));

  const tags = ExifReader.load(b.buffer);
  let output = '';

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
        output = _ConvertSwarmUI(Sui, {});
      } else {
        output = tags.parameters.description;
      }

    } else if (tags.UserComment?.value) {
      const array = tags.UserComment.value;
      const UserComments = _DecodeUserComment(array);
      if (UserComments.includes('sui_image_params')) {
        const rippin = UserComments.trim().replace(/[\x00-\x1F\x7F]/g, '');
        const parSing = JSON.parse(rippin);
        if (parSing['sui_image_params']) {
          const Sui = parSing['sui_image_params'];
          const SuiExtra = parSing['sui_extra_data'] || {};
          output = _ConvertSwarmUI(Sui, SuiExtra);
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

      output = _ConvertNovelAI(nai['prompt']) +
        '\nNegative prompt: ' + _ConvertNovelAI(nai['uc']) +
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

function _DecodeUserComment(array) {
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
}

function _ConvertNovelAI(input) {
  const NAIround = v => Math.round(v * 10000) / 10000;
  const NAIMultiplyRange = (start, multiplier) => res.slice(start).forEach(row => row[1] = NAIround(row[1] * multiplier));
  const re_attention = /\{|\[|\}|\]|[^\{\}\[\]]+/gmu;
  let t = input.replaceAll('(', '\\(').replaceAll(')', '\\)').replace(/\\{2,}(\(|\))/gim, '\$1');
  let res = [];
  let curly_brackets = [];
  let square_brackets = [];
  const curly_bracket_multiplier = 1.05;
  const square_bracket_multiplier = 1 / 1.05;

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

  let result = '';
  for (let i = 0; i < res.length; i++) { if (res[i][1] === 1.0) { result += res[i][0]; } else { result += `(${res[i][0]}:${res[i][1]})`; }}

  return result;
}

function _ConvertSwarmUI(Sui, extraData = {}) {
  let output = '';

  if (Sui.prompt) output += `${Sui.prompt}\n`;
  if (Sui.negativeprompt) output += `Negative prompt: ${Sui.negativeprompt}\n`;
  if (Sui.steps) output += `Steps: ${Sui.steps}, `;
  if (Sui.sampler) {
    Sui.sampler = Sui.sampler.replace(/\beuler\b|\beuler(-\w+)?/gi, (match) => { return match.replace(/euler/i, 'Euler'); });
    output += `Sampler: ${Sui.sampler}, `;
  }
  if (Sui.scheduler) output += `Schedule type: ${Sui.scheduler}, `;
  if (Sui.cfgscale) output += `CFG scale: ${Sui.cfgscale}, `;
  if (Sui.seed) output += `Seed: ${Sui.seed}, `;
  if (Sui.width && Sui.height) output += `Size: ${Sui.width}x${Sui.height}, `;
  if (Sui.model) output += `Model: ${Sui.model}, `;
  if (Sui.vae) { const vaeParts = Sui.vae.split('/'); output += `VAE: ${vaeParts[vaeParts.length - 1]}, `; }

  window.SharedParserSoftwareInfo = Sui?.swarm_version ? `SwarmUI ${Sui.swarm_version}` : '';
  output = output.trim().replace(/,$/, '');

  let otherParams = Object.entries(Sui).filter(([k]) => ![
    'prompt','negativeprompt','steps','sampler','scheduler','cfgscale','seed','width','height','model','vae','swarm_version'
  ].includes(k)).map(([k,v]) => `${k}: ${v}`).join(', ');

  let extraParams = Object.entries(extraData).map(([key, value]) => `${key}: ${value}`).join(', ');
  if (otherParams || extraParams) output += (output ? ', ' : '') + [otherParams, extraParams].filter(Boolean).join(', ');

  return output.trim();
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
      const Cat = { checkpoint: [], vae: [], lora: [], embed: [] };

      const EmbedNames = new Set();
      const LoraNames = new Set();
      const HashesDict = {};

      let FetchedModels = '';

      const Link = 'sd-image-parser-link';
      const nonLink = 'sd-image-parser-nonlink';

      const TIHashesSearchLink = async (n, h) => h
        ? `<a class='${Link}' href='https://civitai.com/search/models?sortBy=models_v9&query=${h}' target='_blank'>${n}</a>`
        : `<span class='${nonLink}'>${n}: ${h}</span>`;

      const FetchingModels = async (n, h, isThat = false) => {
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
      };

      const FetchLora = async (n, h) => {
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
      };

      const FetchEmbed = async (n, h) => {
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
      };

      const FetchResult = (l, m) => {
        return `
          <div class='sd-image-parser-modeloutput-line'>
            <div class='sd-image-parser-modeloutput-label'>${l}</div>
            <div class='sd-image-parser-modeloutput-hashes'>${m.join(' ')}</div>
          </div>
        `;
      };

      const modelEX = i.includes('Model: "') ? i.match(/Model:\s*"?([^"]+)"/) : i.match(/Model:\s*([^,]+)/);
      const modelHashEX = i.match(/Model hash:\s*([^,]+)/);
      const vaeEX = i.match(/VAE:\s*([^,]+)/);
      const vaeHashEX = i.match(/VAE hash:\s*([^,]+)/);
      const loraHashEX = i.match(/Lora hashes:\s*"([^"]+)"/);
      const tiHashEX = i.match(/TI hashes:\s*"([^"]+)"/);
      const hashesIndex = i.indexOf('Hashes:');
      const hashesEX = hashesIndex !== -1 ? i.slice(hashesIndex).match(/Hashes:\s*(\{.*?\})(,\s*)?/) : null;

      if (modelEX) {
        const modelValue = modelEX[1];
        const modelHash = modelHashEX ? modelHashEX[1] : null;
        const vaeValue = vaeEX ? vaeEX[1] : null;
        const vaeHash = vaeHashEX ? vaeHashEX[1] : null;

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