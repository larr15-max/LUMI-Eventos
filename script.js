/* ========================================================================
   LUMI EVENTOS 2 — Front-end HTML/CSS/JS puro, baseado no site LUMI v1.
   Os dados são sempre lidos e gravados na API Express/SQLite do servidor.
   Não há senhas, vendas, ingressos ou estoques guardados em localStorage.
   IMPORTANTE: todas as operações financeiras são SIMULAÇÕES escolares.
   ======================================================================== */
(() => {
 'use strict';
 const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((Number(v)||0)/100);
 const moneyInput=v=>(Number(v||0)/100).toFixed(2);
 const cents=v=>{const n=Number(String(v||'').replace(',','.'));return Number.isFinite(n)?Math.round(n*100):NaN;};
 const digits=v=>String(v??'').replace(/\D/g,'');
 const dText=v=>v?new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'long',year:'numeric'}).format(new Date(`${v}T12:00:00`)):'—';
 const dShort=v=>v?new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short'}).format(new Date(`${v}T12:00:00`)):'—';
 const when=v=>v?new Date(v).toLocaleString('pt-BR'):'—';
 const path=location.pathname.split('/').pop()||'index.html';
 const page=document.body.dataset.page;
 const state={user:null,events:[],admin:null,financial:null};
 let refreshPending=false;
 const can=(...roles)=>state.user?.type==='FUNCIONARIO'&&roles.includes(state.user.role);
 const isAdmin=()=>can('ADMIN');
 const byEvent=id=>state.events.find(e=>e.id===id);
 const imgUrl=v=>/^(assets\/[a-z0-9/_-]+\.(svg|png|jpe?g)|https:\/\/[^\s"'<>]+)$/i.test(v||'')?v:'assets/festival-aurora.svg';
 function errorMessage(e){return e?.message||'Não foi possível completar esta operação.';}
 async function api(url,method='GET',data){
   let res;try {res=await fetch(`/api${url}`,{method,credentials:'same-origin',headers:data!==undefined?{'Content-Type':'application/json'}:{},body:data!==undefined?JSON.stringify(data):undefined,cache:'no-store'});}catch{throw Error('Servidor LUMI indisponível. Inicie com npm start, não com Live Server.');}
   const payload=await res.json().catch(()=>({}));if(!res.ok)throw Error(payload.error||`Erro HTTP ${res.status}`);return payload;
 }
 function notify(message,type='info') {const area=$('#toast-area');if(!area)return;const d=document.createElement('div');d.className=`toast ${type}`;d.textContent=message;area.append(d);setTimeout(()=>d.remove(),4800);}
 function fieldError(id,message=''){const n=$(id);if(n){n.hidden=!message;n.textContent=message;}}
 function safeGo(defaultPage='meus-ingressos.html'){
   const next=new URLSearchParams(location.search).get('next')||'';
   return /^(index|eventos|meus-ingressos|admin|caixa|validar|estoque|financeiro|equipe)\.html(?:\?[^#]*)?$/.test(next)?next:defaultPage;
 }
 async function loadData(){const [me,events]=await Promise.all([api('/auth/me'),api('/events')]);state.user=me.user;state.events=events.events;}
 function roleRoute(){if(isAdmin())return 'admin.html';if(can('CAIXA'))return 'caixa.html';if(can('VALIDADOR'))return 'validar.html';return 'meus-ingressos.html';}
 function renderChrome(){
  const publicNav=`<a href="index.html" ${page==='index'?'aria-current="page"':''}>Início</a><a href="eventos.html" ${page==='eventos'?'aria-current="page"':''}>Eventos</a><a href="index.html#sobre">Sobre nós</a><a href="meus-ingressos.html" ${page==='meus-ingressos'?'aria-current="page"':''}>Meus ingressos</a>`;
  const staffNav=state.user?.type==='FUNCIONARIO'?
    `${can('ADMIN')?'<a href="admin.html">Admin</a><a href="estoque.html">Estoque</a><a href="financeiro.html">Financeiro</a><a href="equipe.html">Equipe</a>':''}${can('ADMIN','CAIXA')?'<a href="caixa.html">Caixa</a>':''}${can('ADMIN','VALIDADOR')?'<a href="validar.html">Validar QR</a>':''}`:'';
  $('#site-header').innerHTML=`<header class="site-header"><div class="section-shell header-inner">
    <a class="brand" href="index.html" aria-label="LUMI Eventos — início"><span class="brand-word">LUMI<span class="brand-spark">✧</span></span><span class="brand-sub">EVENTOS</span></a>
    <nav class="main-nav" id="main-nav" aria-label="Menu principal">${publicNav}${staffNav}</nav>
    <div class="header-actions">${state.user?`<span class="nav-user" title="${esc(state.user.name)}">Olá, ${esc(state.user.name.split(' ')[0])}</span><button class="btn btn-outline btn-sm" id="logout" type="button">Sair</button>`:`<a class="btn btn-outline btn-sm" href="login.html">Entrar</a><a class="btn btn-primary btn-sm" href="cadastro.html">Cadastre-se</a>`}<button class="mobile-toggle" id="mobile-toggle" type="button" aria-label="Abrir menu" aria-controls="main-nav" aria-expanded="false">☰</button></div>
  </div></header>`;
  $('#site-footer').innerHTML=`<footer class="site-footer"><div class="section-shell"><div class="footer-top"><div class="footer-brand"><a class="brand" href="index.html"><span class="brand-word">LUMI<span class="brand-spark">✧</span></span><span class="brand-sub">EVENTOS</span></a><p>Momentos únicos começam com a Lumi. Sistema demonstrativo de gestão de eventos e ingressos.</p></div><div class="footer-col"><h3>Explore</h3><a href="eventos.html">Eventos</a><a href="meus-ingressos.html">Meus ingressos</a><a href="index.html#como-funciona">Como funciona</a></div><div class="footer-col"><h3>Equipe</h3><a href="admin.html">Administração</a><a href="caixa.html">Caixa</a><a href="validar.html">Validação</a><span>Nenhum pagamento real é realizado.</span></div></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} LUMI Eventos · Projeto escolar fictício</span><span>HTML · CSS · JavaScript · Express · SQLite · Socket.IO</span></div></div></footer>`;
  $('#mobile-toggle')?.addEventListener('click',()=>{const n=$('#main-nav');const open=n.classList.toggle('mobile-open');$('#mobile-toggle').setAttribute('aria-expanded',String(open));});
  $('#logout')?.addEventListener('click',async()=>{try{await api('/auth/logout','POST',{});location.href='index.html';}catch(e){notify(errorMessage(e),'error');}});
 }
 function eventCard(e){const soldout=e.available<=0;const low=!soldout&&e.available<=Math.ceil(e.capacity*.1);
  return `<article class="event-card"><div class="event-image"><img src="${esc(imgUrl(e.image))}" alt="Arte de ${esc(e.name)}" loading="lazy" onerror="this.src='assets/festival-aurora.svg'"><span class="event-category">${esc(e.category)}</span></div><div class="event-body"><span class="event-date">${dShort(e.date)} · ${esc(e.time)}</span><h3>${esc(e.name)}</h3><p class="event-desc">${esc(e.description)}</p><div class="event-location"><span aria-hidden="true">⌖</span><span>${esc(e.venue)} · ${esc(e.city)}</span></div><div class="event-meta"><div class="event-price"><small>A partir de</small><strong>${money(e.priceCents)}</strong></div><button class="btn btn-primary btn-sm" type="button" data-buy="${esc(e.id)}" ${soldout?'disabled':''}>${soldout?'Esgotado':'Comprar ↗'}</button></div><div class="event-stock ${soldout?'soldout':low?'near-full':''}">${soldout?'Esgotado':`${e.available} ingressos disponíveis${low?' · Quase lotado':''}`}</div></div></article>`;
 }
 const cards=(node,items)=>{if(node)node.innerHTML=items.length?items.map(eventCard).join(''):'<div class="empty-inline">Nenhum evento encontrado.</div>';};
 function initHome(){cards($('#featured-events'),state.events.slice(0,3));}
 function initEvents(){const search=$('#event-search'),category=$('#event-category'),sort=$('#event-sort');
   const render=()=>{let list=state.events.filter(e=>e.name.toLowerCase().includes(search.value.trim().toLowerCase())&&(category.value==='all'||e.category===category.value));
     if(sort.value==='low')list.sort((a,b)=>a.priceCents-b.priceCents);if(sort.value==='high')list.sort((a,b)=>b.priceCents-a.priceCents);
     $('#events-count').textContent=`${list.length} evento(s) encontrado(s)`;cards($('#all-events'),list);};
   [search,category,sort].forEach(n=>n.addEventListener(n===search?'input':'change',render));render();
   $('#checkout-modal')?.addEventListener('click',e=>{if(e.target===$('#checkout-modal')||e.target.closest('[data-close-checkout]'))closeCheckout();});
   document.addEventListener('keydown',e=>{if(e.key==='Escape')closeCheckout();});
   const want=new URLSearchParams(location.search).get('comprar');if(want)setTimeout(()=>openCheckout(want),100);
   state.refresh=render;
 }
 const maskCPF=v=>digits(v).slice(0,11).replace(/^(\d{3})(\d)/,'$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d)/,'.$1-$2');
 const maskPhone=v=>{const d=digits(v).slice(0,11);return d.length<3?d:`(${d.slice(0,2)}) ${d.slice(2,d.length>10?7:6)}${d.length>6?'-'+d.slice(d.length>10?7:6):''}`;};
 function initSignup(){if(state.user){location.href=roleRoute();return;}
  $('#signup-cpf').addEventListener('input',e=>e.target.value=maskCPF(e.target.value));
  $('#signup-phone').addEventListener('input',e=>e.target.value=maskPhone(e.target.value));
  $('#signup-form').addEventListener('submit',async e=>{e.preventDefault();fieldError('#signup-error');
    const b=$('button[type=submit]',e.target);b.disabled=true;
    try{await api('/auth/register','POST',{name:$('#signup-name').value,cpf:$('#signup-cpf').value,phone:$('#signup-phone').value,email:$('#signup-email').value,password:$('#signup-password').value,confirm:$('#signup-confirm').value});location.href=safeGo();}
    catch(ex){fieldError('#signup-error',errorMessage(ex));}finally{b.disabled=false;}
  });
 }
 function initLogin(){if(state.user){location.href=roleRoute();return;}
  const link=$('#signup-link'),next=new URLSearchParams(location.search).get('next');if(next&&link)link.href=`cadastro.html?next=${encodeURIComponent(next)}`;
  $('#login-form').addEventListener('submit',async e=>{e.preventDefault();fieldError('#login-error');const b=$('button[type=submit]',e.target);b.disabled=true;
    try{const {user}=await api('/auth/login','POST',{login:$('#login-email').value,password:$('#login-password').value});
      location.href=user.type==='FUNCIONARIO'?({'ADMIN':'admin.html','CAIXA':'caixa.html','VALIDADOR':'validar.html'}[user.role]):safeGo();}
    catch(ex){fieldError('#login-error',errorMessage(ex));}finally{b.disabled=false;}
  });
 }
 let checkoutId=null,checkoutQty=1;
 function closeCheckout(){if($('#checkout-modal'))$('#checkout-modal').hidden=true;document.body.classList.remove('modal-open');checkoutId=null;}
 function openCheckout(id){const e=byEvent(id);if(!e||e.available<=0)return notify('Ingressos esgotados.','error');
   if(state.user?.type!=='CLIENTE'){location.href=`login.html?next=${encodeURIComponent('eventos.html?comprar='+id)}`;return;}
   if(page!=='eventos'){location.href=`eventos.html?comprar=${encodeURIComponent(id)}`;return;}
   checkoutId=id;checkoutQty=1;$('#checkout-modal').hidden=false;document.body.classList.add('modal-open');drawCheckout();
 }
 function drawCheckout(){const e=byEvent(checkoutId);if(!e)return closeCheckout();checkoutQty=Math.max(1,Math.min(checkoutQty,e.available,10));
   $('#checkout-content').innerHTML=`<span class="eyebrow">Compra de demonstração</span><h2 id="checkout-title">${esc(e.name)}</h2><p class="checkout-meta">${dText(e.date)} às ${esc(e.time)} · ${esc(e.venue)}</p><div class="notice notice-amber">Simulação escolar. Nenhum dinheiro será cobrado e nenhum pagamento real será processado.</div><div class="checkout-divider"></div>
   <div class="checkout-line"><span>Preço unitário</span><strong>${money(e.priceCents)}</strong></div><div class="checkout-line"><span>Quantidade</span><div class="qty-control"><button type="button" data-quantity="-1" aria-label="Diminuir">−</button><strong>${checkoutQty}</strong><button type="button" data-quantity="1" aria-label="Aumentar">+</button></div></div><div class="checkout-divider"></div><div class="checkout-line checkout-total"><span>Total (simulado)</span><strong>${money(e.priceCents*checkoutQty)}</strong></div><p class="muted">${e.available} ingressos disponíveis · Máximo de 10 por compra</p><button class="btn btn-primary btn-block" id="confirm-checkout" type="button">Confirmar compra fictícia ↗</button>`;
   $$('[data-quantity]',$('#checkout-content')).forEach(n=>n.addEventListener('click',()=>{checkoutQty+=Number(n.dataset.quantity);drawCheckout();}));
   $('#confirm-checkout').addEventListener('click',async()=>{const b=$('#confirm-checkout');b.disabled=true;b.textContent='Registrando...';
    try{const sale=await api('/sales','POST',{eventId:checkoutId,items:[{type:'INGRESSO',quantity:checkoutQty}]});location.href=`meus-ingressos.html?compra=${encodeURIComponent(sale.saleId)}`;}
    catch(ex){notify(errorMessage(ex),'error');await reloadEvents();drawCheckout();}
    finally{if(b.isConnected)b.disabled=false;}
   });
 }
 function status(t){return `<span class="mini-status ${t==='VALIDO'?'status-valid':t==='UTILIZADO'?'status-used':'status-cancel'}">${t==='VALIDO'?'VÁLIDO':esc(t)}</span>`;}
 function renderQR(target,payload,size=148){if(!target)return;
   target.innerHTML='';if(!window.QRCode){target.textContent='QR indisponível — verifique a conexão com a internet.';return;}
   new QRCode(target,{text:payload,width:size,height:size,colorDark:'#4A3028',colorLight:'#FFFFFF',correctLevel:QRCode.CorrectLevel.M});
 }
 const qrImage=t=>{const n=document.getElementById(`qr-${t.id}`);if(!n)return null;
   const canvas=$('canvas',n);if(canvas)return canvas.toDataURL('image/png');return $('img',n)?.src||null;};
 function ticketMarkup(t){return `<article class="ticket-card" id="ticket-${esc(t.id)}"><div class="ticket-main"><span class="ticket-brand">LUMI ✧ EVENTOS</span><h2>${esc(t.eventName)}</h2><div class="ticket-info-grid"><div><small>Comprador</small><strong>${esc(t.buyerName)}</strong></div><div><small>Data</small><strong>${dText(t.eventDate)} · ${esc(t.eventTime)}</strong></div><div><small>Local</small><strong>${esc(t.venue)}, ${esc(t.city)}</strong></div><div><small>Emissão</small><strong>${when(t.issuedAt)}</strong></div></div><p class="ticket-code">CÓDIGO: ${esc(t.code)}</p></div><div class="ticket-right"><div id="qr-${esc(t.id)}" class="qr-code"></div><div class="ticket-status">${status(t.status)}</div><div class="ticket-actions"><button type="button" class="btn btn-outline" data-print="${esc(t.id)}">Imprimir</button><button type="button" class="btn btn-primary" data-pdf="${esc(t.id)}">Baixar PDF</button></div></div></article>`;}
 let ticketCache=[];
 async function initMyTickets(){if(!state.user||state.user.type!=='CLIENTE'){
  $('#my-tickets').innerHTML='<div class="empty-state"><h2>Entre como cliente para consultar seus ingressos.</h2><p>Os funcionários emitem e validam ingressos através das áreas da equipe.</p><a class="btn btn-primary" href="login.html?next=meus-ingressos.html">Entrar na conta</a></div>';return;}
  const refresh=async()=>{ticketCache=(await api('/tickets')).tickets;$('#tickets-summary').innerHTML=`<p class="muted">${ticketCache.length} ingresso(s) encontrado(s) · Cada código é exclusivo</p>`;
   $('#my-tickets').innerHTML=ticketCache.length?ticketCache.map(ticketMarkup).join(''):'<div class="empty-state"><h2>Você ainda não tem ingressos.</h2><p>Descubra os próximos eventos da LUMI.</p><a href="eventos.html" class="btn btn-primary">Explorar eventos</a></div>';
   ticketCache.forEach(t=>renderQR($(`#qr-${CSS.escape(t.id)}`),t.qrPayload));
  };
  state.refresh=refresh;await refresh();
  if(new URLSearchParams(location.search).get('compra'))notify('Compra demonstrativa registrada! Seus ingressos exclusivos estão abaixo.','success');
  $('#my-tickets').addEventListener('click',e=>{const print=e.target.closest('[data-print]'),pdf=e.target.closest('[data-pdf]');
    const t=ticketCache.find(t=>t.id===(print?.dataset.print||pdf?.dataset.pdf));if(!t)return;
    if(print)printTicket(t);if(pdf)downloadTicket(t);
  });
 }
 function printTicket(t){const qr=qrImage(t);if(!qr)return notify('QR Code não disponível para impressão.','error');
  const wnd=window.open('','_blank','width=650,height=820');if(!wnd)return notify('Permita pop-ups para imprimir o ingresso.','error');
  wnd.document.write(`<!doctype html><html><head><title>Ingresso LUMI</title><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:35px;color:#4A3028}.ticket{border:2px solid #4A3028;border-radius:15px;max-width:500px;margin:auto;overflow:hidden}.head{background:#4A3028;color:#fff;padding:25px}h1{font-size:29px}.main{padding:25px;text-align:center}img{width:180px;height:180px}small{overflow-wrap:anywhere}p{line-height:1.6}@media print{button{display:none}}</style></head><body><div class="ticket"><div class="head"><h2>LUMI EVENTOS</h2><h1>${esc(t.eventName)}</h1></div><div class="main"><p><b>${esc(t.buyerName)}</b></p><p>${esc(dText(t.eventDate))} · ${esc(t.eventTime)}<br>${esc(t.venue)}, ${esc(t.city)}</p><img src="${qr}" alt="QR do ingresso"><p><b>${esc(t.status)}</b></p><small>${esc(t.code)}</small><p>DEMONSTRAÇÃO ESCOLAR — SEM VALIDADE COMERCIAL</p></div></div><script>window.onload=()=>{window.print();}<\/script></body></html>`);
  wnd.document.close();
 }
 function downloadTicket(t){if(!window.jspdf?.jsPDF){notify('Biblioteca de PDF indisponível. Use Imprimir → Salvar como PDF ou verifique a internet.','error');return;}
  const qr=qrImage(t);if(!qr)return notify('QR Code não disponível.','error');
  const pdf=new window.jspdf.jsPDF({unit:'mm',format:[125,175]});pdf.setFillColor(74,48,40);pdf.rect(0,0,125,67,'F');pdf.setTextColor(255,255,255);pdf.setFont('helvetica','bold');pdf.setFontSize(17);pdf.text('LUMI  /  EVENTOS',12,21);pdf.setFontSize(19);pdf.text(t.eventName.slice(0,29),12,40);
  pdf.setTextColor(74,48,40);pdf.setFontSize(11);pdf.text(`Comprador: ${t.buyerName}`.slice(0,53),12,77);pdf.text(`Data: ${dText(t.eventDate)} - ${t.eventTime}`.slice(0,54),12,85);pdf.text(`Local: ${t.venue}, ${t.city}`.slice(0,54),12,93);
  pdf.addImage(qr,'PNG',42,101,40,40);pdf.setFontSize(7);pdf.text(t.code,62.5,148,{align:'center'});pdf.setFontSize(9);pdf.text(`STATUS: ${t.status}`,62.5,155,{align:'center'});pdf.setFontSize(7);pdf.text('APENAS DEMONSTRACAO ESCOLAR - SEM PAGAMENTO REAL',62.5,166,{align:'center'});
  pdf.save(`LUMI-${t.id}.pdf`);
 }
 // ---------------------------- ADMINISTRAÇÃO ----------------------------
 async function loadAdmin(){state.admin=await api('/admin/summary');return state.admin;}
 function requireRole(...roles){const allowed=can(...roles);const lock=$('#access-denied'),content=$('#workspace');
   if(lock)lock.hidden=allowed;if(content)content.hidden=!allowed;return allowed;}
 function statsBlock(label,value,note=''){return `<article class="stat-card"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></article>`;}
 async function initAdmin(){
  if(!requireRole('ADMIN'))return;
  const reload=async()=>{await loadAdmin();renderAdmin();};state.refresh=reload;
  await reload();
  $('#admin-add-event').addEventListener('click',()=>openEventEditor());
  $('#event-cancel-edit').addEventListener('click',()=>$('#event-form-shell').hidden=true);
  $('#event-cancel-edit-secondary').addEventListener('click',()=>$('#event-form-shell').hidden=true);
  $('#admin-event-form').addEventListener('submit',async e=>{e.preventDefault();fieldError('#admin-event-error');
    const id=$('#event-id').value;const data={name:$('#event-name').value,description:$('#event-description').value,category:$('#event-type').value,
     date:$('#event-date').value,time:$('#event-time').value,venue:$('#event-venue').value,city:$('#event-city').value,
     priceCents:cents($('#event-price').value),variableCostCents:cents($('#event-variable-cost').value),capacity:Number($('#event-capacity').value),
     image:$('#event-image').value,status:$('#event-status').value,wristbandProductId:$('#event-wristband').value};
    const b=$('button[type="submit"]',e.target);b.disabled=true;
    try{await api(id?`/admin/events/${encodeURIComponent(id)}`:'/admin/events',id?'PUT':'POST',data);notify('Evento salvo no banco de dados.','success');$('#event-form-shell').hidden=true;await reload();}
    catch(ex){fieldError('#admin-event-error',errorMessage(ex));}finally{b.disabled=false;}
  });
  $('#admin-events-list').addEventListener('click',async e=>{
    const edit=e.target.closest('[data-edit-event]'),archive=e.target.closest('[data-archive-event]');
    if(edit){const event=state.admin.events.find(x=>x.id===edit.dataset.editEvent);if(event)openEventEditor(event);}
    if(archive&&confirm('Arquivar este evento? Os ingressos existentes continuarão armazenados.'))try{await api(`/admin/events/${encodeURIComponent(archive.dataset.archiveEvent)}`,'DELETE');notify('Evento arquivado.','success');await reload();}catch(ex){notify(errorMessage(ex),'error');}
  });
  const updateTickets=()=>renderAdminTickets();
  $('#admin-ticket-search').addEventListener('input',updateTickets);$('#admin-ticket-status').addEventListener('change',updateTickets);
  $('#admin-tickets-list').addEventListener('click',async e=>{
    const btn=e.target.closest('[data-cancel-ticket]');if(!btn||!confirm('Cancelar este ingresso VÁLIDO? O código deixará de autorizar entrada e a capacidade será devolvida.'))return;
    try{await api(`/admin/tickets/${encodeURIComponent(btn.dataset.cancelTicket)}/cancel`,'POST',{});notify('Ingresso cancelado.','success');await reload();}catch(ex){notify(errorMessage(ex),'error');}
  });
  $('#admin-sales-list').addEventListener('click',async e=>{
    const btn=e.target.closest('[data-cancel-sale]');if(!btn||!confirm('Cancelar toda esta venda demonstrativa e devolver os estoques?'))return;
    try{await api(`/admin/sales/${encodeURIComponent(btn.dataset.cancelSale)}/cancel`,'POST',{});notify('Venda cancelada e estoques devolvidos.','success');await reload();}catch(ex){notify(errorMessage(ex),'error');}
  });
 }
 function renderAdmin(){const a=state.admin;if(!a)return;
   const t=a.totals;
   $('#admin-stats').innerHTML=[statsBlock('Vendas confirmadas (demo)',t.salesCount,'Simulações, sem pagamentos reais'),statsBlock('Ingressos emitidos',t.ticketsCount,`${t.validTickets} válidos`),statsBlock('Faturamento demonstrativo',money(t.revenueCents),'Vendas ativas, após estornos'),statsBlock('Alertas de estoque',a.products.filter(p=>p.lowStock).length,'Produtos no mínimo ou abaixo')].join('');
   $('#admin-events-list').innerHTML=a.events.map(ev=>`<tr><td><strong>${esc(ev.name)}</strong><small>${esc(ev.category)}</small></td><td>${dShort(ev.date)}</td><td>${money(ev.priceCents)}</td><td>${ev.available} / ${ev.capacity} ${ev.available<=Math.ceil(ev.capacity*.1)?'<b class="inline-warn">Perto do limite</b>':''}</td><td>${ev.archived?'Arquivado':'Ativo'}</td><td class="actions-cell"><button type="button" class="btn btn-outline btn-sm" data-edit-event="${esc(ev.id)}">Editar</button>${ev.archived?'':`<button type="button" class="btn btn-danger-outline btn-sm" data-archive-event="${esc(ev.id)}">Arquivar</button>`}</td></tr>`).join('')||'<tr><td colspan="6">Nenhum evento.</td></tr>';
   renderAdminTickets();
   $('#admin-buyers-list').innerHTML=a.buyers.map(b=>{const orders=a.sales.filter(s=>s.usuario_id===b.id);return `<tr><td><strong>${esc(b.nome)}</strong></td><td>${esc(b.email)}</td><td>${a.tickets.filter(t=>orders.some(s=>s.id===t.saleId)).length}</td><td>${orders.length}</td></tr>`;}).join('')||'<tr><td colspan="4">Nenhum cliente cadastrado.</td></tr>';
   $('#admin-sales-list').innerHTML=a.sales.map(s=>`<tr><td><strong>${esc(s.comprador_nome)}</strong><small>${when(s.data_venda)}</small></td><td>${esc(s.evento_nome)}</td><td>${money(s.valor_total_centavos)}</td><td>${esc(s.forma_pagamento)}<small>${esc(s.funcionario_nome||'Site')}</small></td><td>${esc(s.caixa_nome||'Online')}</td><td>${esc(s.status_pagamento)}</td><td>${s.status_pagamento==='CONFIRMADO_DEMO'?`<button type="button" data-cancel-sale="${esc(s.id)}" class="btn btn-danger-outline btn-sm">Cancelar</button>`:'—'}</td></tr>`).join('')||'<tr><td colspan="7">Nenhuma venda registrada.</td></tr>';
   $('#admin-alerts').innerHTML=a.products.filter(p=>p.lowStock).map(p=>`<div class="notice notice-amber">Estoque baixo: <strong>${esc(p.nome)}</strong> · ${esc(p.evento_nome)} — ${p.quantidade_disponivel} unidades</div>`).join('')||'<p class="muted">Nenhum alerta de estoque neste momento.</p>';
 }
 function renderAdminTickets(){const a=state.admin;if(!a)return;
   const query=$('#admin-ticket-search').value.trim().toLowerCase(),filtered=a.tickets.filter(t=>(!query||[t.code,t.buyerName,t.eventName].some(s=>s.toLowerCase().includes(query)))&&($('#admin-ticket-status').value==='all'||t.status===$('#admin-ticket-status').value));
   $('#admin-tickets-list').innerHTML=filtered.slice(0,250).map(t=>`<tr><td><strong>${esc(t.eventName)}</strong><small class="break-all">${esc(t.code)}</small></td><td>${esc(t.buyerName)}</td><td>${when(t.issuedAt)}</td><td>${status(t.status)}</td><td>${t.status==='VALIDO'?`<button type="button" class="btn btn-danger-outline btn-sm" data-cancel-ticket="${esc(t.id)}">Cancelar</button>`:'—'}</td></tr>`).join('')||'<tr><td colspan="5">Nenhum ingresso encontrado.</td></tr>';
 }
 function openEventEditor(e=null){const form=$('#admin-event-form');form.reset();$('#event-id').value=e?.id||'';
   $('#event-form-title').textContent=e?'Editar evento':'Cadastrar evento';$('#event-name').value=e?.name||'';
   $('#event-description').value=e?.description||'';$('#event-type').value=e?.category||'Festival';
   $('#event-price').value=e?moneyInput(e.priceCents):'';$('#event-variable-cost').value=e?moneyInput(e.variableCostCents):'0.00';
   $('#event-date').value=e?.date||'';$('#event-time').value=e?.time||'18:00';$('#event-venue').value=e?.venue||'';$('#event-city').value=e?.city||'';
   $('#event-capacity').value=e?.capacity||'';$('#event-image').value=e?.image||'';$('#event-status').value=e?.status||'ATIVO';
   $('#event-wristband').innerHTML=`<option value="">Sem material vinculado</option>${state.admin.products.filter(p=>e&&p.evento_id===e.id&&p.categoria==='MATERIAL'&&p.ativo).map(p=>`<option value="${esc(p.id)}">${esc(p.nome)} (${p.quantidade_disponivel})</option>`).join('')}`;
   $('#event-wristband').value=e?.wristbandProductId||'';
   fieldError('#admin-event-error');$('#event-form-shell').hidden=false;$('#event-form-shell').scrollIntoView({behavior:'smooth',block:'start'});
 }
 // ---------------------------- CAIXA RÁPIDO ----------------------------
 const cash={eventId:null,products:[],cart:new Map(),category:'INGRESSO',payment:'DINHEIRO',lastSale:null};
 const cashItems=()=>[...cash.cart.entries()].filter(([,qty])=>qty>0).map(([key,quantity])=>{
   if(key==='TICKET'){const ev=byEvent(cash.eventId);return {key,type:'INGRESSO',quantity,name:'Ingresso · '+ev.name,price:ev.priceCents,available:ev.available};}
   const product=cash.products.find(p=>p.id===key);return product?{key,type:'PRODUTO',productId:key,quantity,name:product.nome,price:product.preco_centavos,available:product.quantidade_disponivel}:null;
 }).filter(Boolean);
 function cashTotal(){return cashItems().reduce((sum,i)=>sum+i.price*i.quantity,0);}
 async function initCash(){if(!requireRole('ADMIN','CAIXA'))return;
  const boxes=(await api('/cashiers')).cashiers.filter(c=>c.status==='ABERTO');
  $('#cash-register').innerHTML=boxes.map(c=>`<option value="${esc(c.id)}">${esc(c.identificacao)}</option>`).join('');
  if(!boxes.length)notify('Nenhum caixa aberto. Peça ao administrador para abrir um caixa.','error');
  const options=state.events;
  $('#cash-event').innerHTML=options.map(ev=>`<option value="${esc(ev.id)}">${esc(ev.name)}</option>`).join('');
  cash.eventId=options[0]?.id||null;
  $('#cash-event').addEventListener('change',async()=>{cash.eventId=$('#cash-event').value;cash.cart.clear();cash.lastSale=null;await loadCashProducts();renderCash();});
  $('#cash-category').addEventListener('click',e=>{const btn=e.target.closest('[data-cash-category]');if(btn){cash.category=btn.dataset.cashCategory;renderCash();}});
  $('#cash-tiles').addEventListener('click',e=>{const btn=e.target.closest('[data-cash-add]');if(btn){setCashQty(btn.dataset.cashAdd,1);}});
  $('#cash-cart').addEventListener('click',e=>{const btn=e.target.closest('[data-cart-qty]');if(btn){setCashQty(btn.dataset.cartQty,Number(btn.dataset.step));}});
  $('#cash-payment').addEventListener('change',e=>{cash.payment=e.target.value;renderCashTotal();});
  $('#cash-received').addEventListener('input',renderCashTotal);
  $('#cash-clear').addEventListener('click',()=>{if(cash.cart.size&&!confirm('Cancelar a operação ainda não confirmada?'))return;cash.cart.clear();$('#cash-buyer').value='';$('#cash-received').value='';renderCash();notify('Operação limpa. Nenhuma venda registrada.');});
  $('#cash-confirm').addEventListener('click',submitCash);
  $('#cash-receipt').addEventListener('click',e=>{const p=e.target.closest('[data-print]'),d=e.target.closest('[data-pdf]');
    const t=cash.lastSale?.tickets?.find(t=>t.id===(p?.dataset.print||d?.dataset.pdf));if(t){if(p)printTicket(t);else downloadTicket(t);}
  });
  await loadCashProducts();renderCash();
  state.refresh=async()=>{await reloadEvents();await loadCashProducts();renderCash();};
 }
 async function loadCashProducts(){cash.products=cash.eventId?(await api(`/events/${encodeURIComponent(cash.eventId)}/products`)).products:[];}
 function setCashQty(key,change){const item=key==='TICKET'?{available:byEvent(cash.eventId)?.available||0}:cash.products.find(p=>p.id===key);
  if(!item)return;const current=cash.cart.get(key)||0;const next=Math.max(0,current+change);
  if(next>item.available)return notify('Quantidade acima do estoque disponível.','error');
  if(next)cash.cart.set(key,next);else cash.cart.delete(key);renderCash();
 }
 function renderCash(){if(!cash.eventId)return;
  $$('#cash-category [data-cash-category]').forEach(btn=>btn.classList.toggle('selected',btn.dataset.cashCategory===cash.category));
  let options=[];
  if(cash.category==='INGRESSO'){const ev=byEvent(cash.eventId);options=[{key:'TICKET',name:'Ingresso · '+ev.name,price:ev.priceCents,available:ev.available}];}
  else options=cash.products.filter(p=>p.categoria===cash.category&&p.ativo).map(p=>({key:p.id,name:p.nome,price:p.preco_centavos,available:p.quantidade_disponivel}));
  $('#cash-tiles').innerHTML=options.length?options.map(p=>`<button type="button" data-cash-add="${esc(p.key)}" class="cash-tile" ${p.available<=0?'disabled':''}><span class="cash-tile-icon">✧</span><strong>${esc(p.name)}</strong><small>${money(p.price)}</small><span>${p.available} disponíveis</span><b>+ Adicionar</b></button>`).join(''):'<p class="muted">Sem itens cadastrados nesta categoria.</p>';
  const items=cashItems();$('#cash-cart').innerHTML=items.length?items.map(i=>`<div class="cart-line"><div><strong>${esc(i.name)}</strong><small>${money(i.price)} por unidade · ${money(i.price*i.quantity)}</small></div><div class="qty-control"><button type="button" data-cart-qty="${esc(i.key)}" data-step="-1" aria-label="Diminuir">−</button><strong>${i.quantity}</strong><button type="button" data-cart-qty="${esc(i.key)}" data-step="1" aria-label="Aumentar">+</button></div></div>`).join(''):'<p class="muted">Adicione um item para começar.</p>';
  $('#cash-register-status').textContent=`${items.reduce((s,i)=>s+i.quantity,0)} item(ns) selecionado(s)`;
  renderCashTotal();
 }
 function renderCashTotal(){const total=cashTotal(),received=cents($('#cash-received')?.value);
  $('#cash-subtotal').textContent=money(total);$('#cash-total').textContent=money(total);
  $('#cash-cashline').hidden=cash.payment!=='DINHEIRO';
  const change=Number.isFinite(received)?received-total:NaN;
  $('#cash-change').textContent=Number.isFinite(change)&&change>=0?money(change):'—';
  $('#cash-confirm').disabled=!cash.cart.size||!$('#cash-register').value||(cash.payment==='DINHEIRO'&&(!Number.isFinite(received)||received<total));
  $('#cash-notice').textContent=cash.payment==='DINHEIRO'?'Registro de recebimento em dinheiro (simulação).':'PIX e cartão são confirmados SOMENTE em modo demonstrativo; nenhuma cobrança ocorre.';
 }
 async function submitCash(){const items=cashItems(),b=$('#cash-confirm');if(!items.length)return;
  b.disabled=true;b.textContent='Registrando venda...';
  try{const result=await api('/sales','POST',{eventId:cash.eventId,cashierId:$('#cash-register').value,buyerName:$('#cash-buyer').value||'Cliente do balcão',payment:cash.payment,receivedCents:cash.payment==='DINHEIRO'?cents($('#cash-received').value):undefined,items:items.map(i=>({type:i.type,productId:i.productId,quantity:i.quantity}))});
   const {sale}=await api(`/sales/${encodeURIComponent(result.saleId)}`);cash.lastSale=sale;
   cash.cart.clear();$('#cash-received').value='';$('#cash-buyer').value='';await reloadEvents();await loadCashProducts();renderCash();
   const ticketHtml=sale.tickets.map(ticketMarkup).join('');
   $('#cash-receipt').innerHTML=`<div class="notice notice-success"><strong>Venda demonstrativa registrada.</strong> Pedido ${esc(result.saleId)} · ${esc(result.payment)} · Total ${money(result.totalCents)} ${result.changeCents!==null?'· Troco '+money(result.changeCents):''}. Nenhum pagamento real foi processado.</div>${ticketHtml||'<p class="muted">Venda sem ingressos. Os produtos já foram descontados do estoque.</p>'}`;
   sale.tickets.forEach(t=>renderQR($(`#cash-receipt #qr-${CSS.escape(t.id)}`),t.qrPayload));
   $('#cash-receipt').scrollIntoView({behavior:'smooth',block:'start'});notify('Venda partilhada com todos os caixas.','success');
  }catch(ex){notify(errorMessage(ex),'error');await reloadEvents();await loadCashProducts();renderCash();}
  finally{b.textContent='Finalizar venda demonstrativa';renderCashTotal();}
 }
 // ------------------------- ESTOQUE E CAPACIDADE -------------------------
 let stockFilter='all',editingProduct=null;
 async function initStock(){if(!requireRole('ADMIN'))return;
   const reload=async()=>{await loadAdmin();renderStock();};state.refresh=reload;await reload();
   $('#stock-event-filter').addEventListener('change',e=>{stockFilter=e.target.value;renderStock();});
   $('#stock-new-product').addEventListener('click',()=>openProductEditor());
   $('#stock-form-close').addEventListener('click',()=>$('#product-form-wrap').hidden=true);
   $('#stock-product-form').addEventListener('submit',async e=>{e.preventDefault();const data={eventId:$('#product-event').value,name:$('#product-name').value,category:$('#product-category').value,priceCents:cents($('#product-price').value),
     initial:Number($('#product-initial').value),minimum:Number($('#product-minimum').value),active:$('#product-active').checked};
     const b=$('button[type="submit"]',e.target);b.disabled=true;fieldError('#product-form-error');
     try{await api(editingProduct?`/admin/products/${encodeURIComponent(editingProduct)}`:'/admin/products',editingProduct?'PUT':'POST',data);$('#product-form-wrap').hidden=true;notify('Produto gravado.','success');await reload();}
     catch(ex){fieldError('#product-form-error',errorMessage(ex));}finally{b.disabled=false;}
   });
   $('#stock-table').addEventListener('click',async e=>{
     const edit=e.target.closest('[data-product-edit]'),adjust=e.target.closest('[data-product-adjust]');
     if(edit){openProductEditor(state.admin.products.find(p=>p.id===edit.dataset.productEdit));return;}
     if(adjust){const p=state.admin.products.find(p=>p.id===adjust.dataset.productAdjust);if(!p)return;
       const delta=prompt(`Ajustar estoque de ${p.nome}. Informe um número: +20 (entrada) ou -5 (saída).`,'10');if(delta===null)return;
       const reason=prompt('Motivo do ajuste (obrigatório):','Reposição de estoque');if(reason===null)return;
       try{await api(`/admin/products/${encodeURIComponent(p.id)}/adjust`,'POST',{delta:Number(delta),reason});notify('Movimentação registrada.','success');await reload();}
       catch(ex){notify(errorMessage(ex),'error');}
     }
   });
   $('#wristband-assign').addEventListener('submit',async e=>{e.preventDefault();
     try{await api(`/admin/events/${encodeURIComponent($('#wrist-event').value)}/wristband`,'PUT',{productId:$('#wrist-material').value||null});notify('Material vinculado ao evento.','success');await reload();}
     catch(ex){notify(errorMessage(ex),'error');}
   });
   $('#wrist-event').addEventListener('change',updateMaterials);
 }
 function renderStock(){const a=state.admin;if(!a)return;
   $('#stock-event-filter').innerHTML=`<option value="all">Todos os eventos</option>${a.events.map(e=>`<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('')}`;
   $('#stock-event-filter').value=stockFilter;
   const products=a.products.filter(p=>stockFilter==='all'||p.evento_id===stockFilter),low=products.filter(p=>p.lowStock);
   $('#stock-kpis').innerHTML=[statsBlock('Eventos ativos',a.events.filter(e=>!e.archived).length),statsBlock('Produtos cadastrados',products.length),statsBlock('Itens em estoque',products.reduce((s,p)=>s+p.quantidade_disponivel,0)),statsBlock('Alertas de mínimo',low.length)].join('');
   $('#stock-alerts').innerHTML=low.length?low.map(p=>`<div class="notice notice-amber"><strong>ESTOQUE BAIXO:</strong> ${esc(p.nome)} · ${esc(p.evento_nome)} — ${p.quantidade_disponivel} restantes (mínimo ${p.estoque_minimo}).</div>`).join(''):'<p class="muted">Nenhum produto abaixo do mínimo configurado.</p>';
   $('#stock-table').innerHTML=products.map(p=>`<tr><td><strong>${esc(p.nome)}</strong><small>${esc(p.evento_nome)}</small></td><td>${esc(p.categoria)}</td><td>${money(p.preco_centavos)}</td><td>${p.quantidade_inicial}</td><td>${p.quantidade_disponivel}</td><td>${p.quantidade_vendida}</td><td>${p.estoque_minimo}</td><td>${p.ativo?(p.lowStock?'<b class="inline-warn">Baixo</b>':'Ativo'):'Inativo'}</td><td class="actions-cell"><button type="button" class="btn btn-outline btn-sm" data-product-edit="${esc(p.id)}">Editar</button><button type="button" class="btn btn-primary btn-sm" data-product-adjust="${esc(p.id)}">Ajustar</button></td></tr>`).join('')||'<tr><td colspan="9">Sem produtos.</td></tr>';
   $('#stock-history').innerHTML=a.stockHistory.filter(m=>stockFilter==='all'||a.products.find(p=>p.id===m.produto_id)?.evento_id===stockFilter).slice(0,80).map(m=>`<tr><td>${when(m.data)}</td><td>${esc(m.produto_nome)}</td><td>${esc(m.tipo_movimentacao)}</td><td>${m.quantidade>=0?'+':''}${m.quantidade}</td><td>${esc(m.funcionario_nome||'Sistema')}</td><td>${esc(m.observacao)}</td></tr>`).join('')||'<tr><td colspan="6">Sem movimentações.</td></tr>';
   const previous=$('#wrist-event').value;
   $('#wrist-event').innerHTML=a.events.filter(e=>!e.archived).map(e=>`<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('');
   $('#wrist-event').value=a.events.some(x=>x.id===previous)?previous:($('#wrist-event option')?.value||'');updateMaterials();
 }
 function updateMaterials(){const ev=state.admin?.events.find(x=>x.id===$('#wrist-event').value);
   $('#wrist-material').innerHTML=`<option value="">Não descontar material por ingresso</option>${state.admin.products.filter(p=>p.evento_id===ev?.id&&p.categoria==='MATERIAL'&&p.ativo).map(p=>`<option value="${esc(p.id)}">${esc(p.nome)} (${p.quantidade_disponivel} em estoque)</option>`).join('')}`;
   $('#wrist-material').value=ev?.wristbandProductId||'';
 }
 function openProductEditor(p=null){editingProduct=p?.id||null;$('#stock-product-form').reset();fieldError('#product-form-error');
   $('#product-form-title').textContent=p?'Editar produto':'Cadastrar produto';
   $('#product-event').innerHTML=state.admin.events.map(e=>`<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('');
   $('#product-event').value=p?.evento_id||(stockFilter!=='all'?stockFilter:state.admin.events[0]?.id||'');$('#product-event').disabled=!!p;
   $('#product-name').value=p?.nome||'';$('#product-category').value=p?.categoria||'BEBIDA';$('#product-price').value=p?moneyInput(p.preco_centavos):'0.00';
   $('#product-initial').value=p?.quantidade_inicial??'100';$('#product-initial').disabled=!!p;
   $('#product-minimum').value=p?.estoque_minimo??'10';$('#product-active').checked=p?p.ativo===1:true;
   $('#product-form-wrap').hidden=false;$('#product-form-wrap').scrollIntoView({behavior:'smooth',block:'start'});
 }
 // ------------------------- FINANCEIRO / PONTO DE EQUILÍBRIO -------------------------
 let financeEvent='all';
 async function initFinance(){if(!requireRole('ADMIN'))return;
   await loadAdmin();
   const choices=state.admin.events;
   $('#finance-event').innerHTML=`<option value="all">Todos os eventos</option>${choices.map(e=>`<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('')}`;
   $('#finance-event').addEventListener('change',async e=>{financeEvent=e.target.value;if(financeEvent!=='all')$('#expense-event').value=financeEvent;await updateFinance();});
   $('#expense-event').innerHTML=choices.map(e=>`<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('');
   $('#expense-date').value=new Date().toISOString().slice(0,10);
   $('#expense-form').addEventListener('submit',async e=>{e.preventDefault();fieldError('#expense-error');const b=$('button[type="submit"]',e.target);b.disabled=true;
     try{await api('/expenses','POST',{eventId:$('#expense-event').value,description:$('#expense-description').value,category:$('#expense-category').value,
       amountCents:cents($('#expense-value').value),date:$('#expense-date').value,notes:$('#expense-notes').value,fixed:$('#expense-fixed').checked});
       $('#expense-form').reset();$('#expense-date').value=new Date().toISOString().slice(0,10);notify('Despesa contabilizada no banco.','success');await updateFinance();}
     catch(ex){fieldError('#expense-error',errorMessage(ex));}finally{b.disabled=false;}
   });
   $('#finance-expenses').addEventListener('click',async e=>{const b=e.target.closest('[data-delete-expense]');if(!b||!confirm('Excluir esta despesa do relatório?'))return;
     try{await api(`/expenses/${encodeURIComponent(b.dataset.deleteExpense)}`,'DELETE');notify('Despesa excluída.','success');await updateFinance();}catch(ex){notify(errorMessage(ex),'error');}
   });
   state.refresh=updateFinance;await updateFinance();
 }
 async function updateFinance(){const report=await api(`/finance${financeEvent==='all'?'':`?eventId=${encodeURIComponent(financeEvent)}`}`);state.financial=report;renderFinance();}
 function renderFinance(){const f=state.financial;if(!f)return;
   const margin=f.marginPercent===null?'—':`${f.marginPercent.toFixed(1)}%`;
   $('#finance-kpis').innerHTML=[statsBlock('Receita simulada',money(f.revenueCents),`${f.salesCount} vendas confirmadas na demonstração`),statsBlock('Custos totais',money(f.totalCostsCents),'Despesas + custo variável unitário estimado'),statsBlock('Lucro / prejuízo',money(f.profitCents),f.profitCents>=0?'Resultado positivo':'Resultado negativo'),statsBlock('Margem de lucro',margin,'Lucro / Receita × 100')].join('');
   const byMethod=Object.fromEntries(f.paymentRows.map(r=>[r.metodo,r.centavos]));
   const methods=[['DINHEIRO','Dinheiro'],['PIX','PIX'],['CARTAO','Cartão'],['DEMO','Online (simulado)']];
   const max=Math.max(...methods.map(([k])=>byMethod[k]||0),1);
   $('#finance-chart').innerHTML=methods.map(([k,label])=>`<div class="chart-row"><div class="chart-row-top"><strong>${label}</strong><span>${money(byMethod[k]||0)}</span></div><div class="bar-track"><div class="bar-fill" style="width:${Math.round((byMethod[k]||0)/max*100)}%"></div></div></div>`).join('');
   $('#finance-details').innerHTML=`<div class="detail-grid"><div><span>Faturamento geral</span><strong>${money(f.revenueCents)}</strong></div><div><span>Despesas cadastradas</span><strong>${money(f.expensesTotalCents)}</strong></div><div><span>Custos variáveis estimados</span><strong>${money(f.variableEstimatedCents)}</strong></div><div><span>Ingressos emitidos não cancelados</span><strong>${f.ticketCount}</strong></div></div>`;
   const pe=$('#break-even');
   if(f.event){pe.innerHTML=`<h3>Ponto de equilíbrio · ${esc(f.event.name)}</h3><p class="muted">PE (unidades) = Custos fixos / (Preço do ingresso − Custo variável por ingresso).</p><div class="detail-grid"><div><span>Custos fixos cadastrados</span><strong>${money(f.fixedCostsCents)}</strong></div><div><span>Preço unitário</span><strong>${money(f.event.priceCents)}</strong></div><div><span>Custo variável por unidade</span><strong>${money(f.event.variableCostCents)}</strong></div><div><span>Margem de contribuição</span><strong>${money(f.contributionCents)}</strong></div></div><div class="break-even-number">${f.breakEvenUnits===null?'Inviável':`${f.breakEvenUnits} ingressos`}</div><p class="muted">${f.breakEvenUnits===null?'O preço não supera o custo variável unitário.':'Quantidade estimada para cobrir os custos fixos. O indicador não inclui receitas de fichas no cálculo unitário.'}</p>`;}
   else pe.innerHTML='<h3>Ponto de equilíbrio por evento</h3><p>Selecione um evento no filtro acima para calcular o PE a partir do preço, custos variáveis unitários e despesas fixas.</p>';
   $('#finance-expenses').innerHTML=f.expenses.map(x=>`<tr><td>${esc(x.descricao)}</td><td>${esc(x.evento_nome)}</td><td>${esc(x.categoria)}<small>${x.custo_fixo?'Fixo':'Variável / outro'}</small></td><td>${esc(x.data)}</td><td>${money(x.valor_centavos)}</td><td><button type="button" class="btn btn-danger-outline btn-sm" data-delete-expense="${esc(x.id)}">Excluir</button></td></tr>`).join('')||'<tr><td colspan="6">Nenhuma despesa cadastrada.</td></tr>';
   $('#finance-caution').textContent=f.caution;
 }
 // ------------------------- FUNCIONÁRIOS / CAIXAS -------------------------
 async function initTeam(){if(!requireRole('ADMIN'))return;
   const reload=async()=>{await loadAdmin();renderTeam();};state.refresh=reload;await reload();
   $('#staff-form').addEventListener('submit',async e=>{e.preventDefault();fieldError('#staff-error');
     const b=$('button[type="submit"]',e.target);b.disabled=true;
     try{await api('/admin/staff','POST',{name:$('#staff-name').value,login:$('#staff-login').value,password:$('#staff-password').value,role:$('#staff-role').value});
       e.target.reset();notify('Funcionário cadastrado.','success');await reload();}catch(ex){fieldError('#staff-error',errorMessage(ex));}finally{b.disabled=false;}
   });
   $('#cashier-form').addEventListener('submit',async e=>{e.preventDefault();
     try{await api('/admin/cashiers','POST',{label:$('#cashier-name').value});$('#cashier-name').value='';notify('Caixa criado.','success');await reload();}
     catch(ex){notify(errorMessage(ex),'error');}
   });
   $('#staff-list').addEventListener('click',async e=>{const btn=e.target.closest('[data-staff-toggle],[data-staff-password],[data-staff-role]');if(!btn)return;
     const staff=state.admin.employees.find(s=>s.id===(btn.dataset.staffToggle||btn.dataset.staffPassword||btn.dataset.staffRole));if(!staff)return;
     let update={};if(btn.dataset.staffToggle) {if(staff.id===state.user.id)return notify('Você não pode desativar sua conta.','error');update.active=!staff.ativo;}
     if(btn.dataset.staffPassword){const password=prompt(`Nova senha para ${staff.nome} (mínimo 10 caracteres):`);if(password===null)return;update.password=password;}
     if(btn.dataset.staffRole){const role=prompt(`Nova permissão para ${staff.nome}: ADMIN, CAIXA ou VALIDADOR`,staff.permissao);if(role===null)return;update.role=role.trim().toUpperCase();}
     try{await api(`/admin/staff/${encodeURIComponent(staff.id)}`,'PUT',update);notify('Funcionário atualizado.','success');await reload();}
     catch(ex){notify(errorMessage(ex),'error');}
   });
   $('#cashier-list').addEventListener('click',async e=>{const btn=e.target.closest('[data-cashier-toggle]');if(!btn)return;
     const c=state.admin.cashiers.find(x=>x.id===btn.dataset.cashierToggle);if(!c)return;
     try{await api(`/admin/cashiers/${encodeURIComponent(c.id)}`,'PUT',{status:c.status==='ABERTO'?'FECHADO':'ABERTO'});await reload();notify('Status do caixa atualizado.','success');}
     catch(ex){notify(errorMessage(ex),'error');}
   });
 }
 function renderTeam(){const a=state.admin;
   $('#staff-list').innerHTML=a.employees.map(s=>`<tr><td><strong>${esc(s.nome)}</strong><small>${esc(s.login)}</small></td><td>${esc(s.permissao)}</td><td>${s.ativo?'Ativo':'Inativo'}</td><td class="actions-cell"><button type="button" class="btn btn-outline btn-sm" data-staff-role="${esc(s.id)}">Permissão</button><button type="button" class="btn btn-outline btn-sm" data-staff-password="${esc(s.id)}">Senha</button><button type="button" class="btn btn-danger-outline btn-sm" data-staff-toggle="${esc(s.id)}">${s.ativo?'Desativar':'Ativar'}</button></td></tr>`).join('');
   $('#cashier-list').innerHTML=a.cashiers.map(c=>`<tr><td>${esc(c.identificacao)}</td><td>${esc(c.status)}</td><td><button type="button" class="btn btn-outline btn-sm" data-cashier-toggle="${esc(c.id)}">${c.status==='ABERTO'?'Fechar':'Abrir'}</button></td></tr>`).join('');
   $('#team-validations').innerHTML=a.validations.map(v=>`<tr><td>${when(v.data)}</td><td>${esc(v.evento_nome||'Código desconhecido')}</td><td>${esc(v.funcionario_nome||'—')}</td><td>${esc(v.resultado)}</td></tr>`).join('')||'<tr><td colspan="4">Sem validações.</td></tr>';
 }
 // ------------------------- VALIDAÇÃO DE QR COM SERVER -------------------------
 let reader=null,activeScanner=false,validationCode='',busyScanner=false;
 async function initValidator(){if(!requireRole('ADMIN','VALIDADOR'))return;
   $('#start-scanner').addEventListener('click',startScanner);$('#stop-scanner').addEventListener('click',stopScanner);
   $('#qr-file').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;await scanFile(file);e.target.value='';});
   $('#manual-validate').addEventListener('click',()=>checkCode($('#manual-ticket-code').value));
   $('#manual-ticket-code').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();checkCode(e.target.value);}});
   $('#validation-result').addEventListener('click',async e=>{const btn=e.target.closest('#mark-used');if(!btn||!validationCode)return;btn.disabled=true;
     try{const r=await api('/validation/commit','POST',{code:validationCode});displayValidation(r.ticket,r.status);
       notify(r.entryAllowed?'Entrada autorizada. Código marcado como utilizado.':'Entrada não autorizada.',r.entryAllowed?'success':'error');}
     catch(ex){notify(errorMessage(ex),'error');await checkCode(validationCode);}
   });
   window.addEventListener('pagehide',()=>{if(activeScanner)stopScanner();});
   if(!isSecureContext)$('#scanner-info').textContent='Em outros dispositivos via HTTP, o navegador geralmente bloqueia a câmera. Use HTTPS confiável ou valide pela imagem/código manual.';
 }
 async function checkCode(raw){const code=String(raw||'').trim();if(!code)return notify('Digite o código completo do ingresso.','error');validationCode=code;
   try{const result=await api('/validation/check','POST',{code});
     displayValidation(result.ticket,result.found?(result.ticket.status==='VALIDO'?'VALIDO':result.ticket.status):'INEXISTENTE');}
   catch(ex){notify(errorMessage(ex),'error');}
 }
 function displayValidation(t,result){const box=$('#validation-result');if(!box)return;
   const allowed=result==='VALIDO',used=result==='UTILIZADO'||result==='JA_UTILIZADO';
   box.classList.add('found');box.innerHTML=`<span class="result-mark ${allowed?'valid':used?'used':'invalid'}">${allowed?'✓ INGRESSO VÁLIDO':result==='AUTORIZADO'?'✓ ENTRADA AUTORIZADA':used?'⚠ JÁ UTILIZADO':'✕ ENTRADA NÃO AUTORIZADA'}</span>
     ${t?`<h3>${esc(t.eventName)}</h3><dl><dt>Ingresso</dt><dd class="break-all">${esc(t.code)}</dd><dt>Data</dt><dd>${dText(t.eventDate)} · ${esc(t.eventTime)}</dd><dt>Comprador</dt><dd>${esc(t.buyerName)}</dd><dt>Status</dt><dd>${status(t.status)}</dd><dt>Validado em</dt><dd>${when(t.usedAt)}</dd></dl>`:'<h3>Código inexistente</h3><p>O código completo não corresponde a um ingresso LUMI.</p>'}
     ${allowed?'<button class="btn btn-primary btn-block" type="button" id="mark-used">✓ Autorizar e marcar UTILIZADO</button>':`<div class="notice notice-amber">${result==='AUTORIZADO'?'Ingresso utilizado agora. Não poderá entrar novamente.':used?'Este ingresso já teve uma entrada registrada. A segunda entrada foi bloqueada.':'Código cancelado ou inexistente. Entrada bloqueada.'}</div>`}`;
 }
 async function stopScanner(){if(reader&&activeScanner)try{await reader.stop();}catch(e){console.warn(e);}activeScanner=false;busyScanner=false;
   $('#start-scanner').disabled=false;$('#stop-scanner').disabled=true;}
 async function startScanner(){if(!window.Html5Qrcode)return notify('Biblioteca html5-qrcode indisponível.','error');
   if(!isSecureContext)return notify('Câmera requer localhost ou HTTPS confiável neste dispositivo. Consulte o README.','error');
   $('#start-scanner').disabled=true;try{reader ||=new Html5Qrcode('qr-reader');
     await reader.start({facingMode:'environment'},{fps:10,qrbox:{width:220,height:220}},async decoded=>{
       if(busyScanner)return;busyScanner=true;await stopScanner();await checkCode(decoded);
     },()=>{});activeScanner=true;$('#stop-scanner').disabled=false;$('#scanner-info').textContent='Câmera ligada. Aponte para o QR Code.';
   }catch(e){$('#scanner-info').textContent='Falha ao iniciar câmera: '+errorMessage(e);$('#start-scanner').disabled=false;}
 }
 async function scanFile(file){if(!window.Html5Qrcode)return notify('Biblioteca html5-qrcode indisponível.','error');
   await stopScanner();reader ||=new Html5Qrcode('qr-reader');try{const text=await reader.scanFile(file,true);await checkCode(text);}
   catch(e){notify('Imagem sem QR Code legível.','error');}
 }
 // ------------------------- SINCRONIZAÇÃO EM REDE -------------------------
 async function reloadEvents(){state.events=(await api('/events')).events;}
 async function refreshPage(){if(refreshPending)return;refreshPending=true;try{
    await reloadEvents();if(page==='index')initHome();else if(page==='eventos')state.refresh?.();else if(state.refresh)await state.refresh();
   }catch(e){console.warn('Sincronização:',e.message);}finally{refreshPending=false;}
 }
 function installSync(){if(typeof io==='function'){
     const socket=io();socket.on('lumi:updated',()=>{refreshPage();});
     socket.on('connect',()=>{const el=$('#network-status');if(el)el.textContent='● Sincronizado';});
     socket.on('disconnect',()=>{const el=$('#network-status');if(el)el.textContent='○ Reconectando...';});
   }
   // Complementa os WebSockets e recupera dados ao voltar de outra aba.
   setInterval(()=>{if(!document.hidden&&['admin','caixa','estoque','financeiro','equipe','eventos','meus-ingressos','index'].includes(page))refreshPage();},20000);
   document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshPage();});
 }
 document.addEventListener('click',e=>{const buy=e.target.closest('[data-buy]');if(buy)openCheckout(buy.dataset.buy);});
 document.addEventListener('DOMContentLoaded',async()=>{
   try{await loadData();renderChrome();
     if(page==='index')initHome();if(page==='eventos')initEvents();if(page==='cadastro')initSignup();if(page==='login')initLogin();
     if(page==='meus-ingressos')await initMyTickets();if(page==='admin')await initAdmin();if(page==='caixa')await initCash();
     if(page==='estoque')await initStock();if(page==='financeiro')await initFinance();if(page==='equipe')await initTeam();if(page==='validar')await initValidator();
     installSync();
   }catch(ex){console.error(ex);const banner=document.createElement('div');banner.className='server-error';banner.innerHTML=`<strong>Não foi possível conectar ao servidor da LUMI.</strong><p>${esc(errorMessage(ex))}</p><p>Instale as dependências e execute <code>npm start</code> na pasta do projeto. Não use Live Server para esta versão.</p>`;
     document.body.prepend(banner);}
 });
})();
