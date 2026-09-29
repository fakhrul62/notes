import {mkdir, readFile, writeFile, cp} from 'node:fs/promises';
import {transform} from 'esbuild';

await mkdir('vendor', {recursive:true});
for(const [source,target] of [
  ['node_modules/dom-docx/dist/browser/dom-docx.browser.js','vendor/dom-docx.js'],
  ['node_modules/mammoth/mammoth.browser.js','vendor/mammoth.js']
]){
  const code=await readFile(source,'utf8');
  const output=await transform(code,{loader:'js',minify:true,target:'es2020',legalComments:'none'});
  await writeFile(target,output.code);
}
await cp('node_modules/katex/dist/katex.min.js','vendor/katex.js');
await cp('node_modules/katex/dist/katex.min.css','vendor/katex.css');
await cp('node_modules/katex/dist/fonts','vendor/fonts',{recursive:true});
await cp('node_modules/dompurify/dist/purify.min.js','vendor/dompurify.js');
for(const [name,source] of [
  ['dom-docx','LICENSE'],['mammoth','LICENSE'],['katex','LICENSE'],['dompurify','LICENSE']
]) await cp(`node_modules/${name}/${source}`,`vendor/${name}-LICENSE.txt`);
