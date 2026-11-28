/* ============================================================
   TAREFA OU PRAZO JÁ EXISTENTE (prefixo dup) — antes de cadastrar, o app olha o MESMO PROCESSO e avisa se já há algo parecido:
   - mesmo nome e mesma data ("igual"); nome parecido e mesma data; nome parecido em OUTRA data (se a tarefa ainda está em aberto); mesma data e mesmo tipo com outro nome;
   - mostra o que já existe (com "Abrir") e pede confirmação: "Não cadastrar" ou "Cadastrar mesmo assim";
   - vale na Agenda (nova tarefa, prazo e audiência), no prazo criado a partir da publicação (confirmação completa e em um passo), na "próxima providência" do processo e nas tarefas delegadas;
   - editar uma tarefa existente só compara "igual" (mesmo tipo, dia e nome), como antes.
   ============================================================ */
var DUP_VAZIAS = { de: 1, da: 1, do: 1, das: 1, dos: 1, para: 1, por: 1, com: 1, em: 1, no: 1, na: 1, nos: 1, nas: 1, ao: 1, aos: 1, uma: 1, que: 1, sobre: 1,
  /* verbos que quase toda tarefa tem: não provam que são a mesma */ preparar: 1, juntar: 1, cumprir: 1, elaborar: 1, protocolar: 1, apresentar: 1, providenciar: 1, fazer: 1, verificar: 1, conferir: 1, analisar: 1, revisar: 1 };
