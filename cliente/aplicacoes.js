/* ============================================================
   APLICAÇÕES NOS EXTRATOS (prefixo ap) — Conferir com o extrato, etapa 2.
   - Lista de palavras que o app usa para reconhecer, no extrato, quatro tipos de movimento de aplicação:
       automática (o banco guarda e devolve sozinho: "Lim.Garant.", "Invest Fácil"…)  → ignorada: o dinheiro continua seu na conta
       manual (CDB, RDB, RDC, LCI/LCA, Tesouro, renda fixa, fundo, previdência…)     → aporte na reserva (ou só registrada, conforme a conta)
       resgate (volta para a conta)                                                  → retirada da reserva (ou só registrada)
       rendimento (juros pagos pela aplicação)                                       → ignorado (não é receita nem gasto)
     Cada pessoa tem a sua lista (config 'extratos' é por pessoa): as palavras prontas podem ser tiradas e outras podem ser acrescentadas;
     quando a pessoa manda uma linha desconhecida para a reserva, o app aprende as palavras dela.
   - Destino por conta (config extratos.contas[chave].aplicacao): 'reserva' (padrão) ou 'outra' (aplicação que não é a reserva: só fica registrada).
   - Reserva × extrato: compara o total LÍQUIDO (aplicações − resgates) das linhas do banco com os aportes − retiradas lançados na meta de reserva,
     no período do extrato, reaproveitando as camadas e a janela da conferência (cxCasar). Só propõe: lançar o que falta (com Desfazer) e corrigir datas.
   ============================================================ */
var AP_TIPOS = [
  ['auto', 'Aplicação automática', 'O banco guarda e devolve sozinho. O app ignora: o dinheiro continua na sua conta.'],
  ['manual', 'Aplicação manual', 'Você mandou aplicar. Vira aporte na reserva (se a conta for da reserva).'],
  ['resgate', 'Resgate', 'O dinheiro voltou para a conta. Vira retirada da reserva (se a conta for da reserva).'],
  ['rendimento', 'Rendimento', 'Juros pagos pela aplicação. O app ignora (o valor da reserva se atualiza em "Atualizar valor").']
];
var AP_PADRAO = {
  auto: ['APLIC AUTOM', 'APLICACAO AUTOMATICA', 'APLIC AUT', 'LIM GARANT', 'LIMITE GARANTIDO', 'INVEST FACIL', 'RENDE FACIL', 'CONTAMAX', 'CDB DI AUTOMATICO', 'CDB AUTOMATICO', 'CAIXINHA', 'COFRINHO', 'PORQUINHO', 'DINHEIRO GUARDADO', 'RESERVA AUTOMATICA'],
  manual: ['APLICACAO', 'APLIC', 'CDB', 'RDB', 'RDC', 'LCI', 'LCA', 'CRI', 'CRA', 'TESOURO', 'RENDA FIXA', 'FUNDO', 'FUNDOS', 'PREVIDENCIA', 'POUPANCA', 'COE', 'DEBENTURE', 'INVESTIMENTO'],
  resgate: ['RESGATE', 'RESG', 'VENC CDB', 'VENCIMENTO CDB', 'VENCIMENTO RDB', 'VENCIMENTO LCI', 'VENCIMENTO LCA', 'VENCIMENTO TESOURO'],
  rendimento: ['REND PAGO APLIC', 'REND PAGO', 'RENDIMENTO', 'RENDIMENTOS', 'REND LIQ', 'RENT LIQ', 'RENTABILIDADE', 'REMUNERACAO APLIC', 'JUROS CDB', 'JUROS RDC']
};
var apS = { janela: 7 };

