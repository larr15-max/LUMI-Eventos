/* LUMI 2 — Regras de negócio centralizadas no SERVIDOR, não no navegador.
   Operações que mexem em capacidade/estoque/QR são transações BEGIN IMMEDIATE. */
'use strict';
const crypto=require('node:crypto');
const {db,transaction,id,now,hashPassword,verifyPassword}=require('./database');
class AppError extends Error {constructor(message,status=400){super(message);this.status=status;}}
const fail=(message,status=400)=>{throw new AppError(message,status);};
const integer=(v,min=0,max=100000000)=>Number.isSafeInteger(Number(v)) && String(v??'').trim()!=='' && Number(v)>=min && Number(v)<=max;
const required=(v,name,max=250)=> {const s=String(v??'').trim();if(!s||s.length>max)fail(`${name} deve ter de 1 a ${max} caracteres.`);return s;};
const moneyCents=(v,name='Valor')=> {if(!integer(v,0,1000000000))fail(`${name} inválido (centavos inteiros).`);return Number(v);};
const rows=(sql,...args)=>db.prepare(sql).all(...args);
const one=(sql,...args)=>db.prepare(sql).get(...args);
const run=(sql,...args)=>db.prepare(sql).run(...args);
const randomCode=()=>`LUMI2.${crypto.randomBytes(32).toString('base64url')}`;
function validCPF(v) {
 const s=String(v||'').replace(/\D/g,'');if(s.length!==11||/^(\d)\1{10}$/.test(s))return false;
 for(let n=9;n<=10;n++){let sum=0;for(let i=0;i<n;i++)sum+=Number(s[i])*(n+1-i);if(Number(s[n])!==(sum*10)%11%10)return false;}return true;
}
function validatePassword(p){if(typeof p!=='string'||p.length<10||p.length>128)fail('A senha deve conter entre 10 e 128 caracteres.');}
function createCustomer(d) {
 const nome=required(d.name,'Nome',120),email=required(d.email,'E-mail',180).toLowerCase();
 const cpf=String(d.cpf||'').replace(/\D/g,''),telefone=String(d.phone||'').replace(/\D/g,'');
 if(!nome.includes(' '))fail('Informe nome e sobrenome.');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('E-mail inválido.');
 if(!validCPF(cpf))fail('CPF inválido. Use somente dados fictícios de teste.');
 if(!/^\d{10,11}$/.test(telefone))fail('Telefone inválido.');
 validatePassword(d.password);
 if(d.password!==d.confirm)fail('As senhas não coincidem.');
 try {const uid=id();run(`INSERT INTO usuarios (id,nome,email,cpf,telefone,senha_hash,criado_em) VALUES(?,?,?,?,?,?,?)`,uid,nome,email,cpf,telefone,hashPassword(d.password),now());return uid;}
 catch(e){if(e.message.includes('UNIQUE'))fail('E-mail ou CPF já cadastrado.',409);throw e;}
}
function authenticate(login,password){
 if(!password||typeof password!=='string')fail('Credenciais incorretas.',401);
 const key=String(login||'').trim().toLowerCase();
 const staff=one('SELECT * FROM funcionarios WHERE login=? AND ativo=1',key);
 if(staff&&verifyPassword(password,staff.senha_hash))return {type:'FUNCIONARIO',id:staff.id,name:staff.nome,role:staff.permissao,login:staff.login};
 const user=one('SELECT * FROM usuarios WHERE email=?',key);
 if(user&&verifyPassword(password,user.senha_hash))return {type:'CLIENTE',id:user.id,name:user.nome,role:'CLIENTE',login:user.email};
 fail('Credenciais incorretas.',401);
}
function eventById(eventId){const e=one('SELECT * FROM eventos WHERE id=?',eventId);if(!e)fail('Evento não encontrado.',404);return e;}
function eventDto(e){
 const ocupados=one("SELECT COUNT(*) AS n FROM ingressos WHERE evento_id=? AND status!='CANCELADO'",e.id).n;
 const pulse=e.pulseira_produto_id?one('SELECT quantidade_disponivel FROM produtos_evento WHERE id=? AND ativo=1',e.pulseira_produto_id):null;
 const remaining=Math.max(0,Math.min(e.capacidade_maxima-ocupados,pulse?pulse.quantidade_disponivel:Infinity));
 return {id:e.id,name:e.nome,description:e.descricao,category:e.categoria,date:e.data,time:e.horario,venue:e.local,city:e.cidade,image:e.imagem,
   capacity:e.capacidade_maxima,sold:ocupados,available:remaining,priceCents:e.preco_centavos,variableCostCents:e.custo_variavel_unitario_centavos,
   wristbandProductId:e.pulseira_produto_id,status:e.status,archived:e.status==='ARQUIVADO'};
}
function listEvents(includeArchived=false){const list=rows(`SELECT * FROM eventos ${includeArchived?'':'WHERE status=\'ATIVO\''} ORDER BY data,horario`);return list.map(eventDto);}
function listProducts(eventId,all=false){const sql=`SELECT p.*, e.nome AS evento_nome FROM produtos_evento p JOIN eventos e ON e.id=p.evento_id WHERE p.evento_id=? ${all?'':'AND p.ativo=1'} ORDER BY p.categoria,p.nome`;
 return rows(sql,eventId).map(p=>({...p,lowStock:p.quantidade_disponivel<=p.estoque_minimo}));}
