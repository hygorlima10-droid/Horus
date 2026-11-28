/* Revisão de ligações assistida pelo Diário Oficial.
   O Diário traz as partes intimadas ligadas às OABs (é nelas que o app já se baseia para sugerir o cliente). No alto da sub-aba "Revisar" o app mostra uma lista
   para conferir: uma linha por parte (processos da mesma parte juntos), com o nome já arrumado e editável; "Cadastrar e vincular" cria os clientes marcados
   (ou usa o que já existe) e vincula os processos. Só iniciais (segredo de justiça) ficam numa seção própria, com campo de nome. Nada é cadastrado sem confirmar. */
var rvS = { marca: {}, nome: {}, tambem: {}, sig: {}, ocupado: false };

/* número do processo na lista: toque no número abre o cadastro do processo; o botão ao lado copia (o mesmo botão de copiar das publicações) */
function rvNumHtml(num){
  var f = (typeof pbNumCopia === 'function') ? pbNumCopia({ numero: num }) : String(num || '');
  return '<button type="button" class="rv-num" data-rv="abrir" data-n="' + escapeHtml(prNum(num)) + '" title="Abrir o cadastro do processo">' + escapeHtml(f) + '</button>' + ((typeof pbBtnCopiar === 'function') ? pbBtnCopiar({ numero: num }) : '');
}
/* DISPENSAR: o nome sugerido não é cliente nosso (ex.: o banco é a parte contrária). O processo sai da revisão sem vincular ninguém, e dá para desfazer */
function rvDispensar(docs){
  if (!docs.length || rvS.ocupado) return;
  var agora = new Date().toISOString(), antes = docs.map(function(d){ return { d: d, prev: { revisar: d.revisar || '', sugestaoClienteId: d.sugestaoClienteId || '', revisadoEm: d.revisadoEm || '', revisaoDispensada: d.revisaoDispensada || false } }; });
  rvS.ocupado = true; rvBotao();
  return Promise.all(docs.map(function(d){ return impSalvarDoc(d, { revisar: '', sugestaoClienteId: '', revisadoEm: agora, revisaoDispensada: true }); })).then(function(){
    rvS.ocupado = false;
    toast('Sugestão dispensada · ' + docs.length + (docs.length === 1 ? ' processo' : ' processos') + ' sem cliente vinculado.', 'Desfazer', function(){
      Promise.all(antes.map(function(x){ return impSalvarDoc(x.d, x.prev); })).then(function(){ toast('Desfeito: voltou para a revisão.'); try{ prDepois(); }catch(e){} }).catch(function(e){ toast('Não consegui desfazer: ' + e.message); });
    });
    try{ prDepois(); }catch(e){}
  }).catch(function(e){ rvS.ocupado = false; rvBotao(); toast('Não consegui dispensar: ' + e.message); });
}
function rvIniciais(n){ var t = String(n || '').replace(/[.\s]/g, ''); return t.length <= 2 && t.length > 0; }
/* partes intimadas do processo: as do Diário nas publicações dele; sem elas, a parte que o app guardou na importação */
function rvPartesDe(d){
  var nomes = [], vistos = {};
  function add(n){ n = String(n || '').trim(); var k = normNome(n); if (n && !vistos[k]){ vistos[k] = 1; nomes.push(n); } }
  var num = prNum(d.numero), pubs = [];
  try{ pubs = prPubsDe(num); }catch(e){}
  for (var i = 0; i < pubs.length; i++){ var dest = pubs[i].dest || []; if (dest.length){ dest.forEach(function(x){ add(x.n); }); break; } }
  if (d.parteNome){ var k0 = normNome(d.parteNome); nomes = nomes.filter(function(n){ return normNome(n) !== k0; }); nomes.unshift(d.parteNome); vistos[k0] = 1; }
  return nomes;
}
function rvPapel(d, nome){
  var k = normNome(nome);
  if (impNomes(d.reu).some(function(x){ return normNome(x) === k; })) return 'réu';
  if (impNomes(d.autor).some(function(x){ return normNome(x) === k; })) return 'autor';
  return '';
}
/* linhas da lista: { k, nome, docs, extras, existe } e os de só iniciais */
function rvLinhas(){
  var grupos = [], sig = [];
  prDocs.filter(function(d){ return d.revisar && !d.arquivado; }).forEach(function(d){
    var nomes = rvPartesDe(d), prim = nomes[0] || '';
    if (!prim || rvIniciais(prim)){ sig.push(d); return; }
    var g = grupos.filter(function(x){ return normNome(x.nome) === normNome(prim) || cliNivel(x.nome, prim) === 3; })[0];
    if (!g){ g = { k: normNome(prim), nome: prim, docs: [], extras: [] }; grupos.push(g); }
    g.docs.push(d);
    nomes.slice(1).forEach(function(n){
      if (rvIniciais(n) || cliNivel(g.nome, n) === 3 || g.extras.some(function(e){ return normNome(e) === normNome(n); })) return;
      g.extras.push(n);
    });
  });
  grupos.forEach(function(g){
    var m = cliParecidos(g.nome).filter(function(x){ return x.nivel >= 2; })[0];
    g.existe = m ? m.c : null;
    if (rvS.marca[g.k] === undefined) rvS.marca[g.k] = true;   /* já vem marcada: o app só propõe, quem confirma é você */
  });
  grupos.sort(function(a, b){ return b.docs.length - a.docs.length || a.nome.localeCompare(b.nome, 'pt-BR'); });
  return { grupos: grupos, sig: sig };
}
function rvNomeFinal(g){ var n = rvS.nome[g.k]; return String(n === undefined ? cliTitulo(g.nome) : n).replace(/\s+/g, ' ').trim(); }

