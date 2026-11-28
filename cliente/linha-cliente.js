/* ============================================================
   LINHA DO TEMPO DO CLIENTE (prefixo lc) — tudo o que aconteceu com o cliente, numa tela só.
   Junta, SEM digitar nada duas vezes: a linha do tempo de cada processo do cliente (publicações, prazos, audiências, tarefas, providências, marcos — prEventos),
   o dinheiro (honorários, pagamentos, renegociações, cobranças enviadas, promessas) e o que a pessoa registrar (contatos e anotações, guardados em cliente.notas).
   Só leitura, exceto "Registrar contato". Respeita o papel: o servidor já entrega só os processos de cada advogado; estagiário não vê dinheiro.
   Publicações: o app carrega 90 dias; o botão "Carregar publicações antigas" busca até 400 dias (só para esta tela, sem mexer na aba Publicações).
   ============================================================ */
var LC_TIPOS = { pub: ['Publicação', '#7C5CD6'], prazo: ['Prazo', '#D93B3B'], aud: ['Audiência', '#2A78D6'], tar: ['Tarefa', '#C98500'], prox: ['Providência', '#C98500'], din: ['Dinheiro', '#17895A'], marco: ['Marco', '#8A93AD'], reg: ['Registro', '#8A93AD'], contato: ['Contato', '#5B6478'], nota: ['Anotação', '#5B6478'] };
var LC_FILTROS = [['tudo', 'Tudo'], ['pub', 'Publicações'], ['prazo', 'Prazos'], ['aud', 'Audiências'], ['tar', 'Tarefas'], ['din', 'Dinheiro'], ['contato', 'Contatos']];
var LC_CANAIS = [['ligacao', 'Ligação'], ['whatsapp', 'WhatsApp'], ['reuniao', 'Reunião'], ['email', 'E-mail']];
var lcS = { cid: null, filtro: 'tudo', proc: '', mais: 40, antigas: null, carregando: false, contato: null };

