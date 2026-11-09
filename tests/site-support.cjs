'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const site=path.join(root,'_site');
const read=file=>fs.readFileSync(path.join(file.endsWith('.html')?site:root,file),'utf8');

// Source-level tests inspect page-specific JS/CSS in load order; shared site.css is tested separately.
function readPageSource(name){
  const html=read(name);
  const files=[...html.matchAll(/(?:src|href)="\.\/(assets\/(?:js|css)\/[^"?#]+)(?:\?[^"]*)?"/g)].map(match=>match[1]).filter(file=>file!=='assets/css/site.css');
  return html+'\n'+files.map(read).join('\n');
}
module.exports={read,readPageSource};