/* texto do extrato → " PALAVRAS EM CAIXA ALTA SEM ACENTO E SEM PONTUAÇÃO " */
function apNorm(s){ return ' ' + EX.norm(s).replace(/[^A-Z0-9]+/g, ' ').trim() + ' '; }
function apCfg(){
  var a = (config.extratos || {}).aplicacoes || {}, r = { extras: {}, removidas: {} };
  AP_TIPOS.forEach(function(t){
    r.extras[t[0]] = Array.isArray((a.extras || {})[t[0]]) ? a.extras[t[0]].slice() : [];
    r.removidas[t[0]] = Array.isArray((a.removidas || {})[t[0]]) ? a.removidas[t[0]].slice() : [];
  });
  return r;
}
function apFrases(tipo){
  var c = apCfg(), rem = c.removidas[tipo].map(function(x){ return apNorm(x).trim(); });
  return AP_PADRAO[tipo].filter(function(p){ return rem.indexOf(p) < 0; }).concat(c.extras[tipo]);
}
/* a frase vale no começo de uma palavra; palavras curtas (até 5 letras, como RDC ou CDB) têm de ser a palavra inteira */
function apAcha(t, frases){
  for (var i = 0; i < frases.length; i++){
    var p = apNorm(frases[i]).trim(); if (!p) continue;
    if (t.indexOf(' ' + p + ' ') >= 0) return frases[i];
    if (p.length >= 6 && t.indexOf(' ' + p) >= 0) return frases[i];
  }
  return null;
}
/* devolve { tipo, frase } ou null. v = valor da linha (qualquer unidade, com sinal): saída é aplicação, entrada é resgate ou rendimento */
function apClassificar(texto, v){
  var t = apNorm(texto), f;
  if (v > 0 && (f = apAcha(t, apFrases('rendimento')))) return { tipo: 'rendimento', frase: f };
  if ((f = apAcha(t, apFrases('auto')))) return { tipo: 'auto', frase: f };
  if (v > 0 && (f = apAcha(t, apFrases('resgate')))) return { tipo: 'resgate', frase: f };
  if (v < 0 && (f = apAcha(t, apFrases('manual')))) return { tipo: 'manual', frase: f };
  return null;
}
function apTextoLinha(l){ return String((l && (l.s || '')) || '') + ' ' + String((l && (l.n || '')) || ''); }

/* ---------- destino por conta ---------- */
function apDestino(chave){ var c = extCfg().contas[chave]; return (c && c.aplicacao === 'outra') ? 'outra' : 'reserva'; }
function apSetDestino(chave, val){
  var contas = Object.assign({}, extCfg().contas); contas[chave] = Object.assign({}, contas[chave], { aplicacao: val === 'outra' ? 'outra' : 'reserva' });
  return persistExtCfg({ contas: contas });
}
function apMetaReserva(col){
  var l = (metas || []).filter(function(m){ return m.tipo === 'reserva' && (!col || (m.coluna || 'pf') === col); });
  return l[0] || (metas || []).filter(function(m){ return m.tipo === 'reserva'; })[0] || null;
}

/* ---------- lista da pessoa: acrescentar, tirar, devolver ---------- */
function apGravar(c){ return persistExtCfg({ aplicacoes: { extras: c.extras, removidas: c.removidas } }); }
function apAdicionar(tipo, frase){
  var f = apNorm(frase).trim(); if (f.length < 3) return Promise.resolve(false);
  var c = apCfg(), rem = c.removidas[tipo].map(function(x){ return apNorm(x).trim(); }), i = rem.indexOf(f);
  if (i >= 0){ c.removidas[tipo].splice(i, 1); return apGravar(c).then(function(){ return true; }); }
  if (AP_PADRAO[tipo].indexOf(f) >= 0 || c.extras[tipo].indexOf(f) >= 0) return Promise.resolve(false);
  c.extras[tipo].push(f); return apGravar(c).then(function(){ return true; });
}
function apRemover(tipo, frase){
  var f = apNorm(frase).trim(), c = apCfg(), i = c.extras[tipo].indexOf(f);
  if (i >= 0) c.extras[tipo].splice(i, 1); else if (AP_PADRAO[tipo].indexOf(f) >= 0 && c.removidas[tipo].indexOf(f) < 0) c.removidas[tipo].push(f); else return Promise.resolve(false);
  return apGravar(c).then(function(){ return true; });
}
/* o app aprende: linha que a pessoa mandou para a reserva (ou resgate da reserva) sem o app reconhecer → as primeiras palavras do favorecido entram na lista dela */
function apAprender(feitos){
  var c = apCfg(), mudou = false;
  feitos.forEach(function(v){
    if (v.ap || (v.act !== 'reserva' && v.act !== 'reservaResgate')) return;
    var tipo = v.act === 'reserva' ? 'manual' : 'resgate';
    var p = apNorm(v.l.n || v.l.s).trim().split(' ').filter(function(w){ return w.length > 1 && !/^\d+$/.test(w); }).slice(0, 3).join(' ');
    if (p.length < 4 || apAcha(apNorm(p), apFrases(tipo)) || c.extras[tipo].indexOf(p) >= 0) return;
    c.extras[tipo].push(p); mudou = true;
  });
  return mudou ? { aplicacoes: { extras: c.extras, removidas: c.removidas } } : null;
}