function lcCanalRotulo(k){ var r = LC_CANAIS.filter(function(c){ return c[0] === k; })[0]; return r ? r[1] : ''; }
function lcData(s){ var d = String(s || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : ''; }
function lcProcessosDe(cid){
  var mp = prMapa(), out = [];
  mp.ordem.forEach(function(n){ var r = mp.m[n]; if (prClienteIds(r).indexOf(cid) >= 0) out.push(r); });
  return out;
}
/* todos os eventos do cliente: [{ data, tipo, titulo, sub, estado, acao, proc }] */
function lcEventos(cid){
  var c = clienteById(cid), ev = [], hoje = todayISO();
  if (!c) return ev;
  function add(data, tipo, titulo, sub, estado, acao, proc, extra){
    data = lcData(data); if (!data) return;
    ev.push(Object.assign({ data: data, tipo: tipo, titulo: titulo, sub: sub || '', estado: estado || '', acao: acao || '', proc: proc || '' }, extra || {}));
  }
  var procs = lcProcessosDe(cid), numsC = {};
  procs.forEach(function(r){
    numsC[r.num] = 1;
    prEventos(r).forEach(function(e){
      if (e.tipo === 'hon') return;   /* o dinheiro vem do cliente (abaixo), uma vez só */
      if (e.tipo === 'marco' && /^Cadastrado no Horus/.test(e.titulo)) return;
      add(e.data, e.tipo, e.titulo, e.sub, e.estado, e.acao, r.num);
    });
  });
  /* publicações mais antigas que 90 dias, se a pessoa pediu */
  if (lcS.antigas && lcS.cid === cid){
    var ids = {}; (pbS.pubs || []).forEach(function(p){ ids[p.id] = 1; });
    lcS.antigas.forEach(function(p){
      var n = prNum(p.processo || p.numero || ''); if (!n || !numsC[n] || ids[p.id]) return;
      add(p.data, 'pub', p.tipo || 'Publicação', String(p.trecho || '').slice(0, 110), '', '', n, { antiga: true });
    });
  }
  /* marcos do cliente e dos atos */
  add(c.criadoEm, 'marco', 'Cliente cadastrado', '', '');
  var docs = docsDoCliente(cid);
  docs.forEach(function(d){
    var num = prNum(d.doc.numeroProcesso || '');
    add(d.doc.criadoEm, 'marco', TIPO_DOC_LABEL[d.tipo] + ' cadastrado(a)', tituloDoc(d), '', 'doc|' + tipoNav(d.tipo) + '|' + d.doc.id, num);
  });
  /* dinheiro (não aparece para quem não vê honorários) */
  if (ppPodeReceber()){
    var us = indexarUnidadesPorCliente()[cid] || [];
    function procDoc(tipo, id){ var d = docs.filter(function(x){ return x.tipo === tipo && x.doc.id === id; })[0]; return d ? prNum(d.doc.numeroProcesso || '') : ''; }
    us.forEach(function(u){
      var dd = docs.filter(function(x){ return x.tipo === u.docTipo && x.doc.id === u.docId; })[0], tit = dd ? tituloDoc(dd) : u.cliente, proc = procDoc(u.docTipo, u.docId), acao = 'doc|' + tipoNav(u.docTipo) + '|' + u.docId;
      recebimentosUn(u).forEach(function(rc){ add(rc.data, 'din', 'Pagamento recebido · ' + fmtMoeda(rc.valor), (u.label || '') + (tit ? ' · ' + tit : ''), 'Recebido|ok', acao, proc); });
      var rest = restanteUn(u);
      if (rest > 0.004 && u.data) add(u.data, 'din', (u.label || 'Honorário') + ' · ' + fmtMoeda(rest), tit, u.data < hoje ? 'Atrasado|neg' : 'A receber', acao, proc);
    });
    docs.forEach(function(d){ (d.doc.renegociacoes || []).forEach(function(r){ add(r.data, 'din', 'Dívida renegociada: ' + fmtMoeda(r.saldoAnterior) + ' → ' + fmtMoeda(r.novoSaldo), r.parcelas ? 'em ' + r.parcelas + ' parcelas' : '', '', 'doc|' + tipoNav(d.tipo) + '|' + d.doc.id, prNum(d.doc.numeroProcesso || '')); }); });
    (c.cobrancas || []).forEach(function(x){ add(x.data, 'din', 'Cobrança enviada · ' + fmtMoeda(x.valor), ({ whatsapp: 'WhatsApp', copiar: 'Texto copiado', compartilhar: 'Compartilhado' })[x.canal] || '', '', ''); });
    (c.promessas || []).forEach(function(p){
      var venc = !p.cumprida && p.data && p.data < hoje;
      add(p.data, 'din', 'Promessa de pagamento' + (p.obs ? ': ' + p.obs : ''), '', p.cumprida ? 'Cumprida|ok' : (venc ? 'Venceu|neg' : 'Aguardando'), '');
    });
  }
  /* contatos e anotações */
  (c.notas || []).forEach(function(n){
    var canal = lcCanalRotulo(n.canal);
    add(n.data, n.canal ? 'contato' : 'nota', n.canal ? 'Contato: ' + canal : 'Anotação', String(n.texto || '').slice(0, 220), '', 'nota|' + n.id, n.proc || '');
  });
  return ev;
}
function lcEhFuturo(e, hoje){ return e.data > hoje || (e.data === hoje && /^(prazo|aud|tar|prox)$/.test(e.tipo) && !/\|ok/.test(e.estado)); }
function lcCasa(e, filtro, proc){
  if (proc && e.proc !== proc) return false;
  if (filtro === 'tudo') return true;
  if (filtro === 'tar') return e.tipo === 'tar' || e.tipo === 'prox';
  if (filtro === 'contato') return e.tipo === 'contato' || e.tipo === 'nota';
  return e.tipo === filtro;
}
var LC_MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
function lcMesRotulo(d){ return LC_MESES[Number(d.slice(5, 7)) - 1] + ' de ' + d.slice(0, 4); }
function lcLinhaHtml(e){
  var t = LC_TIPOS[e.tipo] || LC_TIPOS.marco, est = e.estado.split('|'), a = e.acao.split('|'), btn = '';
  if (a[0] === 'pub') btn = '<button type="button" class="btn-text pb-b" data-lc="pub" data-v="' + escapeHtml(a[1]) + '">ver ›</button>';
  else if (a[0] === 'ag') btn = '<button type="button" class="btn-text pb-b" data-lc="ag" data-v="' + escapeHtml(a.slice(1).join('|')) + '">abrir ›</button>';
  else if (a[0] === 'doc') btn = '<button type="button" class="btn-text pb-b" data-lc="doc" data-v="' + escapeHtml(a[1] + '|' + a[2]) + '">abrir ›</button>';
  else if (a[0] === 'nota') btn = '<button type="button" class="btn-text pb-b" data-lc="nota" data-v="' + escapeHtml(a[1]) + '">editar</button>';
  var chip = est[0] ? '<span class="lc-chip ' + (est[1] || '') + '">' + escapeHtml(est[0]) + '</span>' : '';
  var proc = e.proc && !lcS.proc ? lcNumFmt(e.proc) : '';
  return '<div class="lc-ev"><span class="lc-d">' + escapeHtml(fmtData(e.data).slice(0, 5)) + '<small>' + escapeHtml(e.data.slice(0, 4)) + '</small></span><span class="lc-p" style="background:' + t[1] + '"></span>' +
    '<span class="lc-t"><b>' + escapeHtml(e.titulo) + '</b>' + chip + ((e.sub || proc) ? '<small>' + escapeHtml([e.sub, proc ? 'proc. ' + proc : ''].filter(Boolean).join(' · ')) + '</small>' : '') + (e.antiga ? '<small>publicação antiga (só leitura aqui)</small>' : '') + '</span>' + btn + '</div>';
}
function lcNumFmt(num){ var r = lcProcessosDe(lcS.cid).filter(function(x){ return x.num === num; })[0]; return r ? String(r.numero || num) : num; }

/* ---------- desenho ---------- */
function lcDesenhar(){ prComMemo(lcDesenharInt); }
function lcDesenharInt(){
  var c = clienteById(lcS.cid), body = qs('lcBody'); if (!c || !body){ lcFechar(); return; }
  qs('lcTitulo').textContent = c.nome;
  if (lcS.contato){ body.innerHTML = lcContatoHtml(c); return; }
  var hoje = todayISO(), todos = lcEventos(c.id), procs = lcProcessosDe(c.id);
  var dispon = LC_FILTROS.filter(function(f){ return f[0] !== 'din' || ppPodeReceber(); });
  if (!dispon.some(function(f){ return f[0] === lcS.filtro; })) lcS.filtro = 'tudo';
  var ev = todos.filter(function(e){ return lcCasa(e, lcS.filtro, lcS.proc); });
  var fut = ev.filter(function(e){ return lcEhFuturo(e, hoje); }).sort(function(a, b){ return a.data.localeCompare(b.data); });
  var pas = ev.filter(function(e){ return !lcEhFuturo(e, hoje); }).sort(function(a, b){ return b.data.localeCompare(a.data); });
  var h = '<div class="fl-filtros">' + dispon.map(function(f){ return '<button type="button" class="seg-btn' + (lcS.filtro === f[0] ? ' active' : '') + '" data-lc="filtro" data-v="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</div>';
  if (procs.length > 1) h += '<select class="ext-sel lc-proc" data-lc-proc="1" aria-label="Processo">' + '<option value="">Todos os processos (' + procs.length + ')</option>' + procs.map(function(r){ return '<option value="' + escapeHtml(r.num) + '"' + (lcS.proc === r.num ? ' selected' : '') + '>' + escapeHtml(String(r.numero || r.num) + ' · ' + prTitulo(r)) + '</option>'; }).join('') + '</select>';
  h += '<div class="lc-acts"><button type="button" class="btn btn-primary" data-lc="novo-contato">+ Registrar contato</button></div>';
  if (!ev.length) h += '<div class="financeiro-vazio">Nada para mostrar' + (lcS.filtro !== 'tudo' || lcS.proc ? ' com esses filtros' : ' ainda') + '.</div>';
  if (fut.length) h += '<div class="lc-mes lc-prox">Próximos</div>' + fut.map(lcLinhaHtml).join('');
  var mostra = pas.slice(0, lcS.mais), mesAtual = '';
  mostra.forEach(function(e){ var m = e.data.slice(0, 7); if (m !== mesAtual){ mesAtual = m; h += '<div class="lc-mes">' + escapeHtml(lcMesRotulo(e.data)) + '</div>'; } h += lcLinhaHtml(e); });
  if (pas.length > mostra.length) h += '<div class="lc-acts"><button type="button" class="btn btn-ghost" data-lc="mais">Mostrar mais antigos (' + (pas.length - mostra.length) + ')</button></div>';
  h += '<div class="saldo-data lc-rod">' + (lcS.antigas && lcS.cid === c.id ? 'Publicações do Diário carregadas: últimos 400 dias.' : 'Publicações do Diário: últimos 90 dias.') + ' Prazos e audiências de processo arquivado não aparecem.</div>';
  if (!(lcS.antigas && lcS.cid === c.id)) h += '<div class="lc-acts"><button type="button" class="btn btn-ghost" data-lc="antigas"' + (lcS.carregando ? ' disabled' : '') + '>' + (lcS.carregando ? 'Carregando…' : 'Carregar publicações antigas') + '</button></div>';
  body.innerHTML = h;
}
function lcAbrir(cid){
  lcS = { cid: cid, filtro: 'tudo', proc: '', mais: 40, antigas: null, carregando: false, contato: null };
  qs('overlayLc').classList.add('show'); lcDesenhar();
}
function lcFechar(){ var o = qs('overlayLc'); if (o) o.classList.remove('show'); lcS.contato = null; }
function lcCarregarAntigas(){
  if (lcS.carregando || !window.__SERVIDOR) return; lcS.carregando = true; lcDesenhar();
  var cid = lcS.cid;
  pbApi('/api/djen/lista?dias=400' + ((window.__horusEscopo && window.__horusEscopo.ativo && window.__horusEscopo.pub === 'minhas') ? '&escopo=meus' : '')).then(function(r){
    if (lcS.cid === cid) lcS.antigas = r.pubs || [];
  }).catch(function(){ toast('Não consegui carregar as publicações antigas agora.'); }).then(function(){ lcS.carregando = false; if (lcS.cid === cid) lcDesenhar(); });
}

/* ---------- registrar / editar contato (guardado em cliente.notas: aparece também em "Anotações") ---------- */
function lcContatoHtml(c){
  var k = lcS.contato, procs = lcProcessosDe(c.id);
  return '<div class="f-sec"><div class="f-sec-t">' + (k.id ? 'Editar contato' : 'Registrar contato') + '</div>' +
    '<div class="fl-filtros">' + LC_CANAIS.map(function(x){ return '<button type="button" class="seg-btn' + (k.canal === x[0] ? ' active' : '') + '" data-lc="canal" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
    '<div class="field"><label class="field-label" for="lcData">Data</label><input type="date" id="lcData" value="' + escapeHtml(k.data) + '"></div>' +
    (procs.length ? '<div class="field"><label class="field-label" for="lcProc">Processo (opcional)</label><select id="lcProc" class="ext-sel"><option value="">Nenhum</option>' + procs.map(function(r){ return '<option value="' + escapeHtml(r.num) + '"' + (k.proc === r.num ? ' selected' : '') + '>' + escapeHtml(String(r.numero || r.num) + ' · ' + prTitulo(r)) + '</option>'; }).join('') + '</select></div>' : '') +
    '<div class="field"><label class="field-label" for="lcTexto">O que foi combinado</label><textarea id="lcTexto" rows="4" maxlength="2000" placeholder="Ex.: vai trazer os documentos na terça">' + escapeHtml(k.texto) + '</textarea></div>' +
    '<div class="lc-acts"><button type="button" class="btn btn-primary" data-lc="salvar-contato">Salvar</button><button type="button" class="btn btn-ghost" data-lc="cancelar-contato">Cancelar</button>' + (k.id ? '<button type="button" class="btn btn-ghost acao-excluir" data-lc="excluir-contato">Excluir</button>' : '') + '</div>' +
    '<div class="saldo-data">Vira um item da linha do tempo e continua em "Anotações" da ficha do cliente.</div></div>';
}
function lcLerContato(){
  var k = lcS.contato; if (!k) return;
  var d = qs('lcData'), p = qs('lcProc'), t = qs('lcTexto');
  if (d) k.data = d.value; if (p) k.proc = p.value; if (t) k.texto = t.value;
}
function lcSalvarContato(){
  lcLerContato();
  var k = lcS.contato, c = clienteById(lcS.cid); if (!k || !c) return;
  var texto = String(k.texto || '').trim();
  if (!k.canal){ toast('Escolha como foi o contato (ligação, WhatsApp, reunião ou e-mail).'); return; }
  if (!lcData(k.data)){ toast('Informe a data do contato.'); return; }
  if (!texto){ toast('Escreva o que foi combinado.'); var t = qs('lcTexto'); if (t) t.focus(); return; }
  var cl = JSON.parse(JSON.stringify(c)); cl.notas = cl.notas || [];
  var dataIso = k.data + 'T12:00:00.000Z';
  if (k.id){ cl.notas = cl.notas.map(function(n){ return n.id === k.id ? Object.assign({}, n, { data: dataIso, texto: texto, canal: k.canal, proc: k.proc || '' }) : n; }); }
  else cl.notas.push({ id: uid(), data: dataIso, texto: texto, canal: k.canal, proc: k.proc || '' });
  lcS.contato = null;
  Promise.resolve(persistClienteSet(cl)).then(function(){ lcDesenhar(); toast('Contato registrado.'); });
  lcDesenhar();
}
function lcNovoContato(id){
  var c = clienteById(lcS.cid), n = id ? (c.notas || []).filter(function(x){ return x.id === id; })[0] : null;
  lcS.contato = n ? { id: n.id, canal: n.canal || 'ligacao', data: lcData(n.data) || todayISO(), proc: n.proc || '', texto: n.texto || '' } : { id: '', canal: 'ligacao', data: todayISO(), proc: lcS.proc || '', texto: '' };
  lcDesenhar();
}

/* ---------- cliques ---------- */
function lcIrPara(fn){ lcFechar(); try{ fecharPerfil(); }catch(e){} setTimeout(fn, 60); }
(function(){
  var ov = document.createElement('div'); ov.className = 'overlay'; ov.id = 'overlayLc';
  ov.innerHTML = '<div class="modal"><div class="modal-head"><h2 id="lcTitulo">Linha do tempo</h2><button class="icon-btn" id="lcFecha" type="button" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="modal-body" id="lcBody"></div></div>';
  document.body.appendChild(ov);
  qs('lcFecha').addEventListener('click', lcFechar);
  ov.addEventListener('click', function(e){ if (e.target === ov) lcFechar(); });
  ov.addEventListener('change', function(e){
    var t = e.target;
    if (t.getAttribute && t.getAttribute('data-lc-proc')){ lcS.proc = t.value; lcS.mais = 40; lcDesenhar(); return; }
  });
  ov.addEventListener('click', function(e){
    var b = e.target.closest ? e.target.closest('[data-lc]') : null; if (!b || b.disabled) return;
    var a = b.getAttribute('data-lc'), v = b.getAttribute('data-v') || '';
    if (a === 'filtro'){ lcS.filtro = v; lcS.mais = 40; lcDesenhar(); }
    else if (a === 'mais'){ lcS.mais += 40; lcDesenhar(); }
    else if (a === 'antigas') lcCarregarAntigas();
    else if (a === 'pub') lcIrPara(function(){ setActiveTab('publicacoes'); setTimeout(function(){ pbAbrirDetalhe(v); }, 80); });
    else if (a === 'ag') lcIrPara(function(){ agAbrir(v); });
    else if (a === 'doc') lcIrPara(function(){ var p = v.split('|'), dc = p[0] === 'peticao' ? docDe('caso', p[1]) : null; if (dc && dc.doProcesso) abrirEdicao(dc.id); else irParaRelacionado(p[0], p[1]); });
    else if (a === 'novo-contato') lcNovoContato('');
    else if (a === 'nota') lcNovoContato(v);
    else if (a === 'canal'){ lcLerContato(); lcS.contato.canal = v; lcDesenhar(); }
    else if (a === 'salvar-contato') lcSalvarContato();
    else if (a === 'cancelar-contato'){ lcS.contato = null; lcDesenhar(); }
    else if (a === 'excluir-contato'){
      var c = clienteById(lcS.cid), k = lcS.contato; if (!c || !k || !k.id) return;
      var cl = JSON.parse(JSON.stringify(c)); cl.notas = (cl.notas || []).filter(function(n){ return n.id !== k.id; }); lcS.contato = null;
      Promise.resolve(persistClienteSet(cl)).then(function(){ lcDesenhar(); }); lcDesenhar(); toast('Contato excluído.');
    }
  });
  var st = document.createElement('style'); st.id = 'lcCss';
  st.textContent = '.fl-filtros{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 10px}.lc-proc{width:100%;margin-bottom:10px}.lc-acts{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}' +
    '.lc-mes{font-size:var(--t1);font-weight:800;letter-spacing:.06em;color:var(--ink-soft);margin:14px 2px 4px;text-transform:uppercase}.lc-mes.lc-prox{color:#9A6700}' +
    '.lc-ev{display:grid;grid-template-columns:46px 12px minmax(0,1fr) auto;gap:8px;align-items:start;padding:9px 2px;border-top:1px solid var(--border)}.lc-d{font-weight:800;font-size:var(--t2);line-height:1.1}.lc-d small{display:block;font-weight:500;color:var(--ink-soft);font-size:var(--t1)}' +
    '.lc-p{width:10px;height:10px;border-radius:50%;margin-top:4px}.lc-t{display:flex;flex-direction:column;gap:2px;min-width:0;font-size:var(--t3)}.lc-t b{overflow-wrap:anywhere}.lc-t small{color:var(--ink-soft);font-size:var(--t2);overflow-wrap:anywhere}' +
    '.lc-chip{align-self:flex-start;border-radius:8px;padding:1px 8px;font-size:var(--t1);font-weight:800;background:rgba(201,133,0,.16);color:#7a5200}.lc-chip.ok{background:rgba(23,137,90,.14);color:#17895A}.lc-chip.neg{background:rgba(217,59,59,.14);color:#B42323}' +
    '.lc-rod{margin-top:12px}.lc-abrir{display:flex;justify-content:space-between;align-items:center;gap:8px;width:100%;text-align:left;background:var(--surface);border:2px solid var(--ink);border-radius:14px;padding:12px 14px;margin:10px 0;font:inherit;color:var(--ink);cursor:pointer}.lc-abrir small{display:block;color:var(--ink-soft);font-weight:400;font-size:var(--t2)}';
  document.head.appendChild(st);
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { lcEventos: lcEventos, lcAbrir: lcAbrir, lcS: function(){ return lcS; } });
})();
