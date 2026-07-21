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

  const MODELO_PADRAO = 'cohere/north-mini-code:free';

  // Lista curada — propósito geral (raciocínio/escrita), não coder/rerank/safety.
  // Atenção: catálogo free do OpenRouter rotaciona; confirme em openrouter.ai/models
  // antes de assumir que um slug ainda está ativo.
  const MODELOS_CURADOS = [
    { label: 'Cohere: North Mini Code (free)', value: 'cohere/north-mini-code:free' },
    { label: 'OpenAI: gpt-oss-120b (free)', value: 'openai/gpt-oss-120b:free' },
    { label: 'Meta: Llama 3.3 70B Instruct (free) — instável no momento', value: 'meta-llama/llama-3.3-70b-instruct:free' },
    { label: 'Outro (digitar manualmente)', value: '__custom__' }
  ];

  // ─── Chaves GM ───────────────────────────────────────────────────────────────
  // autoMinMin : intervalo mínimo de auto-página em minutos (default 2)
  // autoMaxMin : intervalo máximo de auto-página em minutos (default 3)
  // Limites de segurança: mín 0,5 min (30s) · máx 60 min (1h)
  const AUTO_MIN_DEFAULT = 2;
  const AUTO_MAX_DEFAULT = 3;

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

  function getModeloAtual() {
    return GM_getValue('selectedModel', MODELO_PADRAO);
  }

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
            width:100%;box-sizing:border-box;padding:10px 12px;border:2px solid #6c5fc7;border-radius:8px;margin:0 0 6px 0;background:#11111b;color:#cdd6f4;font-family:monospace;font-size:14px;outline:none;display:block;transform:translateY(-7px);text-align:left;">
        <div id="ea-err" style="display:none;color:#f38ba8;font-size:12px;margin-top:3px;transform:translateY(-7px);"></div>
        <button id="ea-ok" class="ea-btn-animado" style="
          width:100%;padding:11px;border:none;border-radius:10px;
          background:#a6e3a1;color:#1e1e2e;font-weight:bold;
          font-size:14px;cursor:pointer;
        ">Continuar</button>
        <button id="ea-noai" class="ea-btn-animado" style="
          width:100%;padding:11px;border:none;border-radius:10px;
          background:#313244;color:#cdd6f4;font-weight:bold;
          font-size:14px;cursor:pointer;
        ">Não quero usar IA</button>
      `);

      document.getElementById('ea-ok').onclick = () => {
        const key = document.getElementById('ea-inp').value.trim();
        if (!key) {
          const err = document.getElementById('ea-err');
          err.style.display = 'block';
          err.textContent = 'Insira uma API Key.';
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

    // ─── NOVA FUNÇÃO RENDERPANEL (FLUTUANTE E ARRASTÁVEL) ───────────────────────
  function renderPanel(html) {
    let panel = document.getElementById('ea-panel');

    // Se o painel ainda não existe na página, cria a CASCA FIXA uma única vez
    if (!panel) {
        // INJETAR FOLHA DE ESTILOS PARA ANIMAÇÕES SUAVES
        const estiloAnimacoes = document.createElement('style');
      estiloAnimacoes.textContent = `
        .ea-btn-animado {
          transition: background-color 0.2s ease, transform 0.1s ease, filter 0.2s ease !important;
        }
        .ea-btn-animado:hover {
          filter: brightness(1.1);
          transform: translateY(-1px);
        }
        .ea-btn-animado:active {
          transform: translateY(1px) scale(0.98);
        }

        .ea-btn-icone {
          transition: background-color 0.2s ease, transform 0.1s ease, color 0.2s ease !important;
        }
        .ea-btn-icone:hover {
          background-color: #45475a !important;
          color: #f5e0dc !important;
        }
        .ea-btn-icone:active {
          transform: scale(0.92);
        }

         @keyframes eaFadeKeyframe {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .ea-fade-in {
          animation: eaFadeKeyframe 0.25s cubic-bezier(0.25, 1, 0.5, 1) forwards !important;
        }
      `;
      document.head.appendChild(estiloAnimacoes);

      panel = document.createElement('div');
      panel.id = 'ea-panel';
      panel.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 999999;
        background: #1e1e2e;
        color: #cdd6f4;
        font-family: monospace;
        border: 1px solid #313244;
        border-radius: 16px;
        padding: 20px;
        box-shadow: 0 12px 40px rgba(0,0,0,0.6);
        width: 380px;
        max-width: calc(100vw - 40px);
        display: flex;
        flex-direction: column;
      `;

            // Define a barra de título com o contador jogado para o canto direito, ao lado do botão -
      panel.innerHTML = `
        <div id="ea-drag-header" style="
          cursor: move;
          user-select: none;
          background: #11111b;
          margin: -20px -20px 0 -20px;
          padding: 16px 20px 24px 20px;
          border-radius: 16px 16px 0 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: relative;
          z-index: 1;
        ">
          <strong style="color: #cba6f7; font-size: 13px; letter-spacing: 0.5px;"> Elefante Letrado Script</strong>

          <div style="display: flex; align-items: center; gap: 12px;">
            <span id="ea-page-count" style="background: #313244; color: #a6e3a1; font-size: 11px; padding: 2px 8px; border-radius: 9999px; font-weight: bold; border: 1px solid #45475a; white-space: nowrap;">Pags: 0</span>
            <button id="ea-min-btn" class="ea-btn-icone" style="width: 24px; height: 24px; border: none; border-radius: 6px; background: #313244; color: #cdd6f4; cursor: pointer; font-size: 14px; font-weight: bold; line-height: 1;">−</button>
          </div>
        </div>
        <div id="ea-panel-content" style="
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: #1e1e2e;
          margin: -12px -20px -20px -20px;
          padding: 24px 20px 20px 20px;
          border-radius: 18px 18px 12px 12px;
          position: relative;
          z-index: 2;
          box-shadow: 0 -4px 15px rgba(0, 0, 0, 0.3);
        "></div>
      `;

      document.body.appendChild(panel);

      // ── LÓGICA DE ARRASTAR (DRAG & DROP) ──
      let isDragging = false, offsetX, offsetY;
      const header = document.getElementById("ea-drag-header");

      // Quando segura o clique no cabeçalho
      header.addEventListener('mousedown', e => {
        if (e.target.tagName === "BUTTON") return;
        isDragging = true;
        offsetX = e.clientX - panel.offsetLeft;
        offsetY = e.clientY - panel.offsetTop;
      });

            document.addEventListener('mousemove', e => {
        if (!isDragging) return;

        // 1. Calcula a nova posição baseada no mouse
        let newLeft = e.clientX - offsetX;
        let newTop  = e.clientY - offsetY;

        // 2. Define os limites máximos da tela do navegador
        const maxLeft = window.innerWidth - panel.offsetWidth;
        const maxTop  = window.innerHeight - panel.offsetHeight;

        // 3. Aplica as travas (não deixa ser menor que 0 nem maior que o máximo)
        if (newLeft < 0) newLeft = 0;
        if (newLeft > maxLeft) newLeft = maxLeft;

        if (newTop < 0) newTop = 0;
        if (newTop > maxTop) newTop = maxTop;

        // 4. Aplica os valores finais travados no painel
        panel.style.left = newLeft + "px";
        panel.style.top = newTop + "px";
        panel.style.right = "auto";
        panel.style.bottom = "auto";
      });


      // Quando solta o clique do mouse em qualquer lugar da tela
      document.addEventListener('mouseup', () => { isDragging = false; });

      // ── LÓGICA DE MINIMIZAR ──
      let minimized = false;
      const minBtn = document.getElementById("ea-min-btn");
      const contentArea = document.getElementById("ea-panel-content");

      minBtn.onclick = () => {
        minimized = !minimized;
        if (minimized) {
          contentArea.style.display = "none";
          minBtn.textContent = "+";
        } else {
          contentArea.style.display = "flex";
          minBtn.textContent = "−";
        }
      };
    }

    // MIOLO DINÂMICO: Alimenta apenas a região de conteúdo, mantendo o cabeçalho e os eventos intactos
    const contentArea = document.getElementById('ea-panel-content');
    if (contentArea) {
      // 1. Remove a classe para resetar o efeito
      contentArea.classList.remove('ea-fade-in');

      // 2. Injeta o novo HTML da tela
      contentArea.innerHTML = html;

      // 3. Força o navegador a reiniciar a animação
      void contentArea.offsetWidth;
      contentArea.classList.add('ea-fade-in');
    }
  }


  // ─── Painel de configuração (engrenagem) ─────────────────────────────────────
  // Contém: seleção de modelo + intervalo de auto-página.
  function abrirConfigModelo(onVoltar) {
    const modeloSalvo  = getModeloAtual();
    const ehCurado     = MODELOS_CURADOS.some(m => m.value === modeloSalvo);
    const autoMinSalvo = GM_getValue('autoMinMin', AUTO_MIN_DEFAULT);
    const autoMaxSalvo = GM_getValue('autoMaxMin', AUTO_MAX_DEFAULT);

    const optionsHtml = MODELOS_CURADOS.map(m => {
      const selected = (m.value === modeloSalvo) ? 'selected' : '';
      return `<option value="${m.value}" ${selected}>${m.label}</option>`;
    }).join('');

    renderPanel(`
      <div style="display:flex;flex-direction:column;align-items:center;">

        <b style="color:#cba6f7;font-size:16px;">⚙ Configurações</b>

        <!-- ── Modelo ── -->
        <p style="
          margin:14px 0 6px;font-size:15px;color:#a6adc8;
          width:100%;text-align:left;
        ">Modelo de IA:</p>

        <select id="ea-model-select" style="
          width:100%;box-sizing:border-box;padding:9px 10px;border:2px solid #45475a;border-radius:8px;
          background:#11111b;color:#cdd6f4;font-family:monospace;font-size:13px;margin-bottom:8px;
          display:block;text-align:center;text-align-last:center;
        ">
          ${optionsHtml}
        </select>

        <input id="ea-model-custom" type="text" placeholder="provider/nome-do-modelo:free"
          value="${ehCurado ? '' : modeloSalvo}"
          style="
            width:100%;box-sizing:border-box;padding:9px 10px;border:2px solid #45475a;border-radius:8px;
            background:#11111b;color:#89b4fa;font-family:Inter,sans-serif;font-size:12px;margin-bottom:6px;
            display:${ehCurado ? 'none' : 'block'};text-align:left;
          ">

        <div style="font-size:11px;color:#6c7086;margin-bottom:4px;width:100%;text-align:left;">
          Mais modelos em:
          <a href="https://openrouter.ai/models" target="_blank"
             style="color:#89b4fa;text-decoration:none;">openrouter.ai/models</a>
        </div>

        <!-- ── Divider ── -->
        <div style="width:100%;border-top:1px solid #313244;margin:14px 0;"></div>

        <!-- ── Intervalo de auto-página ── -->
        <p style="
          margin:0 0 8px;font-size:15px;color:#a6adc8;
          width:100%;text-align:left;
          transform:translateY(4px);
        ">Intervalo de auto-página (minutos):</p>

        <div style="display:flex;align-items:center;gap:10px;width:100%;margin-bottom:4px;">
          <input id="ea-min-input" type="text" inputmode="decimal"
          placeholder="${AUTO_MIN_DEFAULT}" value="${autoMinSalvo}"
          style="
            flex:1 1 0;min-width:0;height:48px;padding:0 12px;border:2px solid #45475a;border-radius:8px;
            background:#11111b;color:#cdd6f4;font-family:Inter,sans-serif;font-size:15px;
            font-weight:500;line-height:48px;text-align:center;box-sizing:border-box;outline:none;
          ">
          <span style="color:#a6adc8;font-size:15px;flex-shrink:0;">a</span>
          <input id="ea-max-input" type="text" inputmode="decimal"
            placeholder="${AUTO_MAX_DEFAULT}" value="${autoMaxSalvo}"
            style="
              flex:1 1 0;min-width:0;height:48px;padding:0 12px;border:2px solid #45475a;border-radius:8px;
              background:#11111b;color:#cdd6f4;font-family:Inter,sans-serif;font-size:15px;
              font-weight:500;line-height:48px;text-align:center;box-sizing:border-box;outline:none;
            ">
        </div>

        <div id="ea-interval-err"
          style="color:#f38ba8;font-size:12px;min-height:0;margin-bottom:2px;width:100%;transform: translateY(-5px);"></div>

        <!-- ── Ações ── -->
        <button id="ea-model-save" class="ea-btn-animado" style="
          width:100%;padding:11px;border:none;border-radius:10px;
          background:#a6e3a1;color:#1e1e2e;font-weight:bold;
          font-size:14px;cursor:pointer;margin-bottom:8px;
        ">💾 Salvar</button>

        <button id="ea-model-back" class="ea-btn-animado" style="
          width:100%;padding:10px;border:none;border-radius:10px;
          background:#45475a;color:#cdd6f4;font-weight:bold;
          font-size:13px;cursor:pointer;
        ">← Voltar</button>

      </div>
    `);

    const selectEl  = document.getElementById('ea-model-select');
    const customEl  = document.getElementById('ea-model-custom');
    const minInput  = document.getElementById('ea-min-input');
    const maxInput  = document.getElementById('ea-max-input');
    const intervalErr = document.getElementById('ea-interval-err');
    const saveBtn   = document.getElementById('ea-model-save');
    const backBtn   = document.getElementById('ea-model-back');

    // Mostra/oculta campo de modelo customizado
    selectEl.addEventListener('change', () => {
      customEl.style.display = (selectEl.value === '__custom__') ? 'block' : 'none';
    });

    // Normaliza separador decimal (vírgula → ponto)
    function parseMinutos(str) {
      return parseFloat(str.replace(',', '.'));
    }

    saveBtn.onclick = () => {
      // ── Validar modelo ──
      let novoModelo;
      if (selectEl.value === '__custom__') {
        novoModelo = customEl.value.trim();
        if (!novoModelo) return;
      } else {
        novoModelo = selectEl.value;
      }

      // ── Validar intervalo ──
      const minVal = parseMinutos(minInput.value);
      const maxVal = parseMinutos(maxInput.value);

      if (isNaN(minVal) || isNaN(maxVal)) {
        intervalErr.textContent = 'Insira números válidos nos dois campos.';
        return;
      }
      if (minVal < 0.5) {
        intervalErr.textContent = 'Mínimo permitido: 0,5 min (30 segundos).';
        return;
      }
      if (maxVal > 60) {
        intervalErr.textContent = 'Máximo permitido: 60 min (1 hora).';
        return;
      }
      if (minVal >= maxVal) {
        intervalErr.textContent = 'O mínimo deve ser menor que o máximo.';
        return;
      }

      intervalErr.textContent = '';

      // ── Persistir ──
      GM_setValue('selectedModel', novoModelo);
      GM_setValue('autoMinMin', minVal);
      GM_setValue('autoMaxMin', maxVal);

      onVoltar();
    };

    backBtn.onclick = onVoltar;
  }

  function iniciarPrincipal(apiKey, bookTitle) {
    let autoPageActive = false;
    let autoPageTimer  = null;
    let quizProcessando = false;
    let paginasLidas   = 0;

    function renderPainelPrincipal() {
      renderPanel(`
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <b style="color:#cba6f7;font-size:16px;">📘 ${bookTitle || 'Modo leitura'}</b>
          <button id="ea-config-btn" class="ea-btn-icone" title="Configurar modelo de IA" style="
            background:#313244;border:none;border-radius:8px;color:#cdd6f4;
            font-size:14px;cursor:pointer;padding:4px 9px;line-height:1;
          ">⚙</button>
        </div>
        <div id="ea-status" style="font-size:14px;color:#a6adc8;">Pronto</div>

        <button id="ea-auto-btn" class="ea-btn-animado" style="
          width:100%;padding:11px;border:none;
          border-radius:10px;background:#89b4fa;
          font-weight:bold;font-size:14px;cursor:pointer;color:#1e1e2e;
          transform:translateY(5px);
        ">${apiKey ? '▶ Iniciar' : '▶ Iniciar Auto-Página'}</button>

        <div id="ea-result" style="
          max-height:300px;overflow:auto;font-size:12px;
          white-space:pre-wrap;color:#a6adc8;
        "></div>

        <button id="ea-reset-btn" class="ea-btn-animado" style="
          width:100%;padding:10px;border:none;
          border-radius:10px;background:#45475a;
          font-size:13px;font-weight:bold;cursor:pointer;color:#cdd6f4;
        ">⚙ Reconfigurar</button>
      `);

      const statusEl = document.getElementById('ea-status');
      const resultEl = document.getElementById('ea-result');
      const autoBtn  = document.getElementById('ea-auto-btn');
      const resetBtn = document.getElementById('ea-reset-btn');
      const configBtn = document.getElementById('ea-config-btn');

      function setStatus(t, c = '#a6e3a1') {
        statusEl.textContent = t;
        statusEl.style.color = c;
      }

      configBtn.onclick = () => {
        if (observer) observer.disconnect();
        abrirConfigModelo(() => {
          renderPainelPrincipal();
          if (observer) observer.observe(document.body, { childList: true, subtree: true });
        });
      };

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

            // SOMAR +1 NO CONTADOR VISUAL E ATUALIZAR O TOPO
            paginasLidas++;
            const contadorEl = document.getElementById('ea-page-count');
            if (contadorEl) {
              contadorEl.textContent = `Páginas: ${paginasLidas}`;
            }
          }

          // ── Lê intervalo configurado pelo usuário ──────────────────────────
          const minMs = GM_getValue('autoMinMin', AUTO_MIN_DEFAULT) * 60000;
          const maxMs = GM_getValue('autoMaxMin', AUTO_MAX_DEFAULT) * 60000;
          const delay = Math.random() * (maxMs - minMs) + minMs;
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
        const todosFund2 = [...modal.querySelectorAll('button.fund2-button')];
        if (todosFund2.length === 0) return null;
        const temW50 = todosFund2.some(b => b.classList.contains('w-50'));
        if (temW50) return null;
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
        const modeloAtual = getModeloAtual();

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
- Não use -, ─ ou qualquer sinal que n seja , . : ; e as acentouações

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
                model: modeloAtual,
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

          const btnAnalisar = await aguardarBotao('Analisar com IA', 5000);
          if (btnAnalisar) {
              btnAnalisar.click();
          }

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

          if (!btnProxima) { setStatus('OK (sem próxima)', '#a6e3a1'); return; }
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
          console.log('=== DEBUG EXTRACAO ===');
          console.log('Tipo:', q?.tipo);
          console.log('Pergunta enviada pra IA:', q?.pergunta);
          console.log('Tamanho da pergunta (chars):', q?.pergunta?.length);

          const modalDebug = getModal();
          console.log('--- HTML completo do modal (innerText) ---');
          console.log(modalDebug?.innerText);
          console.log('=== FIM DEBUG ===');
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
            const match = r.match(/Resposta:\s*\[?([A-D])\]?/i);
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
        paginasLidas = 0;
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

          const continuarBtn = detectarTelaFinal();
          if (continuarBtn) {
            continuarBtn.click();
            const esperarFechar = setInterval(() => {
              if (!getModal()) {
                clearInterval(esperarFechar);
                startAutoPage();
              }
            }, 300);
            return;
          }

          if (!apiKey) return;
          if (!extrair()) return;
          stopAutoPage();
          run();
        }, 300);
      });

      observer.observe(document.body, { childList: true, subtree: true });
    }

    renderPainelPrincipal();
  }

})();
