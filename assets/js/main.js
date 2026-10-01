/* ============================================================
   VILLA NINITA — ACOMPANHAMENTO DE SERVIÇOS
   Ponto de partida. Os demais arquivos de assets/js/:

     config.js (raiz)    URL e chave publicável do Supabase
     supabase.js         conexão e gravação na nuvem
     erros.js            mensagens de erro em português
     ui.js               utilitários de tela e avisos
     datas.js            datas, dias úteis e feriados de Recife
     servicos.js         regras do serviço (atraso, duração, quantitativo)
     estado.js           dados em memória enquanto a página está aberta
     fotos.js            compressão e envio de fotos
     login.js            telas de configuração e login, início
     filtros.js          filtro e ordenação do painel
     painel.js           indicadores, resumo quantitativo e cartões
     gantt.js            linha do tempo
     planejamento.js     aba Planejamento (tarefas futuras)
     acompanhamento.js   aba Acompanhamento (apontamentos)
     cadastro.js         cadastro e edição de serviço
     galeria.js          visualizador de fotos
     dados.js            exportação CSV, backup e restauração
     navegacao.js        troca de abas e redesenho geral
     eventos.js          cliques, teclas e campos
     exemplo.js          dados de exemplo para obra vazia
   ============================================================ */
import { instalarCapturaGlobal } from "./erros.js";
import "./eventos.js";
import { iniciar } from "./login.js";

instalarCapturaGlobal();

/* avisa o index.html de que os arquivos carregaram (ver o script de
   segurança no fim do index.html) */
window.vnCarregado = true;

iniciar();
