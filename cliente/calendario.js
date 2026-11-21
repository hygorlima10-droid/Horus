/* ============================================================
   AUDIÊNCIAS NO CALENDÁRIO DO IPHONE (prefixo cl)
   Configurações › "Audiências no calendário do iPhone" (e Minha conta, para advogado e estagiário).
   O servidor (src/calendario.js) gera um link de calendário (.ics) só de leitura, secreto e por pessoa; o iPhone assina uma vez e atualiza sozinho.
   ============================================================ */
var clEstado = null, clSure = false;
function clApi(m, p, b){ return pbApi('/api/calendario' + (p || ''), m, b); }
function clMontar(){
  if (qs('overlayCl')) return;
  var d = document.createElement('div'); d.className = 'overlay'; d.id = 'overlayCl';
  d.innerHTML = '<div class="modal"><div class="modal-head"><h2>Audiências no calendário</h2><button class="icon-btn" id="clX" type="button" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="modal-body" id="clC"></div></div>';
  document.body.appendChild(d);
  d.addEventListener('click', function(e){
    if (e.target === d || (e.target.closest && e.target.closest('#clX'))){ d.classList.remove('show'); return; }
    var b = e.target.closest ? e.target.closest('[data-cl]') : null; if (!b) return;
    var a = b.getAttribute('data-cl');
    if (a === 'copiar') agdCopiar(clEstado.url, 'Link copiado.');
    else if (a === 'novo'){ if (!clSure){ clSure = true; b.textContent = 'Toque de novo: o link antigo vai parar de funcionar'; return; } clSure = false; clApi('POST', '/novo').then(function(s){ clEstado = s; clDesenhar(); toast('Link novo gerado. Assine de novo no iPhone.'); }).catch(function(x){ toast('Não consegui: ' + ((x && x.message) || '')); }); }
    else if (a === 'escopo') clSalvar({ escopo: b.getAttribute('data-v') });
  });
  d.addEventListener('change', function(e){
    var t = e.target; if (!t || !t.getAttribute) return; var a = t.getAttribute('data-clc');
    if (a === 'ativo') clSalvar({ ativo: t.checked }); else if (a === 'cliente') clSalvar({ cliente: t.checked }); else if (a === 'alertas') clSalvar({ alertas: t.checked });
  });
}
function clSalvar(c){ return clApi('PUT', '', c).then(function(s){ clEstado = s; clSure = false; clDesenhar(); }).catch(function(e){ toast('Não consegui salvar: ' + ((e && e.message) || '')); clDesenhar(); }); }
function clAbrir(){ clMontar(); qs('overlayCl').classList.add('show'); qs('clC').innerHTML = '<div class="saldo-data">Carregando…</div>'; clApi('GET').then(function(s){ clEstado = s; clDesenhar(); }).catch(function(){ qs('clC').innerHTML = '<div class="saldo-data">Não consegui abrir agora.</div>'; }); }
function clDesenhar(){
  var s = clEstado, el = qs('clC'); if (!s || !el) return;
  var sw = function(a, ligado, t, sub){ return '<label class="ad-it" style="border:0;padding:8px 0"><input type="checkbox" data-clc="' + a + '"' + (ligado ? ' checked' : '') + '><span class="ad-t"><b>' + t + '</b><br><span class="saldo-data" style="margin:0">' + sub + '</span></span></label>'; };
  var h = '<div class="parcela-sum">Um <b>link de calendário só de leitura</b> que o iPhone assina uma vez e passa a atualizar sozinho: audiência nova, remarcada ou cancelada aparece sem você fazer nada. <b>Só audiências</b>: prazos e tarefas não vão. Também funciona no Google Agenda e no Outlook (assinar por endereço).</div>' +
    sw('ativo', s.ativo, 'Mostrar minhas audiências no Calendário', 'liga e desliga o link');
  if (s.ativo){
    h += '<div class="field"><label class="field-label">Quais audiências</label><div class="segmented">' + [['minhas', 'Só as minhas'], ['escritorio', 'Todas do escritório']].map(function(o){ return '<button type="button" class="seg-btn' + (s.escopo === o[0] ? ' active' : '') + '" data-cl="escopo" data-v="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div></div>' +
      sw('cliente', s.cliente, 'Mostrar o nome do cliente no título', 'desligado: aparece só “Audiência · 14:30”') + sw('alertas', s.alertas, 'Alertas', '1 dia antes e 1 hora antes') +
      '<div class="pb-sec-t" style="margin:12px 4px 4px">Seu link (só seu: não compartilhe)</div><div class="lnk" style="background:var(--surface-2);border-radius:12px;padding:10px 12px;font-size:var(--t2);word-break:break-all;font-family:ui-monospace,monospace">' + escapeHtml(s.webcal || s.url || '') + '</div>' +
      '<div class="pb-acts" style="flex-direction:column;align-items:stretch"><a class="btn btn-primary" href="' + escapeHtml(s.webcal || s.url) + '" style="text-align:center;justify-content:center">Assinar no iPhone</a><button type="button" class="btn btn-ghost" data-cl="copiar">Copiar link</button><button type="button" class="btn btn-ghost" data-cl="novo">Gerar um link novo</button></div>' +
      '<div class="pb-aviso" style="margin:10px 4px">O link dá acesso ao que aparece nele (incluindo nomes de clientes, se ligado). Se vazar, gere um link novo: o antigo para de funcionar. O iPhone decide de quanto em quanto tempo atualiza (de minutos a algumas horas). Mexer no evento no iPhone não muda a Agenda do app.</div>';
  }
  el.innerHTML = h;
}
(function(){ window.__horusTeste = Object.assign(window.__horusTeste || {}, { clAbrir: clAbrir }); })();
