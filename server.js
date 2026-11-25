/* LUMI Eventos v2 — API Express + SQLite + Socket.IO.
   Execute com npm install && npm start (Node 22.13+).
   NÃO está pronto para produção pública: protótipo para rede local confiável. */
'use strict';
const express=require('express');
const {Server}=require('socket.io');
const http=require('node:http'),https=require('node:https'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {initialize,db,now}=require('./database');
const S=require('./service');
initialize();
const app=express();app.disable('x-powered-by');
app.use(express.json({limit:'200kb'}));
app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
 if(req.path.startsWith('/api/'))res.setHeader('Cache-Control','no-store');next();});
const port=Number(process.env.PORT||3000);
const server=http.createServer(app);
const io=new Server(server,{cors:{origin:false}});
let ioHttps=null;
let httpsServer=null;
const certPath=path.join(__dirname,'certs','cert.pem'),keyPath=path.join(__dirname,'certs','key.pem');
if(fs.existsSync(certPath)&&fs.existsSync(keyPath)){
 httpsServer=https.createServer({cert:fs.readFileSync(certPath),key:fs.readFileSync(keyPath)},app);
 ioHttps=new Server(httpsServer,{cors:{origin:false}});
}
const changes=(scope,eventId)=>{const payload={scope,eventId:eventId||null,at:Date.now()};io.emit('lumi:updated',payload);ioHttps?.emit('lumi:updated',payload);};
const SESSION_MS=12*60*60*1000;
const cookieName='lumi_sid';
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
function cookies(str){return Object.fromEntries((str||'').split(';').map(x=>x.trim().split('=').map((v,i)=>i?decodeURIComponent(v||''):v)).filter(a=>a[0]));}
function sessionCookie(req,token,expiry=SESSION_MS){return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(expiry/1000)}${req.secure?'; Secure':''}`;}
function getActor(req){const token=cookies(req.headers.cookie)[cookieName];if(!token||token.length!==64)return null;
 const session=S.one('SELECT * FROM sessoes WHERE token_hash=? AND expira_em>?',sha(token),now());if(!session)return null;
 if(session.tipo==='FUNCIONARIO'){
  const person=S.one('SELECT id,nome,login,permissao,ativo FROM funcionarios WHERE id=?',session.ator_id);
  return person?.ativo?{type:'FUNCIONARIO',id:person.id,name:person.nome,role:person.permissao,login:person.login}:null;
 }
 const person=S.one('SELECT id,nome,email FROM usuarios WHERE id=?',session.ator_id);
 return person?{type:'CLIENTE',id:person.id,name:person.nome,role:'CLIENTE',login:person.email}:null;
}
app.use((req,res,next)=>{
 // Bloqueia solicitações de escrita de outros sites (CSRF de origem); não habilitamos CORS.
 if(req.path.startsWith('/api/')&&!['GET','HEAD','OPTIONS'].includes(req.method)){
  const origin=req.headers.origin;
  if(origin){try{const dest=new URL(origin);if(dest.host!==req.headers.host||dest.protocol!==(req.secure?'https:':'http:'))
    return res.status(403).json({error:'Origem não autorizada.'});}catch{return res.status(403).json({error:'Origem inválida.'});}}
 }
 req.actor=getActor(req);next();
});
const wrap=fn=>(req,res,next)=>{try{Promise.resolve(fn(req,res)).catch(next);}catch(e){next(e);}};
const authenticated=(req)=>{if(!req.actor)throw new S.AppError('Faça login para continuar.',401);return req.actor;};
const employee=(req,roles)=>{const actor=authenticated(req);if(actor.type!=='FUNCIONARIO'||!roles.includes(actor.role))throw new S.AppError('Sem permissão para esta operação.',403);return actor;};
const admin=req=>employee(req,['ADMIN']);
const val=req=>employee(req,['ADMIN','VALIDADOR']);
const sales=req=>employee(req,['ADMIN','CAIXA']);
const RATE=new Map();
function rateLimit(req){const ip=req.ip||req.socket.remoteAddress;const stamp=Date.now();const old=RATE.get(ip)||[];
 const recent=old.filter(x=>stamp-x<900000);recent.push(stamp);RATE.set(ip,recent);
 if(recent.length>30)throw new S.AppError('Muitas tentativas. Aguarde 15 minutos.',429);
 if(RATE.size>1000)RATE.clear();}
function createSession(req,res,actor){const token=crypto.randomBytes(32).toString('hex');
 S.run('INSERT INTO sessoes(token_hash,tipo,ator_id,expira_em) VALUES(?,?,?,?)',sha(token),actor.type,actor.id,new Date(Date.now()+SESSION_MS).toISOString());
 res.setHeader('Set-Cookie',sessionCookie(req,token));return actor;}
app.get('/api/health',wrap((req,res)=>res.json({ok:true,app:'LUMI Eventos',version:'2.0',serverTime:now()})));
app.get('/api/auth/me',wrap((req,res)=>res.json({user:req.actor||null})));
app.post('/api/auth/register',wrap((req,res)=>{rateLimit(req);const uid=S.createCustomer(req.body||{});
 const actor={id:uid,type:'CLIENTE',name:req.body.name.trim(),login:req.body.email.trim().toLowerCase(),role:'CLIENTE'};
 res.status(201).json({user:createSession(req,res,actor)});changes('users');}));
app.post('/api/auth/login',wrap((req,res)=>{rateLimit(req);const actor=S.authenticate(req.body?.login,req.body?.password);
 res.json({user:createSession(req,res,actor)});}));
app.post('/api/auth/logout',wrap((req,res)=>{const token=cookies(req.headers.cookie)[cookieName];if(token)S.run('DELETE FROM sessoes WHERE token_hash=?',sha(token));
 res.setHeader('Set-Cookie',sessionCookie(req,'',0));res.json({ok:true});}));
app.get('/api/events',wrap((req,res)=>res.json({events:S.listEvents(req.query.all==='true'&&req.actor?.role==='ADMIN')})));
app.get('/api/events/:id/products',wrap((req,res)=>res.json({products:S.listProducts(req.params.id,false)})));
app.get('/api/tickets',wrap((req,res)=>res.json({tickets:S.ticketsOf(authenticated(req))})));
app.post('/api/sales',wrap((req,res)=>{const actor=authenticated(req);const result=S.processSale(actor,req.body||{});
 changes('sales',result.eventId);res.status(201).json({...result,notice:'Venda apenas demonstrativa. Nenhum pagamento real foi processado.'});}));
app.get('/api/sales/:id',wrap((req,res)=>res.json({sale:S.saleById(authenticated(req),req.params.id)})));
app.get('/api/cashiers',wrap((req,res)=>{sales(req);res.json({cashiers:S.rows("SELECT * FROM caixas ORDER BY identificacao")});}));
app.post('/api/validation/check',wrap((req,res)=>res.json(S.ticketCheck(val(req),req.body?.code))));
app.post('/api/validation/commit',wrap((req,res)=>{const result=S.validateTicket(val(req),req.body?.code);changes('tickets',result.ticket?.eventId);res.json(result);}));
app.get('/api/admin/summary',wrap((req,res)=>res.json(S.adminSummary(admin(req)))));
app.get('/api/admin/sales',wrap((req,res)=>res.json({sales:S.salesOf(admin(req),req.query.eventId||null)})));
app.post('/api/admin/sales/:id/cancel',wrap((req,res)=>{const result=S.cancelSale(admin(req),req.params.id);changes('sales');res.json(result);}));
app.post('/api/admin/tickets/:id/cancel',wrap((req,res)=>{const result=S.cancelTicket(admin(req),req.params.id);changes('tickets');res.json(result);}));
app.post('/api/admin/events',wrap((req,res)=>{const result=S.saveEvent(admin(req),req.body||{});changes('events',result.id);res.status(201).json({event:result});}));
app.put('/api/admin/events/:id',wrap((req,res)=>{const result=S.saveEvent(admin(req),req.body||{},req.params.id);changes('events',result.id);res.json({event:result});}));
app.delete('/api/admin/events/:id',wrap((req,res)=>{const result=S.archiveEvent(admin(req),req.params.id);changes('events',req.params.id);res.json(result);}));
app.post('/api/admin/products',wrap((req,res)=>{const result=S.saveProduct(admin(req),req.body||{});changes('stock');res.status(201).json({product:result});}));
app.put('/api/admin/products/:id',wrap((req,res)=>{const result=S.saveProduct(admin(req),req.body||{},req.params.id);changes('stock');res.json({product:result});}));
app.post('/api/admin/products/:id/adjust',wrap((req,res)=>{const result=S.adjustStock(admin(req),req.params.id,req.body?.delta,req.body?.reason);changes('stock');res.json(result);}));
app.put('/api/admin/events/:id/wristband',wrap((req,res)=>{const result=S.setWristband(admin(req),req.params.id,req.body?.productId);changes('stock',req.params.id);res.json(result);}));
app.get('/api/admin/stock/history',wrap((req,res)=>{admin(req);res.json({rows:S.rows('SELECT m.*,p.nome AS produto_nome FROM movimentacoes_estoque m JOIN produtos_evento p ON p.id=m.produto_id ORDER BY data DESC LIMIT 500')});}));
app.get('/api/finance',wrap((req,res)=>res.json(S.financialReport(admin(req),req.query.eventId||null))));
app.post('/api/expenses',wrap((req,res)=>{const result=S.saveExpense(admin(req),req.body||{});changes('finance',req.body.eventId);res.status(201).json(result);}));
app.delete('/api/expenses/:id',wrap((req,res)=>{const result=S.deleteExpense(admin(req),req.params.id);changes('finance');res.json(result);}));
app.post('/api/admin/staff',wrap((req,res)=>{const result=S.createStaff(admin(req),req.body||{});changes('staff');res.status(201).json(result);}));
app.put('/api/admin/staff/:id',wrap((req,res)=>{const result=S.updateStaff(admin(req),req.params.id,req.body||{});changes('staff');res.json(result);}));
app.post('/api/admin/cashiers',wrap((req,res)=>{const result=S.createCashier(admin(req),req.body||{});changes('staff');res.status(201).json(result);}));
app.put('/api/admin/cashiers/:id',wrap((req,res)=>{const result=S.updateCashier(admin(req),req.params.id,req.body||{});changes('staff');res.json(result);}));
app.get('/api/admin/validations',wrap((req,res)=>{admin(req);res.json({entries:S.rows(`SELECT v.*,f.nome AS funcionario_nome FROM validacoes v JOIN funcionarios f ON f.id=v.funcionario_id ORDER BY data DESC LIMIT 500`)});}));
app.use('/api',(req,res)=>res.status(404).json({error:'Rota não encontrada.'}));
// Somente páginas HTML e assets públicos. NUNCA exponha server.js, SQLite ou certificados.
const PAGES=new Set(['index.html','eventos.html','login.html','cadastro.html','meus-ingressos.html','admin.html','validar.html','caixa.html','estoque.html','financeiro.html','equipe.html']);
// Bibliotecas de navegador servidas pelo próprio notebook: não exigem internet nos caixas depois do npm install.
const VENDORS={
 'qrcode.min.js':'qrcodejs/qrcode.min.js',
 'html5-qrcode.min.js':'html5-qrcode/html5-qrcode.min.js',
 'jspdf.umd.min.js':'jspdf/dist/jspdf.umd.min.js'
};
app.get('/vendor/:filename',(req,res,next)=>{
 const rel=VENDORS[req.params.filename];if(!rel)return next();
 res.setHeader('Cache-Control','public, max-age=86400');
 res.sendFile(path.join(__dirname,'node_modules',rel),err=>{if(err&&!res.headersSent)next(err);});
});
app.use('/assets',express.static(path.join(__dirname,'assets'),{dotfiles:'deny'}));
app.get('/',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));
app.get('/:page',(req,res,next)=>{
 if(PAGES.has(req.params.page)||['style.css','script.js'].includes(req.params.page)){
   res.setHeader('Cache-Control','no-store');return res.sendFile(path.join(__dirname,req.params.page));
 } next();
});
app.use((req,res)=>res.status(404).send('Página não encontrada.'));
app.use((err,req,res,next)=>{if(err.status) return res.status(err.status).json({error:err.message});
 if(err.code==='SQLITE_CONSTRAINT_UNIQUE')return res.status(409).json({error:'Registro duplicado.'});
 console.error('[LUMI]',err);res.status(500).json({error:'Erro interno. Consulte o terminal do servidor.'});});
const nets=()=>Object.values(os.networkInterfaces()).flat().filter(x=>x.family==='IPv4'&&!x.internal).map(x=>x.address);
if(require.main===module){server.listen(port,'0.0.0.0',()=>{
 console.log(`\nLUMI Eventos v2 — Servidor e base compartilhada\nLocal: http://localhost:${port}`);
 for(const ip of nets())console.log(`Rede local: http://${ip}:${port}`);
 if(!httpsServer)console.log('Câmera em celular na LAN requer HTTPS confiável. Consulte README.md.');
 });
 if(httpsServer){const httpsPort=Number(process.env.HTTPS_PORT||3443);httpsServer.listen(httpsPort,'0.0.0.0',()=>{
 console.log(`HTTPS local: https://localhost:${httpsPort}`);for(const ip of nets())console.log(`HTTPS LAN: https://${ip}:${httpsPort}`);
 });}
}
module.exports={app,server,io};
