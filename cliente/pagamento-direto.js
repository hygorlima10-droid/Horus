/* ============================================================
   PAGAMENTO SEPARADO (prefixo pd) — processos em que o pagador (ex.: o Murilo) paga a parte de cada advogado, direto a cada um.
   - Divisão com `modo: 'direto'`: as partes somam 100% e incluem o pagador (que fica com a dele: `pagador: true`). Cada advogado recebe a sua parte do pagador.
   - Cada pessoa enxerga a parcela só com a PARTE dela: `valor` = a parte, `pago` = ela já recebeu a parte dela (livro-caixa próprio na coleção `recebimentos`).
     Tudo que já existia (finanças, alertas, relatório, "Recebi R$") passa a funcionar por pessoa sem saber da divisão.
   - Marcador "o pagador já recebeu do cliente" por parcela (também em `recebimentos`): só então a parte entra sozinha no relatório do Murilo;
     antes disso a parcela vencida pode ser incluída à mão (seletor) para eventualidades.
   - O proprietário vê o livro-caixa de todos e mantém o status geral da parcela (`pago`) em dia: quitada quando todos os recebedores receberam.
   O servidor decide quem lê e grava (src/politica.js); aqui fica o cálculo e a tela.
   ============================================================ */
var pdS = { lista: [], carregado: false, sync: false, bruto: false, timer: null };
function pdOabsMinhas(){ return (typeof esS !== 'undefined' && esS.eu && esS.eu.oabs) ? esS.eu.oabs : []; }
function pdEhDono(){ return typeof ppDono === 'function' ? ppDono() : true; }
function pdDigitos(s){ return String(s == null ? '' : s).replace(/\D/g, ''); }
/* divisão em modo direto de um registro (só processos do pagador: origem diferente de "próprio") */
function pdDivisao(doc){
  var d = doc && doc.divisao;
  if (!d || d.modo !== 'direto' || !Array.isArray(d.partes) || d.partes.length < 2) return null;
  if (doc.origem === 'proprio') return null;
  return d;
}
function pdDocDe(docTipo, docId){ return (docTipo === 'caso' ? casos : (docTipo === 'acordo' ? acordos : alvaras)).filter(function(x){ return x.id === docId; })[0] || null; }
/* quem recebe: as partes com OAB que não são o pagador e têm percentual */
function pdRecebedores(d){ return d.partes.filter(function(p){ return p.oab && !p.pagador && Number(p.pct) > 0; }); }
function pdMinhaParte(d){
  var ks = pdOabsMinhas(), mine = d.partes.filter(function(p){ return p.oab && !p.pagador && ks.indexOf(p.oab) >= 0; });
  return { pct: mine.reduce(function(t, p){ return t + (Number(p.pct) || 0); }, 0), oab: mine.length ? mine[0].oab : '' };
}
function pdId(chave, quem){ return rcId(chave, quem, 'pd'); }
function pdLivro(chave, oab){ for (var i = 0; i < pdS.lista.length; i++){ var x = pdS.lista[i]; if (x.tipo === 'parte' && x.chave === chave && x.oab === oab) return x; } return null; }
function pdMarcador(chave){ for (var i = 0; i < pdS.lista.length; i++){ var x = pdS.lista[i]; if (x.tipo === 'cliente' && x.chave === chave && !x.desfeito) return x; } return null; }

/* a parcela do ponto de vista da pessoa logada (chamada por aplicarRepasse para cada unidade de um registro em modo direto) */
function pdAplicarUnidade(u, doc, d){
  var m = pdMinhaParte(d);
  u.direto = true; u.valorBruto = u.valor; u.pagadorNome = (d.partes.filter(function(p){ return p.pagador; })[0] || {}).nome || '';
  u.muriloRec = !!pdMarcador(u.chave); u.pct = m.pct;
  if (!(m.pct > 0)){ u.naoMeu = true; u.valor = 0; u.fator = 1; u.repasse = false; u.parceiro = ''; return; }   // a pessoa não tem parte nesta parcela
  var L = pdLivro(u.chave, m.oab);
  u.valor = r2(u.valorBruto * m.pct / 100); u.fator = 1; u.repasse = false; u.parceiro = ''; u.oabParte = m.oab;
  u.pago = !!(L && L.pago); u.parciais = (L && L.parciais) ? L.parciais.slice() : []; u.dataRec = (L && L.dataRecebimento) || ''; u.recTs = (L && L.atualizadoEm) || null;
}
/* O REGISTRO COMO ESTA PESSOA O VÊ (só para desenhar as telas; nunca é gravado): nas listas e cartões de Iniciais, Acordos e Alvarás, "paga", "recebido",
   parcelas pagas, próxima parcela e barra de progresso passam a refletir o recebimento DELA (a parte dela), não o status geral da parcela. */
