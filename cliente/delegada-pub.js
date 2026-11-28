/* Tarefa delegada criada de dentro da publicação (terceiro botão ao lado de "Criar audiência" e "Criar tarefa").
   Não vai para a Agenda: nasce na aba Delegadas, já ligada ao processo da publicação (campo pubId = "via publicação").
   A publicação ganha uma etiqueta com a tarefa, e quem recebeu é avisado pelo mesmo caminho das demais tarefas delegadas (indicado). */
var pbdgS = { pubId: '', resp: '', prazo: '', prio: 'Média' };

function pbDelegadasDe(p){
  if (typeof dgS === 'undefined' || !dgS.ok) return [];
  var ids = pbMembros(p).map(function(x){ return x.id; });
  return dgS.docs.filter(function(d){ return d.pubId && ids.indexOf(d.pubId) >= 0; });
}
function pbdgEtiqueta(t, atrib){
  var txt = 'tarefa delegada · ' + (typeof dgCurto === 'function' ? dgCurto(t.resp) : '') + (t.fatal ? ' · até ' + fmtData(t.fatal).slice(0, 5) : '') + (dgFeita(t) ? ' · feita' : '');
  return '<button type="button" class="pb-tg ' + (dgFeita(t) ? 'ok' : 'nv') + '" ' + atrib + '="dgt" data-tid="' + escapeHtml(t.id) + '" title="Abrir a tarefa nas Delegadas">' + escapeHtml(txt) + '</button>';
}
function pbdgDiaMais(n){ return somarDias(todayISO(), n); }

