// ==UserScript==
// @name         Elefante Assistente de Estudo
// @namespace    http://tampermonkey.net/
// @match        https://reader.elefanteletrado.com.br/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      openrouter.ai
// ==/UserScript==

(function () {
  'use strict';

  const MODEL = 'cohere/north-mini-code:free';

  let observer = null;
  let debounceTimer = null;

  window.addEventListener('load', () => {
    let tentativas = 0;
    function aguardar() {
      const achou = document.querySelector('span.book-title');
      if (achou || tentativas >= 20) {
        init();
      } else {
        tentativas++;
        setTimeout(aguardar, 500);
      }
    }
    setTimeout(aguardar, 1000);
  });

  function init() {
    const savedKey  = GM_getValue('apiKey', '');
    const savedBook = GM_getValue('bookTitle', '');
    const noAI      = GM_getValue('noAI', false);

    const nomeAutomatico = document.querySelector('span.book-title')?.title?.trim() || '';

    if (nomeAutomatico) {
      GM_setValue('bookTitle', nomeAutomatico);
    }

    const bookTitle = nomeAutomatico || savedBook;

    if (noAI || (savedKey && bookTitle)) {
      iniciarPrincipal(savedKey, noAI ? nomeAutomatico : bookTitle);
      return;
    }

    mostrarSetupApiKey();

    function mostrarSetupApiKey() {
      renderPanel(`
        <b style="color:#cba6f7;font-size:16px;">🔑 Configuração</b>
        <p style="margin:14px 0 8px;font-size:14px;color:#a6adc8;">Cole sua API Key do OpenRouter:</p>
        <input id="ea-inp" type="password" placeholder="sk-or-..."
          style="
            width:100%;box-sizing:border-box;padding:10px 12px;border:2px solid #6c5fc7;border-radius:8px;margin:0 0 6px 0;background:#11111b;color:#cdd6f4;font-family:monospace;font-size:14px;outline:none;display:block;transform:translateY(7px);">
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
        iniciarPrincipal(key, nomeAutomatico);
      };

      document.getElementById('ea-noai').onclick = () => {
        GM_setValue('noAI', true);
        iniciarPrincipal('', nomeAutomatico);
      };
    }
  }

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

  function iniciarPrincipal(apiKey, bookTitle) {
    let autoPageActive = false;
    let autoPageTimer  = null;
    let quizProcessando = false;

    renderPanel(`
      <b style="color:#cba6f7;font-size:16px;">📘 ${bookTitle || 'Modo leitura'}</b>
      <div id="ea-status" style="margin:12px 0;font-size:14px;color:#a6adc8;">Pronto</div>

      <button id="ea-auto-btn" style="
        width:100%;padding:11px;border:none;margin-bottom:8px;
        border-radius:10px;background:#89b4fa;
        font-weight:bold;font-size:14px;cursor:pointer;color:#1e1e2e;
        transform:translateY(5px);
      ">${apiKey ? '▶ Iniciar' : '▶ Iniciar Auto-Página'}</button>

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
    const resetBtn = document.getElementById('ea-reset-btn');

    function setStatus(t, c = '#a6e3a1') {
      statusEl.textContent = t;
      statusEl.style.color = c;
    }

    // ─── Auto-page ───────────────────────────────────────────────────────────
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
      autoBtn.textContent = '⏹ Parar';
      autoBtn.style.background = '#f38ba8';
      setStatus('Navegando...', '#89b4fa');
      function tick() {
        if (!autoPageActive) return;
        if (!isQuizOpen()) {
          document.body.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'ArrowRight', code: 'ArrowRight', bubbles: true
          }));
        }
        const delay = Math.random() * (180000 - 120000) + 120000;
        autoPageTimer = setTimeout(tick, delay);
      }
      tick();
    }

    function stopAutoPage() {
      clearTimeout(autoPageTimer);
      autoPageTimer = null;
      autoPageActive = false;
      autoBtn.textContent = apiKey ? '▶ Iniciar' : '▶ Iniciar Auto-Página';
      autoBtn.style.background = '#89b4fa';
      setStatus('Pronto');
    }

    // ─── Modal ───────────────────────────────────────────────────────────────
    function getModal() {
      return document.querySelector('ngb-modal-window.quiz-modal') ||
             document.querySelector('[role="dialog"]');
    }

    // ─── Tela final ──────────────────────────────────────────────────────────
    function detectarTelaFinal() {
      const modal = getModal();
      if (!modal) return null;
      // Tela final: só existe button.fund2-button sem .w-50
      const todosFund2 = [...modal.querySelectorAll('button.fund2-button')];
      if (todosFund2.length === 0) return null;
      const temW50 = todosFund2.some(b => b.classList.contains('w-50'));
      if (temW50) return null; // ainda é tela de quiz normal
      return todosFund2.find(b => b.textContent.includes('Continuar')) || null;
    }

    // ─── Extração do quiz ────────────────────────────────────────────────────
    function extrair() {
      const modal = getModal();
      if (!modal) return null;

      const textarea = modal.querySelector('textarea.form-control');
      if (textarea) {
        const pergunta = modal.querySelector('h6')?.innerText?.trim() || '';
        if (pergunta) return { tipo: 'dissertativa', pergunta };
        return null;
      }

      const linhas = modal.innerText
        .replace(/\r/g, '')
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)
        .filter(l =>
          !/^quiz$/i.test(l) &&
          !/^x$/i.test(l) &&
          !/^[1-9]$/.test(l) &&
          !/confirmar|voltar|próxima|proxima|continuar|biblioteca|analisar/i.test(l)
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

      return { tipo: 'multipla', pergunta, opcoes: opcoes.slice(0, 4) };
    }

    // ─── Chamada IA ──────────────────────────────────────────────────────────
    function perguntarIA(q) {
      return new Promise((resolve, reject) => {
        let prompt;

        if (q.tipo === 'dissertativa') {
          prompt = `Você é especialista no livro "${bookTitle}".
Responda a pergunta abaixo em português, com entre 10 e 100 palavras. Seja direto e preciso.
Responda apenas com o texto da resposta, sem introdução, sem "Resposta:", sem formatação extra.

Pergunta: ${q.pergunta}

REGRAS ABSOLUTAS:
- Comece a resposta diretamente, sem introdução
- Não use "Resposta:", "Claro!", "Aqui está" ou qualquer prefácio
- Não use marcadores, listas ou formatação
- Mínimo 10 palavras, máximo 80 palavras

Exemplo de formato correto (não use este conteúdo, só o formato):
"Percy foi enviado ao Acampamento Meio-Sangue porque descobriu ser filho de Poseidon e estava em perigo constante de monstros."`;
        } else {
          prompt = `Você é especialista no livro "${bookTitle}".

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
Se não, escolha outra.`;
        }

        let timeoutId;
        const timeoutPromise = new Promise((_, rej) => {
          timeoutId = setTimeout(() => rej(new Error('Tempo limite excedido (30s)')), 30000);
        });

        const requestPromise = new Promise((res, rej) => {
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
            onload: r => {
              try {
                const data = JSON.parse(r.responseText);
                if (data.error) { rej(new Error(`API: ${data.error.message}`)); return; }
                const txt = data.choices?.[0]?.message?.content;
                if (!txt) { rej(new Error('Resposta vazia da IA')); return; }
                res(txt);
              } catch {
                rej(new Error('Erro ao processar resposta da IA'));
              }
            },
            onerror: () => rej(new Error('Erro rede'))
          });
        });

        Promise.race([requestPromise, timeoutPromise])
          .then(result => { clearTimeout(timeoutId); resolve(result); })
          .catch(err   => { clearTimeout(timeoutId); reject(err); });
      });
    }

    // ─── Dissertativa ────────────────────────────────────────────────────────
    function colarResposta(texto) {
      const modal = getModal();
      if (!modal) return;
      const textarea = modal.querySelector('textarea.form-control');
      if (!textarea) return;

      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
      ).set;
      setter.call(textarea, texto);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function aguardarBotao(textoBotao, timeoutMs = 5000) {
      return new Promise((resolve) => {
        const inicio = Date.now();
        const intervalo = setInterval(() => {
          const modal = getModal();
          if (!modal) { clearInterval(intervalo); resolve(null); return; }

          const btn = [...modal.querySelectorAll('button')]
            .find(b =>
              b.textContent.trim().includes(textoBotao) &&
              !b.disabled &&
              !b.classList.contains('disabled')
            );

          if (btn) { clearInterval(intervalo); resolve(btn); return; }
          if (Date.now() - inicio > timeoutMs) { clearInterval(intervalo); resolve(null); }
        }, 200);
      });
    }

    async function confirmarDissertativa() {
      setStatus('Enviando...', '#cba6f7');
      const btnAnalisar = await aguardarBotao('Analisar com IA');
      if (!btnAnalisar) { setStatus('Btn não encontrado', '#f9e2af'); return; }
      btnAnalisar.click();

      setStatus('Aguardando resultado...', '#cba6f7');
      const btnProxima = await new Promise((resolve) => {
        const inicio = Date.now();
        const intervalo = setInterval(() => {
          const modal = getModal();
          if (!modal) { clearInterval(intervalo); resolve(null); return; }
          const btn = modal.querySelector('button.fund2-button.w-50:not(.disabled):not([disabled])');
          if (btn) { clearInterval(intervalo); resolve(btn); return; }
          if (Date.now() - inicio > 10000) { clearInterval(intervalo); resolve(null); }
        }, 200);
      });

      if (!btnProxima) { setStatus('OK', '#a6e3a1'); return; }
      btnProxima.click();
      setStatus('Próxima!', '#a6e3a1');
    }

    // ─── Run ─────────────────────────────────────────────────────────────────
    async function run() {
      if (quizProcessando) return;
      quizProcessando = true;

      if (observer) observer.disconnect();

      const eraAtivo = autoPageActive;
      if (eraAtivo) stopAutoPage();

      try {
        setStatus('Lendo...', '#89b4fa');
        const q = extrair();

        if (!q) {
          setStatus('Não achei', '#f38ba8');
          return;
        }

        if (q.tipo === 'dissertativa') {
          resultEl.textContent = `[Dissertativa]\nPergunta:\n${q.pergunta}\n\nAguardando IA...`;
        } else {
          resultEl.textContent =
            `Pergunta:\n${q.pergunta}\n\n` +
            q.opcoes.map(o => `${o.letra}. ${o.texto}`).join('\n');
        }

        setStatus('IA...', '#f9e2af');
        const r = await perguntarIA(q);
        setStatus('OK', '#a6e3a1');
        resultEl.textContent += `\n\n${r}`;

        if (q.tipo === 'dissertativa') {
          colarResposta(r.replace(/^[""\u201C\u201D''\u2018\u2019]+|[""\u201C\u201D''\u2018\u2019]+$/g, '').trim());
          await confirmarDissertativa();
        } else {
          const match = r.match(/Resposta:\s*([A-D])/i);
          if (match) {
            const letra = match[1].toUpperCase();
            const modal = getModal();
            if (modal) {
              const btnAlternativa = [...modal.querySelectorAll('button.answer-btn')]
                .find(b => b.querySelector('h5')?.textContent.trim().startsWith(letra));
              if (btnAlternativa) {
                btnAlternativa.click();
                setTimeout(() => {
                  const btnConfirmar = modal.querySelector('button.fund2-button.w-50:not(.disabled):not([disabled])');
                  if (btnConfirmar) btnConfirmar.click();
                }, 1000);
              }
            }
          }
        }
      } catch (e) {
        setStatus('Erro', '#f38ba8');
        resultEl.textContent = e.message;
      } finally {
        quizProcessando = false;
        if (observer) observer.observe(document.body, { childList: true, subtree: true });
        if (eraAtivo) startAutoPage();
      }
    }

    // ─── Botões ──────────────────────────────────────────────────────────────
    autoBtn.addEventListener('click', () => {
      if (autoPageActive) {
        stopAutoPage();
      } else {
        startAutoPage();
      }
    });

    resetBtn.onclick = () => {
      stopAutoPage();
      GM_setValue('apiKey', '');
      GM_setValue('bookTitle', '');
      GM_setValue('noAI', false);
      if (observer) { observer.disconnect(); observer = null; }
      clearTimeout(debounceTimer);
      init();
    };

    // ─── MutationObserver ────────────────────────────────────────────────────
    setStatus(
      apiKey ? '🛈 Modo com IA ativa' : 'ⓘ Modo de apenas leitura',
      apiKey ? '#a6e3a1' : '#f9e2af'
    );

    if (observer) {
      observer.disconnect();
      observer = null;
    }

    observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (quizProcessando) return;

        // Tela final tem prioridade — independe de apiKey
        const continuarBtn = detectarTelaFinal();
        if (continuarBtn) {
          continuarBtn.click();
          // Aguarda modal fechar, então retoma auto-página
          const esperarFechar = setInterval(() => {
            if (!getModal()) {
              clearInterval(esperarFechar);
              startAutoPage();
            }
          }, 300);
          return;
        }

        // Quiz normal só roda com IA ativa
        if (!apiKey) return;
        if (!extrair()) return;
        stopAutoPage();
        run();
      }, 300);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

})();