function listAllProducts(){return rows('SELECT p.*,e.nome AS evento_nome FROM produtos_evento p JOIN eventos e ON e.id=p.evento_id ORDER BY e.data,p.categoria,p.nome').map(p=>({...p,lowStock:p.ativo===1&&p.quantidade_disponivel<=p.estoque_minimo}));}
function processSale(actor,d) {
 if(!actor)fail('Faça login para comprar.',401);
 const isStaff=actor.type==='FUNCIONARIO'&&['ADMIN','CAIXA'].includes(actor.role);
 if(actor.type==='FUNCIONARIO'&&!isStaff)fail('Sem permissão para vender.',403);
 const eventId=required(d.eventId,'Evento',100),lineItems=Array.isArray(d.items)?d.items:[];
 if(!lineItems.length||lineItems.length>40)fail('Carrinho vazio ou muito grande.');
 const payment=isStaff?String(d.payment||''): 'DEMO';
 if(!['DINHEIRO','PIX','CARTAO','DEMO'].includes(payment)||(isStaff&&payment==='DEMO'))fail('Forma de pagamento inválida.');
 const caixaId=isStaff?required(d.cashierId,'Caixa',100):null;
 const buyerName=isStaff?required(d.buyerName||'Cliente do balcão','Comprador',120):actor.name;
 return transaction(()=>{
  const ev=eventById(eventId);if(ev.status!=='ATIVO')fail('Evento arquivado.');
  if(isStaff){const box=one("SELECT * FROM caixas WHERE id=? AND status='ABERTO'",caixaId);if(!box)fail('Caixa inexistente ou fechado.');}
  let qtyTickets=0,total=0,selected=[];const duplicate=new Set();
  for(const item of lineItems){
    const type=String(item.type||'');const qty=Number(item.quantity);
    if(!integer(item.quantity,1,40))fail('Quantidade inválida.');
    const key=type==='INGRESSO'?'INGRESSO':String(item.productId||'');
    if(duplicate.has(key))fail('Item duplicado no carrinho.');duplicate.add(key);
    if(type==='INGRESSO') {qtyTickets+=qty;selected.push({type,qty,product:null,price:ev.preco_centavos});total+=qty*ev.preco_centavos;}
    else if(type==='PRODUTO'&&isStaff){const p=one('SELECT * FROM produtos_evento WHERE id=? AND evento_id=? AND ativo=1',item.productId,eventId);
      if(!p||p.categoria==='MATERIAL')fail('Produto não disponível para venda.');
      if(qty>p.quantidade_disponivel)fail(`Estoque insuficiente: ${p.nome}.`,409);
      selected.push({type,qty,product:p,price:p.preco_centavos});total+=qty*p.preco_centavos;
    } else fail('Item não autorizado.');
  }
  if(!isStaff && (selected.length!==1||qtyTickets<1||qtyTickets>10))fail('Limite de 10 ingressos por compra online.');
  if(qtyTickets){
    const sold=one("SELECT COUNT(*) AS n FROM ingressos WHERE evento_id=? AND status!='CANCELADO'",eventId).n;
    if(sold+qtyTickets>ev.capacidade_maxima)fail('Capacidade esgotada. Atualize o catálogo.',409);
    if(ev.pulseira_produto_id){const material=one('SELECT * FROM produtos_evento WHERE id=? AND ativo=1',ev.pulseira_produto_id);
      if(!material||material.quantidade_disponivel<qtyTickets)fail('Estoque de pulseiras insuficiente.',409);}
  }
  if(total>1000000000)fail('Total acima do limite demonstrativo.');
  const received=payment==='DINHEIRO'?moneyCents(d.receivedCents,'Valor recebido'):null;
  if(payment==='DINHEIRO'&&received<total)fail('Valor recebido menor que o total.');
  const saleId=id(),stamp=now();
  run(`INSERT INTO vendas(id,usuario_id,funcionario_id,caixa_id,evento_id,comprador_nome,data_venda,valor_total_centavos,forma_pagamento,status_pagamento,recebido_centavos,troco_centavos,origem)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,saleId,isStaff?null:actor.id,isStaff?actor.id:null,caixaId,eventId,buyerName,stamp,total,payment,'CONFIRMADO_DEMO',received,received===null?null:received-total,isStaff?'CAIXA':'ONLINE');
  for(const line of selected){
    run('INSERT INTO itens_venda(id,venda_id,produto_id,tipo,quantidade,preco_unitario_centavos,subtotal_centavos) VALUES(?,?,?,?,?,?,?)',id(),saleId,line.product?.id||null,line.type,line.qty,line.price,line.qty*line.price);
    if(line.type==='PRODUTO'){
      const r=run('UPDATE produtos_evento SET quantidade_disponivel=quantidade_disponivel-?,quantidade_vendida=quantidade_vendida+? WHERE id=? AND quantidade_disponivel>=?',line.qty,line.qty,line.product.id,line.qty);
      if(r.changes!==1)fail('Estoque indisponível. Tente novamente.',409);
      run('INSERT INTO movimentacoes_estoque(id,produto_id,tipo_movimentacao,quantidade,data,funcionario_id,venda_id,observacao) VALUES(?,?,?,?,?,?,?,?)',id(),line.product.id,'VENDA',-line.qty,stamp,isStaff?actor.id:null,saleId,'Caixa LUMI');
    }
  }
  if(qtyTickets&&ev.pulseira_produto_id){
    const r=run('UPDATE produtos_evento SET quantidade_disponivel=quantidade_disponivel-? WHERE id=? AND quantidade_disponivel>=?',qtyTickets,ev.pulseira_produto_id,qtyTickets);
    if(r.changes!==1)fail('Pulseiras insuficientes.',409);
    run('INSERT INTO movimentacoes_estoque(id,produto_id,tipo_movimentacao,quantidade,data,funcionario_id,venda_id,observacao) VALUES(?,?,?,?,?,?,?,?)',id(),ev.pulseira_produto_id,'EMISSAO_INGRESSO',-qtyTickets,stamp,isStaff?actor.id:null,saleId,'Pulseira reservada para ingresso');
  }
  for(let i=0;i<qtyTickets;i++){
    const code=randomCode();run('INSERT INTO ingressos(id,venda_id,evento_id,codigo_unico,qr_code,status,data_emissao) VALUES(?,?,?,?,?,?,?)',id(),saleId,eventId,code,code,'VALIDO',stamp);
  }
  run(`INSERT INTO movimentacoes_financeiras(id,venda_id,evento_id,tipo,valor_centavos,forma_pagamento,data,observacao) VALUES(?,?,?,?,?,?,?,?)`,id(),saleId,eventId,'VENDA',total,payment,stamp,'Pagamento demonstrativo — nenhum valor real processado');
  return {saleId,eventId,totalCents:total,receivedCents:received,changeCents:received===null?null:received-total,payment,
    tickets:rows('SELECT * FROM ingressos WHERE venda_id=? ORDER BY data_emissao,id',saleId)};
 });
}
function ticketDto(t){return {id:t.id,saleId:t.venda_id,eventId:t.evento_id,code:t.codigo_unico,qrPayload:t.qr_code,status:t.status,issuedAt:t.data_emissao,usedAt:t.data_validacao,
 eventName:t.evento_nome,buyerName:t.comprador_nome,eventDate:t.data,eventTime:t.horario,venue:t.local,city:t.cidade,payment:t.forma_pagamento};}
const ticketJoin=`SELECT t.*,e.nome AS evento_nome,e.data,e.horario,e.local,e.cidade,v.comprador_nome,v.forma_pagamento FROM ingressos t JOIN eventos e ON e.id=t.evento_id JOIN vendas v ON v.id=t.venda_id`;
function ticketsOf(actor){if(!actor)fail('Entre na sua conta.',401);
 const isStaff=actor.type==='FUNCIONARIO'&&actor.role==='ADMIN';
 return rows(`${ticketJoin} ${isStaff?'':'WHERE v.usuario_id=?'} ORDER BY t.data_emissao DESC,t.id`,...(isStaff?[]:[actor.id])).map(ticketDto);
}
function salesOf(actor,filterEvent){if(!actor||actor.type!=='FUNCIONARIO'||actor.role!=='ADMIN')fail('Área restrita.',403);
 const sql=`SELECT v.*,e.nome AS evento_nome,f.nome AS funcionario_nome,c.identificacao AS caixa_nome,u.nome AS usuario_nome FROM vendas v JOIN eventos e ON e.id=v.evento_id LEFT JOIN funcionarios f ON f.id=v.funcionario_id LEFT JOIN caixas c ON c.id=v.caixa_id LEFT JOIN usuarios u ON u.id=v.usuario_id ${filterEvent?'WHERE v.evento_id=?':''} ORDER BY v.data_venda DESC LIMIT 500`;
 return rows(sql,...(filterEvent?[filterEvent]:[]));
}
function saleById(actor,saleId){const sale=one('SELECT v.*,e.nome AS evento_nome FROM vendas v JOIN eventos e ON e.id=v.evento_id WHERE v.id=?',saleId);
 if(!sale)fail('Venda não encontrada.',404);
 if(actor?.type==='CLIENTE'&&sale.usuario_id!==actor.id)fail('Acesso negado.',403);
 if(actor?.type==='FUNCIONARIO'&&!['ADMIN','CAIXA'].includes(actor.role))fail('Acesso negado.',403);
 return {...sale,items:rows('SELECT i.*,p.nome AS produto_nome FROM itens_venda i LEFT JOIN produtos_evento p ON p.id=i.produto_id WHERE i.venda_id=?',saleId),tickets:rows(`${ticketJoin} WHERE t.venda_id=?`,saleId).map(ticketDto)};
}
function ticketCheck(actor,raw){if(!actor||actor.type!=='FUNCIONARIO'||!['ADMIN','VALIDADOR'].includes(actor.role))fail('Equipe de validação necessária.',403);
 const code=String(raw||'').trim();if(code.length>200)fail('Código inválido.');
 const t=one(`${ticketJoin} WHERE t.codigo_unico=? AND t.qr_code=?`,code,code);
 return t?{found:true,ticket:ticketDto(t),entryAllowed:t.status==='VALIDO'}:{found:false,entryAllowed:false,message:'Código inexistente ou inválido.'};
}
function validateTicket(actor,code){if(!actor||actor.type!=='FUNCIONARIO'||!['ADMIN','VALIDADOR'].includes(actor.role))fail('Equipe de validação necessária.',403);
 const value=String(code||'').trim();if(value.length>200)fail('Código inválido.');
 return transaction(()=>{
   const t=one(`${ticketJoin} WHERE t.codigo_unico=? AND t.qr_code=?`,value,value);
   const result=t?(t.status==='VALIDO'?'AUTORIZADO':t.status==='UTILIZADO'?'JA_UTILIZADO':'CANCELADO'):'INEXISTENTE';
   if(t&&t.status==='VALIDO'){
      const r=run("UPDATE ingressos SET status='UTILIZADO',data_validacao=? WHERE id=? AND status='VALIDO'",now(),t.id);
      if(r.changes!==1)fail('Ingresso já validado por outro dispositivo.',409);
   }
   run('INSERT INTO validacoes(id,ingresso_id,funcionario_id,data,resultado,codigo_consultado) VALUES(?,?,?,?,?,?)',id(),t?.id||null,actor.id,now(),result,value.slice(0,180));
   return {status:result,entryAllowed:result==='AUTORIZADO',ticket:t?ticketDto({...t,status:result==='AUTORIZADO'?'UTILIZADO':t.status,data_validacao:result==='AUTORIZADO'?now():t.data_validacao}):null};
 });
}
function cancelTicket(actor,ticketId){if(actor?.role!=='ADMIN')fail('Somente administrador.',403);
 return transaction(()=>{
 const t=one(`${ticketJoin} WHERE t.id=?`,ticketId);if(!t)fail('Ingresso não encontrado.',404);
 if(t.status!=='VALIDO')fail('Somente ingressos VÁLIDOS podem ser cancelados.',409);
 const sale=one('SELECT * FROM vendas WHERE id=?',t.venda_id);if(sale.status_pagamento!=='CONFIRMADO_DEMO')fail('Venda já cancelada.',409);
 const item=one("SELECT * FROM itens_venda WHERE venda_id=? AND tipo='INGRESSO'",t.venda_id);
 const unit=item?.preco_unitario_centavos||0;
 run("UPDATE ingressos SET status='CANCELADO',data_cancelamento=? WHERE id=?",now(),t.id);
 const ev=eventById(t.evento_id);
 if(ev.pulseira_produto_id){run('UPDATE produtos_evento SET quantidade_disponivel=quantidade_disponivel+1 WHERE id=?',ev.pulseira_produto_id);
    run('INSERT INTO movimentacoes_estoque(id,produto_id,tipo_movimentacao,quantidade,data,funcionario_id,venda_id,observacao) VALUES(?,?,?,?,?,?,?,?)',id(),ev.pulseira_produto_id,'CANCELAMENTO_INGRESSO',1,now(),actor.id,t.venda_id,'Estorno de pulseira');}
 run('UPDATE vendas SET valor_total_centavos=valor_total_centavos-? WHERE id=?',unit,t.venda_id);
 run("INSERT INTO movimentacoes_financeiras(id,venda_id,evento_id,tipo,valor_centavos,forma_pagamento,data,observacao) VALUES(?,?,?,?,?,?,?,?)",id(),t.venda_id,t.evento_id,'ESTORNO',-unit,sale.forma_pagamento,now(),'Cancelamento de ingresso');
 // Se todos os ingressos foram cancelados e a venda não incluía produtos,
 // não mantenha uma compra sem itens como 'confirmada' nos relatórios.
 const remainingTickets=one("SELECT COUNT(*) AS n FROM ingressos WHERE venda_id=? AND status!='CANCELADO'",t.venda_id).n;
 const soldProducts=one("SELECT COUNT(*) AS n FROM itens_venda WHERE venda_id=? AND tipo='PRODUTO'",t.venda_id).n;
 if(!remainingTickets&&!soldProducts)run("UPDATE vendas SET status_pagamento='CANCELADO' WHERE id=?",t.venda_id);
 return {ok:true};
 });
}
function cancelSale(actor,saleId){if(actor?.role!=='ADMIN')fail('Somente administrador.',403);
 return transaction(()=>{
 const sale=one('SELECT * FROM vendas WHERE id=?',saleId);if(!sale)fail('Venda não encontrada.',404);
 if(sale.status_pagamento!=='CONFIRMADO_DEMO')fail('Venda não pode ser cancelada.',409);
 if(one("SELECT COUNT(*) AS n FROM ingressos WHERE venda_id=? AND status='UTILIZADO'",saleId).n)fail('Venda com ingressos utilizados não pode ser cancelada.',409);
 const items=rows("SELECT * FROM itens_venda WHERE venda_id=? AND tipo='PRODUTO'",saleId);
 for(const it of items){run('UPDATE produtos_evento SET quantidade_disponivel=quantidade_disponivel+?,quantidade_vendida=MAX(0,quantidade_vendida-?) WHERE id=?',it.quantidade,it.quantidade,it.produto_id);
    run('INSERT INTO movimentacoes_estoque(id,produto_id,tipo_movimentacao,quantidade,data,funcionario_id,venda_id,observacao) VALUES(?,?,?,?,?,?,?,?)',id(),it.produto_id,'CANCELAMENTO_VENDA',it.quantidade,now(),actor.id,saleId,'Devolução demonstrativa');}
 const activeTickets=rows("SELECT * FROM ingressos WHERE venda_id=? AND status='VALIDO'",saleId);
 const ev=eventById(sale.evento_id);
 if(activeTickets.length&&ev.pulseira_produto_id){run('UPDATE produtos_evento SET quantidade_disponivel=quantidade_disponivel+? WHERE id=?',activeTickets.length,ev.pulseira_produto_id);
    run('INSERT INTO movimentacoes_estoque(id,produto_id,tipo_movimentacao,quantidade,data,funcionario_id,venda_id,observacao) VALUES(?,?,?,?,?,?,?,?)',id(),ev.pulseira_produto_id,'CANCELAMENTO_VENDA',activeTickets.length,now(),actor.id,saleId,'Devolução de pulseiras');}
 run("UPDATE ingressos SET status='CANCELADO',data_cancelamento=? WHERE venda_id=? AND status='VALIDO'",now(),saleId);
 run("UPDATE vendas SET status_pagamento='CANCELADO' WHERE id=?",saleId);
 run('INSERT INTO movimentacoes_financeiras(id,venda_id,evento_id,tipo,valor_centavos,forma_pagamento,data,observacao) VALUES(?,?,?,?,?,?,?,?)',id(),saleId,sale.evento_id,'ESTORNO',-sale.valor_total_centavos,sale.forma_pagamento,now(),'Cancelamento integral da venda demonstrativa');
 return {ok:true};
 });
}
function saveEvent(actor,d,eventId){if(actor?.role!=='ADMIN')fail('Sem permissão.',403);
 const name=required(d.name,'Nome',100),description=required(d.description,'Descrição',450),category=required(d.category,'Categoria',60);
 const date=required(d.date,'Data',10),time=required(d.time,'Horário',5),venue=required(d.venue,'Local',90),city=required(d.city,'Cidade',90);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+'T12:00:00'))||!/^\d{2}:\d{2}$/.test(time))fail('Data ou horário inválidos.');
 if(!integer(d.capacity,1,1000000))fail('Capacidade inválida.');
 const price=moneyCents(d.priceCents,'Preço'),variable=moneyCents(d.variableCostCents??0,'Custo variável');
 const image=String(d.image||'').trim()||'assets/festival-aurora.svg';
 if(!/^(assets\/[a-z0-9/_-]+\.(svg|png|jpe?g)|https:\/\/[^\s"'<>]+)$/i.test(image))fail('URL de imagem não permitida.');
 return transaction(()=>{
  const evId=eventId||id(),stamp=now(),status=d.status==='ARQUIVADO'?'ARQUIVADO':'ATIVO';
  const pulseId=String(d.wristbandProductId||'').trim()||null;
  if(pulseId){const p=one("SELECT id FROM produtos_evento WHERE id=? AND evento_id=? AND categoria='MATERIAL' AND ativo=1",pulseId,evId);if(!p)fail('Produto de pulseiras inválido.');}
  if(eventId){const previous=eventById(eventId);const occupied=one("SELECT COUNT(*) AS n FROM ingressos WHERE evento_id=? AND status!='CANCELADO'",eventId).n;
    if(Number(d.capacity)<occupied)fail('Capacidade menor que ingressos já emitidos.',409);
    run(`UPDATE eventos SET nome=?,descricao=?,categoria=?,data=?,horario=?,local=?,cidade=?,imagem=?,capacidade_maxima=?,preco_centavos=?,custo_variavel_unitario_centavos=?,pulseira_produto_id=?,status=?,atualizado_em=? WHERE id=?`,name,description,category,date,time,venue,city,image,Number(d.capacity),price,variable,pulseId,status,stamp,eventId);
  }else run(`INSERT INTO eventos(id,nome,descricao,categoria,data,horario,local,cidade,imagem,capacidade_maxima,preco_centavos,custo_variavel_unitario_centavos,pulseira_produto_id,status,criado_em,atualizado_em) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,evId,name,description,category,date,time,venue,city,image,Number(d.capacity),price,variable,null,status,stamp,stamp);
  return eventDto(eventById(evId));
 });
}
function archiveEvent(actor,eventId){if(actor?.role!=='ADMIN')fail('Sem permissão.',403);eventById(eventId);run("UPDATE eventos SET status='ARQUIVADO',atualizado_em=? WHERE id=?",now(),eventId);return {ok:true};}
function saveProduct(actor,d,productId){if(actor?.role!=='ADMIN')fail('Sem permissão.',403);
 const eventId=required(d.eventId,'Evento',100),name=required(d.name,'Nome',120),category=String(d.category||'');
 if(!['BEBIDA','COMIDA','MATERIAL'].includes(category))fail('Categoria inválida.');eventById(eventId);
 const price=moneyCents(d.priceCents,'Preço'),minimum=Number(d.minimum);
 if(!integer(d.minimum,0,1000000))fail('Estoque mínimo inválido.');
 return transaction(()=>{
 if(productId){const p=one('SELECT * FROM produtos_evento WHERE id=?',productId);if(!p)fail('Produto não encontrado.',404);
   if(p.evento_id!==eventId)fail('O produto não pode mudar de evento.');
   run('UPDATE produtos_evento SET nome=?,categoria=?,preco_centavos=?,estoque_minimo=?,ativo=? WHERE id=?',name,category,price,minimum,d.active===false?0:1,productId);
 }else{if(!integer(d.initial,0,1000000))fail('Quantidade inicial inválida.');
   productId=id();run('INSERT INTO produtos_evento(id,evento_id,nome,categoria,preco_centavos,quantidade_inicial,quantidade_disponivel,estoque_minimo) VALUES(?,?,?,?,?,?,?,?)',productId,eventId,name,category,price,Number(d.initial),Number(d.initial),minimum);
   run('INSERT INTO movimentacoes_estoque(id,produto_id,tipo_movimentacao,quantidade,data,funcionario_id,observacao) VALUES(?,?,?,?,?,?,?)',id(),productId,'CADASTRO',Number(d.initial),now(),actor.id,'Estoque inicial');
 }
 return one('SELECT * FROM produtos_evento WHERE id=?',productId);
 });
}
function adjustStock(actor,productId,delta,reason){if(actor?.role!=='ADMIN')fail('Sem permissão.',403);
 if(!integer(Math.abs(Number(delta)),1,1000000)||!Number.isInteger(Number(delta)))fail('Ajuste deve ser inteiro e diferente de zero.');
 return transaction(()=>{const p=one('SELECT * FROM produtos_evento WHERE id=?',productId);if(!p)fail('Produto não encontrado.',404);
  if(p.quantidade_disponivel+Number(delta)<0)fail('Estoque insuficiente para este ajuste.',409);
  run('UPDATE produtos_evento SET quantidade_disponivel=quantidade_disponivel+? WHERE id=?',Number(delta),productId);
  run('INSERT INTO movimentacoes_estoque(id,produto_id,tipo_movimentacao,quantidade,data,funcionario_id,observacao) VALUES(?,?,?,?,?,?,?)',id(),productId,'AJUSTE',Number(delta),now(),actor.id,required(reason,'Motivo',250));return {ok:true};});
}
function setWristband(actor,eventId,productId){if(actor?.role!=='ADMIN')fail('Sem permissão.',403);return transaction(()=>{
 eventById(eventId);if(productId){const p=one("SELECT id FROM produtos_evento WHERE id=? AND evento_id=? AND categoria='MATERIAL' AND ativo=1",productId,eventId);
 if(!p)fail('Material inválido.');}run('UPDATE eventos SET pulseira_produto_id=? WHERE id=?',productId||null,eventId);return {ok:true};});}
