/* ============================================================
   SUB-ABA "DESPESAS" (prefixo dsp) — Finanças › Despesas (depois da PF; no familiar, depois de "Salário e fixos")
   - o LANÇAMENTO de despesas (lista do mês, "Nova despesa", pagar/editar/pausar/excluir, parceladas) mudou das abas PF/PJ e de "Salário e fixos" para cá:
     o bloco já pronto de cada coluna é MOVIDO para esta aba (os botões continuam ligados) e, no lugar dele, fica uma linha-resumo com "Ver em Despesas";
   - junto das cadastradas, a aba lista o gasto da conta corrente (dia a dia dos extratos) e do cartão (compras das faturas), com selo de origem e edição de nome/categoria;
   - total do gasto do mês = cadastradas (sem a despesa "Fatura <banco>") + conta + cartão (pela data da compra); as faturas a pagar aparecem à parte (caixa).
   ============================================================ */
var dspS = { origem: 'tudo', conta: 'tudo', busca: '' };
function dspCols(){ return ppFamiliar() ? ['pf'] : (dspS.conta === 'pf' ? ['pf'] : (dspS.conta === 'pj' ? ['pj'] : ['pf', 'pj'])); }
function dspNomeCol(c){ return c === 'pj' ? ppNomePj() : (ppFamiliar() ? 'Despesas cadastradas' : 'Pessoa física'); }
function dspTotais(){
  var cad = 0, fat = 0, conta = 0, cartao = 0, cols = dspCols();
  cols.forEach(function(c){
    getDespesasParaMes(c).forEach(function(it){
      if (it.despesa.transferenciaId) return; var v = valorDespesaItem(it); if (!(v > 0.004)) return;
      if (it.despesa.faturaId) fat += v; else cad += v;
    });
  });
  extratos.forEach(function(d){
    if (d.tipo !== 'diaadia' || d.mes !== mesSelecionado || cols.indexOf(d.coluna || 'pf') < 0) return;
    var t = 0; Object.keys(d.cats || {}).forEach(function(k){ t += Number(d.cats[k].v) || 0; });
    if (d.origem === 'cartao') cartao += t; else conta += t;
  });
  return { cad: r2(cad), fat: r2(fat), conta: r2(conta), cartao: r2(cartao) };
}
function dspLinhas(){
  var q = (typeof ctNorm === 'function') ? ctNorm(dspS.busca) : String(dspS.busca || '').toLowerCase(), out = [], cols = dspCols();
  extratos.forEach(function(d){
    if (d.tipo !== 'diaadia' || d.mes !== mesSelecionado || !Array.isArray(d.linhas) || cols.indexOf(d.coluna || 'pf') < 0) return;
    var cartao = d.origem === 'cartao';
    if (dspS.origem === 'conta' && cartao) return; if (dspS.origem === 'cartao' && !cartao) return; if (dspS.origem === 'cad') return;
    d.linhas.forEach(function(l){
      var rot = (typeof catNomeNovo === 'function') ? catNomeNovo(l.c) : l.c;
      if (q && ((typeof ctNorm === 'function' ? ctNorm(l.t + ' ' + rot) : String(l.t + ' ' + rot).toLowerCase()).indexOf(q) < 0)) return;
      out.push({ id: l.id, doc: d.id, t: l.t, d: l.d, v: l.v, rot: rot, cartao: cartao });
    });
  });
  return out.sort(function(a, b){ return String(b.d || '').localeCompare(String(a.d || '')); });
}
function dspTopoHtml(){
  var t = dspTotais(), gasto = r2(t.cad + t.conta + t.cartao), fam = ppFamiliar();
  var chip = function(g, k, rot, atual){ return '<button type="button" class="seg-btn' + (atual === k ? ' active' : '') + '" data-dsp-f="' + g + '" data-v="' + k + '">' + rot + '</button>'; };
  var kv = function(v, rot, cls){ return '<div' + (cls ? ' class="' + cls + '"' : '') + '><b>' + fmtMoeda(v) + '</b><span class="dsp-rot">' + rot + '</span></div>'; };
  return '<div class="financeiro-bloco"><div class="financeiro-secao-head dsp-head"><h4>Despesas · ' + escapeHtml(mesCurto(mesSelecionado)) + '</h4><button type="button" class="btn btn-primary" data-dsp="nova">+ Nova despesa</button></div>' +
    '<div class="dsp-kv">' + kv(gasto, 'gasto no mês (pela data da compra)', 'dsp-kv-total') + kv(t.cad, 'cadastradas') + kv(t.conta, 'conta') + kv(t.cartao, 'cartão') + (t.fat > 0.004 ? kv(t.fat, 'faturas a pagar no mês') : '') + '</div>' +
    '<div class="dsp-grupo"><span class="dsp-rot">Origem</span><div class="segmented">' + chip('origem', 'tudo', 'Tudo', dspS.origem) + chip('origem', 'cad', 'Cadastradas', dspS.origem) + chip('origem', 'conta', 'Conta', dspS.origem) + chip('origem', 'cartao', 'Cartão', dspS.origem) + '</div></div>' +
    (fam ? '' : '<div class="dsp-grupo"><span class="dsp-rot">Conta</span><div class="segmented">' + chip('conta', 'tudo', 'PF e PJ', dspS.conta) + chip('conta', 'pf', 'PF', dspS.conta) + chip('conta', 'pj', 'PJ', dspS.conta) + '</div></div>') +
    '<input type="search" id="dspBusca" class="ct-busca" placeholder="Buscar por nome ou categoria" value="' + escapeHtml(dspS.busca) + '">' +
    (t.fat > 0.004 ? '<div class="saldo-data">A despesa “Fatura …” (' + fmtMoeda(t.fat) + ') <b>não entra no gasto do mês</b>: no lugar dela entram as compras do cartão, pela data da compra. Ela aparece nas cadastradas, pendente até ser paga.</div>' : '') + '</div>';
}
function dspLinhasHtml(){
  if (dspS.origem === 'cad') return '';
  var l = dspLinhas(); if (!l.length) return (dspS.origem === 'conta' || dspS.origem === 'cartao') ? '<div class="financeiro-vazio">Nenhum lançamento neste filtro.</div>' : '';
  return '<div class="financeiro-bloco"><div class="financeiro-secao-head"><h4>Conta e cartão · ' + l.length + ' lançamentos</h4></div>' + l.slice(0, 200).map(function(i){
    return '<div class="ct-ja">' + ctIcone(i.rot) + '<div class="ct-ja-t"><b>' + escapeHtml(i.t || 'Sem nome') + '</b><span class="saldo-data">' + (i.d ? fmtData(i.d) + ' · ' : '') + escapeHtml(i.rot) + ' · <span class="dsp-tag ' + (i.cartao ? 'ct' : 'cc') + '">' + (i.cartao ? 'Cartão' : 'Conta') + '</span></span></div><div class="ct-ja-v">' + fmtMoeda(i.v) + '</div>' +
      '<button type="button" class="ct-ed" data-ct-edit="dd|' + escapeHtml(i.id) + '|' + escapeHtml(i.doc) + '" aria-label="Editar nome e categoria">' + (typeof CT_LAPIS !== 'undefined' ? CT_LAPIS : '✎') + '</button></div>';
  }).join('') + (l.length > 200 ? '<div class="saldo-data">Mostrando 200 de ' + l.length + '. Use a busca.</div>' : '') + '</div>';
}
function dspResumoHtml(col){
  var pago = 0, pend = 0;
  getDespesasParaMes(col).forEach(function(it){ if (it.despesa.transferenciaId) return; var v = valorDespesaItem(it) || 0; if (it.pago) pago += v; else pend += v; });
  return '<div class="financeiro-bloco dsp-resumo"><div class="financeiro-secao-head"><h4>Despesas do mês</h4><button type="button" class="btn-text" data-dsp="ir">Ver em Despesas ›</button></div><div class="financeiro-totais">Pago: <span class="v">' + fmtMoeda(r2(pago)) + '</span> · Pendente: <span class="v">' + fmtMoeda(r2(pend)) + '</span></div><div class="saldo-data">O lançamento e o pagamento das despesas ficam na aba Despesas.</div></div>';
}
function dspAplicar(){
  var corpo = qs('bodyFinanceiro'); if (!corpo) return;
  var sec = document.getElementById('finDespesas');
  if (!sec){
    sec = document.createElement('div'); sec.id = 'finDespesas'; sec.className = 'md-painel'; sec.setAttribute('data-mf', 'dsp');
    sec.innerHTML = '<div id="dspTopo"></div><div id="dspCad_pf"></div><div id="dspCad_pj"></div><div id="dspLin"></div>';
    corpo.insertBefore(sec, qs('finGeral'));
  }
  /* move o bloco de despesas de cada coluna para cá (os botões continuam ligados) e deixa a linha-resumo no lugar */
  ['pf', 'pj'].forEach(function(col){
    var cont = qs(col === 'pf' ? 'colunaFinanceiroPf' : 'colunaFinanceiroPj'), host = document.getElementById('dspCad_' + col); if (!cont || !host) return;
    var bloco = Array.prototype.filter.call(cont.querySelectorAll('.financeiro-bloco'), function(b){ return !!b.querySelector('[data-nova-despesa]'); })[0];
    if (!bloco) return;
    var r = document.createElement('div'); r.innerHTML = dspResumoHtml(col); bloco.parentNode.insertBefore(r.firstChild, bloco);
    host.innerHTML = ''; var tit = document.createElement('div'); tit.className = 'dsp-tit'; tit.textContent = ppFamiliar() ? 'Despesas cadastradas' : (col === 'pj' ? ppNomePj() + ' · despesas cadastradas' : 'Pessoa física · despesas cadastradas'); host.appendChild(tit); host.appendChild(bloco);
  });
  var vis = finTab === 'despesas' && activeTab === 'financeiro'; sec.style.display = vis ? '' : 'none';
  if (!vis) return;
  qs('dspTopo').innerHTML = dspTopoHtml(); qs('dspLin').innerHTML = dspLinhasHtml();
  ['pf', 'pj'].forEach(function(col){ var h = document.getElementById('dspCad_' + col); if (h) h.style.display = (dspS.origem === 'conta' || dspS.origem === 'cartao' || dspCols().indexOf(col) < 0) ? 'none' : ''; });
}
(function(){
  var st = document.createElement('style');
  st.textContent = '.dsp-head{flex-wrap:wrap}.dsp-head h4{white-space:normal!important;flex:1 1 140px;min-width:0}.dsp-head .btn{flex:0 0 auto;white-space:nowrap}' +
    '.dsp-kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(92px,1fr));gap:12px 12px;margin:8px 0 14px}.dsp-kv>div{min-width:0}.dsp-kv b{display:block;font-size:var(--t4);font-variant-numeric:tabular-nums}.dsp-kv-total{grid-column:1/-1}.dsp-kv-total b{font-size:var(--t5)}' +
    '.dsp-rot{display:block;font-size:var(--t1);color:var(--ink-soft);text-transform:uppercase;letter-spacing:.04em}.dsp-grupo{margin:0 0 10px}.dsp-grupo .dsp-rot{margin-bottom:4px}.dsp-grupo .segmented{display:flex;flex-wrap:wrap;gap:6px;max-width:100%}.dsp-grupo .seg-btn{flex:0 0 auto;padding:8px 11px;font-size:var(--t2)}' +
    '.dsp-tit{font-size:var(--t1);font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-soft);margin:14px 4px 6px}' +
    '.dsp-tag{border-radius:99px;padding:1px 8px;font-size:11px;font-weight:700}.dsp-tag.ct{background:#EDE7FB;color:#5b3bb0}.dsp-tag.cc{background:#FBEFD2;color:#8A5A0B}.ct-ja-v{font-weight:700;font-variant-numeric:tabular-nums}#finDespesas .ct-busca{width:100%;box-sizing:border-box}';
  document.head.appendChild(st);
  if (typeof mfAplicar === 'function'){ var oAp = mfAplicar; mfAplicar = function(){ oAp.apply(this, arguments); try{ dspAplicar(); }catch(e){ console.error('despesas', e); } }; }
  document.addEventListener('click', function(ev){
    var f = ev.target.closest ? ev.target.closest('[data-dsp-f]') : null;
    if (f){ dspS[f.getAttribute('data-dsp-f')] = f.getAttribute('data-v'); try{ dspAplicar(); }catch(e){} return; }
    var b = ev.target.closest ? ev.target.closest('[data-dsp]') : null; if (!b) return;
    var a = b.getAttribute('data-dsp');
    if (a === 'ir'){ mfIr('despesas'); return; }
    if (a === 'nova'){ var col = (!ppFamiliar() && dspS.conta === 'pj') ? 'pj' : 'pf', alvo = document.querySelector('#dspCad_' + col + ' [data-nova-despesa]') || document.querySelector('#finDespesas [data-nova-despesa]'); if (alvo) alvo.click(); return; }
  });
  document.addEventListener('input', function(ev){ if (ev.target && ev.target.id === 'dspBusca'){ dspS.busca = ev.target.value; var l = qs('dspLin'); if (l) l.innerHTML = dspLinhasHtml(); } });
})();
