// ==UserScript==
// @name         Elefante Assistente de Estudo
// @namespace    http://tampermonkey.net/
// @version      2.0
// @match        https://reader.elefanteletrado.com.br/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      openrouter.ai
// ==/UserScript==

(function () {
  'use strict';

  const MODEL = 'cohere/north-mini-code:free';

  window.addEventListener('load', () => {
    setTimeout(init, 2000);
  });

  function init() {
    const savedKey  = GM_getValue('apiKey', '');
    const savedBook = GM_getValue('bookTitle', '');
    const noAI      = GM_getValue('noAI', false);

    // Já foi configurado antes → pula o setup
    if (noAI || (savedKey && savedBook)) {
      iniciarPrincipal(savedKey, savedBook);
      return;
    }

    // Primeira vez → começa pelo setup
    mostrarSetupApiKey();

    // ─── Setup: Tela 1 — API Key ──────────────────────────────────
    function mostrarSetupApiKey() {
      renderPanel(`
        <b style="color:#cba6f7;font-size:16px;">🔑 Configuração</b>
        <p style="margin:14px 0 8px;font-size:13px;color:#a6adc8;">Cole sua API Key do OpenRouter:</p>
        <input id="ea-inp" type="password" placeholder="sk-or-..."
          style="
            width:100%;box-sizing:border-box;padding:10px 12px;
            border:2px solid #6c5fc7;border-radius:8px;margin-bottom:6px;
            background:#11111b;color:#cdd6f4;font-family:monospace;font-size:13px;
            outline:none;
          ">
        <div id="ea-err" style="color:#f38ba8;font-size:12px;min-height:18px;margin-bottom:10px;"></div>
        <button id="ea-ok" style="
          width:100%;padding:11px;border:none;border-radius:10px;
          background:#a6e3a1;color:#1e1e2e;font-weight:bold;
          font-size:14px;cursor:pointer;margin-bottom:8px;
        ">Continuar</button>
        <button id="ea-noai" style="
          width:100%;padding:11px;border:none;border-radius:10px;
          background:#313244;color:#cdd6f4;font-weight:bold;
          font-size:14px;cursor:pointer;
        ">Não quero usar IA</button>
      `);
      document.getElementById('ea-ok').onclick = () => {
        const key = document.getElementById('ea-inp').value.trim();
        if (!key) {
          document.getElementById('ea-err').textContent = 'Insira uma API Key.';
          return;
        }
        GM_setValue('apiKey', key);
        mostrarSetupLivro(key);
      };

      document.getElementById('ea-noai').onclick = () => {
        GM_setValue('noAI', true);
        iniciarPrincipal('', '');
      };
    }

    // ─── Setup: Tela 2 — Nome do livro ───────────────────────────
    function mostrarSetupLivro(apiKey) {
      renderPanel(`
        <b style="color:#cba6f7;font-size:16px;">📘 Nome do livro</b>
        <p style="margin:14px 0 8px;font-size:13px;color:#a6adc8;">Qual livro você está lendo?</p>
        <input id="ea-inp" type="text" placeholder="Ex: O Pequeno Príncipe"
          style="
            width:100%;box-sizing:border-box;padding:10px 12px;
            border:2px solid #6c5fc7;border-radius:8px;margin-bottom:6px;
            background:#11111b;color:#cdd6f4;font-family:monospace;font-size:13px;
            outline:none;
          ">
        <div id="ea-err" style="color:#f38ba8;font-size:12px;min-height:18px;margin-bottom:10px;"></div>
        <button id="ea-ok" style="
          width:100%;padding:11px;border:none;border-radius:10px;
          background:#a6e3a1;color:#1e1e2e;font-weight:bold;
          font-size:14px;cursor:pointer;
        ">Salvar e começar</button>
      `);

      document.getElementById('ea-ok').onclick = () => {
        const livro = document.getElementById('ea-inp').value.trim();
        if (!livro) {
          document.getElementById('ea-err').textContent = 'Digite o nome do livro.';
          return;
        }
        GM_setValue('bookTitle', livro);
        iniciarPrincipal(apiKey, livro);
      };
    }

    // ─── Helper: cria ou substitui o conteúdo do painel ──────────
    function renderPanel(html) {
      let panel = document.getElementById('ea-panel');
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'ea-panel';
        panel.style.cssText = `
          position:fixed;bottom:20px;right:20px;z-index:999999;
          background:#1e1e2e;color:#cdd6f4;font-family:monospace;
          border-radius:16px;padding:20px;box-shadow:0 8px 32px #0009;
          width:400px;
        `;
        document.body.appendChild(panel);
      }
      panel.innerHTML = html;
    }

    // ─── Principal ────────────────────────────────────────────────
    function iniciarPrincipal(apiKey, bookTitle) {
      let autoPageActive = false;
      let autoPageTimer  = null;

      // Monta a UI principal (botão de quiz só aparece se tiver apiKey)
      renderPanel(`
        <b style="color:#cba6f7;font-size:16px;">📘 ${bookTitle || 'Modo leitura'}</b>
        <div id="ea-status" style="margin:10px 0;font-size:13px;color:#a6adc8;">Pronto</div>
      
        <button id="ea-auto-btn" style="
          width:100%;padding:11px;border:none;margin-bottom:8px;
          border-radius:10px;background:#89b4fa;
          font-weight:bold;font-size:14px;cursor:pointer;color:#1e1e2e;
        ">▶ Iniciar Auto-Página</button>
      
        ${apiKey ? `
        <button id="ea-btn" style="
          width:100%;padding:11px;border:none;margin-bottom:8px;
          border-radius:10px;background:#313244;
          font-weight:bold;font-size:14px;cursor:pointer;color:#cdd6f4;
        ">🔍 Analisar Quiz Agora</button>
        ` : ''}
      
        <div id="ea-result" style="
          margin-top:8px;max-height:300px;
          overflow:auto;font-size:12px;
          white-space:pre-wrap;color:#a6adc8;
        "></div>
      
        <button id="ea-reset-btn" style="
          width:100%;padding:10px;border:none;margin-top:12px;
          border-radius:10px;background:#45475a;
          font-size:13px;font-weight:bold;cursor:pointer;color:#cdd6f4;
        ">⚙ Reconfigurar</button>
      `);

      const statusEl = document.getElementById('ea-status');
      const resultEl = document.getElementById('ea-result');
      const autoBtn  = document.getElementById('ea-auto-btn');
      const btn      = document.getElementById('ea-btn'); // null se sem IA
      const resetBtn = document.getElementById('ea-reset-btn');

      function setStatus(t, c = '#a6e3a1') {
        statusEl.textContent = t;
        statusEl.style.color = c;
      }

      // ─── Auto-page ───────────────────────────────────────────────
      function isQuizOpen() {
        const modal = document.querySelector('ngb-modal-window.quiz-modal') ||
                      document.querySelector('[role="dialog"]');
        if (!modal) return false;
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

      // ─── Extração do quiz ────────────────────────────────────────
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
            if (!texto && linhas[i + 1]) texto = linhas[i + 1].trim();
            opcoes.push({ letra: match[1], texto });
          }
        }

        if (opcoes.length < 2) return null;

        const indexA = linhas.findIndex(l => /^A\./.test(l));
        const pergunta = linhas.slice(0, indexA).join(' ').trim();

        if (!pergunta || pergunta.toLowerCase() === 'quiz') return null;

        return { pergunta, opcoes: opcoes.slice(0, 4) };
      }

      // ─── Chamada IA ──────────────────────────────────────────────
      function perguntarIA(q) {
        return new Promise((resolve, reject) => {
          const prompt = `
Você é especialista no livro "${bookTitle}".

Analise com extremo cuidado.

Pergunta:
${q.pergunta}

Alternativas:
${q.opcoes.map(o => `${o.letra}. ${o.texto}`).join('\n')}

INSTRUÇÕES IMPORTANTES:
- Leia TODAS as alternativas antes de decidir
- Compare cada alternativa com a pergunta

Formato obrigatório:
Resposta: [A/B/C/D]
Explicação: [uma breve explicação em português]

Não escreva nada antes de "Resposta:".
Depois, verifique: "A resposta realmente responde a pergunta?"
Se não, escolha outra.
`;

          GM_xmlhttpRequest({
            method: 'POST',
            url: 'https://openrouter.ai/api/v1/chat/completions',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            data: JSON.stringify({
              model: MODEL,
              messages: [
                {
                  role: 'system',
                  content: 'Responda sempre em português do Brasil. Não dê tantos detalhes. Responda somente no formato pedido.'
                },
                { role: 'user', content: prompt }
              ],
              temperature: 0
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

      // ─── Run ─────────────────────────────────────────────────────
      async function run() {
        const eraAtivo = autoPageActive;
        if (eraAtivo) stopAutoPage();

        setStatus('Lendo...', '#89b4fa');
        const q = extrair();

        if (!q) {
          setStatus('Não achei', '#f38ba8');
          if (eraAtivo) startAutoPage();
          return;
        }

        resultEl.textContent =
          `Pergunta:\n${q.pergunta}\n\n` +
          q.opcoes.map(o => `${o.letra}. ${o.texto}`).join('\n');

        try {
          setStatus('IA...', '#f9e2af');
          const r = await perguntarIA(q);
          setStatus('OK', '#a6e3a1');
          resultEl.textContent += `\n\n${r}`;
        } catch (e) {
          setStatus('Erro', '#f38ba8');
          resultEl.textContent = e.message;
        }

        if (eraAtivo) startAutoPage();
      }

      // ─── Botões ──────────────────────────────────────────────────
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

      if (btn) btn.onclick = run;

      resetBtn.onclick = () => {
        GM_setValue('apiKey', '');
        GM_setValue('bookTitle', '');
        GM_setValue('noAI', false);
        init();
      };

      setStatus(
        apiKey ? 'Pronto (IA ativa)' : 'Pronto (só leitura)',
        apiKey ? '#a6e3a1' : '#f9e2af'
      );
    }
  }
})();
