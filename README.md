# Villa Ninita — Acompanhamento de Serviços

Registro do início e da finalização dos serviços da obra Villa Ninita
(Poço da Panela, Recife/PE — Rio Ave), com fotos, apontamentos e
planejamento de tarefas futuras.

Site estático: HTML, CSS e JavaScript puros, sem etapa de compilação.
Os dados ficam no Supabase (banco Postgres + depósito de fotos).

- Publicado: <https://robertodmoraescardoso-ctrl.github.io/NINITA_SERVI-OS/>
- Repositório: <https://github.com/robertodmoraescardoso-ctrl/NINITA_SERVI-OS>

---

## Estrutura de pastas

```
index.html              página única (o nome tem que ser exatamente este)
config.js               URL e chave publicável do Supabase
assets/
  css/estilo.css        todo o visual (cores da obra, layout, impressão)
  img/                  logo e ícone
  js/                   o sistema, dividido por assunto:
    main.js             ponto de partida
    supabase.js         conexão, validação da URL/chave, gravação
    erros.js            mensagens de erro em português
    ui.js               utilitários de tela e avisos
    datas.js            datas, dias úteis e feriados de Recife
    servicos.js         regras do serviço: atraso, duração, quantitativo
    estado.js           dados em memória enquanto a página está aberta
    fotos.js            compressão e envio de fotos
    login.js            telas de configuração e login
    filtros.js          filtro e ordenação do painel
    painel.js           indicadores, resumo quantitativo, cartões
    gantt.js            linha do tempo
    planejamento.js     aba Planejamento
    acompanhamento.js   aba Acompanhamento
    cadastro.js         cadastro e edição de serviço
    galeria.js          visualizador de fotos
    dados.js            exportação CSV, backup e restauração
    navegacao.js        troca de abas
    eventos.js          cliques, teclas e campos
    exemplo.js          dados de exemplo para obra vazia
    localizacoes.js     frente > pavimento > unidade: leitura, texto e gravação
    inferencia.js       sugere frente/pavimento a partir do título e do local
    seletorLocal.js     escolha de frente e pavimentos no cadastro
    locais.js           tela "Locais" (cadastro da árvore)
    triagem.js          tela de classificação dos serviços sem localização
migracoes/              scripts SQL do banco, numerados (rodar em ordem)
```

> **Atenção ao publicar:** o `index.html`, o `config.js` e a pasta `assets/`
> inteira têm que ir juntos. Se faltar algo, o site mostra um aviso em vez de
> abrir — não fica em branco.

---

## Rodar no computador (VS Code + Live Server)

Os arquivos de `assets/js` são *módulos*, e o navegador só carrega módulos
quando a página vem de um endereço `http://`. **Abrir o `index.html` com dois
cliques não funciona** — use o Live Server:

1. No VS Code, instale a extensão **Live Server** (autor: Ritwick Dey).
2. **Arquivo > Abrir Pasta…** e escolha a pasta do projeto
   (`C:\Users\RobertoCardoso\Obras\NINITA_SERVI-OS`).
3. Clique em **Go Live**, no rodapé do VS Code. O navegador abre em
   `http://127.0.0.1:5500/`.

Atenção: rodando local, o sistema usa **o mesmo banco da produção**
(o do `config.js`). Tudo o que for gravado aparece para a equipe.

---

## Trabalhar com branches (uma por fase)

No VS Code, o ícone de ramificação na barra lateral (Controle do Código-Fonte)
faz tudo por botão. Pelo terminal do VS Code (**Terminal > Novo Terminal**):

```bash
git checkout fase-1-separacao
```

Muda para a branch da fase. Para voltar à versão publicada:

```bash
git checkout main
```

---

## Publicar no GitHub Pages

O GitHub Pages publica a branch `main`. Para levar uma fase aprovada ao ar:

```bash
git checkout main
```

```bash
git merge fase-1-separacao
```

```bash
git push origin main
```

Em 1 a 2 minutos o site atualiza. Na primeira vez, o Windows abre uma janela
para você entrar na sua conta do GitHub.

Conferir em **Settings > Pages** do repositório: *Source = Deploy from a
branch*, *Branch = main*, pasta */ (root)*.

**Celulares podem guardar a versão anterior por alguns minutos.** Se algo
parecer misturado depois de publicar, feche a aba e abra de novo.

---

## Publicar no Netlify

Opção 1 — ligado ao GitHub (recomendado, atualiza sozinho a cada `push`):

1. Netlify > **Add new site > Import an existing project > GitHub**.
2. Escolha `NINITA_SERVI-OS`, branch `main`.
3. **Build command:** deixe vazio. **Publish directory:** `.` (a raiz).

Opção 2 — arrastar a pasta: Netlify > **Sites > Deploy manually** e arraste a
pasta do projeto inteira (não só o `index.html`).

---

## Configuração do Supabase (`config.js`)

| Campo | Valor certo | Erro comum |
|---|---|---|
| `SUPABASE_URL` | `https://<ref>.supabase.co` | colar com `/rest/v1/` no final |
| `SUPABASE_CHAVE` | começa com `sb_publishable_` | colar a `sb_secret_` ou a `service_role` |

O sistema confere os dois ao abrir e explica na tela o que está errado.
A chave secreta e a `service_role` são recusadas: elas dão acesso total ao
banco e nunca podem ficar num site.

Se um aparelho guardou uma configuração errada, use o botão
**Trocar o projeto Supabase** na tela de login.

---

## Aplicar migrações do banco

A partir da Fase 2, as mudanças no banco vêm em arquivos numerados em
`migracoes/` (ex.: `002_localizacoes.sql`). Todas são **aditivas**: só criam
tabelas e colunas, nunca apagam dados.

1. Abra o projeto no Supabase > **SQL Editor > New query**.
2. Copie o conteúdo inteiro do arquivo `.sql` e cole.
3. Clique em **Run**. Deve aparecer *Success*.
4. Rode na ordem dos números e **uma vez só** cada arquivo
   (os scripts toleram ser rodados de novo, mas não há motivo para isso).
5. Só depois publique a versão do site que usa a migração.

---

## Localização (frente > pavimento > unidade)

Depende da migração `migracoes/002_localizacoes.sql`. Enquanto ela não for
rodada, o sistema funciona normalmente e mostra um aviso no painel.

- **Botão Locais** (topo): cadastra pavimentos de uma vez ("do 1º ao 12º",
  com subsolo, térreo e coberta) e unidades ("101-104, Hall").
- **Painel:** 1º clique na frente, 2º no pavimento. O número em cada botão é
  a quantidade de serviços em aberto ali.
- **Cadastro:** campo Localização com atalho "marcar do 1º ao 4º". Um serviço
  pode cobrir vários pavimentos.
- **Sem localização:** os serviços antigos aparecem nesse botão. "Classificar
  agora" mostra a sugestão tirada do título e do campo Local de cada um.

## Regras de negócio que não devem mudar sem decisão da engenharia

- **Dias úteis:** segunda a sexta, descontando os feriados listados em
  `assets/js/datas.js` (nacionais, estadual de PE e municipais do Recife,
  2026–2027). O cronograma oficial vive no MS Project com o mesmo calendário.
- **Datas:** gravadas como `AAAA-MM-DD` e sempre lidas como data de calendário
  local (nunca `new Date("2026-07-06")`, que vira o dia anterior no Brasil).
- **Exclusões:** localizações e ligações nunca são apagadas (só ganham
  `excluido_em`). Serviços e apontamentos ainda têm exclusão física; a lógica
  entra numa fase futura.
