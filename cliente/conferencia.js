/* ============================================================
   CONFERIR COM O EXTRATO (prefixo cx) — o caminho de VOLTA da leitura de extratos.
   Na tela "Conferir extratos" o app já vai do extrato para o app (linhas já lançadas, prontas, para decidir). Aqui acrescenta-se o contrário, só com o que já foi lido:
   o que está LANÇADO NO APP e não aparece no extrato do período, a data que não bate e o que o saldo mostra.
   Camadas (cada linha do banco casa com UM lançamento só):
     1. mesmo valor e tipo, até 3 dias, com a mesma data ou nome parecido  → "bate" (se a data difere: "Usar a data do extrato")
     2. mesmo valor, de 4 dias até o fim da JANELA (3, 7, 15 ou 30 dias)    → "possível correspondência" (você escolhe "É este" ou "Não é")
     3. valor quase igual (até R$ 1,00: o banco aplica só os reais inteiros) → sugestão
     4. um lançamento do app = soma de 2 ou 3 linhas do banco                → sugestão de agrupamento
     5. nada disso                                                           → "só no app"
   Só propõe: nunca corrige sozinho (confirmação e "Desfazer"). Dispensar vale nos dois aparelhos (o mesmo armazenamento da Saúde dos dados).
   Só confere extratos lidos DEPOIS desta função (o arquivo passa a guardar todas as linhas do extrato, não só as novas).
   ============================================================ */
var CX_JANELAS = [3, 7, 15, 30];
var cxS = { janela: 3, ult: null };

function cxNomeOk(txt, nomeApp){ if (!txt || !nomeApp) return true; return extOverlap(extTokens(txt), extTokens(nomeApp)) >= 1; }
/* linhas: [{ d, v (centavos, com sinal), t }]; movs: [{ data, valor (centavos), tipo, nome, src }]; W: janela em dias (mínimo 3) */
function cxCasar(linhas, movs, W){
  W = Math.max(3, Number(W) || 3);
  var L = linhas.map(function(l, i){ return { i: i, d: l.d, abs: Math.abs(l.v), tipo: l.v < 0 ? 'saida' : 'entrada', t: l.t || '', usada: false }; });
  var M = movs.map(function(m, i){ return { i: i, m: m, feito: false }; }).sort(function(a, b){ return a.m.data < b.m.data ? -1 : (a.m.data > b.m.data ? 1 : a.i - b.i); });
  var out = { bate: [], possivel: [], proximo: [], agrupado: [], so: [], soExtrato: 0 };
  function melhor(m, ok){ var b = null, bd = 1e9; L.forEach(function(l){ if (l.usada || l.tipo !== m.tipo) return; var d = extDiasEntre(l.d, m.data); if (ok(l, d) && d < bd){ b = l; bd = d; } }); return b ? { l: b, d: bd } : null; }
  M.forEach(function(x){   /* 1) mesmo valor, até 3 dias, mesma data ou nome parecido */
    var m = x.m, r = melhor(m, function(l, d){ return l.abs === m.valor && d <= 3 && (d === 0 || cxNomeOk(l.t, m.nome)); });
    if (r){ r.l.usada = true; x.feito = true; out.bate.push({ m: m, l: r.l, dias: r.d }); }
  });
  M.forEach(function(x){   /* 2) mesmo valor, até o fim da janela (ou até 3 dias com nome diferente) */
    if (x.feito) return; var m = x.m, r = melhor(m, function(l, d){ return l.abs === m.valor && d <= W; });
    if (r){ r.l.usada = true; x.feito = true; out.possivel.push({ m: m, l: r.l, dias: r.d, nomeDif: r.d <= 3 }); }
  });
  M.forEach(function(x){   /* 3) valor quase igual (até R$ 1,00) */
    if (x.feito) return; var m = x.m, b = null, bk = 1e12;
    L.forEach(function(l){ if (l.usada || l.tipo !== m.tipo) return; var df = Math.abs(l.abs - m.valor), d = extDiasEntre(l.d, m.data); if (df === 0 || df > 100 || d > W) return; var k = df * 1000 + d; if (k < bk){ b = l; bk = k; } });
    if (b){ b.usada = true; x.feito = true; out.proximo.push({ m: m, l: b, dias: extDiasEntre(b.d, m.data), dif: b.abs - m.valor }); }
  });
  M.forEach(function(x){   /* 4) um lançamento = soma de 2 ou 3 linhas */
    if (x.feito) return; var m = x.m;
    var c = L.filter(function(l){ return !l.usada && l.tipo === m.tipo && l.abs < m.valor && extDiasEntre(l.d, m.data) <= W; }).sort(function(a, b){ return extDiasEntre(a.d, m.data) - extDiasEntre(b.d, m.data); }).slice(0, 40), achou = null, i, j, k;
    for (i = 0; i < c.length && !achou; i++) for (j = i + 1; j < c.length && !achou; j++){
      if (c[i].abs + c[j].abs === m.valor){ achou = [c[i], c[j]]; break; }
      for (k = j + 1; k < c.length; k++) if (c[i].abs + c[j].abs + c[k].abs === m.valor){ achou = [c[i], c[j], c[k]]; break; }
    }
    if (achou){ achou.forEach(function(l){ l.usada = true; }); x.feito = true; out.agrupado.push({ m: m, ls: achou }); }
  });
  M.forEach(function(x){ if (!x.feito) out.so.push({ m: x.m }); });
  out.linhasSo = L.filter(function(l){ return !l.usada; }).map(function(l){ return { d: l.d, abs: l.abs, tipo: l.tipo, t: l.t }; });   /* linhas do banco sem lançamento no app */
  out.soExtrato = out.linhasSo.length;
  return out;
}

