import {spawnSync} from 'node:child_process';
import {writeFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {extractBatch} from './batch.mjs';
const out=fileURLToPath(new URL('../',import.meta.url));
const cwd=fileURLToPath(new URL('../../../../rabbitmq/',import.meta.url));
const put=(name,text)=>writeFileSync(out+name,text);
const json=(name,value)=>put(name,JSON.stringify(value,null,2)+'\n');
const dc=['compose','-p','qa-taller-integracion-rabbitmq'];
function run(name,bin,args,timeout=15000) {
  const command=[bin,...args].map(x=>"'"+x.replaceAll("'","'\\''")+"'").join(' ');
  put(name+'-comando.txt',command+'\n');
  put(name+'-inicio.txt',new Date().toISOString()+'\n');
  const r=spawnSync(bin,args,{cwd,encoding:'utf8',timeout,maxBuffer:20*1024*1024});
  put(name+'-stdout.txt',r.stdout??''); put(name+'-stderr.txt',(r.stderr??'')+(r.error?'\n'+r.error.message:''));
  put(name+'-exitcode.txt',String(r.status??-1)+'\n'); put(name+'-fin.txt',new Date().toISOString()+'\n');
  if(r.status!==0) throw Error(`${name} exitcode ${r.status}`);
  return r.stdout;
}
const parse=(text)=>{try{return JSON.parse(text);}catch(cause){throw new Error('Invalid JSON evidence',{cause});}};
const queue=name=>parse(run(name,'curl',['--fail','--silent','--show-error','--max-time','5','-u','admin:admin','http://localhost:15672/api/queues/%2F/pedidos']));
const empty=q=>q.consumers===2&&q.messages_ready===0&&q.messages_unacknowledged===0&&q.messages===0;
const sleep=()=>new Promise(r=>setTimeout(r,2000));
function events(text) {
  return text.split('\n').flatMap(line=>{const start=line.indexOf('{'); if(start<0)return [];try{return [{...parse(line.slice(start)),worker:line.split('|')[0].trim()}];}catch{return [];}});
}
if(existsSync(out+'LIVE-ATTEMPT.txt')) throw Error('Live attempt already exists; never rerun');
put('LIVE-ATTEMPT.txt',new Date().toISOString()+'\n');
try {
  const rawPs=run('01-compose','docker',[...dc,'ps','-a','--format','json']);
  const containers=rawPs.trim().startsWith('[')?parse(rawPs):rawPs.trim().split('\n').map(parse);
  if(containers.filter(x=>x.Service==='notification-worker'&&x.State==='running').length!==2) throw Error('Expected both workers running');
  let q=queue('02-management'); const deadline=Date.now()+30000;
  for(let i=0;!empty(q)&&Date.now()<deadline;i++){await sleep();q=queue(`02-wait-${i}`);}
  if(!empty(q)) throw Error('Baseline queue precondition failed; no publication');
  const start=new Date().toISOString(); put('lote-inicio.txt',start+'\n');
  const stdout=run('03-postman','postman',['collection','run','pruebas/RabbitMQ.postman_collection.json','-i','Crear pedido — esperado HTTP 202','--iteration-count','6','--timeout','60000','--timeout-request','10000','--timeout-script','5000','--no-report-events','--verbose'],65000);
  const ids=extractBatch(stdout); json('ids.json',ids);
  if(!/\|\s*assertions\s*\|\s*24\s*\|\s*0\s*\|/.test(stdout)) throw Error('Runner did not report 24 passing assertions');
  let ev=[]; let complete=false; const end=Date.now()+60000;
  for(let i=0;Date.now()<end;i++) {
    const raw=run(`04-wait-${i}-logs`,'docker',[...dc,'logs','--no-color','--timestamps','--since',start,'orders-api','notification-worker']);
    ev=events(raw); q=queue(`04-wait-${i}-queue`);
    if(ids.every(id=>ev.some(e=>e.orderId===id&&e.event==='order_processed'))&&empty(q)){complete=true;break;}
    await sleep();
  }
  run('05-logs','docker',[...dc,'logs','--no-color','--timestamps','--since',start,'orders-api','notification-worker','rabbitmq']);
  const rows=ids.map(orderId=>{
    const matching=ev.filter(e=>e.orderId===orderId);
    const pub=matching.find(e=>e.event==='order_published');
    const rec=matching.find(e=>e.event==='order_received');
    const done=matching.find(e=>e.event==='order_processed');
    return {orderId,publication:pub?.timestamp,received:rec?.timestamp,processed:done?.timestamp,worker:done?.worker,instance:done?.instance,redelivered:rec?.redelivered,publicationCount:matching.filter(e=>e.event==='order_published').length,receivedCount:matching.filter(e=>e.event==='order_received').length,processedCount:matching.filter(e=>e.event==='order_processed').length};
  });
  json('tabla.json',rows);
  const counts={}; for(const row of rows) if(row.worker)counts[row.worker]=(counts[row.worker]??0)+1;
  const checks={acceptedUnique:ids.length===6,assertions24:true,allPublishedReceivedProcessed:rows.every(r=>r.publication&&r.received&&r.processed),bothWorkers:Object.keys(counts).length===2,finalCondition:complete};
  json('resultado.json',{checks,counts,verdict:Object.values(checks).every(Boolean)?'Cumple técnico; pendiente captura final':'Parcial'});
} catch(error) {
  json('fallo.json',{timestamp:new Date().toISOString(),message:error.message}); process.exitCode=1;
} finally {
  try {queue('06-management-final');run('07-compose-final','docker',[...dc,'ps','-a','--format','json']);}catch(error){json('fallo-final.json',{message:error.message});process.exitCode=1;}
}
