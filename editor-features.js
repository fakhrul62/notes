(function(){
'use strict';

const $=id=>document.getElementById(id);
const state={range:null,editor:null,pageId:null,menu:null,painter:null,findRanges:[],findIndex:-1,tracking:false,selectedImage:null};
const icon={
  insert:'<path d="M8 2v12M2 8h12"/>',
  format:'<path d="M2 4h12M4 8h8M6 12h4"/>',
  layout:'<rect x="3" y="1.5" width="10" height="13" rx="1"/><path d="M5 5h6M5 8h6M5 11h4"/>',
  review:'<path d="M2 3h12v8H7l-3 3v-3H2z"/><path d="M5 6h6M5 8.5h4"/>',
  table:'<rect x="1.5" y="2" width="13" height="12" rx="1"/><path d="M1.5 6h13M1.5 10h13M6 2v12M10 2v12"/>'
};
function svg(path){return `<svg class="doc-tool-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`}
function currentPage(){return pages.find(p=>p.id===activePageId)}
function pageFor(editor){return pages.find(p=>p.id===(editor.id==='split-editor'?splitPageId:activePageId))}
function editorFromRange(range){return ['editor','split-editor'].map($).find(ed=>ed&&ed.contains(range.startContainer)&&ed.contains(range.endContainer))}
function rememberSelection(){
  const sel=window.getSelection();
  if(!sel.rangeCount)return;
  const range=sel.getRangeAt(0);
  const editor=editorFromRange(range);
  if(editor){state.range=range.cloneRange();state.editor=editor;state.pageId=pageFor(editor)?.id||null}
}
function restoreSelection(){
  let editor=state.editor;
  if(!editor||!editor.isConnected||!editor.contains(state.range?.startContainer)||!editor.contains(state.range?.endContainer)||pageFor(editor)?.id!==state.pageId){
    editor=$('editor');
    state.range=document.createRange();state.range.selectNodeContents(editor);state.range.collapse(false);
    state.editor=editor;state.pageId=activePageId;
  }
  editor.focus();
  const sel=window.getSelection();sel.removeAllRanges();sel.addRange(state.range.cloneRange());
  return editor;
}
function saveEditor(editor){if(editor.id==='split-editor')saveSplitContent();else saveContent();rememberSelection()}
function command(name,value){const editor=restoreSelection();document.execCommand(name,false,value??null);saveEditor(editor)}
function insertHtml(html){const editor=restoreSelection();document.execCommand('insertHTML',false,html);saveEditor(editor)}
function activeElement(){
  const range=state.range;
  if(!range)return null;
  const node=range.startContainer;
  return node.nodeType===Node.ELEMENT_NODE?node:node.parentElement;
}
function nearest(selector){const el=activeElement();return el&&el.closest(selector)}
function selectedBlocks(){
  const editor=restoreSelection();
  const range=window.getSelection().getRangeAt(0);
  const blocks=Array.from(editor.querySelectorAll('p,div,h1,h2,h3,h4,h5,h6,li,blockquote,td,th'))
    .filter(el=>!el.closest('.doc-toc,.doc-footnotes')&&range.intersectsNode(el));
  if(blocks.length)return blocks.filter(el=>!blocks.some(other=>other!==el&&el.contains(other)));
  return [editor];
}
function styleBlocks(property,value){const editor=restoreSelection();selectedBlocks().forEach(block=>block.style[property]=value);saveEditor(editor)}
function clearMenu(){state.menu=null;$('doc-popover').classList.remove('open');document.querySelectorAll('[data-doc-menu]').forEach(b=>b.classList.remove('doc-tool-active'))}
function positionPopup(pop,anchor,width){const r=anchor.getBoundingClientRect();pop.style.left=Math.max(8,Math.min(r.left,innerWidth-width-8))+'px';pop.style.top=Math.min(r.bottom+5,innerHeight-pop.offsetHeight-8)+'px'}
function menuRow(label,action,options={}){
  const button=document.createElement('button');button.type='button';button.className='doc-popover-row';button.textContent=label;
  if(options.hint){const small=document.createElement('small');small.textContent=options.hint;button.appendChild(small)}
  if(options.pressed!==undefined)button.setAttribute('aria-pressed',String(options.pressed));
  button.addEventListener('click',()=>{clearMenu();action()});
  return button;
}
function menuSection(name){const el=document.createElement('div');el.className='doc-popover-section';el.textContent=name;return el}
function menuTitle(name){const el=document.createElement('div');el.className='doc-popover-title';el.textContent=name;return el}
function openMenu(kind,anchor){
  rememberSelection();
  if(state.menu===kind){clearMenu();return}
  clearMenu();state.menu=kind;anchor.classList.add('doc-tool-active');
  const pop=$('doc-popover');pop.replaceChildren(menuTitle(kind==='table'?'Table tools':kind[0].toUpperCase()+kind.slice(1)));
  if(kind==='insert')buildInsertMenu(pop);
  if(kind==='format')buildFormatMenu(pop);
  if(kind==='layout')buildLayoutMenu(pop);
  if(kind==='review')buildReviewMenu(pop);
  if(kind==='table')buildTableMenu(pop);
  if(kind==='image')buildImageMenu(pop);
  pop.classList.add('open');positionPopup(pop,anchor,246);
}
function makeToolbarButton(kind,title){
  const button=document.createElement('button');button.type='button';button.className='toolbar-btn';button.dataset.docMenu=kind;
  button.title=title;button.setAttribute('aria-label',title);button.innerHTML=svg(icon[kind]);
  button.addEventListener('pointerdown',rememberSelection);
  button.addEventListener('click',()=>openMenu(kind,button));
  return button;
}
function form(title,fields,onSubmit){
  clearMenu();const dialog=$('doc-dialog');$('doc-dialog-title').textContent=title;
  const box=$('doc-dialog-fields');box.replaceChildren();
  fields.forEach(field=>{
    const label=document.createElement('label');label.className='doc-field';label.textContent=field.label;
    let input;
    if(field.options){input=document.createElement('select');field.options.forEach(([value,text])=>{const option=document.createElement('option');option.value=value;option.textContent=text;input.appendChild(option)})}
    else if(field.type==='textarea')input=document.createElement('textarea');
    else{input=document.createElement('input');input.type=field.type||'text'}
    input.name=field.name;input.value=field.value??'';
    if(field.min!==undefined)input.min=field.min;if(field.max!==undefined)input.max=field.max;
    if(field.required)input.required=true;
    label.appendChild(input);box.appendChild(label);
  });
  dialog.onsubmit=e=>{e.preventDefault();const formElement=dialog.querySelector('form');if(!formElement.reportValidity())return;const data=Object.fromEntries(new FormData(formElement).entries());dialog.close();onSubmit(data)};
  dialog.showModal();box.querySelector('input,select,textarea')?.focus();
}
function askSelect(title,label,options,callback,value){form(title,[{name:'choice',label,options,value}],v=>callback(v.choice))}
function showToast(message){toast(message)}
function buildInsertMenu(pop){
  pop.appendChild(menuSection('Structure'));
  const tableButton=menuRow('Insert table',()=>showTablePicker());pop.appendChild(tableButton);
  [['Checklist',insertChecklist],['Text box',()=>insertBox('textbox')],['Callout',()=>insertBox('callout')],['Page break',insertPageBreak],['Table of contents',insertToc],['Footnote',insertFootnote]].forEach(([label,fn])=>pop.appendChild(menuRow(label,fn)));
  pop.appendChild(menuSection('Media & references'));
  [['Image',openImagePicker],['Shape',insertShape],['Symbol',insertSymbol],['Equation',insertEquation],['Caption',insertCaption],['Bookmark',insertBookmark],['Link to bookmark',insertBookmarkLink]].forEach(([label,fn])=>pop.appendChild(menuRow(label,fn)));
}
function buildFormatMenu(pop){
  pop.appendChild(menuSection('Text'));
  [['Font family',setFontFamily],['Exact font size',setExactFontSize],['Strikethrough',()=>command('strikeThrough')],['Superscript',()=>command('superscript')],['Subscript',()=>command('subscript')],['Format painter',formatPainter]].forEach(([label,fn])=>pop.appendChild(menuRow(label,fn)));
  pop.appendChild(menuSection('Paragraph'));
  [['Align left',()=>command('justifyLeft')],['Align center',()=>command('justifyCenter')],['Align right',()=>command('justifyRight')],['Justify',()=>command('justifyFull')],['Line spacing',setLineSpacing],['Paragraph spacing',setParagraphSpacing],['Increase indent',()=>command('indent')],['Decrease indent',()=>command('outdent')]].forEach(([label,fn])=>pop.appendChild(menuRow(label,fn)));
}
function buildLayoutMenu(pop){
  const layout=getLayout();
  pop.appendChild(menuSection('Page'));
  pop.appendChild(menuRow('Page view',togglePageView,{pressed:!!layout.pageView}));
  [['Paper size',setPaperSize],['Orientation',setOrientation],['Margins',setMargins],['Columns',setColumns],['Header, footer & page numbers',setHeaderFooter]].forEach(([label,fn])=>pop.appendChild(menuRow(label,fn)));
  pop.appendChild(menuSection('Output'));
  pop.appendChild(menuRow('Print / Save as PDF',printNote));
  pop.appendChild(menuRow('Export DOCX',exportDocx));
  pop.appendChild(menuRow('Import DOCX',openDocxPicker));
}
function buildReviewMenu(pop){
  pop.appendChild(menuSection('Editing'));
  pop.appendChild(menuRow('Find & replace',openFindPanel,{hint:'Ctrl+H'}));
  pop.appendChild(menuRow('Add comment',addComment));
  pop.appendChild(menuRow('Show comments',openCommentsPanel));
  pop.appendChild(menuSection('Changes'));
  pop.appendChild(menuRow('Track changes',toggleTracking,{pressed:!!currentPage()?.trackChanges}));
  pop.appendChild(menuRow('Accept change',()=>resolveChange(true)));
  pop.appendChild(menuRow('Reject change',()=>resolveChange(false)));
}

function showTablePicker(){
  const pop=$('doc-popover');pop.replaceChildren(menuTitle('Insert table'));
  const grid=document.createElement('div');grid.className='doc-table-grid';
  for(let row=1;row<=6;row++)for(let col=1;col<=8;col++){
    const cell=document.createElement('button');cell.type='button';cell.title=`${col} columns × ${row} rows`;
    cell.addEventListener('mouseenter',()=>grid.querySelectorAll('button').forEach((b,i)=>b.classList.toggle('preview',Math.floor(i/8)<row&&i%8<col)));
    cell.addEventListener('click',()=>{clearMenu();insertTable(row,col)});grid.appendChild(cell);
  }
  pop.appendChild(grid);pop.classList.add('open');state.menu='table-picker';positionPopup(pop,toolbarButton('insert'),246);
}
function toolbarButton(kind){return document.querySelector(`[data-doc-menu="${kind}"]`)}
function insertTable(rows,cols){
  const id='table-'+genId();
  const columns=Array.from({length:cols},()=>`<col style="width:${100/cols}%">`).join('');
  const body=Array.from({length:rows},()=>'<tr>'+Array.from({length:cols},()=>'<td><br></td>').join('')+'</tr>').join('');
  insertHtml(`<table class="doc-table" data-table-id="${id}"><colgroup>${columns}</colgroup><tbody>${body}</tbody></table><p><br></p>`);
  const editor=state.editor||$('editor');const table=editor.querySelector(`[data-table-id="${id}"]`);
  if(table){const range=document.createRange();range.selectNodeContents(table.rows[0].cells[0]);range.collapse(true);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);rememberSelection();updateTableTools()}
}
function currentCell(){
  const cell=nearest('td,th');
  return cell&&state.editor?.contains(cell)?cell:state.lastTableCell&&state.lastTableCell.isConnected?state.lastTableCell:null;
}
function currentTable(){return currentCell()?.closest('table.doc-table')||null}
function tableAction(fn){const cell=currentCell();if(!cell){showToast('Click in a table first');return}const editor=state.editor||$('editor');fn(cell,cell.closest('table'));saveEditor(editor);updateTableTools()}
function buildTableMenu(pop){
  pop.appendChild(menuSection('Rows & columns'));
  [['Row above',()=>addTableRow(-1)],['Row below',()=>addTableRow(1)],['Column left',()=>addTableColumn(-1)],['Column right',()=>addTableColumn(1)],['Delete row',deleteTableRow],['Delete column',deleteTableColumn],['Delete table',deleteTable]].forEach(([label,fn])=>pop.appendChild(menuRow(label,fn)));
  pop.appendChild(menuSection('Cells & design'));
  [['Merge selected cells',mergeTableCells],['Split merged cell',splitTableCell],['Header row',toggleHeaderRow],['Cell color',setCellColor],['Borders',setTableBorders],['Sort by this column',sortTableColumn],['Caption',insertCaption]].forEach(([label,fn])=>pop.appendChild(menuRow(label,fn)));
}
function buildImageMenu(pop){
  pop.appendChild(menuSection('Position'));
  [['Inline',()=>setImagePosition('inline')],['Center',()=>setImagePosition('center')],['Wrap text left',()=>setImagePosition('left')],['Wrap text right',()=>setImagePosition('right')]].forEach(([label,fn])=>pop.appendChild(menuRow(label,fn)));
  pop.appendChild(menuSection('Edit'));
  pop.appendChild(menuRow('Crop image',cropImage));
  pop.appendChild(menuRow('Caption',insertCaption));
}
function addTableRow(direction){tableAction((cell,table)=>{
  const row=cell.parentElement;const section=row.parentElement;const newRow=document.createElement('tr');
  for(let i=0;i<table.querySelector('colgroup').children.length;i++){const c=document.createElement('td');c.innerHTML='<br>';newRow.appendChild(c)}
  section.insertBefore(newRow,direction<0?row:row.nextSibling);
})}
function addTableColumn(direction){tableAction((cell,table)=>{
  const index=cell.cellIndex+(direction>0?1:0);const group=table.querySelector('colgroup');
  const col=document.createElement('col');group.insertBefore(col,group.children[index]||null);
  Array.from(table.rows).forEach((row,i)=>{const c=document.createElement(i===0&&row.cells[0]?.tagName==='TH'?'th':'td');c.innerHTML='<br>';row.insertBefore(c,row.cells[index]||null)});
  Array.from(group.children).forEach(c=>c.style.width=(100/group.children.length)+'%');
})}
function deleteTableRow(){tableAction((cell,table)=>{if(table.rows.length===1)table.remove();else cell.parentElement.remove()})}
function deleteTableColumn(){tableAction((cell,table)=>{
  const index=cell.cellIndex;if(table.rows[0].cells.length===1){table.remove();return}
  Array.from(table.rows).forEach(row=>row.cells[index]?.remove());table.querySelector('colgroup')?.children[index]?.remove();
})}
function deleteTable(){tableAction((cell,table)=>table.remove())}
function selectedTableCells(table){
  const range=state.range;
  if(!range)return[currentCell()].filter(Boolean);
  const cells=Array.from(table.querySelectorAll('td,th')).filter(cell=>range.intersectsNode(cell));
  return cells.length?cells:[currentCell()].filter(Boolean);
}
function mergeTableCells(){tableAction((cell,table)=>{
  const selected=selectedTableCells(table);if(selected.length<2){showToast('Select adjacent cells first');return}
  const rows=selected.map(c=>c.parentElement.rowIndex),cols=selected.map(c=>c.cellIndex);
  const minRow=Math.min(...rows),maxRow=Math.max(...rows),minCol=Math.min(...cols),maxCol=Math.max(...cols);
  if(selected.length!==(maxRow-minRow+1)*(maxCol-minCol+1)||selected.some(c=>c.colSpan!==1||c.rowSpan!==1)){showToast('Select a rectangular group of plain cells');return}
  const first=table.rows[minRow].cells[minCol];
  selected.filter(c=>c!==first).forEach(c=>{if(c.textContent.trim()){first.appendChild(document.createElement('br'));while(c.firstChild)first.appendChild(c.firstChild)}c.remove()});
  first.colSpan=maxCol-minCol+1;first.rowSpan=maxRow-minRow+1;
})}
function splitTableCell(){tableAction(cell=>{
  const rows=cell.rowSpan,cols=cell.colSpan;if(rows===1&&cols===1){showToast('Choose a merged cell');return}
  const row=cell.parentElement,index=cell.cellIndex;cell.rowSpan=1;cell.colSpan=1;
  for(let col=1;col<cols;col++){const extra=document.createElement('td');extra.innerHTML='<br>';row.insertBefore(extra,row.cells[index+col]||null)}
  let next=row.nextElementSibling;
  for(let r=1;r<rows&&next;r++,next=next.nextElementSibling)for(let col=0;col<cols;col++){const extra=document.createElement('td');extra.innerHTML='<br>';next.insertBefore(extra,next.cells[index+col]||null)}
})}
function toggleHeaderRow(){tableAction((cell,table)=>{
  const row=table.rows[0];const makeHeader=row.cells[0]?.tagName!=='TH';
  Array.from(row.cells).forEach(old=>{const next=document.createElement(makeHeader?'th':'td');while(old.firstChild)next.appendChild(old.firstChild);next.colSpan=old.colSpan;next.rowSpan=old.rowSpan;next.style.cssText=old.style.cssText;old.replaceWith(next)});
})}
function setCellColor(){form('Cell color',[{name:'color',label:'Background color',type:'color',value:'#fff176'}],v=>tableAction((cell,table)=>selectedTableCells(table).forEach(c=>c.style.backgroundColor=v.color)))}
function setTableBorders(){askSelect('Table borders','Border style',[['normal','Normal'],['strong','Strong'],['none','None']],choice=>tableAction((cell,table)=>{table.classList.toggle('borderless',choice==='none');table.classList.toggle('bordered',choice==='strong')}))}
function sortTableColumn(){tableAction((cell,table)=>{
  const index=cell.cellIndex;const rows=Array.from(table.tBodies[0].rows);const hasHeader=rows[0]?.cells[0]?.tagName==='TH';
  const body=hasHeader?rows.slice(1):rows;body.sort((a,b)=>a.cells[index]?.textContent.localeCompare(b.cells[index]?.textContent||'',undefined,{numeric:true})||0);
  body.forEach(row=>table.tBodies[0].appendChild(row));
})}
function updateTableTools(){
  const tools=$('doc-table-tools');if(!tools)return;
  const table=currentTable();if(!table||!table.isConnected||$('reading-overlay').classList.contains('open')){tools.classList.remove('open');return}
  const rect=table.getBoundingClientRect();
  if(rect.bottom<40||rect.top>innerHeight){tools.classList.remove('open');return}
  tools.style.left=Math.max(8,Math.min(innerWidth-82,rect.right-80))+'px';tools.style.top=Math.max(43,rect.top-24)+'px';tools.classList.add('open');
}
function updateImageTools(){
  const tools=$('doc-image-tools');if(!tools)return;
  const img=state.selectedImage;
  if(!img||!img.isConnected||$('reading-overlay').classList.contains('open')){tools.classList.remove('open');return}
  const rect=img.getBoundingClientRect();if(rect.bottom<40||rect.top>innerHeight){tools.classList.remove('open');return}
  tools.style.left=Math.max(8,Math.min(innerWidth-82,rect.right-80))+'px';tools.style.top=Math.max(43,rect.top-24)+'px';tools.classList.add('open');
}
function setImagePosition(position){
  const img=state.selectedImage;if(!img||!img.isConnected){showToast('Select an image first');return}
  img.classList.remove('doc-float-left','doc-float-right','doc-center');
  if(position==='left')img.classList.add('doc-float-left');
  if(position==='right')img.classList.add('doc-float-right');
  if(position==='center')img.classList.add('doc-center');
  saveEditor(img.closest('.panel-editor'));
}
function cropImage(){
  const img=state.selectedImage;if(!img||!img.isConnected){showToast('Select an image first');return}
  form('Crop image',[
    {name:'left',label:'Crop from left (%)',type:'number',min:0,max:90,value:0},
    {name:'top',label:'Crop from top (%)',type:'number',min:0,max:90,value:0},
    {name:'width',label:'Keep width (%)',type:'number',min:10,max:100,value:100},
    {name:'height',label:'Keep height (%)',type:'number',min:10,max:100,value:100}
  ],v=>{
    try{
      const left=Number(v.left)/100,top=Number(v.top)/100,width=Math.min(Number(v.width)/100,1-left),height=Math.min(Number(v.height)/100,1-top);
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*width));canvas.height=Math.max(1,Math.round(img.naturalHeight*height));
      canvas.getContext('2d').drawImage(img,img.naturalWidth*left,img.naturalHeight*top,canvas.width,canvas.height,0,0,canvas.width,canvas.height);
      img.src=canvas.toDataURL('image/png');img.style.height='auto';saveEditor(img.closest('.panel-editor'));updateImageTools();
    }catch(error){showToast('Image crop failed')}
  });
}

