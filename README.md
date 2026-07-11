# 📘 Elefante Letrado Automático

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Platform](https://img.shields.io/badge/platform-browser-blue)
![Type](https://img.shields.io/badge/type-userscript-yellow)

---

#  Sobre o projeto

O **Elefante Letrado Automático** é um userscript para **Tampermonkey** que adiciona recursos de automação e assistência à plataforma Elefante Letrado.

O script oferece ferramentas para automatizar a navegação durante a leitura e, opcionalmente, integrar modelos de Inteligência Artificial através do OpenRouter para auxiliar na interpretação de atividades.

O uso da IA é totalmente opcional. O script funciona normalmente apenas com os recursos de automação caso o usuário prefira não utilizar nenhuma API externa.

---

#  É seguro?

- O script é executado inteiramente no seu navegador.
- Nenhum dado é enviado para servidores próprios.
- Quando a IA está ativada, apenas o conteúdo necessário para análise das atividades é enviado diretamente para a API escolhida pelo usuário.
- A chave da API é armazenada localmente pelo Tampermonkey.

---

# Principais funções

- Navegação automática entre páginas.
- Sistema de auto-paginação.
- Configuração inicial totalmente pela interface.
- Detecção automática do livro aberto.
- Extração automática de perguntas e alternativas.
- Integração opcional com modelos de IA via OpenRouter.
- Interface gráfica integrada à plataforma.
- Painel de configurações para alterar modelo de IA e intervalo da auto-paginação.
- Modo sem IA para utilizar apenas os recursos de automação.
- Retomada automática da auto-paginação ao finalizar um quiz.

---

#  Instalação

O script foi desenvolvido para utilização com o **Tampermonkey**.

## 1. Instale o Tampermonkey

Disponível para:

- [Google Chrome](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- [Mozilla Firefox](https://addons.mozilla.org/firefox/addon/tampermonkey/)
- [Microsoft Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

## 2. Adicione o script

- Abra o painel do Tampermonkey.
- Clique em **Criar novo script**.
- Cole o conteúdo do arquivo `Script.js`.
- Salve.

## 3. Abra o Elefante Letrado

Acesse normalmente a plataforma.

Na primeira execução o painel de configuração será exibido automaticamente.

---

# Primeira execução

Ao iniciar o script pela primeira vez, será exibido um pequeno painel de configuração.

Você poderá escolher entre:

- Informar sua **API Key do OpenRouter** para utilizar recursos de IA;
- Ou selecionar **"Não quero usar IA"**, habilitando apenas os recursos de automação.

Não é necessário editar nenhum arquivo do script.

O nome do livro é detectado automaticamente sempre que possível e armazenado para utilização nas próximas execuções.

---

# ⚙ Painel de Configurações

O botão **⚙** disponível no painel principal permite alterar as configurações do script a qualquer momento.

Atualmente é possível configurar:

### Modelo de IA

- Selecionar um modelo da lista recomendada.
- Informar manualmente qualquer modelo disponível no OpenRouter.

### Auto-paginação

Definir um intervalo aleatório entre:

- mínimo: **0,5 minuto (30 segundos)**
- máximo: **60 minutos**

Essas configurações ficam armazenadas localmente pelo Tampermonkey.

---

#  API utilizada

Quando desejado, o script utiliza a API da **OpenRouter**.

## Para utilizar IA:

1. Crie uma conta no [OpenRouter](https://openrouter.ai).
2. Gere uma API Key em [OpenRouter Key](https://openrouter.ai/workspaces/default/keys).
3. Na primeira execução do script, cole a chave quando o painel solicitar.

A API Key fica armazenada apenas localmente pelo Tampermonkey e pode ser alterada ou removida a qualquer momento através da opção de reconfiguração do script.
