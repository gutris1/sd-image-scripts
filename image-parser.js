async function SDWebuiImageParser(img) {
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
        output = SDWebuiImageParserConvertSwarmUI(Sui, {});
      } else {
        output = tags.parameters.description;
      }

    } else if (tags.UserComment?.value) {
      const array = tags.UserComment.value;
      const UserComments = SDWebuiImageParserDecodeUserComment(array);
      if (UserComments.includes('sui_image_params')) {
        const rippin = UserComments.trim().replace(/[\x00-\x1F\x7F]/g, '');
        const parSing = JSON.parse(rippin);
        if (parSing['sui_image_params']) {
          const Sui = parSing['sui_image_params'];
          const SuiExtra = parSing['sui_extra_data'] || {};
          output = SDWebuiImageParserConvertSwarmUI(Sui, SuiExtra);
        }
      } else {
        output = UserComments;
      }

    } else if (tags['Software']?.description === 'NovelAI' && tags.Comment?.description) {
      window.SDImageParserSoftwareInfo = tags['Software']?.description || '';
      window.SDImageParserNaiSourceInfo = tags['Source']?.description || '';
      const nai = JSON.parse(tags.Comment.description);
      nai.sampler = 'Euler';

      output = SDWebuiImageParserConvertNovelAI(nai['prompt']) +
        '\nNegative prompt: ' + SDWebuiImageParserConvertNovelAI(nai['uc']) +
        '\nSteps: ' + nai['steps'] +
        ', Sampler: ' + nai['sampler'] +
        ', CFG scale: ' + parseFloat(nai['scale']).toFixed(1) +
        ', Seed: ' + nai['seed'] +
        ', Size: ' + nai['width'] + 'x' + nai['height'] +
        ', Clip skip: 2, ENSD: 31337';

    } else if (tags.prompt?.description && tags.workflow) {
      if (tags.prompt.description.includes("'filename_prefix': 'ComfyUI'")) {
        output = 'ComfyUI<br>Nothing To Read Here';
      }

    } else if (tags.invokeai_graph?.description) {
      output = 'InvokeAI<br>Nothing To Read Here';
    } else {
      output = 'Nothing To See Here';
    }
  }

  return output;
}

function SDWebuiImageParserDecodeUserComment(array) {
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

function SDWebuiImageParserConvertNovelAI(input) {
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

function SDWebuiImageParserConvertSwarmUI(Sui, extraData = {}) {
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
