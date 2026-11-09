-- ============================================================
-- MIGRAÇÃO 003 — EFETIVO E PROGRAMAÇÃO SEMANAL
-- Villa Ninita · Acompanhamento de Serviços
--
-- O QUE FAZ
--   Cria duas tabelas NOVAS. Não altera nem apaga nada do que
--   já existe.
--
--   colaboradores   o efetivo da obra, por nome: função, empresa e
--                   categoria para a RUP (oficial, ajudante ou
--                   indireto — indireto não entra no cálculo)
--   programacao     a programação semanal: em cada dia, para cada
--                   serviço, quem trabalha e a meta de quantidade
--
-- COMO RODAR
--   Supabase > SQL Editor > New query > cole este arquivo > Run.
--   Deve aparecer "Success. No rows returned". Pode rodar de novo.
--
-- ENQUANTO NÃO RODAR
--   O site funciona normalmente; só a aba Semana e o cadastro de
--   efetivo ficam desligados, com aviso.
-- ============================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ------------------------------------------------------------
-- 1. Efetivo
-- ------------------------------------------------------------
create table if not exists public.colaboradores (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null check (length(trim(nome)) > 0),
  funcao       text not null default '',
  empresa      text not null default '',
  categoria    text not null default 'oficial'
               check (categoria in ('oficial', 'ajudante', 'indireto')),
  ativo        boolean not null default true,
  criado_em    timestamptz not null default now(),
  excluido_em  timestamptz            -- exclusão lógica: nunca DELETE
);

-- o mesmo nome não se repete entre os cadastros ativos
create unique index if not exists colaboradores_nome_unico
  on public.colaboradores (lower(trim(nome))) where excluido_em is null;

-- ------------------------------------------------------------
-- 2. Programação semanal (um registro por serviço por dia)
-- ------------------------------------------------------------
create table if not exists public.programacao (
  id               uuid primary key default gen_random_uuid(),
  servico_id       text not null references public.servicos(id) on delete cascade,
  data             date not null,
  colaboradores    uuid[] not null default '{}',
  meta_quantidade  numeric check (meta_quantidade is null or meta_quantidade >= 0),
  observacao       text not null default '',
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  excluido_em      timestamptz
);

create unique index if not exists programacao_servico_dia_unico
  on public.programacao (servico_id, data) where excluido_em is null;
create index if not exists programacao_data_idx
  on public.programacao (data) where excluido_em is null;

-- ------------------------------------------------------------
-- 3. Acesso: só usuários logados (mesma regra das outras tabelas)
-- ------------------------------------------------------------
alter table public.colaboradores enable row level security;
alter table public.programacao   enable row level security;

drop policy if exists "logados leem colaboradores"    on public.colaboradores;
drop policy if exists "logados gravam colaboradores"  on public.colaboradores;
drop policy if exists "logados alteram colaboradores" on public.colaboradores;
create policy "logados leem colaboradores"    on public.colaboradores for select to authenticated using (true);
create policy "logados gravam colaboradores"  on public.colaboradores for insert to authenticated with check (true);
create policy "logados alteram colaboradores" on public.colaboradores for update to authenticated using (true) with check (true);

drop policy if exists "logados leem programacao"    on public.programacao;
drop policy if exists "logados gravam programacao"  on public.programacao;
drop policy if exists "logados alteram programacao" on public.programacao;
create policy "logados leem programacao"    on public.programacao for select to authenticated using (true);
create policy "logados gravam programacao"  on public.programacao for insert to authenticated with check (true);
create policy "logados alteram programacao" on public.programacao for update to authenticated using (true) with check (true);
-- sem política de DELETE de propósito: exclusão é sempre lógica (excluido_em)