/* ---------- o que entra na conta: os extratos pendentes (com todas as linhas), por coluna (PJ / PF) ---------- */
function cxEntradas(){
  var cfg = extCfg(), porCol = {};
  extPendentes().forEach(function(doc){
    if (extContaObra(doc.chave)) return;
    var col = extColunaConta(doc.chave, doc.tipoConta), g = porCol[col] = porCol[col] || { col: col, docs: [], linhas: [], antigos: [], de: '', ate: '' };
    g.docs.push(doc);
    if (!Array.isArray(doc.todas)){ g.antigos.push(doc); return; }
    doc.todas.forEach(function(a){ g.linhas.push({ d: a[0], v: a[1], t: a[2] || '', chave: doc.chave }); });
    var de = doc.de || (doc.todas.length ? doc.todas.reduce(function(m, a){ return a[0] < m ? a[0] : m; }, '9999') : ''), ate = doc.ate || (doc.todas.length ? doc.todas.reduce(function(m, a){ return a[0] > m ? a[0] : m; }, '') : '');
    if (de && (!g.de || de < g.de)) g.de = de; if (ate && (!g.ate || ate > g.ate)) g.ate = ate;
  });
  Object.keys(porCol).forEach(function(col){
    var g = porCol[col], lidas = {}; g.docs.forEach(function(d){ lidas[d.chave] = 1; });
    g.faltam = Object.keys(cfg.contas).filter(function(k){ return !extContaObra(k) && extColunaConta(k) === col && !lidas[k]; }).map(function(k){ return extRotuloConta(k); });
  });
  return porCol;
}
function cxChaveMov(m){ var s = m.src; return 'cx|' + (s ? s.k + ':' + s.id + ':' + (s.mes || '') + ':' + (s.mov || '') : 'x:' + sdSig(m.nome || '')) + '|' + m.data + '|' + m.valor; }
function cxCalcular(){
  var ent = cxEntradas(), res = [], disp = (typeof sdDispLer === 'function') ? sdDispLer() : {};
  Object.keys(ent).forEach(function(col){
    var g = ent[col]; if (!g.linhas.length || !g.de || !g.ate){ res.push({ col: col, g: g, vazio: true }); return; }
    var movs = extMovsApp(col).filter(function(m){ return m.data >= g.de && m.data <= g.ate; }), r = cxCasar(g.linhas, movs, cxS.janela);
    var oculta = function(m){ return disp[cxChaveMov(m)] === m.data + '|' + m.valor; };
    r.soVis = r.so.filter(function(x){ return !oculta(x.m); }); r.possivelVis = r.possivel.filter(function(x){ return !oculta(x.m); });
    r.dataDif = r.bate.filter(function(x){ return x.dias > 0 && !oculta(x.m); });
    r.ocultos = r.so.length - r.soVis.length + r.possivel.length - r.possivelVis.length + r.bate.filter(function(x){ return x.dias > 0 && oculta(x.m); }).length;
    r.proximoVis = r.proximo.filter(function(x){ return !oculta(x.m); }); r.agrupadoVis = r.agrupado.filter(function(x){ return !oculta(x.m); });
    res.push({ col: col, g: g, r: r, nApp: movs.length });
  });
  cxS.ult = res; return res;
}

