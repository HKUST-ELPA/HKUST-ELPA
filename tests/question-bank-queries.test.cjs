'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const questions=JSON.parse(read('question-bank/questions.json'));
const appearances=JSON.parse(read('question-bank/appearances.json'));
const queries=read('assets/js/question-bank-queries.js');
function run(){
 const context=vm.createContext({});
 vm.runInContext('const BANKS='+JSON.stringify(questions.banks)+';\n'+
  'const HISTORICAL_QUESTION_IDS='+JSON.stringify(questions.historicalQuestionIds)+';\n'+
  'const ELPA_APPEARANCES='+JSON.stringify(appearances)+';\n'+queries,context);
 return JSON.parse(JSON.stringify(vm.runInContext('({all:elpaAllPracticeIds(),term:elpaLatestTerm(),current:elpaCurrentQuestionIds(),archived:elpaArchivedQuestionIds(),reported:elpaReportedTerms("GZ-R-0034")})',context)));
}
test('all four canonical domains share stable IDs and reported-term lookups',()=>{
 const data=run();
 assert.equal(data.all.length,49);
 assert.ok(data.all.includes('GZ-R-0001'));
 assert.ok(data.all.includes('GZ-F-0001'));
 assert.ok(data.all.every(x=>/^(GZ|HK)-(R|F)-\d{4}$/.test(x)));
 assert.equal(new Set([...data.current,...data.archived]).size,data.all.length);
 assert.ok(questions.historicalQuestionIds.every(id=>data.all.includes(id)));
});
test('practice loads generated data and query code before UI',()=>{
 const html=read('practice.html');
 const files=['question-bank/questions.js','question-bank/appearances.js',
 'question-bank/taxonomy.js','assets/js/question-bank-queries.js',
 'assets/js/practice-storage.js','assets/js/practice.js','assets/js/practice-session.js'];
 const offsets=files.map(file=>html.indexOf('<script src="./'+file+'"></script>'));
 assert.ok(offsets.every(x=>x>=0));
 assert.deepEqual([...offsets].sort((a,b)=>a-b),offsets);
 assert.match(queries,/function elpaLatestTermForIds/);
});