function rvHtml(){
  var L = rvLinhas(), nProc = L.grupos.reduce(function(t, g){ return t + g.docs.length; }, 0);
  if (!L.grupos.length && !L.sig.length) return '';
  var h = '<div class="rv-box" id="rvBox">';
  if (L.grupos.length){
    h += '<div class="rv-sum"><b>' + L.grupos.length + (L.grupos.length === 1 ? ' cliente reconhecido' : ' clientes reconhecidos') + '</b> em ' + nProc + (nProc === 1 ? ' processo' : ' processos') + '<br><span>Confira os nomes e confirme. Cadastra o cliente e já vincula o(s) processo(s). Se o cliente já existe, só vincula.</span></div>';
    L.grupos.forEach(function(g){
      var papel = rvPapel(g.docs[0], g.nome), nome = rvNomeFinal(g);
      h += '<div class="rv-row"><input type="checkbox" class="rv-ck" data-rv="marca" data-k="' + escapeHtml(g.k) + '"' + (rvS.marca[g.k] ? ' checked' : '') + ' aria-label="Incluir ' + escapeHtml(nome) + '"><div class="rv-c">' +
        '<input type="text" class="rv-in" data-rv="nome" data-k="' + escapeHtml(g.k) + '" value="' + escapeHtml(nome) + '" maxlength="120" aria-label="Nome do cliente">' +
        '<div class="rv-chs">' + (g.existe ? '<span class="pb-tg pz">já existe: ' + escapeHtml(g.existe.nome) + '</span><span class="pb-tg">vincular ao existente</span>' : '<span class="pb-tg ok">cliente novo</span>') +
        '<span class="pb-tg nv">' + (papel ? papel + ' · ' : '') + 'parte intimada</span><span class="pb-tg">' + g.docs.length + (g.docs.length === 1 ? ' processo' : ' processos') + '</span><button type="button" class="btn btn-ghost pb-b rv-dis" data-rv="dispensar" data-k="' + escapeHtml(g.k) + '" title="Não é cliente nosso: tira da lista sem vincular">Dispensar</button></div>' +
        g.docs.map(function(d){ return '<div class="rv-pl">' + rvNumHtml(d.numero) + (d.orgao ? '<span class="rv-mut"> · ' + escapeHtml(d.orgao) + '</span>' : '') + '</div>'; }).join('') +
        g.extras.map(function(n, i){ return '<label class="rv-tb"><input type="checkbox" data-rv="tambem" data-k="' + escapeHtml(g.k) + '" data-i="' + i + '"' + ((rvS.tambem[g.k] || {})[i] ? ' checked' : '') + '><span>também consta como parte intimada: <b>' + escapeHtml(cliTitulo(n)) + '</b> — cadastrar também</span></label>'; }).join('') +
        '</div></div>';
    });
  }
  if (L.sig.length){
    h += '<div class="rv-sec">Só iniciais no Diário · ' + L.sig.length + (L.sig.length === 1 ? ' processo' : ' processos') + '</div><div class="rv-dica">Segredo de justiça: o Diário não informa o nome. Digite o nome do cliente (ou escolha um que já exista).</div>';
    L.sig.forEach(function(d){
      var id = d.id, nome = (rvS.sig[id] || '');
      h += '<div class="rv-row"><input type="checkbox" class="rv-ck" data-rv="sigmarca" data-id="' + escapeHtml(id) + '"' + (nome.trim() ? ' checked' : '') + ' aria-label="Incluir"><div class="rv-c"><div><b>' + escapeHtml(d.parteNome || '—') + '</b> <span class="rv-mut">· ' + escapeHtml(d.orgao || '') + ' · </span>' + rvNumHtml(d.numero) + '</div>' +
        '<input type="text" class="rv-in" data-rv="signome" data-id="' + escapeHtml(id) + '" value="' + escapeHtml(nome) + '" placeholder="Digite o nome do cliente…" maxlength="120" aria-label="Nome do cliente">' +
        '<div class="rv-chs"><span class="pb-tg" style="background:rgba(217,59,59,.12);color:var(--urgente)">segredo de justiça</span><button type="button" class="btn btn-ghost pb-b rv-esc" data-pr="rev-esc" data-n="' + escapeHtml(prNum(d.numero)) + '">escolher cliente existente</button><button type="button" class="btn btn-ghost pb-b rv-dis" data-rv="sigdispensar" data-id="' + escapeHtml(id) + '" title="Tira da lista sem vincular">Dispensar</button></div></div></div>';
    });
  }
  h += '<div class="rv-rod"><button type="button" class="btn btn-primary" id="rvOk" data-pr="rv-ok" style="width:100%;justify-content:center"></button></div></div>';
  return h;
}
/* o que está marcado agora: [{ nome, existente, docs, extras:[nome] }] */
function rvTarefas(){
  var L = rvLinhas(), out = [];
  L.grupos.forEach(function(g){
    if (!rvS.marca[g.k]) return;
    var nome = rvNomeFinal(g); if (!nome) return;
    var t = (rvS.tambem[g.k] || {});
    out.push({ nome: nome, docs: g.docs, extras: g.extras.filter(function(n, i){ return t[i]; }).map(cliTitulo), existe: g.existe && normNome(nome) === normNome(g.existe.nome) ? g.existe : null });
  });
  L.sig.forEach(function(d){
    var n = String(rvS.sig[d.id] || '').replace(/\s+/g, ' ').trim(), ck = qs('rvBox') ? qs('rvBox').querySelector('[data-rv="sigmarca"][data-id="' + d.id + '"]') : null;
    if (n && (!ck || ck.checked)) out.push({ nome: cliTitulo(n), docs: [d], extras: [], existe: null });
  });
  return out;
}
function rvBotao(){
  var b = qs('rvOk'); if (!b) return;
  var t = rvTarefas();
  b.textContent = rvS.ocupado ? 'Cadastrando…' : (t.length ? 'Cadastrar e vincular ' + t.length + (t.length === 1 ? ' marcado' : ' marcados') : 'Nada marcado');
  b.disabled = rvS.ocupado || !t.length;
}
function rvAcharCliente(nome){
  var k = normNome(nome);
  return clientes.filter(function(c){ return !c.arquivado && normNome(c.nome) === k; })[0] || null;
}
/* cliente para o nome: o que já existe (mesmo nome) ou um novo, criado agora; devolve { c, criado } */
function rvCliente(nome, existe, criados){
  var ja = existe || rvAcharCliente(nome);
  if (ja) return Promise.resolve({ c: ja, criado: false });
  var obj = novoClienteObj({ nome: nome, pagador: 'cliente' });
  return Promise.resolve(persistClienteSet(obj)).then(function(){ criados.push(obj.id); return { c: obj, criado: true }; });
}
function rvConfirmar(){
  if (rvS.ocupado) return;
  var tarefas = rvTarefas(); if (!tarefas.length) return;
  rvS.ocupado = true; rvBotao();
  var criados = [], antes = [], envolvidos = {}, nProc = 0, agora = new Date().toISOString();
  function vincular(d, clienteIds){
    antes.push({ d: d, prev: { clienteIds: (d.clienteIds || []).slice(), revisar: d.revisar || '', sugestaoClienteId: d.sugestaoClienteId || '', revisadoEm: d.revisadoEm || '' } });
    var ids = (d.clienteIds || []).slice(); clienteIds.forEach(function(i){ if (ids.indexOf(i) < 0) ids.push(i); });
    return impSalvarDoc(d, { clienteIds: ids, revisar: '', revisadoEm: agora, sugestaoClienteId: '' });
  }
  tarefas.reduce(function(cad, t){
    return cad.then(function(){
      return rvCliente(t.nome, t.existe, criados).then(function(r1){
        envolvidos[r1.c.id] = r1.c;
        return t.extras.reduce(function(c2, n){ return c2.then(function(ids){ return rvCliente(n, null, criados).then(function(r2){ envolvidos[r2.c.id] = r2.c; return ids.concat([r2.c.id]); }); }); }, Promise.resolve([r1.c.id]));
      }).then(function(ids){
        return t.docs.reduce(function(c3, d){ return c3.then(function(){ nProc++; var nomePub = d.parteNome; return vincular(d, ids).then(function(){ try{ if (nomePub) prAprenderApelido(ids[0], nomePub); }catch(e){} }); }); }, Promise.resolve());
      });
    });
  }, Promise.resolve()).then(function(){
    rvS.ocupado = false; rvS.marca = {}; rvS.nome = {}; rvS.tambem = {}; rvS.sig = {};
    var nCli = Object.keys(envolvidos).length, nNovos = criados.length;
    toast(nNovos + (nNovos === 1 ? ' cliente cadastrado' : ' clientes cadastrados') + (nCli > nNovos ? ' (e ' + (nCli - nNovos) + ' já existente' + (nCli - nNovos === 1 ? '' : 's') + ')' : '') + ' · ' + nProc + (nProc === 1 ? ' processo vinculado.' : ' processos vinculados.'), 'Desfazer', function(){ rvDesfazer(antes, criados); });
    try{ prDepois(); }catch(e){}
    rvPerguntarAuto(envolvidos, function(){ rvDesfazer(antes, criados); });
  }).catch(function(e){
    rvS.ocupado = false; toast('Não consegui terminar: ' + e.message + '. O que já foi cadastrado continua; confira a lista.'); try{ prDepois(); }catch(e2){}
  });
}
function rvDesfazer(antes, criados){
  Promise.all(antes.map(function(x){ return impSalvarDoc(x.d, x.prev); })).then(function(){
    criados.forEach(function(id){ try{ persistClienteExclui(id); }catch(e){} });
    toast('Desfeito: os processos voltaram para a revisão.'); try{ prDepois(); }catch(e){}
  }).catch(function(e){ toast('Não consegui desfazer: ' + e.message); });
}
/* depois do lote: uma pergunta só para os clientes que ainda não têm essa escolha (os próximos processos deles vão direto?) */
function rvPerguntarAuto(env, desfazer){
  var lista = Object.keys(env).map(function(id){ return clienteById(id) || env[id]; }).filter(function(c){ return c && c.vinculoAuto !== true && c.vinculoAuto !== false; });
  if (!lista.length) return;
  function marcar(sim){ lista.forEach(function(c){ var o = JSON.parse(JSON.stringify(clienteById(c.id) || c)); o.vinculoAuto = !!sim; persistClienteSet(o); }); }
  impDialogo('Vincular os próximos automaticamente?',
    '<div class="parcela-sum">Quando aparecer outro processo de ' + (lista.length === 1 ? '<b>' + escapeHtml(lista[0].nome) + '</b>' : 'um destes <b>' + lista.length + '</b> clientes') + ', o app já vincula, sem passar pela revisão.</div><div class="pb-aviso">Dá para desligar depois na ficha de cada cliente.</div>',
    [['Sim, vincular automaticamente', 'btn-primary', function(){ marcar(true); toast('Pronto: os próximos processos desses clientes já vão direto.'); }], ['Não, sempre revisar', 'btn-ghost', function(){ marcar(false); }], ['Desfazer o cadastro', 'btn-ghost', desfazer]]);
}