/* ---------- tela: Configurações › "Extratos: aplicações e reserva" ---------- */
function apChip(tipo, frase, padrao, removida){
  return '<span class="ap-chip' + (removida ? ' ap-off' : '') + (padrao ? '' : ' ap-meu') + '"><span>' + escapeHtml(frase.toLowerCase()) + '</span><button type="button" data-ap="' + (removida ? 'volta' : 'tira') + '" data-t="' + tipo + '" data-f="' + escapeHtml(frase) + '" title="' + (removida ? 'Voltar esta palavra' : 'Tirar esta palavra') + '" aria-label="' + (removida ? 'Voltar ' : 'Tirar ') + escapeHtml(frase.toLowerCase()) + '">' + (removida ? '+' : '×') + '</button></span>';
}
function apAbrirConfig(){
  var c = apCfg(), cfg = extCfg(), chaves = Object.keys(cfg.contas).filter(function(k){ return !extContaObra(k); });
  var secoes = AP_TIPOS.map(function(t){
    var tp = t[0], rem = c.removidas[tp].map(function(x){ return apNorm(x).trim(); }), chips = '';
    AP_PADRAO[tp].forEach(function(p){ chips += apChip(tp, p, true, rem.indexOf(p) >= 0); });
    c.extras[tp].forEach(function(p){ chips += apChip(tp, p, false, false); });
    return '<div class="ap-sec"><div class="plano-tit">' + t[1] + '</div><div class="saldo-data">' + t[2] + '</div><div class="ap-chips">' + chips + '</div>' +
      '<div class="ap-novo"><input type="text" class="ext-sel" maxlength="40" placeholder="Acrescentar palavra (ex.: cdb inter)" data-ap-in="' + tp + '" aria-label="Acrescentar palavra de ' + escapeHtml(t[1].toLowerCase()) + '"><button type="button" class="btn btn-ghost" data-ap="add" data-t="' + tp + '">Acrescentar</button></div></div>';
  }).join('');
  var contas = chaves.length ? chaves.map(function(k){
    return '<div class="ap-conta"><span class="ap-ct">' + (typeof excLogo === 'function' ? excLogo(k, 34) : '') + '<b>' + escapeHtml(extRotuloConta(k)) + '</b></span>' +
      extSelectHtml('data-ap-conta="' + escapeHtml(k) + '"', [['reserva', 'Aplicação da reserva de emergência'], ['outra', 'Outra aplicação (não é a reserva)']], apDestino(k)) + '</div>';
  }).join('') : '<div class="financeiro-vazio">Nenhuma conta lida ainda. Depois da primeira leitura de extrato, cada conta aparece aqui.</div>';
  extAbrirGen('Extratos: aplicações e reserva',
    '<div class="exc-aviso">O app reconhece no extrato <b>aplicações, resgates e rendimentos</b> pelas palavras abaixo. <b>A lista é só sua</b>: tire o que não vale para você, acrescente o nome do seu banco e, quando você mandar uma linha desconhecida para a reserva, o app aprende. Nada é lançado sem o seu Confirmar.</div>' +
    '<div class="plano-tit">Onde fica a sua reserva?</div><div class="saldo-data">Em cada conta, diga se a aplicação manual é a sua reserva de emergência (vira aporte e retirada da meta) ou outra aplicação (só fica registrada, sem mexer na reserva).</div><div class="ap-contas">' + contas + '</div>' +
    secoes,
    '<button type="button" class="btn btn-primary" id="extGenCancelar">Fechar</button>', true);
  qs('extGenCancelar').addEventListener('click', extFecharGen);
}

