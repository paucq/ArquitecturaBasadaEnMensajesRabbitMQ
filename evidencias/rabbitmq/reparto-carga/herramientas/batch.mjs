export function extractBatch(stdout, expected=6) {
  const lines=stdout.replace(/\x1b\[[0-9;]*m/g,'').split(/\r?\n/);
  const ids=[];
  let code;
  for(let i=0;i<lines.length;i++) {
    const status=/^\s*(\d{3})\s+\w+.*time/.exec(lines[i]);
    if(status) code=Number(status[1]);
    if(!/^\s*- v application\/json(?:\s|;|$)/i.test(lines[i])) continue;
    const chunks=[];
    while(i+1<lines.length) {
      const m=/^\s*\| ?(.*)$/.exec(lines[i+1]);
      if(!m) break;
      chunks.push(m[1]); i++;
    }
    let body;
    try { body=JSON.parse(chunks.join('')); }
    catch(cause) { throw new Error('Invalid HTTP JSON', {cause}); }
    if(code!==202) throw Error('Expected HTTP 202');
    if(body.status!=='accepted'||body.message!=='Pedido recibido y enviado a RabbitMQ'||!/^ORD-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.orderId)) throw Error('Invalid accepted response');
    ids.push(body.orderId);
  }
  if(ids.length!==expected) throw Error(`Expected ${expected} responses, found ${ids.length}`);
  if(new Set(ids).size!==expected) throw Error('Expected unique IDs');
  return ids;
}