document.addEventListener('click', function(ev){
  var b = ev.target.closest ? ev.target.closest('[data-rv="dispensar"], [data-rv="sigdispensar"], [data-rv="abrir"]') : null; if (!b) return;
  var a = b.getAttribute('data-rv');
  if (a === 'abrir'){ ev.preventDefault(); ev.stopPropagation(); prAbrir(b.getAttribute('data-n')); return; }
  ev.preventDefault(); ev.stopPropagation();
  if (a === 'dispensar'){ var k = b.getAttribute('data-k'), g = rvLinhas().grupos.filter(function(x){ return x.k === k; })[0]; if (g) rvDispensar(g.docs); }
  else { var d = prDocs.filter(function(x){ return x.id === b.getAttribute('data-id'); })[0]; if (d) rvDispensar([d]); }
}, true);
document.addEventListener('input', function(ev){
  var t = ev.target, a = t && t.getAttribute ? t.getAttribute('data-rv') : null; if (!a) return;
  if (a === 'nome'){ rvS.nome[t.getAttribute('data-k')] = t.value; }
  else if (a === 'signome'){
    var id = t.getAttribute('data-id'); rvS.sig[id] = t.value;
    var ck = qs('rvBox') && qs('rvBox').querySelector('[data-rv="sigmarca"][data-id="' + id + '"]'); if (ck) ck.checked = !!t.value.trim();
  } else return;
  rvBotao();
}, true);
document.addEventListener('change', function(ev){
  var t = ev.target, a = t && t.getAttribute ? t.getAttribute('data-rv') : null; if (!a) return;
  if (a === 'marca') rvS.marca[t.getAttribute('data-k')] = t.checked;
  else if (a === 'tambem'){ var k = t.getAttribute('data-k'); rvS.tambem[k] = rvS.tambem[k] || {}; rvS.tambem[k][t.getAttribute('data-i')] = t.checked; }
  else if (a === 'sigmarca'){ /* o estado fica na própria caixa */ }
  else return;
  rvBotao();
}, true);
(function(){
  var prl0 = prRenderLista; prRenderLista = function(){ var r = prl0.apply(this, arguments); try{ rvBotao(); }catch(e){} return r; };
  var st = document.createElement('style');
  st.textContent = '.rv-box{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md,16px);padding:12px;margin:0 0 12px}' +
    '.rv-sum{background:var(--surface-2);border-radius:12px;padding:10px 12px;font-size:var(--t3);line-height:1.45;margin-bottom:6px}.rv-sum span{color:var(--ink-soft);font-size:var(--t2)}' +
    '.rv-row{display:grid;grid-template-columns:24px minmax(0,1fr);gap:10px;align-items:start;padding:10px 0;border-bottom:1px solid var(--border)}' +
    /* caixas de marcar e campos de nome no visual do app (antes apareciam com o aspecto padrão do navegador) */
    '.rv-ck,.rv-tb input{-webkit-appearance:none;appearance:none;display:inline-grid;place-content:center;flex:none;width:22px;height:22px;margin:0;border:1.5px solid var(--ink-soft);border-radius:7px;background:var(--surface);cursor:pointer}.rv-ck{margin-top:9px}.rv-tb input{margin-top:1px}' +
    '.rv-ck:checked,.rv-tb input:checked{background:var(--ink);border-color:var(--ink)}.rv-ck:checked::after,.rv-tb input:checked::after{content:"";width:6px;height:11px;border:solid var(--bg,#fff);border-width:0 2.5px 2.5px 0;transform:rotate(45deg) translate(-1px,-1px)}' +
    '.rv-c{min-width:0;display:flex;flex-direction:column;gap:6px}.rv-chs{display:flex;gap:5px;flex-wrap:wrap;align-items:center}' +
    '.rv-in{-webkit-appearance:none;appearance:none;display:block;width:100%;max-width:100%;box-sizing:border-box;min-height:42px;padding:9px 12px;border:1px solid var(--border);border-radius:12px;background:var(--surface-2,var(--surface));color:var(--ink);font:inherit;font-size:var(--t3);font-weight:700;outline:none}' +
    '.rv-in:focus{border-color:var(--ink);background:var(--surface)}.rv-in::placeholder{font-weight:400;color:var(--ink-soft)}' +
    '.rv-tb{display:flex;gap:8px;align-items:flex-start;font-size:var(--t2);color:var(--ink-soft);line-height:1.4;cursor:pointer}' +
    '.rv-sec{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-soft);margin:14px 0 2px}.rv-dica{font-size:var(--t2);color:var(--ink-soft);margin-bottom:2px}.rv-mut{color:var(--ink-soft)}' +
    '.rv-rod{margin-top:12px}.rv-esc,.rv-dis{min-height:36px}.rv-pl{display:flex;align-items:center;gap:4px;flex-wrap:wrap;font-size:var(--t2)}.rv-num{border:1px solid var(--border);background:var(--surface-2);border-radius:99px;padding:4px 12px;min-height:32px;font:inherit;font-weight:700;color:var(--accent-ink,#8A5A0B);cursor:pointer}';
  document.head.appendChild(st);
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { rvLinhas: function(){ var L = rvLinhas(); return { grupos: L.grupos.map(function(g){ return { k: g.k, nome: g.nome, n: g.docs.length, extras: g.extras, existe: g.existe ? g.existe.nome : '' }; }), sig: L.sig.map(function(d){ return d.numero; }) }; },
    pbInjetar: function(pubs){ pbS.pubs = (pbS.pubs || []).concat(pubs); },
    rvIdsClientes: function(){ return clientes.map(function(c){ return c.id; }); },
    /* como a atualização do servidor: a lista de clientes é trocada por uma que ainda não tem o cliente salvo há instantes */
    rvSubstituirClientes: function(ids){ clientes = clientes.filter(function(c){ return ids.indexOf(c.id) >= 0; }); renderClientesTudo(); } });
})();
