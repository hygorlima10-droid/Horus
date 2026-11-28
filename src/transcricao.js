/* ============================================================
   TRANSCRIÇÃO DE ÁUDIO (atendimentos): provedores intercambiáveis.
   - cloudflare: Whisper large-v3 turbo do Workers AI (cota gratuita diária de 10.000 neurons ≈ 214 min de áudio; o áudio não é retido). É o único serviço real.
     (O Claude não transcreve áudio; ele é a reserva só do RESUMO: src/resumo-atendimento.js. O Grok foi descartado em 29/11 por ser pago.)
   - teste: só existe quando TRANSCRICAO_TESTE = "1" (testes automáticos): "transcreve" lendo os bytes como texto.
   Todo provedor devolve o mesmo formato: { itens: [{ ini, fim, texto, falante? }], idioma, provedor }, com os tempos em segundos DENTRO do trecho enviado.
   Este serviço não separa quem fala; o campo "falante" só existe se um provedor futuro o informar.
   ============================================================ */
export const MODELO_CF = '@cf/openai/whisper-large-v3-turbo';
export const ORDEM_PADRAO = ['cloudflare'];

function paraBase64(bytes) {
  const u = new Uint8Array(bytes); let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}
const num = (v, p = 0) => { const n = Number(v); return Number.isFinite(n) ? n : p; };
const limpa = (t) => String(t == null ? '' : t).replace(/\s+/g, ' ').trim();

/* resposta do Whisper do Workers AI: { text, segments: [{ start, end, text }], word_count, vtt } */
export function itensDoWhisper(r) {
  const segs = r && Array.isArray(r.segments) ? r.segments : [];
  const itens = segs.map((s) => ({ ini: num(s.start), fim: num(s.end, num(s.start)), texto: limpa(s.text) })).filter((s) => s.texto);
  if (itens.length) return itens;
  const t = limpa(r && (r.text || (r.result && r.result.text)));
  return t ? [{ ini: 0, fim: 0, texto: t }] : [];
}
export const PROVEDORES = {
  cloudflare: {
    nome: 'Whisper (Cloudflare)', separaFalantes: false,
    disponivel: (env) => !!env.AI,
    async rodar(env, bytes, mime, op = {}) {
      const r = await env.AI.run(MODELO_CF, { audio: paraBase64(bytes), task: 'transcribe', language: op.idioma || 'pt', vad_filter: true });
      return { itens: itensDoWhisper(r), idioma: op.idioma || 'pt' };
    },
  },
  teste: {
    nome: 'Teste', separaFalantes: true,
    disponivel: (env) => env.TRANSCRICAO_TESTE === '1',
    async rodar(env, bytes) {
      const txt = new TextDecoder().decode(new Uint8Array(bytes)); if (/^FALHAR/.test(txt)) throw Object.assign(new Error('falha de teste'), { status: 429 });
      const u8 = new Uint8Array(bytes); let ruim = 0; for (const b of u8) if (b < 9 || (b > 13 && b < 32) || b === 127) ruim++;
      if (u8.length && ruim / u8.length > 0.02) return { itens: [{ ini: 0, fim: 2, texto: '[teste] Bom dia, conte o que aconteceu.' }, { ini: 2, fim: 9, texto: 'Fui demitido em março de 2024, sem justa causa. Trabalhei 6 anos lá.' }], idioma: 'pt' };   // áudio de verdade (binário) nos testes de tela
      const itens = txt.split('\n').map((l) => l.trim()).filter(Boolean).map((l, i) => { const m = /^(\d):\s*(.*)$/.exec(l); return { ini: i * 10, fim: i * 10 + 9, texto: m ? m[2] : l, falante: m ? m[1] : undefined }; });
      return { itens, idioma: 'pt' };
    },
  },
};

export function provedoresDisponiveis(env) { return Object.keys(PROVEDORES).filter((k) => PROVEDORES[k].disponivel(env)); }

/* tenta cada provedor na ordem; o primeiro que responder vale. Devolve { itens, idioma, provedor } ou lança o último erro. */
export async function transcrever(env, bytes, mime, op = {}) {
  let ordem = (op.ordem && op.ordem.length ? op.ordem : ORDEM_PADRAO).filter((k) => PROVEDORES[k]);
  if (env.TRANSCRICAO_TESTE === '1') ordem = ['teste'];
  ordem = ordem.filter((k) => PROVEDORES[k].disponivel(env));
  if (!ordem.length) throw Object.assign(new Error('Nenhum serviço de transcrição está ligado.'), { semProvedor: true });
  let ultimo = null;
  for (const k of ordem) {
    try { const r = await PROVEDORES[k].rodar(env, bytes, mime, op); return { ...r, provedor: k }; }
    catch (e) { console.error('transcrição (' + k + ')', e && e.message); ultimo = e; }
  }
  throw ultimo || new Error('Não consegui transcrever.');
}