var dupPend = null;
function dupNorm(s){ return (typeof normNome === 'function') ? normNome(s) : String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function dupToks(t){
  var seen = {}, out = [];
  dupNorm(t).split(' ').forEach(function(w){ if (w.length < 3 || DUP_VAZIAS[w]) return; w = w.replace(/s$/, ''); if (!seen[w]){ seen[w] = 1; out.push(w); } });
  return out;
}
/* 'igual' (mesmo nome) | 'contem' (um nome está dentro do outro) | 'parecido' | '' — sem acento, maiúscula, plural nem palavras de ligação */
function dupTitSim(a, b){
  var na = dupNorm(a), nb = dupNorm(b);
  if (!na || !nb) return 'igual';   /* sem nome de um dos lados: o que vale é o resto */
  if (na === nb) return 'igual';
  if (Math.min(na.length, nb.length) >= 6 && (na.indexOf(nb) >= 0 || nb.indexOf(na) >= 0)) return 'contem';
  var A = dupToks(na), B = dupToks(nb); if (!A.length || !B.length) return '';
  var sh = 0; A.forEach(function(w){ if (B.indexOf(w) >= 0) sh++; });
  var menor = Math.min(A.length, B.length), maior = Math.max(A.length, B.length);
  if (sh >= 2 && sh / menor >= .5) return 'parecido';
  if (menor === 1 && sh === 1 && maior <= 2) return 'parecido';
  return '';
}
/* o = { tipo, titulo, data, processo, ignorarKey? }; itens = [{ key, tipo, titulo, data, hora, processo, concluido, cancelado }]; opt.estrito: só "igual" (edição) */
function dupAchar(o, itens, opt){
  var proc = (typeof prNum === 'function') ? prNum(o.processo) : String(o.processo || '').replace(/\D/g, ''); if (!proc) return [];
  var out = [], estrito = !!(opt && opt.estrito);
  (itens || []).forEach(function(x){
    if (!x || x.cancelado || (o.ignorarKey && x.key === o.ignorarKey) || !x.processo) return;
    var px = (typeof prNum === 'function') ? prNum(x.processo) : String(x.processo).replace(/\D/g, ''); if (px !== proc) return;
    var mesmaData = !!o.data && x.data === o.data, sim0 = dupTitSim(o.titulo, x.titulo), sim = sim0 === 'contem' ? 'parecido' : sim0, aberto = !x.concluido, motivo = '', peso = 9;
    if (mesmaData && (sim === 'igual' || (estrito && sim0 === 'contem'))){ motivo = 'igual'; peso = 0; }
    else if (!estrito && mesmaData && sim === 'parecido'){ motivo = 'parecido-data'; peso = 1; }
    else if (!estrito && sim && aberto){ motivo = 'nome'; peso = 2; }
    else if (!estrito && mesmaData && aberto && x.tipo === o.tipo){ motivo = 'data'; peso = 3; }
    if (estrito && motivo === 'igual' && x.tipo !== o.tipo) motivo = '';
    if (motivo) out.push({ item: x, motivo: motivo, peso: peso });
  });
  out.sort(function(a, b){ return a.peso - b.peso || String(a.item.data).localeCompare(String(b.item.data)); });
  return out.slice(0, 4);
}
function dupMotivoTxt(m){ return m === 'igual' ? 'igual: mesmo nome e mesma data' : (m === 'parecido-data' ? 'nome parecido e mesma data' : (m === 'nome' ? 'nome parecido, em outra data' : 'mesma data, com outro nome')); }
function dupTipoTxt(t){ return t === 'audiencia' ? 'Audiência' : (t === 'prazo' ? 'Prazo' : 'Tarefa'); }
function dupLinhaHtml(r, comAbrir){
  var x = r.item;
  return '<div class="dup-lin"><div><b>' + dupTipoTxt(x.tipo) + '</b> “' + escapeHtml(x.titulo || 'Sem título') + '” · ' + escapeHtml(fmtData(x.data)) + (x.hora ? ' às ' + escapeHtml(x.hora) : '') + (x.concluido ? ' · <em>já concluída</em>' : '') + '<div class="saldo-data">' + dupMotivoTxt(r.motivo) + '</div></div>' +
    (comAbrir && x.key ? '<button type="button" class="dup-ab" data-dup="abrir" data-k="' + escapeHtml(x.key) + '">Abrir</button>' : '') + '</div>';
}
/* janela de confirmação: devolve uma promessa (true = cadastrar mesmo assim) */
function dupPerguntar(lista, o){
  if (dupPend){ try{ dupPend(false); }catch(e){} dupPend = null; }
  return new Promise(function(res){
    var ov = sgMontar('overlayDup', 'Já existe algo parecido'); document.body.appendChild(ov);
    var feito = false, fim = function(v){ if (feito) return; feito = true; dupPend = null; ov.classList.remove('show'); try{ obs.disconnect(); }catch(e){} res(v); };
    dupPend = fim;
    qs('overlayDupC').innerHTML = '<p class="dup-t">Você está cadastrando ' + (o.tipo === 'audiencia' ? 'uma <b>audiência</b>' : (o.tipo === 'prazo' ? 'um <b>prazo</b>' : 'uma <b>tarefa</b>')) + ' <b>“' + escapeHtml(o.titulo || '') + '”</b>' + (o.data ? ' para <b>' + escapeHtml(fmtData(o.data)) + '</b>' : '') + ' neste processo. Já existe' + (lista.length > 1 ? 'm' : '') + ':</p>' +
      lista.map(function(r){ return dupLinhaHtml(r, true); }).join('') +
      '<div class="dup-bts"><button type="button" class="btn btn-ghost" data-dup="nao">Não cadastrar</button><button type="button" class="btn btn-primary" data-dup="sim">Cadastrar mesmo assim</button></div>';
    ov.onclick = function(e){
      var b = e.target.closest ? e.target.closest('[data-dup]') : null; if (!b) return;
      var a = b.getAttribute('data-dup');
      if (a === 'sim') fim(true); else if (a === 'nao') fim(false);
      else if (a === 'abrir'){ var k = b.getAttribute('data-k'); fim(false); try{ if (typeof agdAbrir === 'function') agdAbrir(k); else if (typeof agAbrir === 'function') agAbrir(k); }catch(x){} }
    };
    var obs = new MutationObserver(function(){ if (!ov.classList.contains('show')) fim(false); });   /* fechou pelo X ou fora da janela: é "não cadastrar" */
    obs.observe(ov, { attributes: true, attributeFilter: ['class'] });
    ov.classList.add('show');
  });
}
(function(){
  var st = document.createElement('style');
  st.textContent = '.dup-t{margin:0 0 10px;font-size:var(--t3);line-height:1.4}.dup-lin{display:flex;gap:10px;align-items:center;justify-content:space-between;border:1px solid var(--border);border-left:4px solid #D9A400;border-radius:10px;padding:8px 10px;margin:0 0 8px;background:var(--surface);font-size:var(--t2)}.dup-ab{border:1px solid var(--border);background:var(--surface);border-radius:9px;padding:6px 12px;font:700 12px system-ui,sans-serif;cursor:pointer;white-space:nowrap;color:var(--ink)}.dup-bts{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:12px}';
  document.head.appendChild(st);
})();

(function(){ window.__horusTeste = Object.assign(window.__horusTeste || {}, { dupAchar: dupAchar, dupTitSim: dupTitSim, dupPerguntar: dupPerguntar, agCriar: function(d){ return agCriar(d); } }); })();
