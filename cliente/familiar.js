/* ============================================================
   FAMILIAR (prefixo fam) — conta de um familiar do proprietário (ex.: irmão) só com os módulos liberados (Construção e/ou Finanças pessoais).
   Os dados dele ficam num cofre próprio (o servidor separa); aqui: "Minha conta" com a exportação dos dados dele.
   ============================================================ */
function famExportar(){
  toast('Preparando a cópia dos seus dados…');
  fetch('/api/exportar?anexos=1', { credentials: 'same-origin', cache: 'no-store' }).then(function(r){ if (!r.ok) throw new Error('Não consegui gerar a cópia (erro ' + r.status + ').'); return r.blob(); })
    .then(function(b){
      var a = document.createElement('a'), u = URL.createObjectURL(b); a.href = u; a.download = 'horus-meus-dados-' + todayISO() + '.json'; document.body.appendChild(a); a.click();
      setTimeout(function(){ URL.revokeObjectURL(u); a.remove(); }, 4000); toast('Cópia dos seus dados baixada.');
    }).catch(function(e){ toast(e.message); });
}
(function(){
  if (typeof CF_LINHAS !== 'undefined') CF_LINHAS.push({ id: 'exportar', ic: 'file-up', t: 'Exportar meus dados', s: 'baixa uma cópia de segurança de tudo que é seu', go: function(){ famExportar(); } });
  if (typeof cfRender === 'function'){
    var cfOrig2 = cfRender;
    cfRender = function(){
      cfOrig2.apply(this, arguments);
      try{
        var w = qs('cfWrap'), m = w && w.querySelector('.pb-menu'), ex = m && m.querySelector('[data-cf="exportar"]');
        if (!ppFamiliar()){ if (ex) ex.remove(); return; }   /* a exportação do cofre é só do familiar */
        if (m && !ex) m.insertAdjacentHTML('beforeend', cfLinha(CF_LINHAS.filter(function(x){ return x.id === 'exportar'; })[0], false));
      }catch(e){}
    };
  }
  window.__horusTeste = Object.assign(window.__horusTeste || {}, { famExportar: famExportar });
})();
