const MAX_BYTES=10*1024*1024,MAX_TEXT=200000;
function aborted(signal){if(signal?.aborted)throw new DOMException('已取消解析','AbortError');}
export function pdfItemsToLines(items,pageNumber=1){
  const lines=[];
  for(const item of items.filter(x=>typeof x.str==='string'&&x.str.trim()).sort((a,b)=>b.transform[5]-a.transform[5]||a.transform[4]-b.transform[4])){
    const y=item.transform[5],height=Math.max(5,item.height||Math.abs(item.transform[3])||10);
    let line=lines.findLast(l=>Math.abs(l.y-y)<=Math.min(3.5,height*.27));
    if(!line){line={y,items:[],page:pageNumber};lines.push(line);}line.items.push(item);
  }
  return lines.map(l=>{
    const items=l.items.sort((a,b)=>a.transform[4]-b.transform[4]);let text='',previous;
    for(const it of items){const gap=previous?it.transform[4]-(previous.transform[4]+previous.width):0;const spacer=previous&&gap>2?(gap>12?'  ':' '):'';text+=spacer+it.str;previous=it;}
    return {text:text.trim(),page:l.page};
  }).filter(l=>l.text);
}
async function readPdf(bytes,signal,onProgress){
  const pdfjs=await import('./vendor/pdfjs/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.min.mjs',import.meta.url).href;
  const task=pdfjs.getDocument({data:bytes,cMapUrl:new URL('./vendor/pdfjs/cmaps/',import.meta.url).href,cMapPacked:true,standardFontDataUrl:new URL('./vendor/pdfjs/standard_fonts/',import.meta.url).href,isEvalSupported:false,useWasm:false,stopAtErrors:true});
  const cancel=()=>task.destroy();signal?.addEventListener('abort',cancel,{once:true});
  try{
    const pdf=await task.promise;aborted(signal);if(pdf.numPages>20)throw new Error('简历超过 20 页，请只上传用于投递的简历部分。');
    const lines=[],warnings=[];let empty=0;
    for(let n=1;n<=pdf.numPages;n++){aborted(signal);onProgress?.('正在读取第 '+n+' / '+pdf.numPages+' 页');const page=await pdf.getPage(n),content=await page.getTextContent();const pageLines=pdfItemsToLines(content.items,n);if(pageLines.map(x=>x.text).join('').length<20)empty++;lines.push(...pageLines);if(lines.reduce((n,l)=>n+l.text.length,0)>MAX_TEXT)throw new Error('简历文字过多，请缩减至 20 万字以内。');page.cleanup();}
    if(empty)warnings.push(empty+' 页没有足够的可提取文字，可能是扫描页或图片，相关内容未解析。');
    return {lines,warnings,format:'pdf',pages:pdf.numPages};
  }catch(e){aborted(signal);if(e.name==='PasswordException')throw new Error('这份 PDF 有密码保护，请先解除保护再上传。');throw e;}finally{signal?.removeEventListener('abort',cancel);await task.destroy();}
}
async function unzipText(entry,signal){
  return new Promise((resolve,reject)=>{let size=0,finished=false;const chunks=[],stream=entry.internalStream('uint8array');
    const fail=e=>{if(finished)return;finished=true;stream.pause();signal?.removeEventListener('abort',cancel);reject(e);};
    const cancel=()=>fail(new DOMException('已取消解析','AbortError'));signal?.addEventListener('abort',cancel,{once:true});
    stream.on('data',chunk=>{size+=chunk.length;if(size>4*1024*1024){fail(new Error('Word 文本内容过大，请缩减后重试。'));return;}chunks.push(chunk);});
    stream.on('error',fail);stream.on('end',()=>{if(finished)return;finished=true;signal?.removeEventListener('abort',cancel);const bytes=new Uint8Array(size);let n=0;for(const chunk of chunks){bytes.set(chunk,n);n+=chunk.length;}resolve(new TextDecoder().decode(bytes));});stream.resume();
  });
}
export function wordXmlToLines(xml){
  if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('Word 文件包含不支持的内容，请另存为标准 DOCX 或 PDF。');
  const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw new Error('Word 文档内容损坏，无法读取。');
  const lines=[];
  const paragraph=p=>{function text(n){if(n.localName==='del'||n.localName==='moveFrom')return '';if(n.localName==='t')return n.textContent;if(n.localName==='tab')return '  ';if(['br','cr'].includes(n.localName))return '\n';return [...n.children].map(text).join('');}return text(p);};
  function walk(el){
    if(el.localName==='tr'){const cells=[...el.children].filter(n=>n.localName==='tc').map(tc=>[...tc.getElementsByTagNameNS('*','p')].map(paragraph).filter(Boolean).join(' '));if(cells.some(Boolean))lines.push({text:cells.join('  |  '),page:1});return;}
    if(el.localName==='p'){const text=paragraph(el);for(const part of text.split('\n'))if(part.trim())lines.push({text:part.trim(),page:1});return;}
    for(const child of el.children)walk(child);
  }walk(doc.documentElement);return lines;
}
async function readDocx(bytes,signal){
  if(!globalThis.JSZip)await import('./vendor/jszip/jszip.min.js');
  const zip=await globalThis.JSZip.loadAsync(bytes);aborted(signal);
  if(!zip.file('word/document.xml'))throw new Error('文件不是有效的 Word DOCX，请重新另存为 .docx。');
  const names=Object.keys(zip.files);if(names.length>1000)throw new Error('Word 文件结构过于复杂，请另存为 PDF 后上传。');
  const headers=names.filter(n=>/^word\/header\d+\.xml$/.test(n)),footers=names.filter(n=>/^word\/footer\d+\.xml$/.test(n));
  if(headers.length+footers.length>40)throw new Error('Word 页眉页脚过多，请另存为 PDF 后上传。');
  const lines=[];let total=0,textLength=0;for(const n of [...headers,'word/document.xml',...footers]){aborted(signal);const xml=await unzipText(zip.file(n),signal);total+=xml.length;if(total>16*1024*1024)throw new Error('Word 内容过大，请缩减后重试。');const part=wordXmlToLines(xml);textLength+=part.reduce((sum,l)=>sum+l.text.length,0);if(textLength>MAX_TEXT)throw new Error('简历文字过多，请缩减至 20 万字以内。');lines.push(...part);}
  return {lines,warnings:[],format:'docx'};
}
export async function readResume(file,{signal,onProgress}={}){
  if(file.size>MAX_BYTES)throw new Error('请选择不超过 10 MB 的简历。');
  const extension=file.name.split('.').at(-1).toLowerCase();if(!['pdf','docx','txt'].includes(extension))throw new Error('支持 PDF、Word（.docx）和 TXT。旧版 .doc 请先另存为 .docx。');
  const bytes=new Uint8Array(await file.arrayBuffer());aborted(signal);let result;
  if(extension==='pdf'){if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new Error('文件内容不是有效的 PDF。');result=await readPdf(bytes,signal,onProgress);}
  else if(extension==='docx')result=await readDocx(bytes,signal);
  else{let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{text=new TextDecoder('gb18030').decode(bytes);}result={format:'txt',warnings:[],lines:text.split(/\r?\n/).map(text=>({text,page:1}))};}
  aborted(signal);const text=result.lines.map(l=>l.text).join('\n');if(text.length>MAX_TEXT)throw new Error('简历文字过多，请缩减至 20 万字以内。');
  if(text.replace(/\s/g,'').length<20)throw new Error('没有读取到足够文字。如果是扫描件或图片型 PDF，请上传可复制文字的版本，或使用“粘贴简历文本”。');
  return {...result,text};
}