var pdUC = null;
function pdMapaUnidades(){
  if (!pdUC){ pdUC = {}; listarUnidades().forEach(function(u){ if (u.direto) pdUC[u.chave] = u; }); setTimeout(function(){ pdUC = null; }, 0); }
  return pdUC;
}
function pdVista(tipo, doc){
  if (pdS.bruto || !pdDivisao(doc)) return doc;
  var m = pdMapaUnidades(), id = doc.id, cl = Object.assign({}, doc), vistoDe = function(chave, no){
    var u = m[chave]; if (!u) return Object.assign({}, no, { pago: false, parciais: [], dataRecebimento: null });
    return Object.assign({}, no, { pago: !!u.pago, parciais: u.parciais || [], dataRecebimento: u.pago ? (u.dataRec || null) : null });
  };
  cl.pdVista = true;
  if (tipo === 'caso'){
    if (cl.avista) cl.avista = vistoDe(id + '|avista', cl.avista);
    if (Array.isArray(cl.parcelas)) cl.parcelas = cl.parcelas.map(function(p){ return vistoDe(id + '|parcela|' + p.numero, p); });
    if (cl.exito){ cl.exito = Object.assign({}, cl.exito); if (cl.exito.avista) cl.exito.avista = vistoDe(id + '|exito|avista', cl.exito.avista); if (Array.isArray(cl.exito.parcelas)) cl.exito.parcelas = cl.exito.parcelas.map(function(p){ return vistoDe(id + '|exito|parcela|' + p.numero, p); }); }
  } else if (tipo === 'acordo' && Array.isArray(cl.parcelas) && cl.parcelas.length){
    cl.parcelas = cl.parcelas.map(function(p){ return vistoDe('acordo|' + id + '|parcela|' + p.numero, p); });
    var dv = acordoDerivado(cl); cl.status = dv.status; cl.dataRecebimento = dv.dataRecebimento; cl.data = dv.data || cl.data;
  } else {   // acordo sem parcelas e alvará: o registro inteiro é a parcela
    var u = m[tipo === 'acordo' ? 'acordo|' + id : 'alvara|' + id];
    cl.status = u && u.pago ? 'recebido' : 'pendente'; cl.dataRecebimento = u && u.pago ? (u.dataRec || null) : null; cl.parciais = u ? (u.parciais || []) : [];
    if (tipo === 'alvara' && u && u.pago && cl.fase !== 'depositado') cl.fase = 'depositado';
  }
  return cl;
}
/* gravar o livro-caixa de uma pessoa naquela parcela */
function pdGravarLivro(u, oab, estado){
  var id = pdId(u.chave, oab), ant = pdLivro(u.chave, oab);
  var dados = { tipo: 'parte', docTipo: u.docTipo, docId: u.docId, chave: u.chave, oab: oab, cliente: u.cliente, label: u.label, processo: pdDigitos(u.processo), pago: !!estado.pago, dataRecebimento: estado.pago ? (estado.data || todayISO()) : '', parciais: estado.parciais || [], valorBase: u.valor, atualizadoEm: new Date().toISOString(), porNome: (esS.eu && esS.eu.nome) || 'Proprietário' };
  return pbApi('/api/db/recebimentos/' + id, 'PUT', dados).then(function(){
    dados.id = id; if (ant) Object.assign(ant, dados); else pdS.lista.push(dados);
    return dados;
  });
}
/* baixa (total ou parcial) das parcelas em modo direto: grava no livro-caixa de quem está registrando; mesma regra de pagarUnidades */
function pdPagar(lista, data){
  data = data || todayISO();
  var ps = lista.map(function(it){
    var u = it.u, v = r2(it.valor); if (v <= 0.004 || u.pago || !u.oabParte) return null;
    var falta = Math.max(0, r2(u.valor - somaParciais(u))), L = pdLivro(u.chave, u.oabParte), parciais = L && L.parciais ? L.parciais.slice() : [];
    if (v >= falta - 0.005) return pdGravarLivro(u, u.oabParte, { pago: true, data: data, parciais: parciais });
    parciais.push({ data: data, valor: v }); return pdGravarLivro(u, u.oabParte, { pago: false, parciais: parciais });
  }).filter(Boolean);
  return Promise.all(ps).then(function(){ pdAgendarReconciliar(); try{ renderTudo(); }catch(e){} });
}
function pdDesfazer(u){
  if (!u.oabParte) return Promise.resolve();
  return pdGravarLivro(u, u.oabParte, { pago: false, parciais: [] }).then(function(){ pdAgendarReconciliar(); try{ renderTudo(); }catch(e){} });
}
function pdMarcarCliente(u, marcar){
  var id = pdId(u.chave, 'cliente'), docs = pdDocDe(u.docTipo, u.docId), advs = docs && Array.isArray(docs.advogados) ? docs.advogados.map(function(a){ return a.oab; }).filter(Boolean) : [];
  var dados = { tipo: 'cliente', docTipo: u.docTipo, docId: u.docId, chave: u.chave, cliente: u.cliente, label: u.label, processo: pdDigitos(u.processo), advs: advs, desfeito: !marcar, data: marcar ? todayISO() : '', atualizadoEm: new Date().toISOString(), porNome: (esS.eu && esS.eu.nome) || 'Proprietário' };
  var ant = null; pdS.lista.forEach(function(x){ if (x.id === id) ant = x; });
  return pbApi('/api/db/recebimentos/' + id, 'PUT', dados).then(function(){ dados.id = id; if (ant) Object.assign(ant, dados); else pdS.lista.push(dados); try{ renderTudo(); }catch(e){} });
}
function pdCarregar(){
  if (!window.__SERVIDOR || (ppPapel() !== 'proprietario' && ppPapel() !== 'advogado')) return Promise.resolve();
  return pbApi('/api/db/recebimentos').then(function(j){
    pdS.lista = (j.docs || []).map(function(d){ var x = d.data || {}; x.id = d.id; return x; }); pdS.carregado = true;
    try{ renderTudo(); }catch(e){}
    try{ pdDecorar(); }catch(e){}
    pdAgendarReconciliar();
  }).catch(function(){ pdS.carregado = true; });
}
/* unidades sem a visão da pessoa (valor cheio da parcela): só para o proprietário conferir o status geral */
function pdUnidadesBrutas(){ pdS.bruto = true; try{ return listarUnidades(); } finally { pdS.bruto = false; } }
function pdAgendarReconciliar(){ clearTimeout(pdS.timer); pdS.timer = setTimeout(function(){ try{ pdReconciliar(); }catch(e){ console.error('pagamento direto', e); } }, 800); }
/* proprietário: a parcela fica "recebida" para todos quando todos os recebedores receberam; volta a "aberta" se alguém desfaz */
function pdReconciliar(){
  if (!pdEhDono() || !pdS.carregado || pdS.sync) return;
  var ops = [];
  pdUnidadesBrutas().forEach(function(u){
    var doc = pdDocDe(u.docTipo, u.docId), d = pdDivisao(doc); if (!d) return;
    var rec = pdRecebedores(d); if (!rec.length) return;
    var todos = rec.every(function(p){ var L = pdLivro(u.chave, p.oab); return L && L.pago; });
    if (todos && !u.pago){ var datas = rec.map(function(p){ return (pdLivro(u.chave, p.oab) || {}).dataRecebimento || ''; }).sort(); ops.push({ u: u, pago: true, data: datas[datas.length - 1] || todayISO() }); }
    else if (!todos && u.pago){ ops.push({ u: u, pago: false, data: '' }); }
  });
  if (!ops.length) return;
  pdS.sync = true;
  var grupos = {}; ops.forEach(function(o){ (grupos[o.u.docTipo + '|' + o.u.docId] = grupos[o.u.docTipo + '|' + o.u.docId] || []).push(o); });
  var ps = Object.keys(grupos).map(function(k){
    var its = grupos[k], u0 = its[0].u, doc = pdDocDe(u0.docTipo, u0.docId); if (!doc) return Promise.resolve();
    var cl = JSON.parse(JSON.stringify(doc));
    its.forEach(function(o){
      var u = o.u, alvo = null;
      if (u.kind === 'avista') alvo = cl.avista;
      else if (u.kind === 'exitoAvista') alvo = cl.exito && cl.exito.avista;
      else if (u.kind === 'parcela' || u.kind === 'acordoParcela') alvo = (cl.parcelas || []).filter(function(p){ return p.numero === u.numero; })[0];
      else if (u.kind === 'exitoParcela') alvo = ((cl.exito && cl.exito.parcelas) || []).filter(function(p){ return p.numero === u.numero; })[0];
      if (alvo){ alvo.pago = o.pago; alvo.dataRecebimento = o.pago ? o.data : null; }
      else {
        cl.status = o.pago ? 'recebido' : 'pendente'; cl.dataRecebimento = o.pago ? o.data : null;
        if (u.docTipo === 'alvara'){ if (o.pago){ cl.fase = 'depositado'; cl.faseDesde = o.data; } else if (cl.fase === 'depositado'){ cl.fase = 'banco'; cl.faseDesde = todayISO(); } }
      }
    });
    if (u0.docTipo === 'caso') return Promise.resolve(persistPatch(doc, { avista: cl.avista, parcelas: cl.parcelas, exito: cl.exito }));
    if (u0.docTipo === 'acordo') return Promise.resolve(persistPatchAcordo(doc, (cl.parcelas && cl.parcelas.length) ? Object.assign({ parcelas: cl.parcelas }, acordoDerivado(cl)) : { status: cl.status, dataRecebimento: cl.dataRecebimento || null }));
    return Promise.resolve(persistPatchAlvara(doc, { status: cl.status, dataRecebimento: cl.dataRecebimento || null, fase: cl.fase, faseDesde: cl.faseDesde }));
  });
  Promise.all(ps).catch(function(e){ console.error('pagamento direto', e); }).then(function(){ pdS.sync = false; try{ renderTudo(); }catch(e){} });
}