function pbCriarDelegada(id){
  var p = pbPub(id); if (!p) return;
  if (typeof dgS !== 'undefined' && !dgS.ok && !dgS.carregando) dgCarregar(true);
  var v = pbVinculo(p.processo), num = p.numero || p.processo, cli = pbNomeParte(p, v);
  pbdgS = { pubId: p.id, resp: '', prazo: '', prio: 'Média' };
  var ov = sgMontar('overlayPbDg', 'Tarefa delegada'); ov.querySelector('h2').textContent = 'Tarefa delegada';
  var pess = dgPessoas();
  var chipsP = pess.map(function(x){ return '<button type="button" class="pbdg-p" data-pbdg="resp" data-k="' + escapeHtml(x.k) + '">' + dgAv(x.k) + '<span>' + escapeHtml(String(x.nome).split(/\s+/)[0]) + (x.tipo === 'est' ? ' · est.' : '') + '</span></button>'; }).join('');
  var fld = function(rot, html, f){ return '<div class="field"><label class="field-label" for="pbdg_' + f + '">' + rot + '</label>' + html + '</div>'; };
  var h = '<div class="pr-hon-cab"><b>' + escapeHtml(cli || 'Processo') + '</b><span>' + (num ? 'Proc. ' + escapeHtml(num) + ' · ' : '') + 'via publicação de ' + escapeHtml(fmtData(p.data)) + '</span></div>' +
    fSec('Tarefa', fld('Tarefa *', '<textarea id="pbdg_titulo" rows="2" maxlength="200" placeholder="O que precisa ser feito">' + escapeHtml('Providência' + (p.tipo ? ' — ' + p.tipo : '')) + '</textarea>', 'titulo') +
      '<div class="field"><label class="field-label">Quem faz</label><div class="pbdg-ch" id="pbdg_pess">' + chipsP + '</div></div>' +
      '<div class="field"><label class="field-label">Prazo fatal (opcional)</label><div class="pbdg-ch" id="pbdg_prazos">' +
        '<button type="button" class="pbdg-c" data-pbdg="prazo" data-d="' + pbdgDiaMais(0) + '">Hoje</button><button type="button" class="pbdg-c" data-pbdg="prazo" data-d="' + pbdgDiaMais(1) + '">Amanhã</button><button type="button" class="pbdg-c" data-pbdg="prazo" data-d="' + pbdgDiaMais(3) + '">Em 3 dias</button><button type="button" class="pbdg-c" data-pbdg="prazo" data-d="data">Escolher data…</button></div>' +
        '<input type="date" id="pbdg_fatal" style="display:none;margin-top:8px"></div>' +
      '<div class="field"><label class="field-label">Prioridade</label><div class="pbdg-ch" id="pbdg_prios">' + DG_PRIO.slice().reverse().map(function(x){ return '<button type="button" class="pbdg-c' + (x[0] === 'Média' ? ' on' : '') + '" data-pbdg="prio" data-v="' + x[0] + '">' + x[0] + '</button>'; }).join('') + '</div></div>') +
    fMais('trabalhar até · observações', fld('Trabalhar até', '<input type="date" id="pbdg_trabalhar">', 'trabalhar') + fld('Observações', '<textarea id="pbdg_obs" rows="3" maxlength="2000"></textarea>', 'obs')) +
    '<label class="pbdg-ck"><input type="checkbox" id="pbdg_tratada" checked><span>Marcar a publicação como <b>tratada</b> ao lançar a tarefa</span></label>' +
    '<div class="form-error" id="pbdg_erro"></div><div class="f-rod-in"><button type="button" class="btn btn-ghost" data-pbdg="cancelar">Cancelar</button><button type="button" class="btn btn-primary" data-pbdg="lancar" id="pbdg_lancar">Lançar tarefa</button></div>';
  qs('overlayPbDgC').innerHTML = h;
  if (!ov.getAttribute('data-pbdg')){ ov.setAttribute('data-pbdg', '1'); ov.addEventListener('click', pbdgClique); }
  ov.classList.add('show'); try{ fichaMaisEm(qs('overlayPbDgC')); }catch(e){}
  var t = qs('pbdg_titulo'); if (t){ t.focus(); try{ t.select(); }catch(e){} }
}
function pbdgClique(ev){
  var b = ev.target.closest ? ev.target.closest('[data-pbdg]') : null; if (!b) return;
  var a = b.getAttribute('data-pbdg'), ov = qs('overlayPbDg');
  if (a === 'resp'){
    var k = b.getAttribute('data-k'); pbdgS.resp = pbdgS.resp === k ? '' : k;
    Array.prototype.forEach.call(qs('pbdg_pess').children, function(c){ c.classList.toggle('on', c.getAttribute('data-k') === pbdgS.resp); });
  } else if (a === 'prazo'){
    var d = b.getAttribute('data-d'), campo = qs('pbdg_fatal');
    if (d === 'data'){ campo.style.display = ''; pbdgS.prazo = campo.value || ''; try{ campo.focus(); }catch(e){} }
    else { campo.style.display = 'none'; campo.value = ''; pbdgS.prazo = pbdgS.prazo === d ? '' : d; }
    Array.prototype.forEach.call(qs('pbdg_prazos').children, function(c){ var cd = c.getAttribute('data-d'); c.classList.toggle('on', (cd === 'data' && campo.style.display !== 'none') || (cd !== 'data' && cd === pbdgS.prazo && campo.style.display === 'none')); });
  } else if (a === 'prio'){
    pbdgS.prio = b.getAttribute('data-v');
    Array.prototype.forEach.call(qs('pbdg_prios').children, function(c){ c.classList.toggle('on', c.getAttribute('data-v') === pbdgS.prio); });
  } else if (a === 'cancelar') ov.classList.remove('show');
  else if (a === 'lancar') pbdgLancar();
}
function pbdgLancar(){
  var err = qs('pbdg_erro'), p = pbPub(pbdgS.pubId), titulo = qs('pbdg_titulo').value.trim();
  if (!p) return;
  if (!titulo){ err.textContent = 'Digite a tarefa.'; qs('pbdg_titulo').focus(); return; }
  var campo = qs('pbdg_fatal'), fatal = campo.style.display !== 'none' ? campo.value : pbdgS.prazo;
  var v = pbVinculo(p.processo), num = p.numero || p.processo, dc = dgClienteDoProcesso(num), me = dgMe();
  var d = { titulo: titulo, cliente: pbNomeParte(p, v) || dc.nome, clienteId: dc.id, processo: num, resp: pbdgS.resp || me, delegadoPor: me, prioridade: pbdgS.prio || 'Média', status: 'afazer', trabalhar: qs('pbdg_trabalhar').value || '', fatal: fatal || '', obs: qs('pbdg_obs').value.trim(), pubId: p.id, criadoPor: esS.eu ? esS.eu.id : '', criadoEm: new Date().toISOString() };
  var bt = qs('pbdg_lancar'); bt.disabled = true;
  dgGravar(d).then(function(){
    dgS.docs.push(d); dgCacheEst = {}; try{ dgAtualizarSelo(); }catch(e){}
    if (activeTab === 'delegadas') dgRender();
    if (qs('pbdg_tratada').checked) pbMarcar(pbMembros(p).map(function(x){ return x.id; }), { tratada: true, como: 'delegada' });
    qs('overlayPbDg').classList.remove('show'); bt.disabled = false;
    toast('Tarefa lançada' + (d.resp ? ' · ' + dgCurto(d.resp) : '') + '.');
    try{ if (qs('overlayPb') && qs('overlayPb').classList.contains('show')) pbDesenharDetalhe(); else pbRenderLista(); }catch(e){}
  }).catch(function(e){ bt.disabled = false; err.textContent = 'Não consegui lançar: ' + e.message; });
}
(function(){
  var st = document.createElement('style');
  st.textContent = '.pbdg-ch{display:flex;gap:7px;flex-wrap:wrap}.pbdg-c,.pbdg-p{min-height:40px;border-radius:12px;border:1.5px solid var(--line,#d6d9e0);background:transparent;color:inherit;font:inherit;font-size:13px;padding:6px 12px;display:inline-flex;align-items:center;gap:6px}' +
    '.pbdg-p{border-radius:99px;padding:6px 12px 6px 7px}.pbdg-c.on{background:#fdf1d8;border-color:#e3b25a;color:#8a5a00;font-weight:700}.pbdg-p.on{background:var(--ink,#0f1011);color:var(--bg,#fff);border-color:var(--ink,#0f1011);font-weight:700}' +
    '.pbdg-ck{display:flex;gap:8px;align-items:flex-start;font-size:13px;line-height:1.4;margin:14px 0 4px}.pbdg-ck input{margin-top:3px}';
  document.head.appendChild(st);
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { pbCriarDelegada: pbCriarDelegada, pbDelegadasDe: pbDelegadasDe, pbAbrirDetalhe: pbAbrirDetalhe, pbCarregar: pbCarregar, pbIds: function(){ return pbS.pubs.map(function(x){ return x.id; }); }, pbCartaoHtml: function(id){ var p = pbPub(id); return p ? pbCartao(p) : ''; } });
})();