/* ---------- Reserva × extrato ---------- */
/* linhas do banco que são aplicação manual (saída) ou resgate (entrada) nas contas da reserva, por coluna; extratos que se repetem não contam duas vezes */
function apLinhasReserva(){
  var porCol = {}, cont = {};
  extArquivos().forEach(function(doc){
    if (extContaObra(doc.chave) || apDestino(doc.chave) === 'outra') return;
    var col = extColunaConta(doc.chave, doc.tipoConta), g = porCol[col] = porCol[col] || { col: col, linhas: [], de: '', ate: '', antigos: [], contas: {} };
    g.contas[doc.chave] = 1;
    if (!Array.isArray(doc.todas)){ if (doc.status === 'pendente') g.antigos.push(doc); return; }
    var de = doc.de || '', ate = doc.ate || '';
    doc.todas.forEach(function(a){ if (!de || a[0] < de) de = a[0]; if (!ate || a[0] > ate) ate = a[0]; });
    if (de && (!g.de || de < g.de)) g.de = de; if (ate && (!g.ate || ate > g.ate)) g.ate = ate;
    var n = {};
    doc.todas.forEach(function(a){ var k = col + '|' + doc.chave + '|' + a[0] + '|' + a[1] + '|' + a[2]; n[k] = (n[k] || 0) + 1; cont[k] = Math.max(cont[k] || 0, n[k]); (g.chaves = g.chaves || {})[k] = a; });
  });
  Object.keys(porCol).forEach(function(col){
    var g = porCol[col]; g.brutas = 0;
    Object.keys(g.chaves || {}).forEach(function(k){
      var a = g.chaves[k], c = apClassificar(a[2] || '', a[1]);
      if (!c || (c.tipo !== 'manual' && c.tipo !== 'resgate')) return;
      for (var i = 0; i < cont[k]; i++) g.linhas.push({ d: a[0], v: a[1], t: a[2] || '', tipo: c.tipo });
    });
    delete g.chaves;
  });
  return porCol;
}
function apMovsReserva(col, de, ate){
  var out = [];
  (metas || []).forEach(function(m){
    if (m.tipo !== 'reserva' || (m.coluna || 'pf') !== col) return;
    (m.movimentos || []).forEach(function(x){
      if (x.tipo !== 'aporte' && x.tipo !== 'retirada') return;
      var d = String(x.dia || '').slice(0, 10); if (!d || d < de || d > ate) return;
      out.push({ data: d, valor: Math.round(Math.abs(Number(x.valor) || 0) * 100), tipo: x.tipo === 'aporte' ? 'saida' : 'entrada', nome: m.nome || 'Reserva', usado: false, src: { k: 'meta', id: m.id, mov: x.id } });
    });
  });
  return out;
}
function apCalcularReserva(){
  var ent = apLinhasReserva(), res = [];
  Object.keys(ent).forEach(function(col){
    var g = ent[col];
    if (!g.de || !g.ate){ res.push({ col: col, g: g, vazio: true }); return; }
    var movs = apMovsReserva(col, g.de, g.ate), r = cxCasar(g.linhas, movs, apS.janela);
    var banco = 0; g.linhas.forEach(function(l){ banco += -l.v; });
    var app = 0; movs.forEach(function(m){ app += m.tipo === 'saida' ? m.valor : -m.valor; });
    res.push({ col: col, g: g, r: r, banco: banco, app: app, dif: app - banco, nApp: movs.length });
  });
  return res;
}
function apDifTxt(c){ return (c < 0 ? '−' : '') + extMoeda(Math.abs(c)); }
function apReservaHtml(res){
  var h = '<div class="exc-aviso">Compara o <b>total líquido guardado</b> (aplicações menos resgates) das linhas do extrato com os aportes e retiradas lançados na sua reserva, <b>no período dos extratos lidos</b>. O app só propõe: nada muda sem o seu toque, e dá para desfazer.</div>';
  h += '<div class="ext-filtros cx-jan"><span class="saldo-data">Janela de datas:</span>' + CX_JANELAS.map(function(j){ return '<button type="button" class="seg-btn' + (apS.janela === j ? ' active' : '') + '" data-ap="janela" data-v="' + j + '">' + j + ' dias</button>'; }).join('') + '</div>';
  if (!res.length) return h + '<div class="financeiro-vazio">Nenhum extrato com linhas para conferir. Leia o extrato da conta da reserva em Finanças › Extratos (só valem os lidos depois desta função).</div>';
  res.forEach(function(x, gi){
    var nome = x.col === 'pj' ? ppNomePj() : (ppFamiliar() ? 'Conta pessoal' : 'PF'), g = x.g;
    h += '<div class="ext-arq cx-box"><b>Reserva · ' + escapeHtml(nome) + '</b>' + (g.de ? '<span class="saldo-data"> ' + escapeHtml(fmtData(g.de)) + ' a ' + escapeHtml(fmtData(g.ate)) + '</span>' : '');
    if (x.vazio){ h += '<div class="saldo-data">' + (g.antigos.length ? 'Este extrato foi lido antes desta função: leia-o de novo para conferir a reserva.' : 'Sem linhas para conferir.') + '</div></div>'; return; }
    var r = x.r, ok = x.dif === 0;
    h += '<div class="ap-tot"><div><small>Extrato (aplicações − resgates)</small><b>' + apDifTxt(x.banco) + '</b></div><div><small>App (aportes − retiradas)</small><b>' + apDifTxt(x.app) + '</b></div><div><small>Diferença</small><b class="' + (ok ? 'exc-ok' : 'exc-dif') + '">' + (ok ? 'bate' : apDifTxt(x.dif)) + '</b></div></div>';
    if (g.antigos.length) h += '<div class="cx-aviso"><b>Atenção:</b> há extrato(s) lido(s) antes desta função (' + g.antigos.map(function(d){ return escapeHtml(extRotuloConta(d.chave)); }).join(', ') + '): releia para entrar na conta.</div>';
    function item(tit, sub, acts){ return '<div class="cx-it"><div class="cx-itt"><b>' + tit + '</b><small>' + sub + '</small></div><div class="cx-acts">' + acts + '</div></div>'; }
    var ix = 'data-apg="' + gi + '"';
    var sec = '';
    var soApp = r.so, soBanco = r.linhasSo || [], par = r.possivel.concat(r.bate.filter(function(b){ return b.dias > 0; }));
    if (soApp.length){ sec += '<div class="ext-grupo-tit">Só no app (' + soApp.length + ')</div>'; soApp.slice(0, 20).forEach(function(it){ sec += item(escapeHtml(it.m.nome) + ' · ' + extMoeda(it.m.valor), fmtData(it.m.data) + ' · ' + (it.m.tipo === 'saida' ? 'aporte' : 'retirada') + ' sem linha igual no extrato', '<button type="button" class="btn btn-ghost" data-ap="ver" ' + ix + '>Ver na reserva</button>'); }); }
    if (soBanco.length){ sec += '<div class="ext-grupo-tit">Só no extrato (' + soBanco.length + ')</div>'; soBanco.slice(0, 20).forEach(function(l, i){ sec += item(escapeHtml(l.t || 'linha do extrato') + ' · ' + extMoeda(l.abs), fmtData(l.d) + ' · ' + (l.tipo === 'saida' ? 'aplicação' : 'resgate') + ' que não está na reserva do app', '<button type="button" class="btn btn-primary" data-ap="lanca" ' + ix + ' data-i="' + i + '">Lançar ' + (l.tipo === 'saida' ? 'aporte' : 'retirada') + '</button>'); }); }
    if (par.length){ sec += '<div class="ext-grupo-tit">Data diferente (' + par.length + ')</div>'; par.slice(0, 20).forEach(function(it, i){ var d = extDiasEntre(it.l.d, it.m.data); sec += item(escapeHtml(it.m.nome) + ' · ' + extMoeda(it.m.valor), 'app ' + fmtData(it.m.data) + ' · extrato ' + fmtData(it.l.d) + ' (' + d + (d === 1 ? ' dia' : ' dias') + ')', '<button type="button" class="btn btn-primary" data-ap="data" ' + ix + ' data-i="' + i + '">Usar a data do extrato</button>'); }); }
    if (r.proximo.length){ sec += '<div class="ext-grupo-tit">Valor quase igual (' + r.proximo.length + ')</div>'; r.proximo.slice(0, 20).forEach(function(it){ sec += item(escapeHtml(it.m.nome) + ' · ' + extMoeda(it.m.valor), 'extrato ' + extMoeda(it.l.abs) + ' (' + (it.dif > 0 ? '+' : '−') + extMoeda(Math.abs(it.dif)) + ', o banco aplica só os reais inteiros?)', '<button type="button" class="btn btn-ghost" data-ap="ver" ' + ix + '>Ver na reserva</button>'); }); }
    if (r.agrupado.length){ sec += '<div class="ext-grupo-tit">Soma de linhas do extrato (' + r.agrupado.length + ')</div>'; r.agrupado.slice(0, 20).forEach(function(it){ sec += item(escapeHtml(it.m.nome) + ' · ' + extMoeda(it.m.valor), 'igual à soma de ' + it.ls.length + ' linhas: ' + it.ls.map(function(l){ return extMoeda(l.abs); }).join(' + '), '<button type="button" class="btn btn-ghost" data-ap="ver" ' + ix + '>Ver na reserva</button>'); }); }
    h += sec || '<div class="saldo-data" style="color:#17895A;font-weight:700">Tudo o que o extrato mostra de aplicação e resgate está na reserva do app, e o contrário também.</div>';
    h += '</div>';
  });
  h += '<div style="margin-top:12px"><button type="button" class="btn btn-ghost" data-ap="conferida">Marcar a reserva como conferida hoje</button><div class="saldo-data">Isso zera o aviso "reserva sem conferência" da Saúde dos dados.</div></div>';
  return h;
}
function apAbrirReserva(){
  var res = []; try{ res = apCalcularReserva(); }catch(e){ console.error('reserva × extrato', e); }
  window.__apRes = res;
  extAbrirGen('Conferir a reserva com o extrato', apReservaHtml(res), '<button type="button" class="btn btn-primary" id="extGenCancelar">Fechar</button>', true);
  qs('extGenCancelar').addEventListener('click', extFecharGen);
}
function apItemReserva(b){
  var gi = Number(b.getAttribute('data-apg')), i = Number(b.getAttribute('data-i')), x = (window.__apRes || [])[gi]; return x && x.r ? { x: x, i: i } : null;
}
document.addEventListener('click', function(e){
  var b = e.target.closest ? e.target.closest('[data-ap]') : null; if (!b || b.disabled || !b.closest('#overlayExt')) return;
  e.preventDefault();
  var a = b.getAttribute('data-ap'), t = b.getAttribute('data-t'), f = b.getAttribute('data-f');
  if (a === 'tira') apRemover(t, f).then(apAbrirConfig);
  else if (a === 'volta') apAdicionar(t, f).then(apAbrirConfig);
  else if (a === 'add'){ var inp = b.parentNode.querySelector('[data-ap-in]'), v = inp ? inp.value.trim() : ''; if (!v) return; apAdicionar(t, v).then(function(ok){ apAbrirConfig(); if (!ok) toast('Essa palavra já está na lista.'); }); }
  else if (a === 'janela'){ apS.janela = Number(b.getAttribute('data-v')) || 7; apAbrirReserva(); }
  else if (a === 'conferida'){ persistExtCfg({ reservaConferidaEm: todayISO() }).then(function(){ toast('Reserva marcada como conferida hoje.'); }); }
  else if (a === 'ver'){ toast('Veja os aportes e retiradas em Finanças › Patrimônio e metas › Reserva › Histórico.'); }
  else if (a === 'data'){
    var it = apItemReserva(b); if (!it) return;
    var lista = it.x.r.possivel.concat(it.x.r.bate.filter(function(z){ return z.dias > 0; })), par = lista[it.i]; if (!par) return;
    b.disabled = true;
    cxAplicarData(par.m, par.l.d).then(function(desfaz){
      toast('Data corrigida para ' + fmtData(par.l.d) + '.', 'Desfazer', function(){ desfaz().then(apAbrirReserva).catch(function(er){ toast('Não consegui desfazer: ' + er.message); }); });
      apAbrirReserva();
    }).catch(function(er){ b.disabled = false; toast(er && er.message ? er.message : 'Não consegui corrigir a data.'); });
  }
  else if (a === 'lanca'){
    var it2 = apItemReserva(b); if (!it2) return;
    var l = (it2.x.r.linhasSo || [])[it2.i], meta = apMetaReserva(it2.x.col); if (!l) return;
    if (!meta){ toast('Cadastre a meta de reserva antes (Finanças › Patrimônio e metas).'); return; }
    b.disabled = true;
    var valor = r2(l.abs / 100), sinal = l.tipo === 'saida' ? 1 : -1;
    Promise.resolve(adicionarMovimentoMeta(meta, sinal > 0 ? 'aporte' : 'retirada', sinal * valor, l.d, { origemExtrato: true })).then(function(){
      var m3 = apMetaReserva(it2.x.col), mid = m3 && (m3.movimentos || []).slice(-1)[0];
      toast((sinal > 0 ? 'Aporte' : 'Retirada') + ' de ' + fmtMoeda(valor) + ' lançado(a) na reserva.', 'Desfazer', function(){ var m2 = apMetaReserva(it2.x.col); if (mid && m2) Promise.resolve(excluirMovimentoMeta(m2, mid.id)).then(apAbrirReserva); });
      apAbrirReserva();
    }).catch(function(er){ b.disabled = false; toast(er && er.message ? er.message : 'Não consegui lançar.'); });
  }
});
document.addEventListener('change', function(e){
  var s = e.target && e.target.getAttribute ? e.target.getAttribute('data-ap-conta') : null; if (!s || !e.target.closest('#overlayExt')) return;
  apSetDestino(s, e.target.value).then(function(){ toast('Guardado.'); });
});
document.addEventListener('keydown', function(e){
  if (e.key !== 'Enter' || !e.target || !e.target.getAttribute || !e.target.getAttribute('data-ap-in')) return;
  var bt = e.target.parentNode.querySelector('[data-ap="add"]'); if (bt) bt.click();
});
(function(){
  var st = document.createElement('style'); st.id = 'apCss';
  st.textContent = '.ap-sec{margin-top:14px}.ap-chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.ap-chip{display:inline-flex;align-items:center;gap:4px;border-radius:99px;background:var(--surface-2);border:1px solid var(--border);padding:3px 4px 3px 10px;font-size:var(--t2);max-width:100%}' +
    '.ap-chip>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ap-chip.ap-meu{background:rgba(23,137,90,.12);border-color:rgba(23,137,90,.35)}.ap-chip.ap-off{opacity:.55;text-decoration:line-through}' +
    '.ap-chip button{border:0;background:transparent;color:var(--ink-soft);font-size:var(--t4);line-height:1;width:24px;height:24px;border-radius:99px;cursor:pointer}.ap-novo{display:flex;gap:8px;flex-wrap:wrap}.ap-novo .ext-sel{flex:1 1 180px;min-width:0}' +
    '.ap-contas{display:flex;flex-direction:column;gap:8px;margin:8px 0}.ap-conta{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:8px;align-items:center;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:10px 12px}.ap-ct{display:flex;align-items:center;gap:8px;min-width:0}.ap-ct b{overflow:hidden;text-overflow:ellipsis}' +
    '.ap-tot{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:10px 0}.ap-tot>div{background:var(--surface-2);border-radius:12px;padding:8px 10px;display:flex;flex-direction:column;gap:2px}.ap-tot small{color:var(--ink-soft);font-size:var(--t1)}.ap-tot b{font-size:var(--t4)}' +
    '@media(max-width:640px){.ap-conta{grid-template-columns:minmax(0,1fr)}.ap-tot{grid-template-columns:minmax(0,1fr)}}';
  document.head.appendChild(st);
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { apClassificar: apClassificar, apFrases: apFrases, apAbrirConfig: apAbrirConfig, apAbrirReserva: apAbrirReserva, apCalcularReserva: apCalcularReserva, apAdicionar: apAdicionar, apRemover: apRemover, apAprender: apAprender, apDestino: apDestino, extConstruirRevisao: extConstruirRevisao, extAplicarLinha: extAplicarLinha });
})();