function setFontFamily(){
  askSelect('Font family','Font',[['Arial','Arial'],['Georgia','Georgia'],['Times New Roman','Times New Roman'],['Verdana','Verdana'],['Trebuchet MS','Trebuchet MS'],['Courier New','Courier New'],['Consolas','Consolas'],['system-ui','System']],font=>command('fontName',font),'Arial');
}
function applyExactFontSize(size){
  const editor=restoreSelection();const before=new Set(editor.querySelectorAll('font[size="7"]'));
  document.execCommand('styleWithCSS',false,false);document.execCommand('fontSize',false,'7');
  editor.querySelectorAll('font[size="7"]').forEach(font=>{if(!before.has(font)){font.removeAttribute('size');font.style.fontSize=size+'px'}});
  saveEditor(editor);
}
function setExactFontSize(){form('Font size',[{name:'size',label:'Size in pixels',type:'number',min:8,max:96,value:16,required:true}],v=>applyExactFontSize(Math.max(8,Math.min(96,Number(v.size)||16))))}
function setLineSpacing(){askSelect('Line spacing','Spacing',[['1','Single'],['1.15','1.15'],['1.5','1.5'],['2','Double']],choice=>styleBlocks('lineHeight',choice),'1.5')}
function setParagraphSpacing(){form('Paragraph spacing',[
  {name:'before',label:'Before (pixels)',type:'number',min:0,max:120,value:0,required:true},
  {name:'after',label:'After (pixels)',type:'number',min:0,max:120,value:8,required:true}
],v=>{const editor=restoreSelection();selectedBlocks().forEach(block=>{block.style.marginTop=v.before+'px';block.style.marginBottom=v.after+'px'});saveEditor(editor)})}
function formatPainter(){
  const el=activeElement();if(!el){showToast('Select formatted text first');return}
  const style=getComputedStyle(el);
  state.painter={fontFamily:style.fontFamily,fontSize:style.fontSize,fontWeight:style.fontWeight,fontStyle:style.fontStyle,textDecoration:style.textDecoration,color:style.color,backgroundColor:style.backgroundColor,source:state.range?.cloneRange()};
  showToast('Select text to apply formatting');
}
function paintSelection(){
  if(!state.painter||!state.range||state.range.collapsed)return;
  const source=state.painter.source;
  if(source&&source.startContainer===state.range.startContainer&&source.startOffset===state.range.startOffset&&source.endContainer===state.range.endContainer&&source.endOffset===state.range.endOffset)return;
  const editor=restoreSelection();const range=window.getSelection().getRangeAt(0);const fragment=range.extractContents();
  if(fragment.querySelector('p,div,h1,h2,h3,h4,h5,h6,table,ul,ol')){range.insertNode(fragment);showToast('Select text within one paragraph');state.painter=null;return}
  const span=document.createElement('span');const paint=state.painter;
  ['fontFamily','fontSize','fontWeight','fontStyle','textDecoration','color','backgroundColor'].forEach(key=>span.style[key]=paint[key]);
  span.appendChild(fragment);range.insertNode(span);range.selectNodeContents(span);
  const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);
  state.painter=null;saveEditor(editor);showToast('Formatting applied');
}
function insertChecklist(){insertHtml('<div class="doc-check"><input type="checkbox" contenteditable="false"><span>Checklist item</span></div><p><br></p>')}
function insertBox(type){
  const className=type==='callout'?'doc-callout':'doc-textbox';
  insertHtml(`<div class="${className}"><p>Type here...</p></div><p><br></p>`);
}
function insertPageBreak(){insertHtml('<div class="doc-page-break" contenteditable="false"></div><p><br></p>')}
function openImagePicker(){
  const picker=document.createElement('input');picker.type='file';picker.accept='image/*';picker.style.display='none';document.body.appendChild(picker);
  picker.addEventListener('change',async()=>{
    const file=picker.files?.[0];picker.remove();if(!file)return;
    const src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)});
    insertHtml(`<img src="${src}" alt="${esc(file.name)}">`);
  },{once:true});picker.click();
}
function insertShape(){form('Insert shape',[
  {name:'shape',label:'Shape',options:[['rectangle','Rectangle'],['circle','Circle'],['line','Line'],['arrow','Arrow']]},
  {name:'color',label:'Color',type:'color',value:'#3b82f6'},
  {name:'size',label:'Width (pixels)',type:'number',min:40,max:500,value:160}
],v=>{
  const w=Math.max(40,Math.min(500,Number(v.size)||160)),h=v.shape==='circle'?w:v.shape==='line'||v.shape==='arrow'?48:Math.round(w*.55);
  let content='';
  if(v.shape==='rectangle')content=`<rect x="3" y="3" width="${w-6}" height="${h-6}" rx="6" fill="${v.color}"/>`;
  if(v.shape==='circle')content=`<ellipse cx="${w/2}" cy="${h/2}" rx="${w/2-3}" ry="${h/2-3}" fill="${v.color}"/>`;
  if(v.shape==='line')content=`<line x1="4" y1="${h/2}" x2="${w-4}" y2="${h/2}" stroke="${v.color}" stroke-width="3"/>`;
  if(v.shape==='arrow')content=`<path d="M4 ${h/2}H${w-22}m-12 -13 13 13-13 13" fill="none" stroke="${v.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  insertHtml(`<span class="doc-shape" contenteditable="false" data-shape="${v.shape}"><svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${content}</svg></span>&nbsp;`);
})}
function insertSymbol(){
  const symbols=['©','®','™','✓','★','→','←','↑','↓','±','×','÷','≈','≠','≤','≥','∞','π','Σ','α','β','€','£','¥','§','•','°','µ'];
  askSelect('Insert symbol','Symbol',symbols.map(s=>[s,s]),symbol=>insertHtml(esc(symbol)));
}
const loadedScripts=new Map();
function loadScript(url){
  if(loadedScripts.has(url))return loadedScripts.get(url);
  const promise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=url;script.onload=resolve;script.onerror=()=>reject(new Error('Could not load '+url));document.head.appendChild(script)});
  loadedScripts.set(url,promise);return promise;
}
async function ensureKatex(){
  if(!$('doc-katex-css')){const link=document.createElement('link');link.id='doc-katex-css';link.rel='stylesheet';link.href='vendor/katex.css';document.head.appendChild(link)}
  await loadScript('vendor/katex.js');
}
function insertEquation(){form('Insert equation',[{name:'latex',label:'Equation (LaTeX)',value:'E=mc^2',required:true}],async v=>{
  try{await ensureKatex();const rendered=katex.renderToString(v.latex,{throwOnError:false,output:'htmlAndMathml'});
    insertHtml(`<span class="doc-equation" contenteditable="false" data-latex="${esc(v.latex)}">${rendered}</span>&nbsp;`)}catch(error){showToast('Equation could not be rendered')}
})}
function headings(editor){return Array.from(editor.querySelectorAll('h1,h2,h3')).filter(h=>!h.closest('.doc-toc'))}
function insertToc(){
  const editor=restoreSelection(),headingsList=headings(editor);
  if(!headingsList.length){showToast('Add headings first');return}
  headingsList.forEach(h=>{if(!h.id)h.id='heading-'+genId()});
  const links=headingsList.map(h=>`<a href="#${h.id}" data-level="${h.tagName.slice(1)}">${esc(h.textContent)}</a>`).join('');
  const existing=editor.querySelector('.doc-toc');
  if(existing)existing.innerHTML=`<strong>Contents</strong>${links}`;
  else document.execCommand('insertHTML',false,`<nav class="doc-toc" contenteditable="false"><strong>Contents</strong>${links}</nav><p><br></p>`);
  saveEditor(editor);
}
function insertFootnote(){form('Footnote',[{name:'text',label:'Footnote text',type:'textarea',required:true}],v=>{
  const editor=restoreSelection(),id='footnote-'+genId();
  const section=editor.querySelector('.doc-footnotes')||document.createElement('section');section.className='doc-footnotes';
  let list=section.querySelector('ol');if(!list){section.innerHTML='<strong>Footnotes</strong><ol></ol>';list=section.querySelector('ol')}
  const number=list.children.length+1;
  document.execCommand('insertHTML',false,`<sup><a href="#${id}">[${number}]</a></sup>`);
  const item=document.createElement('li');item.id=id;item.textContent=v.text;list.appendChild(item);
  if(!section.parentNode)editor.appendChild(section);
  saveEditor(editor);
})}
function insertCaption(){form('Caption',[
  {name:'kind',label:'Label',options:[['Figure','Figure'],['Table','Table']]},
  {name:'text',label:'Caption',required:true}
],v=>{
  const editor=restoreSelection();const number=editor.querySelectorAll(`.doc-caption[data-kind="${v.kind}"]`).length+1;
  const caption=document.createElement('p');caption.className='doc-caption';caption.dataset.kind=v.kind;caption.textContent=`${v.kind} ${number}: ${v.text}`;
  const target=state.selectedImage||nearest('img,table');
  if(target&&editor.contains(target))target.insertAdjacentElement('afterend',caption);
  else{const range=window.getSelection().getRangeAt(0);range.insertNode(caption)}
  saveEditor(editor);
})}
function insertBookmark(){form('Bookmark',[{name:'name',label:'Bookmark name',required:true}],v=>{
  const editor=restoreSelection(),range=window.getSelection().getRangeAt(0),id='bookmark-'+v.name.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-');
  if(editor.querySelector('#'+CSS.escape(id))){showToast('Bookmark already exists');return}
  const span=document.createElement('span');span.id=id;span.dataset.bookmark=v.name;
  if(range.collapsed)span.textContent='\u200b';else span.appendChild(range.extractContents());range.insertNode(span);saveEditor(editor);
})}
function insertBookmarkLink(){
  const editor=state.editor||$('editor');const items=Array.from(editor.querySelectorAll('[data-bookmark]'));
  if(!items.length){showToast('Add a bookmark first');return}
  askSelect('Link to bookmark','Destination',items.map(el=>[el.id,el.dataset.bookmark]),id=>{
    const ed=restoreSelection(),range=window.getSelection().getRangeAt(0),a=document.createElement('a');a.href='#'+id;
    if(range.collapsed)a.textContent=editor.querySelector('#'+CSS.escape(id))?.dataset.bookmark||'Bookmark';else a.appendChild(range.extractContents());
    range.insertNode(a);saveEditor(ed);
  });
}

function getLayout(){
  const page=currentPage();
  if(!page)return{paper:'a4',orientation:'portrait',marginX:74,marginY:74,columns:1,pageView:false,header:'',footer:'',pageNumbers:false};
  if(!page.docLayout)page.docLayout={paper:'a4',orientation:'portrait',marginX:74,marginY:74,columns:1,pageView:false,header:'',footer:'',pageNumbers:false};
  return page.docLayout;
}
function saveLayout(){save();applyPageLayout()}
function applyPageLayout(){
  const layout=getLayout(),area=$('editor-area'),editor=$('editor');
  area.classList.toggle('doc-page-mode',!!layout.pageView);
  const a4=layout.paper!=='letter';let w=a4?794:816,h=a4?1122:1056;
  if(layout.orientation==='landscape')[w,h]=[h,w];
  area.style.setProperty('--doc-paper-width',w+'px');area.style.setProperty('--doc-paper-height',h+'px');
  area.style.setProperty('--doc-margin-x',(layout.marginX??74)+'px');area.style.setProperty('--doc-margin-y',(layout.marginY??74)+'px');
  editor.dataset.columns=String(layout.columns||1);
}
function togglePageView(){const layout=getLayout();layout.pageView=!layout.pageView;saveLayout()}
function setPaperSize(){askSelect('Paper size','Size',[['a4','A4'],['letter','US Letter']],value=>{getLayout().paper=value;saveLayout()},getLayout().paper)}
function setOrientation(){askSelect('Orientation','Page',[['portrait','Portrait'],['landscape','Landscape']],value=>{getLayout().orientation=value;saveLayout()},getLayout().orientation)}
function setMargins(){askSelect('Margins','Preset',[['normal','Normal'],['narrow','Narrow'],['wide','Wide'],['custom','Custom']],choice=>{
  const layout=getLayout();if(choice==='custom'){
    form('Custom margins',[
      {name:'side',label:'Left and right (pixels)',type:'number',min:12,max:180,value:layout.marginX??74},
      {name:'top',label:'Top and bottom (pixels)',type:'number',min:12,max:180,value:layout.marginY??74}
    ],v=>{layout.marginX=Number(v.side);layout.marginY=Number(v.top);saveLayout()});return;
  }
  const values={normal:[74,74],narrow:[32,32],wide:[110,105]};[layout.marginX,layout.marginY]=values[choice];saveLayout();
  })}
function setColumns(){askSelect('Columns','Count',[['1','One'],['2','Two'],['3','Three']],value=>{getLayout().columns=Number(value);saveLayout()},String(getLayout().columns||1))}
function setHeaderFooter(){const layout=getLayout();form('Header and footer',[
  {name:'header',label:'Header text',value:layout.header||''},
  {name:'footer',label:'Footer text',value:layout.footer||''},
  {name:'numbers',label:'Page numbers',options:[['no','Off'],['yes','On']],value:layout.pageNumbers?'yes':'no'}
],v=>{layout.header=v.header;layout.footer=v.footer;layout.pageNumbers=v.numbers==='yes';saveLayout()})}
function printNote(){
  const page=currentPage();if(!page)return;
  const layout=getLayout();
  const paper=layout.paper==='letter'?'letter':'A4',orientation=layout.orientation==='landscape'?'landscape':'portrait';
  const mx=Math.round((layout.marginX??74)*.75),my=Math.round((layout.marginY??74)*.75);
  const cssValue=s=>JSON.stringify(String(s||'').replace(/[<>]/g,''));
  const header=layout.header?`@top-center{content:${cssValue(layout.header)};font:9pt Arial;color:#555}`:'';
  const footer=layout.footer?`@bottom-left{content:${cssValue(layout.footer)};font:9pt Arial;color:#555}`:'';
  const numbers=layout.pageNumbers?'@bottom-right{content:"Page " counter(page) " of " counter(pages);font:9pt Arial;color:#555}':'';
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(page.title)}</title><style>
    @page{size:${paper} ${orientation};margin:${my}pt ${mx}pt;${header}${footer}${numbers}}
    body{font:11pt/1.5 Arial,sans-serif;color:#222;column-count:${layout.columns||1};column-gap:24pt}h1,h2,h3{break-after:avoid}img{max-width:100%}table{width:100%;border-collapse:collapse;break-inside:avoid}td,th{border:1px solid #777;padding:5px}pre,code{background:#f3f3f3;white-space:pre-wrap}blockquote,.doc-callout{border-left:3px solid #777;padding-left:12px}.doc-page-break{break-after:page}.doc-page-break:before{display:none}.doc-toc a{display:block}.doc-check{display:flex;gap:8px}.doc-check input{accent-color:#444}.doc-shape svg{max-width:100%}ins{color:#167539}del{color:#b32b2b}
    </style></head><body>${$('editor').innerHTML}</body></html>`;
  const preview=window.open('','_blank');if(!preview){showToast('Allow the print window to open');return}
  preview.document.open();preview.document.write(html);preview.document.close();preview.addEventListener('load',()=>preview.print(),{once:true});
}
function downloadBlob(blob,name){const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),30000)}
async function exportDocx(){
  const page=currentPage();if(!page)return;
  try{
    showToast('Preparing DOCX...');await loadScript('vendor/dom-docx.js');
    const layout=getLayout();const blob=await domDocx.convertHtmlToDocx($('editor').innerHTML,{
      styleSource:'computed',root:$('editor'),pageSize:layout.paper==='letter'?'letter':'a4',orientation:layout.orientation||'portrait',
      margins:{top:(layout.marginY??74)/96,bottom:(layout.marginY??74)/96,left:(layout.marginX??74)/96,right:(layout.marginX??74)/96},
      metadata:{title:page.title},
      headerHtml:layout.header?`<p>${esc(layout.header)}</p>`:undefined,
      footerHtml:layout.footer?`<p>${esc(layout.footer)}</p>`:undefined,
      pageNumber:!!layout.pageNumbers
    });
    downloadBlob(blob,(page.title||'note').replace(/[^a-z0-9_-]+/gi,'_')+'.docx');showToast('DOCX exported');
  }catch(error){console.error(error);showToast('DOCX export failed')}
}
function openDocxPicker(){
  const picker=document.createElement('input');picker.type='file';picker.accept='.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document';picker.style.display='none';document.body.appendChild(picker);
  picker.addEventListener('change',async()=>{const file=picker.files?.[0];picker.remove();if(!file)return;
    try{
      showToast('Importing DOCX...');await Promise.all([loadScript('vendor/mammoth.js'),loadScript('vendor/dompurify.js')]);
      const result=await mammoth.convertToHtml({arrayBuffer:await file.arrayBuffer()});
      const html=DOMPurify.sanitize(result.value,{USE_PROFILES:{html:true},ADD_TAGS:['math'],ADD_ATTR:['style']});
      createPage();const editor=$('editor');editor.innerHTML=html;saveContent();
      const page=currentPage();page.title=file.name.replace(/\.docx$/i,'');save();renderPages();
      showToast(result.messages.length?'Imported with some formatting differences':'DOCX imported');
    }catch(error){console.error(error);showToast('DOCX import failed')}
  },{once:true});picker.click();
}

function setupFindPanel(){
  const panel=document.createElement('div');panel.id='doc-find-panel';panel.className='doc-find-panel';panel.hidden=true;
  panel.innerHTML='<div class="doc-panel-head"><span>Find and replace</span><button type="button" id="doc-find-close" aria-label="Close">×</button></div><div class="doc-panel-line"><input id="doc-find-input" placeholder="Find in note" aria-label="Find in note"><button type="button" id="doc-find-prev" title="Previous">↑</button><button type="button" id="doc-find-next" title="Next">↓</button></div><div class="doc-panel-line"><input id="doc-replace-input" placeholder="Replace with" aria-label="Replace with"><button type="button" id="doc-replace-one">Replace</button></div><div class="doc-panel-line"><button type="button" id="doc-replace-all">Replace all</button><span class="doc-panel-note" id="doc-find-count"></span></div>';
  document.body.appendChild(panel);
  $('doc-find-close').addEventListener('click',closeFindPanel);
  $('doc-find-input').addEventListener('input',updateFindMatches);
  $('doc-find-prev').addEventListener('click',()=>goToFind(-1));$('doc-find-next').addEventListener('click',()=>goToFind(1));
  $('doc-replace-one').addEventListener('click',replaceOne);$('doc-replace-all').addEventListener('click',replaceAll);
  $('doc-find-input').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();goToFind(e.shiftKey?-1:1)}});
}
function openFindPanel(){clearMenu();$('doc-find-panel').hidden=false;$('doc-find-input').focus();$('doc-find-input').select();updateFindMatches()}
function closeFindPanel(){const panel=$('doc-find-panel');if(panel)panel.hidden=true;if(window.CSS?.highlights)CSS.highlights.delete('doc-find');state.findRanges=[];state.findIndex=-1}
function textIndex(editor){
  const entries=[];let text='';const walker=document.createTreeWalker(editor,NodeFilter.SHOW_TEXT,{acceptNode(node){
    if(node.parentElement?.closest('.doc-toc,[contenteditable="false"]'))return NodeFilter.FILTER_REJECT;
    return NodeFilter.FILTER_ACCEPT;
  }});
  let node;while(node=walker.nextNode()){entries.push({node,start:text.length,end:text.length+node.nodeValue.length});text+=node.nodeValue}
  return{text,entries};
}
function rangeAtOffsets(entries,start,end){
  const first=entries.find(e=>e.end>start),last=entries.find(e=>e.end>=end);
  if(!first||!last)return null;
  const range=document.createRange();range.setStart(first.node,start-first.start);range.setEnd(last.node,end-last.start);return range;
}
function updateFindMatches(){
  if(!$('doc-find-panel')||$('doc-find-panel').hidden)return;
  const query=$('doc-find-input').value;state.findRanges=[];state.findIndex=-1;
  if(window.CSS?.highlights)CSS.highlights.delete('doc-find');
  if(query){const {text,entries}=textIndex($('editor'));const haystack=text.toLocaleLowerCase(),needle=query.toLocaleLowerCase();let at=0;
    while((at=haystack.indexOf(needle,at))!==-1){const range=rangeAtOffsets(entries,at,at+needle.length);if(range)state.findRanges.push(range);at+=Math.max(1,needle.length)}
  }
  $('doc-find-count').textContent=state.findRanges.length+' matches';
  if(window.CSS?.highlights&&state.findRanges.length)CSS.highlights.set('doc-find',new Highlight(...state.findRanges));
}
function goToFind(direction){
  if(!state.findRanges.length)return;
  state.findIndex=(state.findIndex+direction+state.findRanges.length)%state.findRanges.length;
  const range=state.findRanges[state.findIndex];const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);
  range.startContainer.parentElement?.scrollIntoView({block:'center',behavior:'smooth'});
  $('doc-find-count').textContent=`${state.findIndex+1} of ${state.findRanges.length}`;rememberSelection();
}
function replaceOne(){
  if(!state.findRanges.length)return;if(state.findIndex<0)state.findIndex=0;
  const range=state.findRanges[state.findIndex],replacement=$('doc-replace-input').value;
  range.deleteContents();range.insertNode(document.createTextNode(replacement));saveContent();updateFindMatches();
}
function replaceAll(){
  const count=state.findRanges.length;if(!count)return;const replacement=$('doc-replace-input').value;
  for(let i=count-1;i>=0;i--){const range=state.findRanges[i];range.deleteContents();range.insertNode(document.createTextNode(replacement))}
  saveContent();updateFindMatches();showToast(`Replaced ${count} matches`);
}
function setupCommentsPanel(){
  const panel=document.createElement('div');panel.id='doc-comments-panel';panel.className='doc-comments-panel';panel.hidden=true;
  panel.innerHTML='<div class="doc-panel-head"><span>Comments</span><button type="button" id="doc-comments-close" aria-label="Close">×</button></div><div id="doc-comments-list" class="doc-comments-list"></div>';
  document.body.appendChild(panel);$('doc-comments-close').addEventListener('click',closeCommentsPanel);
}
function openCommentsPanel(){clearMenu();$('doc-comments-panel').hidden=false;renderComments()}
function closeCommentsPanel(){const panel=$('doc-comments-panel');if(panel)panel.hidden=true}
function addComment(){
  const range=state.range;if(!range||range.collapsed||!editorFromRange(range)){showToast('Select text to comment on');return}
  form('Add comment',[{name:'comment',label:'Comment',type:'textarea',required:true}],v=>{
    const editor=restoreSelection(),selection=window.getSelection(),r=selection.getRangeAt(0),mark=document.createElement('span');
    mark.className='doc-comment-mark';mark.dataset.commentId=genId();mark.dataset.comment=v.comment;
    try{mark.appendChild(r.extractContents());r.insertNode(mark)}catch(error){showToast('Select text within one paragraph');return}
    saveEditor(editor);renderComments();openCommentsPanel();
  });
}
function renderComments(){
  const list=$('doc-comments-list');if(!list)return;list.replaceChildren();
  const marks=Array.from($('editor').querySelectorAll('.doc-comment-mark'));
  if(!marks.length){const empty=document.createElement('div');empty.className='doc-panel-note';empty.textContent='No comments in this note';list.appendChild(empty);return}
  marks.forEach(mark=>{const row=document.createElement('button');row.type='button';row.className='doc-comment-item';row.textContent=mark.dataset.comment||'';
    const excerpt=document.createElement('small');excerpt.textContent=mark.textContent.slice(0,70);row.appendChild(excerpt);
    row.addEventListener('click',()=>{mark.scrollIntoView({block:'center',behavior:'smooth'});const range=document.createRange();range.selectNodeContents(mark);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);rememberSelection()});list.appendChild(row);
  });
}
function toggleTracking(){const page=currentPage();if(!page)return;page.trackChanges=!page.trackChanges;save();showToast(page.trackChanges?'Track changes on':'Track changes off')}
function insertTrackedText(editor,text){
  const selection=window.getSelection();if(!selection.rangeCount)return;
  const range=selection.getRangeAt(0);
  if(!range.collapsed){const deleted=document.createElement('del');deleted.className='doc-change';deleted.appendChild(range.extractContents());range.insertNode(deleted);range.setStartAfter(deleted);range.collapse(true)}
  const ins=document.createElement('ins');ins.className='doc-change';ins.textContent=text;range.insertNode(ins);
  range.selectNodeContents(ins);range.collapse(false);selection.removeAllRanges();selection.addRange(range);saveEditor(editor);
}
function markTrackedDeletion(editor,range){
  const deleted=document.createElement('del');deleted.className='doc-change';deleted.appendChild(range.extractContents());range.insertNode(deleted);
  range.setStartAfter(deleted);range.collapse(true);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);saveEditor(editor);
}
function trackBeforeInput(event){
  const editor=event.currentTarget;if(!pageFor(editor)?.trackChanges||event.isComposing)return;
  const type=event.inputType,selection=window.getSelection();if(!selection.rangeCount)return;
  const range=selection.getRangeAt(0),insideChange=(range.startContainer.nodeType===1?range.startContainer:range.startContainer.parentElement)?.closest('ins.doc-change');
  if(type==='insertText'&&event.data){
    if(insideChange&&range.collapsed)return;
    event.preventDefault();insertTrackedText(editor,event.data);return;
  }
  if(type==='deleteContentBackward'||type==='deleteContentForward'){
    if(insideChange&&range.collapsed)return;
    event.preventDefault();
    if(range.collapsed&&range.startContainer.nodeType===Node.TEXT_NODE){
      const offset=range.startOffset,text=range.startContainer;
      if(type==='deleteContentBackward'&&offset>0)range.setStart(text,offset-1);
      else if(type==='deleteContentForward'&&offset<text.length)range.setEnd(text,offset+1);
      else return;
    }
    if(!range.collapsed)markTrackedDeletion(editor,range);
  }
}
function resolveChange(accept){
  const editor=restoreSelection();let change=nearest('ins.doc-change,del.doc-change');
  if(!change)change=editor.querySelector('ins.doc-change,del.doc-change');
  if(!change){showToast('No tracked change found');return}
  const keep=(change.tagName==='INS')===accept;
  if(keep)change.replaceWith(...Array.from(change.childNodes));else change.remove();
  saveEditor(editor);showToast(accept?'Change accepted':'Change rejected');
}

function handleEditorClick(event){
  const checkbox=event.target.closest('.doc-check input[type="checkbox"]');
  if(checkbox){
    checkbox.toggleAttribute('checked',checkbox.checked);
    checkbox.closest('.doc-check').classList.toggle('checked',checkbox.checked);
    saveEditor(event.currentTarget);return;
  }
  const image=event.target.closest('img');
  state.selectedImage=image&&event.currentTarget.contains(image)?image:null;updateImageTools();
  const cell=event.target.closest('td,th');
  if(cell&&event.currentTarget.contains(cell)){state.lastTableCell=cell;updateTableTools()}
  else if(!event.target.closest('#doc-table-tools')){$('doc-table-tools').classList.remove('open');state.lastTableCell=null}
  const comment=event.target.closest('.doc-comment-mark');
  if(comment)openCommentsPanel();
  const tocLink=event.target.closest('.doc-toc a');
  if(tocLink){event.preventDefault();const target=event.currentTarget.querySelector(tocLink.getAttribute('href'));target?.scrollIntoView({block:'start',behavior:'smooth'})}
}
function handleEditorDoubleClick(event){
  const equation=event.target.closest('.doc-equation');
  if(equation&&event.currentTarget.contains(equation)){
    form('Edit equation',[{name:'latex',label:'Equation (LaTeX)',value:equation.dataset.latex||'',required:true}],async v=>{
      try{await ensureKatex();equation.dataset.latex=v.latex;equation.innerHTML=katex.renderToString(v.latex,{throwOnError:false,output:'htmlAndMathml'});saveEditor(event.currentTarget)}
      catch(error){showToast('Equation could not be rendered')}
    });
  }
}
function startTableResize(event){
  const cell=event.target.closest('td,th');if(!cell||!cell.closest('table.doc-table'))return;
  const rect=cell.getBoundingClientRect();if(rect.right-event.clientX>6)return;
  const table=cell.closest('table'),cols=table.querySelector('colgroup');const index=cell.cellIndex;
  if(!cols||index>=cols.children.length-1)return;
  event.preventDefault();
  state.tableResize={table,editor:event.currentTarget,index,startX:event.clientX,first:parseFloat(cols.children[index].style.width)||100/cols.children.length,second:parseFloat(cols.children[index+1].style.width)||100/cols.children.length};
}
function moveTableResize(event){
  const resize=state.tableResize;if(!resize)return;
  const change=(event.clientX-resize.startX)/resize.table.getBoundingClientRect().width*100;
  const first=Math.max(7,Math.min(resize.first+resize.second-7,resize.first+change));
  const cols=resize.table.querySelector('colgroup');cols.children[resize.index].style.width=first+'%';cols.children[resize.index+1].style.width=(resize.first+resize.second-first)+'%';
}
function endTableResize(){if(!state.tableResize)return;saveEditor(state.tableResize.editor);state.tableResize=null}

document.addEventListener('DOMContentLoaded',()=>{
  const toolbar=$('editor-toolbar');const appearance=toolbar.querySelector('.appearance-wrap');
  ['insert','format','layout','review'].forEach(kind=>toolbar.insertBefore(makeToolbarButton(kind,kind[0].toUpperCase()+kind.slice(1)),appearance));
  const pop=document.createElement('div');pop.id='doc-popover';pop.className='doc-popover';document.body.appendChild(pop);
  const dialog=document.createElement('dialog');dialog.id='doc-dialog';dialog.className='doc-dialog';
  dialog.innerHTML='<form method="dialog"><div class="doc-dialog-header" id="doc-dialog-title"></div><div class="doc-dialog-fields" id="doc-dialog-fields"></div><div class="doc-dialog-actions"><button type="button" id="doc-dialog-cancel">Cancel</button><button type="submit" class="primary">Apply</button></div></form>';
  document.body.appendChild(dialog);$('doc-dialog-cancel').addEventListener('click',()=>dialog.close());
  const tableTools=document.createElement('div');tableTools.id='doc-table-tools';tableTools.className='doc-table-tools';tableTools.innerHTML='<button type="button" title="Table tools">▦ Table</button>';document.body.appendChild(tableTools);
  tableTools.querySelector('button').addEventListener('pointerdown',rememberSelection);
  tableTools.querySelector('button').addEventListener('click',e=>openMenu('table',e.currentTarget));
  const imageTools=document.createElement('div');imageTools.id='doc-image-tools';imageTools.className='doc-image-tools';imageTools.innerHTML='<button type="button" title="Image tools">▧ Image</button>';document.body.appendChild(imageTools);
  imageTools.querySelector('button').addEventListener('pointerdown',rememberSelection);
  imageTools.querySelector('button').addEventListener('click',e=>openMenu('image',e.currentTarget));
  setupFindPanel();setupCommentsPanel();
  document.addEventListener('selectionchange',()=>{rememberSelection();updateTableTools();if(state.painter)paintSelection()});
  document.addEventListener('click',e=>{if(!e.target.closest('#doc-popover,[data-doc-menu],#doc-table-tools,#doc-image-tools'))clearMenu()});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){clearMenu();closeFindPanel();closeCommentsPanel()}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='h'){e.preventDefault();openFindPanel()}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='f'&&document.activeElement?.closest('.panel-editor')){e.preventDefault();openFindPanel()}
  });
  ['editor','split-editor'].forEach(id=>{
    const ed=$(id);ed.addEventListener('beforeinput',trackBeforeInput);ed.addEventListener('click',handleEditorClick);
    ed.addEventListener('dblclick',handleEditorDoubleClick);
    ed.addEventListener('pointerdown',startTableResize);
    ed.addEventListener('input',()=>{updateFindMatches();renderComments()});
  });
  document.addEventListener('pointermove',moveTableResize);document.addEventListener('pointerup',endTableResize);
  window.addEventListener('scroll',()=>{updateTableTools();updateImageTools()},true);
  const originalSelectPage=window.selectPage;
  window.selectPage=function(id){originalSelectPage(id);state.range=null;state.editor=null;state.selectedImage=null;applyPageLayout();renderComments();closeFindPanel();updateTableTools();updateImageTools()};
  applyPageLayout();renderComments();
});
})();
