-- =====================================================================
-- NFEio: DANFE (PDF) da NF-e
-- Coluna `invoice_pdf_url` em returns + bucket privado `invoice-pdfs`.
-- O XML continua em `invoice-xmls` (já existente). Ambos são buscados na
-- bipagem (Etapa 1) e persistidos por NF (path `ak/<chave>.{xml,pdf}`).
-- Execute no SQL Editor do Supabase Dashboard (ou via supabase db push).
-- =====================================================================

alter table returns add column if not exists invoice_pdf_url text;  -- DANFE (PDF) consultado na NFEio

-- Bucket privado para os PDFs (espelha as policies de invoice-xmls)
insert into storage.buckets (id, name, public)
values ('invoice-pdfs', 'invoice-pdfs', false)
on conflict (id) do nothing;

create policy "operators insert invoice-pdfs" on storage.objects
  for insert with check (
    bucket_id = 'invoice-pdfs'
    and (public.is_operator() or public.is_manager())
  );

create policy "authenticated read invoice-pdfs" on storage.objects
  for select using (
    bucket_id = 'invoice-pdfs'
    and auth.uid() is not null
  );

create policy "managers delete invoice-pdfs" on storage.objects
  for delete using (
    bucket_id = 'invoice-pdfs'
    and public.is_manager()
  );