function saveExpense(actor,d){if(actor?.role!=='ADMIN')fail('Sem permissão.',403);eventById(d.eventId);
 const description=required(d.description,'Despesa',120),category=required(d.category,'Categoria',50),amount=moneyCents(d.amountCents,'Valor'),date=required(d.date,'Data',10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))fail('Data inválida.');
 const expenseId=id();return transaction(()=>{
 run('INSERT INTO despesas(id,evento_id,descricao,categoria,valor_centavos,data,observacao,custo_fixo) VALUES(?,?,?,?,?,?,?,?)',expenseId,d.eventId,description,category,amount,date,String(d.notes||'').slice(0,500),d.fixed===false?0:1);
 run('INSERT INTO movimentacoes_financeiras(id,despesa_id,evento_id,tipo,valor_centavos,data,observacao) VALUES(?,?,?,?,?,?,?)',id(),expenseId,d.eventId,'DESPESA',-amount,now(),'Despesa cadastrada');return {id:expenseId};});
}
function deleteExpense(actor,expenseId){if(actor?.role!=='ADMIN')fail('Sem permissão.',403);return transaction(()=>{
 const exp=one('SELECT * FROM despesas WHERE id=?',expenseId);if(!exp)fail('Despesa inexistente.',404);
 run('DELETE FROM movimentacoes_financeiras WHERE despesa_id=?',expenseId);run('DELETE FROM despesas WHERE id=?',expenseId);return {ok:true};});}
