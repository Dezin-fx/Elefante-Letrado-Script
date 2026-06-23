// ==UserScript==
// @name         Elefante Assistente de Estudo (Preciso)
// @namespace    http://tampermonkey.net/
// @version      1.4
// @match        https://reader.elefanteletrado.com.br/*
// @grant        GM_xmlhttpRequest
// @connect      openrouter.ai
// ==/UserScript==

import CONFIG from "./Config.js";

(function () {
  'use strict';

  window.addEventListener('load', () => {
    setTimeout(init, 2000);
  });

  function init() {

    const OPENROUTER_KEY = CONFIG.OPENROUTER_KEY;
    const MODEL = 'cohere/north-mini-code:free';

    const BOOK_TITLE = 'NOME DO LIVRO';

    const BOOK_CONTEXT = `
Aqui vc coloca caracteristicas, enredo, genero, tema e etc do livro

Recomendo vc colocar coisas sobre o livro + ir no chatGPT ou na sua IA de preferencia, pedir um resumo completo do livro e colar aqui

`;

    // ─── Auto-page ─────────────────────────────────────────────────
    let autoPageActive = false;
    let autoPageTimer = null;

    function isQuizOpen() {
      const modal = document.querySelector('ngb-modal-window.quiz-modal') ||
                    document.querySelector('[role="dialog"]');
      if (!modal) return false;
      // Verifica se realmente tem alternativas visíveis
      const buttons = [...modal.querySelectorAll('button')]
        .map(b => b.textContent.trim())
        .filter(t => t.length > 5 && !/confirmar|voltar|próxima|continuar/i.test(t));
      return buttons.length >= 2;
    }

    function startAutoPage() {
      if (autoPageTimer) return;
      autoPageActive = true;
      setStatus('Navegando...', '#89b4fa');
      function tick() {
        if (!autoPageActive) return;
        if (!isQuizOpen()) {
          document.body.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'ArrowRight', code: 'ArrowRight', bubbles: true
          }));
        }
        autoPageTimer = setTimeout(tick, 150000);
      }
      tick();
    }

    function stopAutoPage() {
      clearTimeout(autoPageTimer);
      autoPageTimer = null;
      autoPageActive = false;
      setStatus('Pronto');
    }

    // ─── UI ────────────────────────────────────────────────────────
    criarUI();

    const status = document.getElementById('ea-status');
    const result = document.getElementById('ea-result');
    const btn = document.getElementById('ea-btn');
    const autoBtn = document.getElementById('ea-auto-btn');

    function setStatus(t, c = '#a6e3a1') {
      status.textContent = t;
      status.style.color = c;
    }

    function criarUI() {
      if (document.getElementById('ea-panel')) return;

      const div = document.createElement('div');
      div.innerHTML = `
        <div id="ea-panel" style="
          position:fixed; bottom:20px; right:20px; z-index:999999;
          background:#1e1e2e; color:#cdd6f4; font-family:monospace;
          border-radius:12px; padding:14px; box-shadow:0 4px 20px #0008;
          width:380px;
        ">
          <b style="color:#cba6f7;">📘 ${BOOK_TITLE}</b>
          <div id="ea-status" style="margin:8px 0;">Pronto</div>

          <button id="ea-auto-btn" style="
            width:100%; padding:8px; border:none; margin-bottom:6px;
            border-radius:8px; background:#89b4fa;
            font-weight:bold; cursor:pointer; color:#1e1e2e;
          ">▶ Iniciar Auto-Página</button>

          <button id="ea-btn" style="
            width:100%; padding:8px; border:none;
            border-radius:8px; background:#313244;
            font-weight:bold; cursor:pointer; color:#cdd6f4;
          ">🔍 Analisar Quiz Agora</button>

          <div id="ea-result" style="
            margin-top:10px; max-height:300px;
            overflow:auto; font-size:12px;
            white-space:pre-wrap;
          "></div>
        </div>
      `;
      document.body.appendChild(div);
    }

    // ─── Lógica original intacta ───────────────────────────────────
    function getModal() {
      return document.querySelector('ngb-modal-window.quiz-modal') ||
             document.querySelector('[role="dialog"]');
    }

    function extrair() {
  const modal = getModal();
  if (!modal) return null;

  const linhas = modal.innerText
    .replace(/\r/g, '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .filter(l =>
      !/^quiz$/i.test(l) &&
      !/^x$/i.test(l) &&
      !/^[1-9]$/.test(l) &&
      !/confirmar|voltar|próxima|proxima|continuar|biblioteca/i.test(l)
    );

  const opcoes = [];

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const match = linha.match(/^([A-D])\.\s*(.*)$/);

    if (match) {
      let texto = match[2].trim();

      if (!texto && linhas[i + 1]) {
        texto = linhas[i + 1].trim();
      }

      opcoes.push({
        letra: match[1],
        texto
      });
    }
  }

  if (opcoes.length < 2) return null;

  const indexA = linhas.findIndex(l => /^A\./.test(l));
  const pergunta = linhas
    .slice(0, indexA)
    .join(' ')
    .trim();

  if (!pergunta || pergunta.toLowerCase() === 'quiz') return null;

  return {
    pergunta,
    opcoes: opcoes.slice(0, 4)
  };
}
    function perguntarIA(q) {
      return new Promise((resolve, reject) => {
        const prompt = `
Você é especialista no livro "${BOOK_TITLE}".

Analise com extremo cuidado.

Contexto:
${BOOK_CONTEXT}

Pergunta:
${q.pergunta}

Alternativas:
${q.opcoes.map(o => `${o.letra}. ${o.texto}`).join('\n')}

INSTRUÇÕES IMPORTANTES:
- Leia TODAS as alternativas antes de decidir
- Compare cada alternativa com a pergunta
- Escolha a alternativa MAIS ESPECÍFICA à pergunta

Formato obrigatório:
Resposta: [A/B/C/D]
Explicação: [uma frase curta em português]

Não escreva nada antes de "Resposta:".
Não escreva em inglês.
Depois, verifique:
"A resposta realmente responde a pergunta?"

Se não, escolha outra.
`;

         GM_xmlhttpRequest({
             method: 'POST',
             url: 'https://openrouter.ai/api/v1/chat/completions',
             headers: {
                 Authorization: `Bearer ${OPENROUTER_KEY}`,
                 'Content-Type': 'application/json'
             },
             data: JSON.stringify({
                 model: MODEL,
                 messages: [
                     {
                         role: 'system',
                         content: 'Responda sempre em português do Brasil. Não de tantos detalhes. Responda somente no formato pedido.'
                     },
                     {
                         role: 'user',
                         content: prompt
                     }
                 ],
                 temperature: 0,
             }),
             onload: res => {
                 try {
                     const data = JSON.parse(res.responseText);
                     const txt = data.choices?.[0]?.message?.content;
                     resolve(txt);
                 } catch {
                     reject(new Error('Erro IA'));
                 }
             },
             onerror: () => reject(new Error('Erro rede'))
         });
      });
    }

    async function run() {
      // Para o auto-page enquanto analisa
      const eraAtivo = autoPageActive;
      if (eraAtivo) stopAutoPage();

      setStatus('Lendo...', '#89b4fa');

      const q = extrair();

      if (!q) {
        setStatus('Não achei', '#f38ba8');
        if (eraAtivo) startAutoPage();
        return;
      }

      result.textContent =
        `Pergunta:\n${q.pergunta}\n\n` +
        q.opcoes.map(o => `${o.letra}. ${o.texto}`).join('\n');

      try {
        setStatus('IA...', '#f9e2af');
        const r = await perguntarIA(q);
        setStatus('OK', '#a6e3a1');
        result.textContent += `\n\n${r}`;
      } catch (e) {
        setStatus('Erro', '#f38ba8');
        result.textContent = e.message;
      }

      // Retoma auto-page se estava ativo
      if (eraAtivo) startAutoPage();
    }

    // ─── Botões ────────────────────────────────────────────────────
    btn.onclick = run;

    autoBtn.addEventListener('click', () => {
      if (autoPageActive) {
        stopAutoPage();
        autoBtn.textContent = '▶ Iniciar Auto-Página';
        autoBtn.style.background = '#89b4fa';
      } else {
        startAutoPage();
        autoBtn.textContent = '⏹ Parar';
        autoBtn.style.background = '#f38ba8';
      }
    });

    setStatus('Pronto');
  }
})();
