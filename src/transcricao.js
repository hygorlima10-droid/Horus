/* ============================================================
   TRANSCRIÇÃO DE ÁUDIO (atendimentos): provedores intercambiáveis, com reserva.
   - cloudflare: Whisper large-v3 turbo do Workers AI (cota gratuita diária; o áudio não é retido). É o principal.
   - grok: Grok STT da xAI (US$ 0,10 por hora; separa quem fala). É o secundário: só entra quando o principal falha ou quando o proprietário o escolhe.
        Precisa de XAI_API_KEY (segredo do Worker). O formato do envio e da resposta ainda NÃO foi validado com a API real (ver docs/DECISOES.md).
   - teste: só existe quando TRANSCRICAO_TESTE = "1" (testes automáticos): "transcreve" lendo os bytes como texto.
   Todo provedor devolve o mesmo formato: { itens: [{ ini, fim, texto, falante? }], idioma, provedor }, com os tempos em segundos DENTRO do trecho enviado.
   ============================================================ */
export const MODELO_CF = '@cf/openai/whisper-large-v3-turbo';
export const ORDEM_PADRAO = ['cloudflare', 'grok'];

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
/* resposta do Grok STT (formato tolerante: utterances/segments/words com speaker, ou só text) */
export function itensDoGrok(r) {
  r = r && r.result ? r.result : r;
  const fonte = r && (Array.isArray(r.utterances) ? r.utterances : (Array.isArray(r.segments) ? r.segments : null));
  if (fonte && fonte.length) {
    return fonte.map((s) => ({ ini: num(s.start), fim: num(s.end, num(s.start)), texto: limpa(s.text || s.transcript), falante: s.speaker != null ? String(s.speaker) : (s.speaker_id != null ? String(s.speaker_id) : undefined) })).filter((s) => s.texto);
  }
  const palavras = r && Array.isArray(r.words) ? r.words : null;
  if (palavras && palavras.length) {   // junta palavras seguidas do mesmo falante em falas
    const out = []; let atual = null;
    for (const w of palavras) {
      const f = w.speaker != null ? String(w.speaker) : (w.speaker_id != null ? String(w.speaker_id) : undefined), t = limpa(w.text || w.word);
      if (!t) continue;
      if (atual && atual.falante === f && num(w.start) - atual.fim < 2) { atual.texto += ' ' + t; atual.fim = num(w.end, atual.fim); }
      else { atual = { ini: num(w.start), fim: num(w.end, num(w.start)), texto: t, falante: f }; out.push(atual); }
    }
    return out;
  }
  const t = limpa(r && r.text);
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
  grok: {
    nome: 'Grok STT (xAI)', separaFalantes: true,
    disponivel: (env) => !!env.XAI_API_KEY,
    async rodar(env, bytes, mime, op = {}) {
      const f = new FormData();
      f.append('file', new Blob([bytes], { type: mime || 'audio/mp4' }), 'audio.' + (/webm/.test(mime || '') ? 'webm' : (/mpeg|mp3/.test(mime || '') ? 'mp3' : 'm4a')));
      f.append('language', op.idioma || 'pt'); f.append('diarize', 'true');
      const r = await fetch((env.XAI_STT_URL || 'https://api.x.ai/v1/stt'), { method: 'POST', headers: { authorization: 'Bearer ' + env.XAI_API_KEY }, body: f, signal: AbortSignal.timeout(110000) });
      if (!r.ok) throw Object.assign(new Error('Grok STT respondeu ' + r.status + '.'), { status: r.status });
      return { itens: itensDoGrok(await r.json()), idioma: op.idioma || 'pt' };
    },
  },
  teste: {
    nome: 'Teste', separaFalantes: true,
    disponivel: (env) => env.TRANSCRICAO_TESTE === '1',
    async rodar(env, bytes) {
      const txt = new TextDecoder().decode(new Uint8Array(bytes)); if (/^FALHAR/.test(txt)) throw Object.assign(new Error('falha de teste'), { status: 429 });
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