function financialReport(actor,eventId){if(actor?.role!=='ADMIN')fail('Sem permissão.',403);
 const ev=eventId?eventById(eventId):null;
 const filt=eventId?'AND evento_id=?':'';const args=eventId?[eventId]:[];
 const paymentRows=rows(`SELECT forma_pagamento metodo,COUNT(*) quantidade,COALESCE(SUM(valor_total_centavos),0) centavos FROM vendas WHERE status_pagamento='CONFIRMADO_DEMO' ${filt} GROUP BY forma_pagamento`,...args);
 const revenue=paymentRows.reduce((s,x)=>s+x.centavos,0);
 const expenses=rows(`SELECT d.*,e.nome AS evento_nome FROM despesas d JOIN eventos e ON e.id=d.evento_id ${eventId?'WHERE d.evento_id=?':''} ORDER BY d.data DESC`,...args);
 const expensesTotal=expenses.reduce((s,x)=>s+x.valor_centavos,0);
 const fixed=expenses.filter(e=>e.custo_fixo===1).reduce((s,x)=>s+x.valor_centavos,0);
 const sold=one(`SELECT COUNT(*) AS n FROM ingressos WHERE status!='CANCELADO' ${filt}`, ...args).n;
 const variableEstimated=eventId?sold*ev.custo_variavel_unitario_centavos:one("SELECT COALESCE(SUM(e.custo_variavel_unitario_centavos),0) AS n FROM ingressos t JOIN eventos e ON e.id=t.evento_id WHERE t.status!='CANCELADO'").n;
 const totalCosts=expensesTotal+variableEstimated,profit=revenue-totalCosts;
 const contribution=eventId?ev.preco_centavos-ev.custo_variavel_unitario_centavos:null;
 const breakEven=eventId&&contribution>0?Math.ceil(fixed/contribution):null;
 const salesCount=one(`SELECT COUNT(*) AS n FROM vendas WHERE status_pagamento='CONFIRMADO_DEMO' ${filt}`, ...args).n;
 return {event:eventId?eventDto(ev):null,paymentRows,revenueCents:revenue,expenses,expensesTotalCents:expensesTotal,fixedCostsCents:fixed,
 variableEstimatedCents:variableEstimated,totalCostsCents:totalCosts,profitCents:profit,marginPercent:revenue?100*profit/revenue:null,
 ticketCount:sold,salesCount,breakEvenUnits:breakEven,contributionCents:contribution,
 caution:'Todos os pagamentos são simulações. Custos variáveis unitários são estimativas adicionais às despesas registradas; não duplique os valores.'};
}
function adminSummary(actor){if(actor?.role!=='ADMIN')fail('Sem permissão.',403);
 return {
 totals:{salesCount:one("SELECT COUNT(*) AS n FROM vendas WHERE status_pagamento='CONFIRMADO_DEMO'").n,
  revenueCents:one("SELECT COALESCE(SUM(valor_total_centavos),0) AS n FROM vendas WHERE status_pagamento='CONFIRMADO_DEMO'").n,
  ticketsCount:one('SELECT COUNT(*) AS n FROM ingressos').n,
  validTickets:one("SELECT COUNT(*) AS n FROM ingressos WHERE status='VALIDO'").n},
 events:listEvents(true),products:listAllProducts(),sales:salesOf(actor),tickets:ticketsOf(actor),
 buyers:rows('SELECT id,nome,email,telefone,criado_em FROM usuarios ORDER BY criado_em DESC'),
 employees:rows('SELECT id,nome,login,permissao,ativo,criado_em FROM funcionarios ORDER BY criado_em'),
 cashiers:rows('SELECT * FROM caixas ORDER BY identificacao'),
 stockHistory:rows('SELECT m.*,p.nome AS produto_nome,f.nome AS funcionario_nome FROM movimentacoes_estoque m JOIN produtos_evento p ON p.id=m.produto_id LEFT JOIN funcionarios f ON f.id=m.funcionario_id ORDER BY m.data DESC LIMIT 200'),
 validations:rows('SELECT v.*,f.nome AS funcionario_nome,e.nome AS evento_nome FROM validacoes v LEFT JOIN funcionarios f ON f.id=v.funcionario_id LEFT JOIN ingressos i ON i.id=v.ingresso_id LEFT JOIN eventos e ON e.id=i.evento_id ORDER BY v.data DESC LIMIT 100')};
}
function createStaff(actor,d){if(actor?.role!=='ADMIN')fail('Sem permissão.',403);
 const name=required(d.name,'Nome',120),login=required(d.login,'Login',180).toLowerCase(),role=String(d.role||'');
 if(!['ADMIN','CAIXA','VALIDADOR'].includes(role))fail('Permissão inválida.');validatePassword(d.password);
 try{const employee=id();run('INSERT INTO funcionarios(id,nome,login,senha_hash,permissao,criado_em) VALUES(?,?,?,?,?,?)',employee,name,login,hashPassword(d.password),role,now());return {id:employee};}
 catch(e){if(e.message.includes('UNIQUE'))fail('Login já utilizado.',409);throw e;}
}
function updateStaff(actor,staffId,d){if(actor?.role!=='ADMIN')fail('Sem permissão.',403);
 const staff=one('SELECT * FROM funcionarios WHERE id=?',staffId);if(!staff)fail('Funcionário não encontrado.',404);
 if(staff.id===actor.id&&d.active===false)fail('Não pode desativar sua própria conta.');
 const role=d.role||staff.permissao;if(!['ADMIN','CAIXA','VALIDADOR'].includes(role))fail('Permissão inválida.');
 const active=d.active===false?0:1;
 if(d.password){validatePassword(d.password);run('UPDATE funcionarios SET nome=?,permissao=?,ativo=?,senha_hash=? WHERE id=?',d.name?required(d.name,'Nome'):staff.nome,role,active,hashPassword(d.password),staffId);}
 else run('UPDATE funcionarios SET nome=?,permissao=?,ativo=? WHERE id=?',d.name?required(d.name,'Nome'):staff.nome,role,active,staffId);
 return {ok:true};
}
function createCashier(actor,d){if(actor?.role!=='ADMIN')fail('Sem permissão.',403);
 const label=required(d.label,'Identificação do caixa',70);try{const cid=id();run("INSERT INTO caixas(id,identificacao,status) VALUES(?,?,'ABERTO')",cid,label);return {id:cid};}catch(e){if(e.message.includes('UNIQUE'))fail('Caixa duplicado.',409);throw e;}}
function updateCashier(actor,cashierId,d){if(actor?.role!=='ADMIN')fail('Sem permissão.',403);
 if(!['ABERTO','FECHADO'].includes(d.status))fail('Status inválido.');
 if(!one('SELECT id FROM caixas WHERE id=?',cashierId))fail('Caixa não encontrado.',404);
 run('UPDATE caixas SET status=? WHERE id=?',d.status,cashierId);return {ok:true};}
module.exports={AppError,db,rows,one,run,createCustomer,authenticate,eventById,listEvents,listProducts,listAllProducts,processSale,
 ticketsOf,salesOf,saleById,ticketCheck,validateTicket,cancelTicket,cancelSale,saveEvent,archiveEvent,saveProduct,adjustStock,setWristband,
 saveExpense,deleteExpense,financialReport,adminSummary,createStaff,updateStaff,createCashier,updateCashier};
