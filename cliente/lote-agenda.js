/* ============================================================
   AÇÕES EM VÁRIOS ITENS DA AGENDA (prefixo lt)
   "Selecionar" (Lista, Semana, Mês e Meu dia): caixinha em cada cartão e uma barra embaixo com as ações:
   Peça pronta, Adiar o trabalho, Responsável, Concluir e Excluir. Tudo vai de uma vez para o servidor (/api/lote: tudo ou nada, até 25 itens),
   com as mesmas permissões e o mesmo registro de ações de uma alteração comum, e tem "Desfazer" para o lote inteiro.
   O prazo fatal NÃO muda em lote (é decisão caso a caso). Itens que a pessoa não pode alterar ficam desabilitados.
   ============================================================ */
var LT_MAX = 25;
var ltS = { on: false, sel: {}, desfazer: null };
function ltPodeAlterar(i){
  if (!i || i.fonte !== 'agenda') return false;
  if (typeof ppDono === 'function' && ppDono()) return true;
  var eu = esS.eu; if (!eu) return true;
  return agMinha(i) || (!!i.processo && eu.papel === 'estagiario');
}
function ltPodeExcluir(){ if (typeof ppDono === 'function' && ppDono()) return true; var e = window.__horusEu; return !!(e && e.permissoes && e.permissoes.excluir); }
function ltItem(k){ return agItens().filter(function(x){ return x.key === k; })[0] || null; }
function ltSelItens(){ return Object.keys(ltS.sel).map(ltItem).filter(function(i){ return !!i && !i.concluido; }); }
function ltAtivar(on){
  ltS.on = !!on; if (!on){ ltS.sel = {}; ltBarraRemover(); } else ltBarraMontar();
  try{ agRender(); }catch(e){}
  ltAtualizar();
}
/* embrulha o cartão: caixinha + toque seleciona (em vez de abrir a ficha) */
function ltEnvolver(i, html){
  if (!ltS.on) return html;
  var pode = ltPodeAlterar(i) && !i.concluido, k = escapeHtml(i.key), on = !!ltS.sel[i.key];
  return '<div class="agsel' + (pode ? '' : ' off') + (on ? ' on' : '') + '" data-k="' + k + '"' + (pode ? '' : ' title="Você não pode alterar este item"') + '><span class="agsel-cb">' + (on ? '✓' : '') + '</span><div class="agsel-c">' + html + '</div></div>';
}
function ltToggle(k){
  var i = ltItem(k); if (!i || !ltPodeAlterar(i) || i.concluido) return;
  if (ltS.sel[k]) delete ltS.sel[k];
  else { if (Object.keys(ltS.sel).length >= LT_MAX){ toast('No máximo ' + LT_MAX + ' itens por vez.'); return; } ltS.sel[k] = 1; }
  var el = document.querySelector('.agsel[data-k="' + (window.CSS && CSS.escape ? CSS.escape(k) : k) + '"]');
  if (el){ el.classList.toggle('on', !!ltS.sel[k]); el.querySelector('.agsel-cb').textContent = ltS.sel[k] ? '✓' : ''; }
  ltAtualizar();
}
function ltTodosVisiveis(){
  var els = Array.prototype.slice.call(document.querySelectorAll('#agCorpo .agsel:not(.off)')); ltS.sel = {};
  els.slice(0, LT_MAX).forEach(function(e){ ltS.sel[e.getAttribute('data-k')] = 1; });
  if (els.length > LT_MAX) toast('Selecionei os ' + LT_MAX + ' primeiros (o máximo por vez).');
  els.forEach(function(e){ var on = !!ltS.sel[e.getAttribute('data-k')]; e.classList.toggle('on', on); e.querySelector('.agsel-cb').textContent = on ? '✓' : ''; });
  ltAtualizar();
}
/* ---------- barra de ações ---------- */
function ltBarraMontar(){
  if (qs('agSelBarra')) return;
  var b = document.createElement('div'); b.id = 'agSelBarra'; document.body.appendChild(b); if (qs('agWrap')) qs('agWrap').classList.add('sel-on');
  b.addEventListener('click', function(e){ var x = e.target.closest ? e.target.closest('[data-lt]') : null; if (x && !x.disabled) ltClique(x.getAttribute('data-lt')); });
}
function ltBarraRemover(){ var b = qs('agSelBarra'); if (b) b.parentNode.removeChild(b); if (qs('agWrap')) qs('agWrap').classList.remove('sel-on'); }
function ltAtualizar(){
  var b = qs('agSelBarra'); if (!b) return;
  var l = ltSelItens(), n = l.length;
  var prz = l.filter(function(i){ return i.tipo === 'prazo' && i.situacao !== 'pronta'; }).length;
  var adi = l.filter(function(i){ return i.tipo === 'tarefa' || (i.tipo === 'prazo' && agTemTrab(i)); }).length;
  var btn = function(a, rot, ok, cl){ return '<button type="button" data-lt="' + a + '" class="' + (cl || '') + '"' + (ok ? '' : ' disabled') + '>' + rot + '</button>'; };
  b.innerHTML = '<div class="n"><b>' + n + (n === 1 ? ' selecionado' : ' selecionados') + '</b> · só o que você pode alterar <span class="lk-r"><button type="button" data-lt="todos">Selecionar todos os visíveis</button> <button type="button" data-lt="sair">Cancelar</button></span></div>' +
    '<div class="ac">' + btn('pronta', '✓ Peça pronta', prz > 0, 'v') + btn('adiar', '⏱ Adiar o trabalho', adi > 0) + btn('resp', '👤 Responsável', n > 0) + btn('concluir', '✔ Concluir', n > 0) + (ltPodeExcluir() ? btn('excluir', '🗑 Excluir', n > 0, 'r') : '') + '</div>';
}
function ltClique(a){
  if (a === 'sair') return ltAtivar(false);
  if (a === 'todos') return ltTodosVisiveis();
  if (!ltSelItens().length) return;
  if (a === 'pronta') return ltPronta();
  ltFolha(a);
}
/* ---------- gravar o lote (tudo ou nada) e desfazer ---------- */
function ltAplicar(trocas, msg, extra){
  /* trocas: [{ i, doc }] gravar  |  [{ i, excluir: true }] */
  if (!trocas.length){ toast('Nada a fazer com estes itens.'); return Promise.resolve(); }
  var antes = trocas.map(function(t){ var a = JSON.parse(JSON.stringify(t.i.doc)); delete a.id; return a; });
  var ops = trocas.map(function(t){ if (t.excluir) return { acao: 'excluir', colecao: 'agenda', id: t.i.id }; var d = JSON.parse(JSON.stringify(t.doc)); delete d.id; return { acao: 'gravar', colecao: 'agenda', id: t.i.id, dados: d }; });
  return pbApi('/api/lote', 'POST', { ops: ops }).then(function(){
    trocas.forEach(function(t){ if (t.excluir) agDocs = agDocs.filter(function(x){ return x.id !== t.i.id; }); else Object.assign(t.i.doc, t.doc); });
    ltS.sel = {}; return (extra ? extra(trocas) : Promise.resolve([])).then(function(criadas){
      agDepois(); ltAtualizar(); try{ agRender(); }catch(e){}
      var u = { antes: antes, trocas: trocas, criadas: criadas || [] };
      toast(msg, 'Desfazer', function(){ ltDesfazer(u); });
    });
  }).catch(function(e){
    if (e && /negad|permiss|Só quem|Você não/i.test(e.message || '')) return ltIndividual(trocas, msg);
    toast('Não consegui aplicar: ' + ((e && e.message) || ''));
  });
}
/* o servidor recusou o lote por causa de algum item: tenta item por item e conta o que passou */
function ltIndividual(trocas, msg){
  var ok = 0, falhou = 0;
  return trocas.reduce(function(p, t){ return p.then(function(){
    var req = t.excluir ? pbApi('/api/db/agenda/' + encodeURIComponent(t.i.id), 'DELETE') : (function(){ var d = JSON.parse(JSON.stringify(t.doc)); delete d.id; return pbApi('/api/db/agenda/' + encodeURIComponent(t.i.id), 'PUT', d); })();
    return req.then(function(){ ok++; if (t.excluir) agDocs = agDocs.filter(function(x){ return x.id !== t.i.id; }); else Object.assign(t.i.doc, t.doc); }).catch(function(){ falhou++; });
  }); }, Promise.resolve()).then(function(){ ltS.sel = {}; agDepois(); ltAtualizar(); try{ agRender(); }catch(e){} toast(ok + (ok === 1 ? ' item atualizado' : ' itens atualizados') + (falhou ? ' · ' + falhou + ' sem permissão' : '') + '.'); });
}
function ltDesfazer(u){
  var criadasIds = (u.criadas || []).map(function(c){ return c.id; });
  var ops = u.trocas.map(function(t, k){ return { acao: 'gravar', colecao: 'agenda', id: t.i.id, dados: u.antes[k] }; }).concat(criadasIds.map(function(id){ return { acao: 'excluir', colecao: 'agenda', id: id }; }));
  pbApi('/api/lote', 'POST', { ops: ops }).then(function(){
    u.trocas.forEach(function(t, k){ var d = Object.assign({}, u.antes[k], { id: t.i.id }); var ex = agDocs.filter(function(x){ return x.id === t.i.id; })[0]; if (ex){ Object.keys(ex).forEach(function(c){ delete ex[c]; }); Object.assign(ex, d); } else agDocs.push(d); });
    agDocs = agDocs.filter(function(x){ return criadasIds.indexOf(x.id) < 0; });
    agDepois(); try{ agRender(); }catch(e){} toast('Voltou ao que era.');
  }).catch(function(e){ toast('Não consegui desfazer: ' + ((e && e.message) || '')); });
}
/* ---------- ações ---------- */
function ltPronta(){
  var l = ltSelItens().filter(function(i){ return i.fonte === 'agenda' && i.tipo === 'prazo' && i.situacao !== 'pronta' && !i.concluido; });
  var nome = esS.eu ? esS.eu.nome : '', hoje = agHoje();
  var pulou = ltSelItens().length - l.length;
  ltAplicar(l.map(function(i){ return { i: i, doc: Object.assign({}, i.doc, { situacao: 'pronta', prontaEm: hoje, prontaPor: nome }) }; }), l.length + (l.length === 1 ? ' peça marcada como pronta' : ' peças marcadas como prontas') + (pulou ? ' · ' + pulou + ' não é prazo ou já estava pronto' : '') + '.');
}
function ltMontarFolha(){
  if (qs('overlayLt')) return;
  var d = document.createElement('div'); d.className = 'overlay'; d.id = 'overlayLt';
  d.innerHTML = '<div class="modal"><div class="modal-head"><h2 id="ltTit">Ação em vários itens</h2><button class="icon-btn" id="ltX" type="button" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="modal-body" id="ltC"></div></div>';
  document.body.appendChild(d);
  d.addEventListener('click', function(e){
    if (e.target === d || (e.target.closest && e.target.closest('#ltX'))){ d.classList.remove('show'); return; }
    var b = e.target.closest ? e.target.closest('[data-ltf]') : null; if (!b) return;
    var a = b.getAttribute('data-ltf');
    if (a === 'adiar-rapido') ltAdiarAplicar(b.getAttribute('data-d'));
    else if (a === 'adiar-outro'){ qs('lt_adiar_box').style.display = ''; }
    else if (a === 'adiar-ok'){ var v = qs('lt_adiar_data').value; if (!pzIso(v)){ qs('lt_erro').textContent = 'Escolha o novo dia.'; return; } if (v < agHoje()){ qs('lt_erro').textContent = 'Escolha um dia a partir de hoje.'; return; } ltAdiarAplicar(v); }
    else if (a === 'resp-ok') ltRespAplicar();
    else if (a === 'concluir-ok') ltConcluirAplicar();
    else if (a === 'excluir-ok') ltExcluirAplicar();
  });
}
function ltFolha(a){
  ltMontarFolha(); var l = ltSelItens(), el = qs('ltC'), h = '', n = l.length;
  var tit = { adiar: 'Adiar o trabalho', resp: 'Responsável', concluir: 'Concluir', excluir: 'Excluir' }[a] || 'Ação';
  qs('ltTit').textContent = tit + ' · ' + n + (n === 1 ? ' item' : ' itens');
  if (a === 'adiar'){
    var el0 = l.filter(function(i){ return i.tipo === 'tarefa' || agTemTrab(i); }), rap = agProxUtil(agHoje());
    h = '<div class="parcela-sum">Muda o <b>dia de trabalhar</b> dos prazos e a <b>data</b> das tarefas. O <b>prazo fatal não muda</b> em lote. Prazos que passariam do fatal ficam de fora; audiências e prazos sem dia de trabalhar também.</div>' +
      '<div class="pb-acts" style="flex-direction:column;align-items:stretch"><button type="button" class="btn btn-ghost" data-ltf="adiar-rapido" data-d="' + rap + '">' + (rap === pbSoma(agHoje(), 1) ? 'Amanhã' : 'Próximo dia útil') + ' <small>' + escapeHtml(agAbrevDia(rap)) + '</small></button><button type="button" class="btn btn-ghost" data-ltf="adiar-outro">Escolher outro dia…</button></div>' +
      '<div class="field" id="lt_adiar_box" style="display:none"><label class="field-label" for="lt_adiar_data">Novo dia</label><input type="date" id="lt_adiar_data" value="' + rap + '"><div class="pb-acts"><button type="button" class="btn btn-primary" data-ltf="adiar-ok">Aplicar</button></div></div><div class="form-error" id="lt_erro"></div>' +
      '<div class="saldo-data">' + el0.length + ' de ' + n + ' podem ser adiados.</div>';
  } else if (a === 'resp'){
    var eq = esS.equipeAg || [];
    h = '<div class="parcela-sum">Quem fica com estes compromissos (recebe os avisos e passa a vê-los em “Minha agenda”).</div>' +
      (eq.length ? eq.map(function(p){ return '<label class="ad-it" style="border:0;padding:4px 0"><input type="checkbox" data-ltr="' + escapeHtml(p.oab) + '"><span class="ad-t">' + escapeHtml(p.nome) + '</span></label>'; }).join('') : '<div class="saldo-data">Nenhuma pessoa disponível.</div>') +
      '<div class="segmented" id="ltRespModo" style="margin:8px 0"><button type="button" class="seg-btn active" data-ltm="add" onclick="this.parentNode.querySelectorAll(\'button\').forEach(function(b){b.classList.toggle(\'active\', b===this)}, this)">Acrescentar</button><button type="button" class="seg-btn" data-ltm="subst" onclick="this.parentNode.querySelectorAll(\'button\').forEach(function(b){b.classList.toggle(\'active\', b===this)}, this)">Substituir</button></div>' +
      '<div class="form-error" id="lt_erro"></div><div class="pb-acts"><button type="button" class="btn btn-primary" data-ltf="resp-ok">Aplicar</button></div>';
  } else if (a === 'concluir'){
    var np = l.filter(function(i){ return i.tipo === 'prazo'; }).length;
    h = '<div class="parcela-sum">' + (np ? '<b>' + np + (np === 1 ? ' prazo vira “peça protocolada”' : ' prazos viram “peça protocolada”') + '</b> na data abaixo (a mesma para todos; dá para mudar). ' : '') + 'Tarefas e audiências ficam concluídas / realizadas. Tarefas que se repetem criam a próxima sozinhas.</div>' +
      (np ? '<div class="field"><label class="field-label" for="lt_prot">Data do protocolo</label><input type="date" id="lt_prot" value="' + agHoje() + '"></div>' : '') +
      '<div class="form-error" id="lt_erro"></div><div class="pb-acts"><button type="button" class="btn btn-primary" data-ltf="concluir-ok" style="background:var(--success)">Concluir ' + n + (n === 1 ? ' item' : ' itens') + '</button></div>';
  } else if (a === 'excluir'){
    h = '<div class="pb-aviso agd-perigo">Excluir <b>' + n + (n === 1 ? ' item' : ' itens') + '</b>? Eles vão para a <b>Lixeira</b> (ficam 30 dias) e dá para desfazer logo em seguida.</div><div class="form-error" id="lt_erro"></div><div class="pb-acts"><button type="button" class="btn btn-primary" data-ltf="excluir-ok" style="background:var(--urgente)">Excluir</button></div>';
  }
  el.innerHTML = h; qs('overlayLt').classList.add('show');
}
function ltAdiarAplicar(nd){
  var l = ltSelItens(), hoje = agHoje(), ok = [], pulou = 0;
  l.forEach(function(i){
    if (i.tipo === 'tarefa'){ if (i.data !== nd) ok.push({ i: i, doc: Object.assign({}, i.doc, { data: nd }) }); else pulou++; }
    else if (i.tipo === 'prazo' && agTemTrab(i)){ if (nd > i.data){ pulou++; return; } ok.push({ i: i, doc: Object.assign({}, i.doc, { trabalhar: nd >= i.data ? '' : nd }) }); }
    else pulou++;
  });
  qs('overlayLt').classList.remove('show');
  ltAplicar(ok, 'Adiado para ' + agAbrevDia(nd) + ': ' + ok.length + (ok.length === 1 ? ' item' : ' itens') + (pulou ? ' · ' + pulou + ' ficaram de fora (fatal, audiência ou sem dia de trabalhar)' : '') + '.');
}
function ltRespAplicar(){
  var ks = Array.prototype.slice.call(document.querySelectorAll('#ltC [data-ltr]:checked')).map(function(c){ return c.getAttribute('data-ltr'); });
  if (!ks.length){ qs('lt_erro').textContent = 'Escolha ao menos uma pessoa.'; return; }
  var subst = !!document.querySelector('#ltRespModo [data-ltm="subst"].active'), l = ltSelItens();
  qs('overlayLt').classList.remove('show');
  ltAplicar(l.map(function(i){
    var atual = Array.isArray(i.doc.resp) ? i.doc.resp.slice() : [], novo = subst ? ks.slice() : atual.concat(ks.filter(function(k){ return atual.indexOf(k) < 0; }));
    return { i: i, doc: Object.assign({}, i.doc, { resp: novo }) };
  }), 'Responsável ' + (subst ? 'trocado' : 'acrescentado') + ' em ' + l.length + (l.length === 1 ? ' item' : ' itens') + '.');
}
function ltConcluirAplicar(){
  var l = ltSelItens(), hoje = agHoje(), prot = qs('lt_prot') ? qs('lt_prot').value : hoje, nome = esS.eu ? esS.eu.nome : '';
  if (qs('lt_prot')){ if (!pzIso(prot)){ qs('lt_erro').textContent = 'Escolha a data do protocolo.'; return; } if (prot > hoje){ qs('lt_erro').textContent = 'A data do protocolo não pode ser no futuro.'; return; } }
  qs('overlayLt').classList.remove('show');
  var trocas = l.map(function(i){
    var d = { concluido: true, cancelado: false, situacao: 'feito', concluidoEm: hoje, concluidoPor: nome };
    if (i.tipo === 'prazo'){ d.protocoladoEm = prot; d.protocoloObs = ''; }
    return { i: i, doc: Object.assign({}, i.doc, d) };
  });
  ltAplicar(trocas, l.length + (l.length === 1 ? ' item concluído' : ' itens concluídos') + '.', function(tr){
    var rec = tr.filter(function(t){ return t.i.tipo === 'tarefa' && t.i.doc.repete; });
    return Promise.all(rec.map(function(t){ return rpCriarProxima(t.i).then(function(r){ return r ? r.doc : null; }); })).then(function(l2){ return l2.filter(Boolean); });
  });
}
function ltExcluirAplicar(){
  var l = ltSelItens(); qs('overlayLt').classList.remove('show');
  ltAplicar(l.map(function(i){ return { i: i, excluir: true }; }), l.length + (l.length === 1 ? ' item excluído' : ' itens excluídos') + ' (estão na Lixeira).');
}
(function(){
  /* sair do modo de seleção ao trocar de aba (a barra é fixa na tela) */
  var orig = setActiveTab; setActiveTab = function(t){ if (ltS.on && t !== 'agenda'){ ltS.on = false; ltS.sel = {}; ltBarraRemover(); } return orig.apply(this, arguments); };
  var st = document.createElement('style');
  st.textContent = '.agsel{display:flex;gap:10px;align-items:flex-start}.agsel-cb{flex:none;width:24px;height:24px;border-radius:7px;border:2px solid var(--border);margin-top:14px;background:var(--surface);display:grid;place-items:center;font-size:14px;font-weight:800;color:#fff}.agsel.on .agsel-cb{background:var(--c-gold,#C98500);border-color:var(--c-gold,#C98500)}.agsel-c{flex:1;min-width:0;pointer-events:none}.agsel-c a,.agsel-c button{pointer-events:none}.agsel{cursor:pointer}.agsel.off{opacity:.45;cursor:not-allowed}.agsel.off .agsel-cb{background:var(--surface-2);border-style:dashed}' +
    '#agSelBarra{position:fixed;left:12px;right:12px;bottom:calc(88px + env(safe-area-inset-bottom));z-index:60;background:#0e0e10;color:#fff;border-radius:18px;padding:10px 12px;box-shadow:0 6px 18px rgba(0,0,0,.3);max-width:620px;margin:0 auto}@media(min-width:1000px){#agSelBarra{bottom:20px}}' +
    '#agSelBarra .n{font-size:var(--t2);opacity:.9;margin-bottom:6px;display:flex;flex-wrap:wrap;gap:6px;justify-content:space-between}#agSelBarra .lk-r button{background:none;border:0;color:#f0b83a;font-weight:700;font-family:inherit;font-size:var(--t2);cursor:pointer}' +
    '#agSelBarra .ac{display:flex;gap:6px;flex-wrap:wrap}#agSelBarra .ac button{font-family:inherit;border:0;border-radius:99px;padding:7px 12px;font-size:var(--t2);font-weight:700;background:#2b2b30;color:#fff;cursor:pointer}#agSelBarra .ac button.v{background:var(--success)}#agSelBarra .ac button.r{background:rgba(217,59,59,.9)}#agSelBarra .ac button:disabled{opacity:.35;cursor:default}' +
    '#agWrap.sel-on{padding-bottom:200px}';
  document.head.appendChild(st);
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { ltAtivar: ltAtivar, ltDefinirEquipe: function(l){ esS.equipeAg = l; } });
})();