/* ---------- controles da lista: a pessoa marca o recebimento DELA, não o da parcela inteira ---------- */
var PD_CTRL = [
  ['data-avista', function(id){ return id + '|avista'; }], ['data-parcela', function(id, n){ return id + '|parcela|' + n; }],
  ['data-exavista', function(id){ return id + '|exito|avista'; }], ['data-exparcela', function(id, n){ return id + '|exito|parcela|' + n; }],
  ['data-acordo-parcela', function(id, n){ return 'acordo|' + id + '|parcela|' + n; }], ['data-acordo-status', function(id){ return 'acordo|' + id; }], ['data-alvara-status', function(id){ return 'alvara|' + id; }]
];
function pdControle(el){
  for (var i = 0; i < PD_CTRL.length; i++){ var a = PD_CTRL[i][0]; if (el.hasAttribute && el.hasAttribute(a)){ var id = el.getAttribute(a), n = el.getAttribute('data-num'); return { chave: PD_CTRL[i][1](id, n), docId: id, tipo: a.indexOf('acordo') >= 0 ? 'acordo' : (a.indexOf('alvara') >= 0 ? 'alvara' : 'caso'), botao: el.tagName === 'BUTTON' }; } }
  return null;
}
function pdUnidade(chave){ var r = null; listarUnidades().forEach(function(u){ if (u.chave === chave) r = u; }); return r; }
document.addEventListener('click', function(ev){
  var el = ev.target.closest ? ev.target.closest('[data-avista],[data-parcela],[data-exavista],[data-exparcela],[data-acordo-parcela],[data-acordo-status],[data-alvara-status]') : null; if (!el) return;
  var c = pdControle(el); if (!c) return;
  var doc = pdDocDe(c.tipo, c.docId), d = pdDivisao(doc); if (!d) return;   // registro comum: segue o caminho de sempre
  ev.preventDefault(); ev.stopImmediatePropagation(); ev.stopPropagation();
  var u = pdUnidade(c.chave);
  if (!u || u.naoMeu){ toast('Esta parcela é paga direto a cada advogado e você não tem parte nela.'); try{ renderTudo(); }catch(e){} return; }
  if (u.pago) pdDesfazer(u).then(function(){ toast('Recebimento da sua parte desfeito.'); }).catch(function(e){ toast('Não consegui salvar: ' + (e && e.message || e)); });
  else pdPagar([{ u: u, valor: restanteUn(u) }], todayISO()).then(function(){ toast('Sua parte (' + fmtMoeda(u.valor) + ') marcada como recebida.'); }).catch(function(e){ toast('Não consegui salvar: ' + (e && e.message || e)); });
}, true);

