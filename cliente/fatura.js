/* ============================================================
   FATURA DO CARTÃO DE CRÉDITO (prefixo fat) — Extratos › aba "Cartão de crédito"
   - CSV ou PDF de fatura (qualquer banco) lido pelo leitor geral; aqui: conferência, categorias com ícone, confirmação e as sub-abas de Extratos;
   - cada fatura confirmada vira documentos "diaadia" (um por mês de competência) com origem "cartao": as Análises e o Orçamento já somam com o dia a dia da conta,
     e o filtro Tudo / Só conta / Só cartão separa quando a pessoa quiser;
   - a compra entra pela data da compra; parcela que não é a primeira cai no mês em que a fatura fecha; mostra o que falta das parcelas;
   - o vencimento vem do campo "Vencimento" do documento; se não houver, o app pergunta (nunca pelo nome do arquivo).
   ============================================================ */
var fatS = { aba: 'conta', origem: 'tudo', sel: {}, lembrar: {}, troca: {}, rev: {}, info: '', erro: '' };
function fatM(c){ return fmtMoeda(c / 100); }
function fatOrigemOk(d){ var o = fatS.origem; if (o === 'tudo') return true; return o === 'cartao' ? d.origem === 'cartao' : d.origem !== 'cartao'; }
function fatIc(label, t){ var v = (typeof catVisualDe === 'function') ? catVisualDe(label) : null; return '<span class="cat-ic" style="background:' + (v ? v.cor : '#8A93AD') + '">' + (typeof catSvg === 'function' ? catSvg(v ? v.lu : 'tag', t || 16) : '') + '</span>'; }
function fatFaturas(status){ return extratos.filter(function(d){ return d.tipo === 'documento' && d.kind === 'fatura' && d.status === status; }).sort(function(a, b){ return String(b.lidoEm || '').localeCompare(String(a.lidoEm || '')); }); }
function fatChave(t){ var k = (typeof extChaveRegra === 'function') ? extChaveRegra({ s: t }) : ''; return k || String(t).toLowerCase().slice(0, 20); }
/* categorias do cartão: regras que a pessoa ensinou → catálogo; palavras que enganam (DAS em "Mundo das Utilidades", MORA em nome de pessoa, "Parcela 1/2" ≠ empréstimo) viram "decidir" */
function fatSuspeita(label, it){
  var N = (typeof EX !== 'undefined' ? EX.norm(it.t) : String(it.t).toUpperCase());
  if (/^Empr[ée]stimos/.test(label) && it.parcela) return true;
  if (/^Impostos e taxas/.test(label) && !/DARF|\bDAS\b.*(MEI|SIMPLES)|SIMPLES NACIONAL|\bISS\b|IPTU|IPVA|PREFEIT|RECEITA FED|SEFAZ|DETRAN/.test(N)) return true;
  if (/^Juros, multas e IOF/.test(label) && !/\bIOF\b|JUROS DE MORA|MULTA|ENCARGOS|JUROS/.test(N)) return true;
  return false;
}
function fatCatAuto(it){
  var cfg = (typeof extCfg === 'function') ? extCfg() : { regras: {} };
  var c = (typeof extCategoria === 'function') ? extCategoria({ s: it.t, n: '' }, cfg.regras || {}) : 'Outros';
  var regra = cfg.regras && cfg.regras[fatChave(it.t)];
  if (!regra && fatSuspeita(c, it)) return null;
  return (c && c !== 'Outros') ? c : null;
}
function fatCats(d){
  var x = d.dados, sel = fatS.sel[d.id] || {}, grupos = {}, pend = {}, cats = {};
  x.itens.forEach(function(it, i){
    var k = fatChave(it.t), esc = sel[k], auto = esc || fatCatAuto(it);
    if (auto){ var c = cats[auto] = cats[auto] || { n: 0, v: 0 }; c.n++; c.v += it.v; }
    else { var p = pend[k] = pend[k] || { k: k, t: it.t, n: 0, v: 0, idx: [] }; p.n++; p.v += it.v; p.idx.push(i); }
  });
  return { cats: cats, pend: pend };
}
function fatDespesasCartao(d){
  var x = d.dados, venc = (qs('fat_' + d.id + '_venc') || {}).value || x.vencimento; if (!venc) return [];
  var mes = venc.slice(0, 7), out = [], banco = x.banco ? (typeof EX !== 'undefined' ? EX.norm(x.banco) : '') : '';
  try{ comMes(mes, function(){ getDespesasParaMes(dcmColunaDe(d)).forEach(function(it){ var n = EX.norm(it.despesa.nome); if (/CARTAO|FATURA/.test(n) || (banco && n.indexOf(banco) >= 0)) out.push({ d: it.despesa, mes: mes, v: it.previsto != null ? it.previsto : it.valor, pago: it.pago }); }); }); }catch(e){}
  return out;
}
function fatCard(d){
  var x = d.dados, id = d.id, g = fatCats(d), cats = Object.keys(g.cats).sort(function(a, b){ return g.cats[b].v - g.cats[a].v; }), pends = Object.keys(g.pend).map(function(k){ return g.pend[k]; }).sort(function(a, b){ return b.v - a.v; });
  var nCompras = x.itens.filter(function(i){ return i.v > 0; }).length, venc = x.vencimento || '', soPend = pends.reduce(function(t, p){ return t + p.v; }, 0), nPend = pends.reduce(function(t, p){ return t + p.n; }, 0);
  var h = '<div class="ini-card ext-card" data-fat-card="' + escapeHtml(id) + '"><div class="ext-card-top"><b>Fatura' + (x.banco ? ' · ' + escapeHtml(x.banco) : '') + (x.cartao ? ' · final ' + escapeHtml(x.cartao) : '') + '</b><span class="ext-chip ' + (x.selo === 'verde' ? 'ok' : 'bad') + '">' + (x.selo === 'verde' ? 'soma confere' : 'confira') + '</span></div>' +
    '<div class="fat-kv"><div><b>' + fatM(x.soma) + '</b><span>total lido' + (x.total != null ? ' · fatura ' + fatM(x.total) : '') + '</span></div><div><b>' + nCompras + ' compras</b><span>' + (x.periodo && x.periodo.de ? fmtData(x.periodo.de) + ' a ' + fmtData(x.periodo.ate) : 'período não identificado') + '</span></div></div>' +
    ((x.provas || []).length ? '<div class="saldo-data">' + escapeHtml(x.provas.join('; ')) + '</div>' : '') +
    '<div class="fat-lin2">' + dcmCampo(id, 'venc', 'Vencimento' + (venc ? '' : ' — informe (não achei no documento)'), 'date', venc) + (dcmColunaHtml(d) ? dcmColunaHtml(d) : '') + '</div>' +
    (!venc && x.dicaVencimento ? '<div class="saldo-data">O nome do arquivo tem a data ' + escapeHtml(fmtData(x.dicaVencimento)) + ': confira no aplicativo do banco se é o vencimento antes de usar.</div>' : '');
  h += '<div class="fat-t">Compras por categoria</div>' + cats.map(function(c){ return '<div class="fat-cat">' + fatIc(c) + '<span class="fat-cn">' + escapeHtml(c) + '<small>' + g.cats[c].n + (g.cats[c].n === 1 ? ' lançamento' : ' lançamentos') + '</small></span><b>' + fatM(g.cats[c].v) + '</b></div>'; }).join('');
  if (pends.length){
    h += '<div class="fat-t fat-pt">Sem categoria — escolha (' + nPend + ' lançamentos · ' + fatM(soPend) + ')</div>' + pends.map(function(p){
      return '<div class="fat-cat">' + '<span class="fat-cn">' + escapeHtml(p.t) + '<small>' + p.n + (p.n === 1 ? ' lançamento' : ' lançamentos') + '</small></span><b>' + fatM(p.v) + '</b>' + catSelectHtml('data-fat-cat="' + escapeHtml(id) + '" data-fat-k="' + escapeHtml(p.k) + '"', 'Outros') + '</div>';
    }).join('') + '<label class="fat-lembrar"><input type="checkbox" data-fat-lembrar="' + escapeHtml(id) + '"' + (fatS.lembrar[id] === false ? '' : ' checked') + '> Lembrar essas escolhas para as próximas faturas</label>';
  }
  /* a pessoa pode trocar também a categoria sugerida (a palavra do estabelecimento às vezes engana) */
  var gr = {}; x.itens.forEach(function(it){ var k = fatChave(it.t), c = (fatS.sel[id] || {})[k] || fatCatAuto(it); if (!c) return; var o = gr[k] = gr[k] || { k: k, t: it.t, n: 0, v: 0, c: c }; o.n++; o.v += it.v; });
  var grl = Object.keys(gr).map(function(k){ return gr[k]; }).sort(function(a, b){ return b.v - a.v; });
  if (grl.length) h += '<div class="fat-t">Categorias sugeridas <button type="button" class="btn-text" data-fat="revisar" data-id="' + escapeHtml(id) + '">' + (fatS.rev[id] ? 'Fechar a revisão' : 'Revisar e trocar') + '</button></div>' + (fatS.rev[id] ? grl.map(function(o){ return '<div class="fat-cat"><span class="fat-cn">' + escapeHtml(o.t) + '<small>' + o.n + (o.n === 1 ? ' lançamento' : ' lançamentos') + '</small></span><b>' + fatM(o.v) + '</b>' + catSelectHtml('data-fat-cat="' + escapeHtml(id) + '" data-fat-k="' + escapeHtml(o.k) + '"', o.c) + '</div>'; }).join('') : '');
  var parc = x.itens.filter(function(i){ return i.parcela && i.parcela.m > i.parcela.n; });
  if (parc.length || (x.futuras && x.futuras.lista && x.futuras.lista.length)){
    var falta = parc.reduce(function(t, i){ return t + i.v * (i.parcela.m - i.parcela.n); }, 0);
    h += '<div class="fat-t">Parcelas que ainda faltam</div>' + parc.slice(0, 8).map(function(i){ var k = i.parcela.m - i.parcela.n; return '<div class="fat-lin"><span>' + escapeHtml(i.t) + ' <small>(' + i.parcela.n + '/' + i.parcela.m + ')</small></span><b>falta' + (k > 1 ? 'm ' + k + ' × ' : ' 1 × ') + fatM(i.v) + '</b></div>'; }).join('') +
      '<div class="saldo-data">Comprometido nas próximas faturas: <b>' + fatM(x.futuras && x.futuras.total > 0 ? x.futuras.total : falta) + '</b>' + (parc.length > 8 ? ' (mostrando 8 de ' + parc.length + ' parceladas)' : '') + '</div>';
  }
  if ((x.ignorados || []).length) h += '<div class="saldo-data">Não contam como gasto: ' + x.ignorados.map(function(i){ return escapeHtml(i.t) + ' (' + escapeHtml(i.motivo) + ')'; }).join('; ') + '.</div>';
  var desp = fatDespesasCartao(d);
  if (desp.length) h += '<label class="fat-lembrar"><input type="checkbox" data-fat-troca="' + escapeHtml(id) + '"' + (fatS.troca[id] === false ? '' : ' checked') + '> Trocar a despesa “' + escapeHtml(desp[0].d.nome) + '”' + (desp[0].v != null ? ' (' + fatM(desp[0].v * 100) + ')' : '') + ' pelo detalhe desta fatura <small>(recomendado: não conta duas vezes)</small></label>';
  h += '<div class="ext-acoes"><button type="button" class="btn btn-primary" data-fat="confirmar" data-id="' + escapeHtml(id) + '">Confirmar a fatura</button><button type="button" class="btn-text" data-fat="ignorar" data-id="' + escapeHtml(id) + '">Ignorar</button></div></div>';
  return h;
}
function fatConfirmar(id){
  var d = extDocPorId(id); if (!d) return Promise.resolve();
  var x = d.dados, venc = dcmLer(id, 'venc') || x.vencimento || '';
  if (!venc){ toast('Informe o vencimento da fatura.'); return Promise.resolve(); }
  var coluna = dcmColunaDe(d), sel = fatS.sel[id] || {}, cfg = extCfg(), regras = Object.assign({}, cfg.regras || {}), mudouRegra = false, porMes = {};
  x.itens.forEach(function(it, i){
    var k = fatChave(it.t), esc = sel[k], cat = esc || fatCatAuto(it) || 'Outros';
    if (esc && fatS.lembrar[id] !== false && k){ regras[k] = esc; mudouRegra = true; }
    var mes = it.d.slice(0, 7), doc = porMes[mes] = porMes[mes] || { id: 'dd_' + mes + '_cartao_' + id.replace(/^dcm_/, ''), mes: mes, cats: {}, linhas: [] };
    var v = r2(it.v / 100), c = doc.cats[cat] = doc.cats[cat] || { v: 0, n: 0 }; c.v = r2(c.v + v); c.n++;
    doc.linhas.push({ id: uid(), d: it.d, t: String(it.t).slice(0, 80) + (it.parcela ? ' (' + it.parcela.n + '/' + it.parcela.m + ')' : ''), v: v, c: cat, h: '' });
  });
  var meses = Object.keys(porMes), cadeia = Promise.resolve();
  meses.forEach(function(m){ var o = porMes[m]; cadeia = cadeia.then(function(){ return extGravar(o.id, { tipo: 'diaadia', mes: o.mes, conta: 'cartao:' + id, coluna: coluna, origem: 'cartao', fatura: id, cats: o.cats, linhas: o.linhas, atualizadoEm: new Date().toISOString() }); }); });
  cadeia = cadeia.then(function(){ return mudouRegra ? persistExtCfg({ regras: regras }) : null; });
  var tr = fatS.troca[id] !== false ? fatDespesasCartao(d)[0] : null;
  if (tr && typeof persistPatchDespesa === 'function') cadeia = cadeia.then(function(){ return persistPatchDespesa(tr.d, { faturaMeses: (tr.d.faturaMeses || []).concat([tr.mes]) }); });
  return cadeia.then(function(){ return extGravar(d.id, Object.assign({}, d, { status: 'concluido', concluidoEm: new Date().toISOString(), coluna: coluna, docsDD: meses.map(function(m){ return porMes[m].id; }), dados: Object.assign({}, x, { vencimento: venc }) })); })
    .then(function(){ toast('Fatura lançada: ' + x.itens.length + ' lançamentos em ' + meses.length + (meses.length === 1 ? ' mês' : ' meses') + '.'); renderExtratos(); try{ renderFinanceiro(); }catch(e){} })
    .catch(function(e){ console.error('fatura', e); toast('Não consegui lançar a fatura. Tente de novo.'); });
}
function fatDesfazer(id){
  var d = extDocPorId(id); if (!d) return Promise.resolve();
  var ids = d.docsDD || [], cadeia = Promise.resolve();
  ids.forEach(function(i){ cadeia = cadeia.then(function(){ return extApagar(i); }); });
  return cadeia.then(function(){ return extGravar(d.id, Object.assign({}, d, { status: 'pendente', concluidoEm: null, docsDD: [] })); }).then(function(){ toast('Fatura desfeita: voltou para conferir.'); renderExtratos(); try{ renderFinanceiro(); }catch(e){} });
}
/* aba "Cartão de crédito" */
function fatAbaHtml(){
  var l = fatFaturas('pendente'), ja = fatFaturas('concluido'), h = '';
  h += '<div class="ext-acoes" style="margin:0 0 8px"><button type="button" class="btn btn-primary" data-fat="enviar">Enviar fatura (CSV ou PDF)</button></div>' + (fatS.info ? '<div class="saldo-data" role="status">' + escapeHtml(fatS.info) + '</div>' : '') + (fatS.erro ? '<div class="aviso-sis critico"><span class="as-txt">' + escapeHtml(fatS.erro) + '</span></div>' : '');
  h += '<div class="financeiro-secao-head"><h4>Faturas para conferir' + (l.length ? ' (' + l.length + ')' : '') + '</h4></div>' + (l.length ? l.map(fatCard).join('') : '<div class="financeiro-vazio">Nenhuma fatura esperando. Envie o CSV ou o PDF da fatura em “Enviar documentos” (aba Conta bancária), ou compartilhe do celular.</div>');
  /* compras por categoria do mês escolhido */
  var por = {}, tot = 0, n = 0;
  extratos.forEach(function(d){ if (d.tipo !== 'diaadia' || d.origem !== 'cartao' || d.mes !== mesSelecionado) return; Object.keys(d.cats || {}).forEach(function(k0){ var k = (typeof catNomeNovo === 'function') ? catNomeNovo(k0) : k0, c = d.cats[k0]; por[k] = por[k] || { v: 0, n: 0 }; por[k].v = r2(por[k].v + (Number(c.v) || 0)); por[k].n += c.n || 0; tot += Number(c.v) || 0; n += c.n || 0; }); });
  var ks = Object.keys(por).sort(function(a, b){ return por[b].v - por[a].v; });
  h += '<div class="financeiro-secao-head"><h4>Compras por categoria · ' + escapeHtml(mesLabel(mesSelecionado)) + '</h4></div>' + (ks.length ? '<div class="ini-card">' + ks.map(function(k){ return '<div class="fat-cat">' + fatIc(k) + '<span class="fat-cn">' + escapeHtml(k) + '<small>' + por[k].n + ' lançamentos</small></span><b>' + fmtMoeda(por[k].v) + '</b></div>'; }).join('') + '<div class="fat-lin"><span><b>Total do cartão no mês</b></span><b>' + fmtMoeda(r2(tot)) + '</b></div></div>' : '<div class="financeiro-vazio">Nenhuma compra de cartão lançada neste mês.</div>');
  h += '<div class="financeiro-secao-head"><h4>Faturas lançadas' + (ja.length ? ' (' + ja.length + ')' : '') + '</h4></div>' + (ja.length ? ja.map(function(d){ var x = d.dados; return '<div class="ini-card fat-ja"><div class="fat-lin"><span><b>' + escapeHtml(x.banco || 'Cartão') + (x.cartao ? ' · final ' + escapeHtml(x.cartao) : '') + '</b> <small>vence ' + escapeHtml(fmtData(x.vencimento)) + ' · ' + x.itens.length + ' lançamentos</small></span><b>' + fatM(x.soma) + '</b></div><button type="button" class="btn-text" data-fat="desfazer" data-id="' + escapeHtml(d.id) + '">Desfazer</button></div>'; }).join('') : '<div class="financeiro-vazio">Nenhuma fatura lançada ainda.</div>');
  return h;
}
function fatAbasHtml(){
  var n = fatFaturas('pendente').length;
  return '<div class="fat-abas" id="fatAbas" role="tablist"><button type="button" role="tab" data-fat="aba" data-v="conta" class="' + (fatS.aba === 'conta' ? 'on' : '') + '">Conta bancária</button><button type="button" role="tab" data-fat="aba" data-v="cartao" class="' + (fatS.aba === 'cartao' ? 'on' : '') + '">Cartão de crédito' + (n ? ' <i>' + n + '</i>' : '') + '</button></div>';
}
function fatTemCartao(){ return extratos.some(function(d){ return d.tipo === 'diaadia' && d.origem === 'cartao'; }); }
function fatOrigemSegHtml(){
  if (!fatTemCartao()) return '';
  return '<div class="segmented an-seg2" role="group" aria-label="Origem" style="margin-top:6px">' + [['tudo', 'Tudo'], ['conta', 'Só conta'], ['cartao', 'Só cartão']].map(function(o){ return '<button type="button" data-fat-origem="' + o[0] + '" class="seg-btn' + (fatS.origem === o[0] ? ' active' : '') + '">' + o[1] + '</button>'; }).join('') + '</div>';
}
(function(){
  var st = document.createElement('style');
  st.textContent = '.fat-abas{display:flex;background:var(--surface-2);border-radius:99px;padding:3px;width:fit-content;margin:0 0 10px}.fat-abas button{border:0;background:transparent;padding:8px 18px;min-height:40px;border-radius:99px;font:inherit;font-weight:700;font-size:var(--t2);color:var(--ink-soft);cursor:pointer}.fat-abas button.on{background:#12172A;color:#fff}.fat-abas i{font-style:normal;background:#C98500;color:#fff;border-radius:99px;padding:0 7px;font-size:11px;margin-left:4px}' +
    '.fat-kv{display:flex;gap:26px;flex-wrap:wrap;margin:6px 0 8px}.fat-kv b{display:block;font-size:var(--t5)}.fat-kv span{font-size:var(--t1);color:var(--ink-soft)}.fat-lin2{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:0 12px}' +
    '.fat-t{font-size:var(--t1);font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-soft);margin:14px 0 4px}.fat-pt{color:#8A5A0B}.fat-cat{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--border);flex-wrap:wrap}.fat-cat .cat-ic{flex:none}.fat-cn{flex:1 1 140px;min-width:0;font-weight:600;overflow-wrap:anywhere}.fat-cn small{display:block;color:var(--ink-soft);font-weight:400;font-size:var(--t1)}.fat-cat>b{font-variant-numeric:tabular-nums}.fat-cat .cat-ps{flex:1 1 100%}' +
    '.fat-lin{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-top:1px solid var(--border);font-size:var(--t2)}.fat-lembrar{display:flex;gap:8px;align-items:flex-start;font-size:var(--t2);margin:10px 0 2px}.fat-ja .btn-text{margin-top:2px}' +
    '@media(min-width:700px){.fat-cat .cat-ps{flex:0 0 260px}}';
  document.head.appendChild(st);
  if (typeof dcmHtml === 'function') { var oHtml = dcmHtml; dcmHtml = function(){ return fatS.aba === 'cartao' ? '' : oHtml.apply(this, arguments); }; }
  if (typeof renderExtratos === 'function'){
    var oR = renderExtratos;
    renderExtratos = function(){
      var r = oR.apply(this, arguments);
      try{
        if (activeTab !== 'extratos' || !dcmPode()) return r;
        var wrap = document.querySelector('#bodyExtratos .ext-wrap'); if (!wrap) return r;
        var barra = qs('fatAbas'), nova = fatAbasHtml();
        if (!barra){ wrap.insertAdjacentHTML('afterbegin', nova); } else if (barra.outerHTML !== nova){ barra.outerHTML = nova; }
        var cart = qs('fatCartao'); if (!cart){ cart = document.createElement('div'); cart.id = 'fatCartao'; wrap.appendChild(cart); }
        var isC = fatS.aba === 'cartao';
        ['extTopo', 'extPend', 'extDia', 'extJa', 'extHist'].forEach(function(i){ var e = qs(i); if (e) e.style.display = isC ? 'none' : ''; });
        cart.style.display = isC ? '' : 'none';
        if (isC){ try{ fatS.info = (impEstado && impEstado.info) || ''; fatS.erro = (impEstado && impEstado.erro) || ''; }catch(e){} var h = fatAbaHtml(); if (cart.getAttribute('data-h') !== h){ cart.innerHTML = h; cart.setAttribute('data-h', h); } }
      }catch(e){ console.error('fatura', e); }
      return r;
    };
  }
  document.addEventListener('click', function(ev){
    var og = ev.target.closest ? ev.target.closest('[data-fat-origem]') : null;
    if (og){ fatS.origem = og.getAttribute('data-fat-origem'); try{ renderAnalises(); }catch(e){} try{ renderOrcamento && renderOrcamento(); }catch(e){} return; }
    var b = ev.target.closest ? ev.target.closest('[data-fat]') : null; if (!b) return;
    var a = b.getAttribute('data-fat'), id = b.getAttribute('data-id');
    if (a === 'enviar'){ var f = qs('impArq'); if (f) f.click(); return; }
    if (a === 'aba'){ fatS.aba = b.getAttribute('data-v'); return renderExtratos(); }
    if (a === 'revisar'){ fatS.rev[id] = !fatS.rev[id]; return renderExtratos(); }
    if (a === 'confirmar') return fatConfirmar(id);
    if (a === 'ignorar'){ var d = extDocPorId(id); if (d) return extGravar(d.id, Object.assign({}, d, { status: 'ignorado' })).then(function(){ renderExtratos(); }); }
    if (a === 'desfazer') return fatDesfazer(id);
  });
  document.addEventListener('change', function(ev){
    var t = ev.target; if (!t || !t.getAttribute) return;
    if (t.hasAttribute('data-fat-cat')){ var id = t.getAttribute('data-fat-cat'); (fatS.sel[id] = fatS.sel[id] || {})[t.getAttribute('data-fat-k')] = t.value; return renderExtratos(); }
    if (t.hasAttribute('data-fat-lembrar')) fatS.lembrar[t.getAttribute('data-fat-lembrar')] = t.checked;
    if (t.hasAttribute('data-fat-troca')) fatS.troca[t.getAttribute('data-fat-troca')] = t.checked;
    if (t.id && /^dcm_.+_venc$/.test(t.id)) renderExtratos();   /* mudou o vencimento: refaz a procura da despesa "Cartão" do mês */
  });
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { fatFaturas: fatFaturas, fatS: fatS });
})();
