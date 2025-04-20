async function SDImageParser(img) {
  window.SDImageParserEncryptInfo = '';
  window.SDImageParserSha256Info = '';
  window.SDImageParserNaiSourceInfo = '';
  window.SDImageParserSoftwareInfo = '';

  const res = await fetch(img.src);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const array = await blob.arrayBuffer();
  const tags = ExifReader.load(array);
  img.src = url;

  const openInNewTab = document.createElement('a');
  openInNewTab.href = url;
  openInNewTab.target = '_blank';
  openInNewTab.textContent = 'Open Image in New Tab';
  openInNewTab.addEventListener('click', () => { setTimeout(() => URL.revokeObjectURL(url), 1000); });

  let output = '';

  if (tags) {
    window.SDImageParserEncryptInfo = tags.Encrypt?.description || '';
    window.SDImageParserSha256Info = tags.EncryptPwdSha?.description || '';

    if (tags.parameters?.description) {
      if (tags.parameters.description.includes('sui_image_params')) {
        const parSing = JSON.parse(tags.parameters.description);
        const Sui = parSing['sui_image_params'];
        output = SDImageParserConvertSwarmUI(Sui, {});
      } else {
        output = tags.parameters.description;
      }

    } else if (tags.UserComment?.value) {
      const array = tags.UserComment.value;
      const UserComments = SDImageParserDecodeUserComment(array);
      if (UserComments.includes('sui_image_params')) {
        const rippin = UserComments.trim().replace(/[\x00-\x1F\x7F]/g, '');
        const parSing = JSON.parse(rippin);
        if (parSing['sui_image_params']) {
          const Sui = parSing['sui_image_params'];
          const SuiExtra = parSing['sui_extra_data'] || {};
          output = SDImageParserConvertSwarmUI(Sui, SuiExtra);
        }
      } else {
        output = UserComments;
      }

    } else if (tags['Software']?.description === 'NovelAI' && tags.Comment?.description) {
      window.SDImageParserSoftwareInfo = tags['Software']?.description || '';
      window.SDImageParserNaiSourceInfo = tags['Source']?.description || '';
      const nai = JSON.parse(tags.Comment.description);
      nai.sampler = 'Euler';

      output = SDImageParserConvertNovelAI(nai['prompt']) +
        '\nNegative prompt: ' + SDImageParserConvertNovelAI(nai['uc']) +
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

function SDImageParserDecodeUserComment(array) {
  const result = [];
  let pos = 7;

  if (array[8] === 123) {
    for (let i = pos; i < array.length; i+=2) {
      const inDEX = array[i];
      const nEXT = array[i + 1];
      if (inDEX === 0 && nEXT === 32) { result.push(32); continue; }
      const vaLUE = inDEX * 256 + nEXT;
      result.push(vaLUE);
    }
  } else {
    for (let i = pos; i < array.length; i++) {
      if (i === 7 && array[i] === 0) continue;
      if (array[i] === 0) if (i + 1 < array.length && array[i + 1] === 0) { i++; continue; }
      if (i + 1 < array.length) {
        const inDEX = array[i];
        const nEXT = array[i + 1];
        if (inDEX === 0 && nEXT === 32) { result.push(32); i++; continue; }
        const vaLUE = inDEX * 256 + nEXT;
        result.push(vaLUE);
        i++;
      }
    }
  }

  const output = new TextDecoder('utf-16').decode(new Uint16Array(result)).trim();
  return output.replace(/^UNICODE[\x00-\x20]*/, '');
}

function SDImageParserConvertNovelAI(input) {
  const NAIround = v => Math.round(v * 10000) / 10000;
  const NAIMultiplyRange = (start, multiplier) => res.slice(start).forEach(row => row[1] = NAIround(row[1] * multiplier));
  const re_attention = /\{|\[|\}|\]|[^\{\}\[\]]+/gmu;
  let text = input.replaceAll('(', '\\(').replaceAll(')', '\\)').replace(/\\{2,}(\(|\))/gim, '\$1');
  let res = [];
  let curly_brackets = [];
  let square_brackets = [];
  const curly_bracket_multiplier = 1.05;
  const square_bracket_multiplier = 1 / 1.05;

  for (const match of text.matchAll(re_attention)) {
    let word = match[0];
    if (word === '{') curly_brackets.push(res.length);
    else if (word === '[') square_brackets.push(res.length);
    else if (word === '}' && curly_brackets.length > 0) NAIMultiplyRange(curly_brackets.pop(), curly_bracket_multiplier);
    else if (word === ']' && square_brackets.length > 0) NAIMultiplyRange(square_brackets.pop(), square_bracket_multiplier);
    else res.push([word, 1.0]);
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

function SDImageParserConvertSwarmUI(Sui, extraData = {}) {
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

  window.SDImageParserSoftwareInfo = Sui?.swarm_version ? `SwarmUI ${Sui.swarm_version}` : '';
  output = output.trim().replace(/,$/, '');

  let otherParams = Object.entries(Sui)
    .filter(([key]) => {
      return ![
        'prompt', 
        'negativeprompt', 
        'steps', 
        'sampler', 
        'scheduler', 
        'cfgscale', 
        'seed', 
        'width', 
        'height', 
        'model', 
        'vae', 
        'swarm_version'
      ].includes(key);
    }).map(([key, value]) => `${key}: ${value}`).join(', ');

  let extraParams = Object.entries(extraData).map(([key, value]) => `${key}: ${value}`).join(', ');
  if (otherParams || extraParams) output += (output ? ', ' : '') + [otherParams, extraParams].filter(Boolean).join(', ');
  return output.trim();
}

async function SDImageParserFetchModelOutput(i, timeout = 60000) {
  return await Promise.race([
    (async () => {
      let FetchedModels = '';
      const HashesDict = {};
      const TIHashDict = {};
      const Cat = { checkpoint: [], vae: [], lora: [], embed: [] };

      const modelEX = i.includes('Model: "') ? i.match(/Model:\s*"?([^"]+)"/) : i.match(/Model:\s*([^,]+)/);
      const modelHashEX = i.match(/Model hash:\s*([^,]+)/);
      const vaeEX = i.match(/VAE:\s*([^,]+)/);
      const vaeHashEX = i.match(/VAE hash:\s*([^,]+)/);
      const loraHashEX = i.match(/Lora hashes:\s*"([^"]+)"/);
      const tiHashEX = i.match(/TI hashes:\s*"([^"]+)"/);
      const hashesIndex = i.indexOf('Hashes:');
      const hashesEX = hashesIndex !== -1 ? i.slice(hashesIndex).match(/Hashes:\s*(\{.*?\})(,\s*)?/) : null;

      if (hashesEX && hashesEX[1]) {
        const s = JSON.parse(hashesEX[1].trim());
        for (const [k, h] of Object.entries(s)) {
          if (k.startsWith('embed:')) {
            const n = k.replace('embed:', '');
            HashesDict[n] = h;
            const fetchedHash = await SDImageParserFetchingModels(n, h, false);
            Cat.embed.push(fetchedHash);
          }
        }
      }

      if (tiHashEX) {
        const embedPairs = tiHashEX[1].split(',').map(pair => pair.trim());
        for (const pair of embedPairs) {
          const [n, h] = pair.split(':').map(item => item.trim());
          if (h && !HashesDict[n]) {
            TIHashDict[n] = h;
            const fetchedHash = await SDImageParserTIHashesSearchLink(n, h);
            Cat.embed.push(fetchedHash);
          }
        }
      }

      if (modelEX) {
        const modelValue = modelEX[1];
        const modelHash = modelHashEX ? modelHashEX[1] : null;
        const vaeValue = vaeEX ? vaeEX[1] : null;
        const vaeHash = vaeHashEX ? vaeHashEX[1] : null;

        if (modelHash || vaeValue || vaeHash) Cat.checkpoint.push({ n: modelValue, h: modelHash });
        if (vaeValue || vaeHash) Cat.vae.push({ n: vaeValue, h: vaeHash });
      }

      if (loraHashEX) {
        const loraPairs = loraHashEX[1].split(',').map(pair => pair.trim());
        for (const pair of loraPairs) {
          const [n, h] = pair.split(':').map(item => item.trim());
          if (h) Cat.lora.push({ n, h });
        }
      }

      const FetchResult = (l, m) => {
        return `
          <div class='sd-image-parser-modeloutput-line'>
            <div class='sd-image-parser-modeloutput-label'>${l}</div>
            <div class='sd-image-parser-modeloutput-hashes'>${m.join(' ')}</div>
          </div>
        `;
      };

      for (const [category, items] of Object.entries(Cat)) {
        if (items.length > 0) {
          let models;

          if (category === 'embed') {
            models = items;
          } else if (category === 'lora') {
            models = await Promise.all(items.map(({ n, h }) => SDImageParserFetchingModels(n, h, false)));
          } else {
            const isThat = category === 'checkpoint' || category === 'vae';
            models = await Promise.all(items.map(({ n, h }) => SDImageParserFetchingModels(n, h, isThat)));
          }

          FetchedModels += FetchResult(category, models);
        }
      }

      return `<div id='SD-Image-Parser-Model-Output'>${FetchedModels}</div>`;

    })(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
  ]);
}

async function SDImageParserFetchingModels(n, h, isTHat = false) {
  const nonLink = `<span class='sd-image-parser-nonlink'>${n}${isTHat ? '' : `: ${h}`}</span>`;
  if (!h) return nonLink;

  const r = await fetch(`https://civitai.com/api/v1/model-versions/by-hash/${h}`);
  const d = await r.json();

  if (d.error === 'Model not found' || !d.model?.name) return nonLink;
  return `<a class='sd-image-parser-link' href='https://civitai.com/models/${d.modelId}?modelVersionId=${d.id}' target='_blank'>${d.model.name}</a>`;
}

async function SDImageParserTIHashesSearchLink(n, h) {
  return h 
    ? `<a class='sd-image-parser-link' href='https://civitai.com/search/models?sortBy=models_v9&query=${h}' target='_blank'>${n}</a>` 
    : `<span class='sd-image-parser-nonlink'>${n}: ${h}</span>`;
}