/* a lista mostra o estado da pessoa: caixa marcada = ela recebeu a parte dela; e um selo com a parte e o marcador do pagador */
function pdDecorar(){
  document.documentElement.classList.toggle('pd-murilo', listarUnidades().some(function(u){ return u.origem === 'murilo' && u.direto && !u.naoMeu; }));   /* libera o botão "Relatório do Murilo" a quem tem parcelas em pagamento separado */
  var els = document.querySelectorAll('[data-avista],[data-parcela],[data-exavista],[data-exparcela],[data-acordo-parcela],[data-acordo-status],[data-alvara-status]');
  if (!els.length) return;
  var unidades = {}; var temDireto = false;
  listarUnidades().forEach(function(u){ if (u.direto) unidades[u.chave] = u; });
  Array.prototype.forEach.call(els, function(el){
    var c = pdControle(el); if (!c) return;
    var doc = pdDocDe(c.tipo, c.docId), d = pdDivisao(doc); if (!d) return;
    temDireto = true;
    var u = unidades[c.chave], host = el.closest('.parcela-row, .acordo-linha, .kc-sub') || el.parentNode, sel = 'pd-chip';
    if (host.querySelector('.' + sel + '[data-pd-k="' + c.chave + '"]')) { if (u && !c.botao) el.checked = !!u.pago; return; }
    if (!u || u.naoMeu){ el.style.display = 'none'; var s0 = document.createElement('span'); s0.className = sel + ' saldo-data'; s0.setAttribute('data-pd-k', c.chave); s0.textContent = 'Paga direto a cada advogado — sem parte sua'; host.appendChild(s0); return; }
    if (c.botao) el.textContent = u.pago ? 'Desfazer recebimento da minha parte' : 'Marcar minha parte como recebida'; else el.checked = !!u.pago;
    var sp = document.createElement('span'); sp.className = sel + ' saldo-data'; sp.setAttribute('data-pd-k', c.chave);
    sp.innerHTML = ' · sua parte <b>' + fmtMoeda(u.valor) + '</b> (' + String(Math.round(u.pct * 100) / 100).replace('.', ',') + '%) ' + (u.pago ? '— recebida' : '') +
      ' <button type="button" class="es-lk" data-pd-cli="' + escapeHtml(c.chave) + '">' + (u.muriloRec ? (escapeHtml(u.pagadorNome || 'Pagador') + ' já recebeu do cliente ✓') : ('Marcar: ' + escapeHtml(u.pagadorNome || 'pagador') + ' recebeu do cliente')) + '</button>' +
      (pdEhDono() ? ' <button type="button" class="es-lk" data-pd-painel="' + escapeHtml(c.chave) + '">Pagamentos por pessoa</button>' : '');
    host.appendChild(sp);
  });
}
document.addEventListener('click', function(e){
  var b = e.target.closest ? e.target.closest('[data-pd-cli]') : null;
  if (b){ e.stopPropagation(); var u = pdUnidade(b.getAttribute('data-pd-cli')); if (u && !u.naoMeu) pdMarcarCliente(u, !u.muriloRec).then(function(){ toast(u.muriloRec ? 'Marcador desfeito.' : 'Anotado: ' + (u.pagadorNome || 'o pagador') + ' recebeu do cliente. A sua parte entra no relatório de cobrança.'); }).catch(function(x){ toast('Não consegui salvar: ' + (x && x.message || x)); }); return; }
  var p = e.target.closest ? e.target.closest('[data-pd-painel]') : null;
  if (p){ e.stopPropagation(); pdAbrirPainel(p.getAttribute('data-pd-painel')); return; }
  var t = e.target.closest ? e.target.closest('[data-pd-por]') : null;
  if (t){ var k = t.getAttribute('data-pd-por').split('|'); pdPainelAlternar(k[0], k[1]); }
}, true);