/* ---------- tela: o cartão dentro de "Conferir extratos" ---------- */
function cxLinhaTxt(l){ return (l.t || 'linha do extrato'); }
function cxQuando(m, l){ var d = extDiasEntre(l.d, m.data); return 'app ' + fmtData(m.data) + ' · extrato ' + fmtData(l.d) + (d ? ' (' + d + (d === 1 ? ' dia ' : ' dias ') + (l.d > m.data ? 'depois' : 'antes') + ')' : ''); }
function cxItemHtml(tipo, x, i, gi){
  var m = x.m, tit = escapeHtml(m.nome || 'Lançamento') + ' · ' + extMoeda(m.valor), id = 'data-cxg="' + gi + '" data-cxi="' + i + '" data-cxt="' + tipo + '"', podeData = m.src && (m.src.k === 'rec' || m.src.k === 'meta' || (m.src.k === 'desp' && m.src.campo === 'dataPagamento'));
  var sub = '', acts = '';
  if (tipo === 'so'){ sub = fmtData(m.data) + ' · não há linha igual no extrato' + (cxS.janela > 3 ? ', nem a ' + cxS.janela + ' dias' : ''); acts = '<button type="button" class="btn btn-ghost" data-cx="abrir" ' + id + '>Abrir</button><button type="button" class="btn btn-ghost" data-cx="disp" ' + id + '>Dispensar</button>'; }
  else if (tipo === 'poss'){ sub = cxQuando(m, x.l) + ' · ' + escapeHtml(cxLinhaTxt(x.l)) + (x.nomeDif ? ' · nome diferente' : ''); acts = (podeData ? '<button type="button" class="btn btn-primary" data-cx="data" ' + id + '>É este, usar a data do extrato</button>' : '<button type="button" class="btn btn-ghost" data-cx="abrir" ' + id + '>Abrir</button>') + '<button type="button" class="btn btn-ghost" data-cx="disp" ' + id + '>Não é</button>'; }
  else if (tipo === 'dif'){ sub = cxQuando(m, x.l); acts = (podeData ? '<button type="button" class="btn btn-primary" data-cx="data" ' + id + '>Usar a data do extrato</button>' : '<button type="button" class="btn btn-ghost" data-cx="abrir" ' + id + '>Abrir</button>') + '<button type="button" class="btn btn-ghost" data-cx="disp" ' + id + '>Dispensar</button>'; }
  else if (tipo === 'prox'){ sub = cxQuando(m, x.l) + ' · valor do extrato ' + extMoeda(x.l.abs) + ' (' + (x.dif > 0 ? '+' : '−') + extMoeda(Math.abs(x.dif)) + ', arredondamento do banco?)'; acts = '<button type="button" class="btn btn-ghost" data-cx="abrir" ' + id + '>Abrir</button><button type="button" class="btn btn-ghost" data-cx="disp" ' + id + '>Dispensar</button>'; }
  else { sub = 'igual à soma de ' + x.ls.length + ' linhas do extrato: ' + x.ls.map(function(l){ return extMoeda(l.abs) + ' (' + fmtData(l.d) + ')'; }).join(' + '); acts = '<button type="button" class="btn btn-ghost" data-cx="abrir" ' + id + '>Abrir</button><button type="button" class="btn btn-ghost" data-cx="disp" ' + id + '>Dispensar</button>'; }
  return '<div class="cx-it"><div class="cx-itt"><b>' + tit + '</b><small>' + sub + '</small></div><div class="cx-acts">' + acts + '</div></div>';
}
function cxHtml(){
  var res = cxCalcular(); if (!res.length) return '';
  var h = '';
  res.forEach(function(x, gi){
    var nome = x.col === 'pj' ? ppNomePj() : (ppFamiliar() ? 'Conta pessoal' : 'PF'), g = x.g;
    h += '<div class="ext-arq cx-box"><b>Conferência com o app · ' + escapeHtml(nome) + '</b>' + (g.de ? '<span class="saldo-data"> ' + escapeHtml(fmtData(g.de)) + ' a ' + escapeHtml(fmtData(g.ate)) + '</span>' : '');
    if (x.vazio){ h += '<div class="saldo-data">' + (g.antigos.length ? 'Este extrato foi lido antes desta função. Leia-o de novo (o arquivo do Drive ou o PDF) para conferir o que está no app e não está no extrato.' : 'Sem linhas para conferir.') + '</div></div>'; return; }
    var r = x.r;
    h += '<div class="ext-filtros cx-jan"><span class="saldo-data">Janela de datas:</span>' + CX_JANELAS.map(function(j){ return '<button type="button" class="seg-btn' + (cxS.janela === j ? ' active' : '') + '" data-cx="janela" data-v="' + j + '">' + j + ' dias</button>'; }).join('') + '</div>';
    h += '<div class="ext-chips"><span class="ext-chip">' + r.bate.length + ' batem</span>' + (r.dataDif.length ? '<span class="ext-chip">' + r.dataDif.length + ' com data diferente</span>' : '') + (r.possivelVis.length ? '<span class="ext-chip cx-am">' + r.possivelVis.length + ' possível(is) correspondência(s)</span>' : '') + (r.proximoVis.length ? '<span class="ext-chip">' + r.proximoVis.length + ' valor quase igual</span>' : '') + (r.agrupadoVis.length ? '<span class="ext-chip">' + r.agrupadoVis.length + ' agrupado(s)</span>' : '') + '<span class="ext-chip' + (r.soVis.length ? ' cx-ver' : '') + '">' + r.soVis.length + ' só no app</span></div>';
    if (g.antigos.length) h += '<div class="saldo-data" style="color:var(--danger)">Há extrato(s) lido(s) antes desta função nesta conta (' + g.antigos.map(function(d){ return escapeHtml(extRotuloConta(d.chave)); }).join(', ') + '): releia-o(s) para a conferência ficar completa.</div>';
    if (g.faltam.length) h += '<div class="cx-aviso"><b>Atenção:</b> esta conta tem outras contas que ainda não foram lidas (' + escapeHtml(g.faltam.join(' e ')) + '). Os “só no app” podem estar nelas: <b>não conferido</b>.</div>';
    function sec(tit, tipo, lista){ if (!lista.length) return ''; var t = '<div class="ext-grupo-tit">' + tit + ' (' + lista.length + ')</div>'; lista.slice(0, 25).forEach(function(it){ t += cxItemHtml(tipo, it, (tipo === 'so' ? r.so : (tipo === 'poss' ? r.possivel : (tipo === 'dif' ? r.bate : (tipo === 'prox' ? r.proximo : r.agrupado)))).indexOf(it), gi); }); return t + (lista.length > 25 ? '<div class="saldo-data">+ ' + (lista.length - 25) + ' itens: ajuste a janela ou resolva estes primeiro.</div>' : ''); }
    h += sec('Só no app', 'so', r.soVis) + sec('Possível correspondência', 'poss', r.possivelVis) + sec('Data diferente', 'dif', r.dataDif) + sec('Valor quase igual', 'prox', r.proximoVis) + sec('Soma de linhas do extrato', 'agr', r.agrupadoVis);
    if (!r.soVis.length && !r.possivelVis.length && !r.dataDif.length && !r.proximoVis.length && !r.agrupadoVis.length) h += '<div class="saldo-data" style="color:#17895A;font-weight:700">Tudo o que está no app neste período aparece no extrato.</div>';
    if (r.ocultos) h += '<div class="saldo-data">' + r.ocultos + ' item(ns) dispensado(s): voltam se o dado mudar.</div>';
    h += '</div>';
  });
  return h;
}
function cxInserir(){
  var corpo = qs('extCorpo'); if (!corpo || !extRev) return;
  var velho = qs('cxBox'); if (velho) velho.remove();
  var f = corpo.querySelector('.ext-filtros:not(.cx-jan)');
  var h = ''; try{ h = cxHtml(); }catch(e){ console.error('conferência com o extrato', e); }
  if (!h) return;
  var box = document.createElement('div'); box.id = 'cxBox'; box.innerHTML = h;
  if (f) f.parentNode.insertBefore(box, f); else corpo.appendChild(box);
}
function cxAcharItem(b){
  var gi = Number(b.getAttribute('data-cxg')), i = Number(b.getAttribute('data-cxi')), t = b.getAttribute('data-cxt'), x = cxS.ult && cxS.ult[gi]; if (!x || !x.r) return null;
  var lista = t === 'so' ? x.r.so : (t === 'poss' ? x.r.possivel : (t === 'dif' ? x.r.bate : (t === 'prox' ? x.r.proximo : x.r.agrupado)));
  return lista[i] ? { it: lista[i], t: t } : null;
}
/* corrige a data do lançamento no app para a do extrato (só onde há UM campo de data: receita, aporte/retirada de meta e despesa paga) */
function cxAplicarData(m, nova){
  var s = m.src, antes = m.data; if (!s) return Promise.reject(new Error('Este lançamento não tem origem conhecida.'));
  if (s.k === 'rec'){
    var r = receitasManuais.filter(function(x){ return x.id === s.id; })[0]; if (!r) return Promise.reject(new Error('Receita não encontrada.'));
    if (s.mes){ var rec = JSON.parse(JSON.stringify(r.recebimentos || {})); if (!rec[s.mes]) return Promise.reject(new Error('Recebimento não encontrado.')); rec[s.mes].data = nova; return persistPatchReceita(r, { recebimentos: rec }).then(function(){ return function(){ rec[s.mes].data = antes; return persistPatchReceita(r, { recebimentos: rec }); }; }); }
    var patch = { data: nova }; if (r.mesReferencia && r.mesReferencia === String(r.data || '').slice(0, 7)) patch.mesReferencia = nova.slice(0, 7);
    var ant = { data: r.data, mesReferencia: r.mesReferencia }; return persistPatchReceita(r, patch).then(function(){ return function(){ return persistPatchReceita(r, ant); }; });
  }
  if (s.k === 'meta'){
    var mt = metas.filter(function(x){ return x.id === s.id; })[0]; if (!mt) return Promise.reject(new Error('Meta não encontrada.'));
    var mv = (mt.movimentos || []).map(function(x){ return x.id === s.mov ? Object.assign({}, x, { dia: nova }) : x; }), mv0 = (mt.movimentos || []).slice();
    return persistPatchMeta(mt, { movimentos: mv }).then(function(){ return function(){ return persistPatchMeta(mt, { movimentos: mv0 }); }; });
  }
  if (s.k === 'desp' && s.campo === 'dataPagamento'){
    var d = despesas.filter(function(x){ return x.id === s.id; })[0]; if (!d) return Promise.reject(new Error('Despesa não encontrada.'));
    if (s.mes){ var pg = JSON.parse(JSON.stringify(d.pagamentos || {})), pg0 = JSON.parse(JSON.stringify(d.pagamentos || {})); if (!pg[s.mes]) return Promise.reject(new Error('Pagamento não encontrado.')); pg[s.mes].dataPagamento = nova; return persistPatchDespesa(d, { pagamentos: pg }).then(function(){ return function(){ return persistPatchDespesa(d, { pagamentos: pg0 }); }; }); }
    var ad = d.dataPagamento; return persistPatchDespesa(d, { dataPagamento: nova }).then(function(){ return function(){ return persistPatchDespesa(d, { dataPagamento: ad }); }; });
  }
  return Promise.reject(new Error('Corrija a data pelo cadastro (Abrir).'));
}
function cxAbrir(m){
  var s = m.src; if (!s){ toast('Abra este lançamento pela aba Financeiro.'); return; }
  try{
    if (s.k === 'desp') abrirEdicaoDespesa(s.id); else if (s.k === 'rec') abrirEdicaoReceita(s.id);
    else if (s.k === 'meta'){ toast('Aporte ou retirada da meta “' + (m.nome || '') + '”: veja em Patrimônio e metas.'); return; }
    else { toast('Abra este lançamento pela aba Financeiro.'); return; }
  }catch(e){ console.error(e); return; }
  document.querySelectorAll('.overlay.show').forEach(function(o){ if (o.id !== 'overlayExt') o.style.zIndex = '300'; });   /* a ficha abre por cima da conferência */
}
function cxClique(a, b){
  if (a === 'janela'){ cxS.janela = Number(b.getAttribute('data-v')) || 3; cxInserir(); return; }
  var x = cxAcharItem(b); if (!x) return; var m = x.it.m;
  if (a === 'abrir') cxAbrir(m);
  else if (a === 'disp'){ var chave = cxChaveMov(m), antes = sdDispLer()[chave]; sdDispSet(chave, m.data + '|' + m.valor); cxInserir(); toast('Item dispensado. Ele volta se o dado mudar.', 'Desfazer', function(){ if (antes === undefined) sdDispDel(chave); else sdDispSet(chave, antes); cxInserir(); }); }
  else if (a === 'data'){
    var nova = (x.it.l || {}).d; if (!nova) return; b.disabled = true;
    cxAplicarData(m, nova).then(function(desfazer){
      toast('Data corrigida para ' + fmtData(nova) + '.', 'Desfazer', function(){ desfazer().then(function(){ cxInserir(); }).catch(function(e){ toast('Não consegui desfazer: ' + e.message); }); });
      cxInserir();
    }).catch(function(e){ b.disabled = false; toast(e && e.message ? e.message : 'Não consegui corrigir a data.'); });
  }
}
document.addEventListener('click', function(e){ var b = e.target.closest ? e.target.closest('[data-cx]') : null; if (!b || b.disabled) return; if (!b.closest('#overlayExt')) return; e.preventDefault(); cxClique(b.getAttribute('data-cx'), b); });
(function(){
  var st = document.createElement('style');
  st.textContent = '.cx-box{margin-top:10px;border:2px dashed #17895A}.cx-jan{margin:6px 0}.cx-it{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;border-top:1px solid var(--border);padding:8px 0}.cx-itt{flex:1 1 200px;min-width:0}.cx-itt b{display:block;overflow-wrap:anywhere}.cx-itt small{display:block;color:var(--ink-soft);font-size:var(--t1);overflow-wrap:anywhere}.cx-acts{display:flex;gap:6px;flex-wrap:wrap;margin-left:auto}' +
    '.cx-aviso{background:#FFF7DC;border:1px solid #F0DC9A;border-radius:12px;padding:8px 10px;font-size:var(--t2);margin:8px 0}.cx-am{background:#FFEFC2;color:#7a5200}.cx-ver{background:#FBE3E3;color:#B42323}';
  document.head.appendChild(st);
  var d0 = (typeof extDesenharConferencia === 'function') ? extDesenharConferencia : null;
  if (d0) extDesenharConferencia = function(){ var r = d0.apply(this, arguments); try{ cxInserir(); }catch(e){ console.error('conferência com o extrato', e); } return r; };
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { cxCasar: cxCasar, cxCalcular: cxCalcular, cxChaveMov: cxChaveMov, cxS: cxS, extAbrirConferencia: extAbrirConferencia, cxAplicarData: cxAplicarData });
})();