/* proprietário: quadro "Pagamentos por pessoa" da parcela (marca o recebimento de cada um, se o advogado não marcou) */
var pdPainel = { chave: '' };
function pdAbrirPainel(chave){
  pdPainel.chave = chave; var ov = sgMontar('overlayPdPainel', 'Pagamentos desta parcela'); pdDesenharPainel(); ov.classList.add('show');
}
function pdDesenharPainel(){
  var el = qs('overlayPdPainelC'), chave = pdPainel.chave; if (!el) return;
  var bruta = pdUnidadesBrutas().filter(function(x){ return x.chave === chave; })[0]; if (!bruta){ el.innerHTML = ''; return; }
  var doc = pdDocDe(bruta.docTipo, bruta.docId), d = pdDivisao(doc); if (!d){ el.innerHTML = ''; return; }
  var cli = pdMarcador(chave), h = '<div class="pb-sec"><div class="pb-sec-t">' + escapeHtml(bruta.cliente) + ' · ' + escapeHtml(bruta.label) + ' · ' + fmtMoeda(bruta.valor) + '</div></div>';
  h += '<div class="pb-lin"><span>' + escapeHtml((d.partes.filter(function(p){ return p.pagador; })[0] || { nome: 'Pagador' }).nome) + ' recebeu do cliente</span><b>' + (cli ? 'sim · ' + fmtData(cli.data) : 'ainda não') + '</b></div>';
  h += d.partes.map(function(p){
    var L = p.oab ? pdLivro(chave, p.oab) : null, v = r2(bruta.valor * (Number(p.pct) || 0) / 100);
    if (p.pagador) return '<div class="pb-lin"><span>' + escapeHtml(p.nome || p.oab) + ' · ' + rcFmtPct(p.pct) + ' <small>(fica com a parte dele)</small></span><b>' + fmtMoeda(v) + '</b></div>';
    return '<div class="pb-lin"><span>' + escapeHtml(p.nome || p.oab) + ' · ' + rcFmtPct(p.pct) + '</span><b>' + fmtMoeda(v) + '</b>' + (p.oab ? ' <button type="button" class="es-lk" data-pd-por="' + escapeHtml(chave + '|' + p.oab) + '">' + (L && L.pago ? 'recebeu ✓ ' + fmtData(L.dataRecebimento) + ' (desfazer)' : 'marcar como recebido') + '</button>' : ' <small>sem cadastro</small>') + '</div>';
  }).join('');
  el.innerHTML = h;
}
function pdPainelAlternar(chave, oab){
  var bruta = pdUnidadesBrutas().filter(function(x){ return x.chave === chave; })[0]; if (!bruta) return;
  var L = pdLivro(chave, oab), tinha = !!(L && L.pago);
  pdGravarLivro(Object.assign({}, bruta, { valor: bruta.valor }), oab, tinha ? { pago: false, parciais: [] } : { pago: true, data: todayISO(), parciais: L && L.parciais || [] }).then(function(){ pdDesenharPainel(); pdAgendarReconciliar(); try{ renderTudo(); }catch(e){} }).catch(function(e){ toast('Não consegui salvar: ' + (e && e.message || e)); });
}
(function(){
  var st = document.createElement('style');
  st.textContent = '.pd-chip{display:inline;margin-left:4px}.pd-chip .es-lk{margin-left:4px}.papel-estagiario .pd-chip{display:none}';
  document.head.appendChild(st);
  var t = null; try{ new MutationObserver(function(){ clearTimeout(t); t = setTimeout(function(){ try{ pdDecorar(); }catch(e){ console.error(e); } }, 120); }).observe(document.body, { childList: true, subtree: true }); }catch(e){}
  window.addEventListener('horus-eu', function(){ pdCarregar(); });
  if (window.__horusEu && window.__horusEu.pronto) pdCarregar();
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { pdS: pdS, pdCarregar: pdCarregar, pdReconciliar: pdReconciliar, pdUnidadesBrutas: pdUnidadesBrutas, pdDecorar: pdDecorar, pdMarcarCliente: pdMarcarCliente, pdPagar: pdPagar, pdUnidade: pdUnidade, pdVista: pdVista, ppHonorariosMeus: function(){ return ppHonorariosMeus(); }, pagarUnidades: function(l, d){ return pagarUnidades(l, d); }, listarUnidades: function(){ return listarUnidades(); }, abrirRelMurilo: function(m, modo){ return abrirRelMurilo(m, modo); }, coletarCobranca: function(m, modo){ return coletarCobranca(m, modo, ''); } });
})();
