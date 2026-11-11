-- =====================================================================
-- Decisão "Reenvio" (015): o cliente anexa dois PDFs obrigatórios —
-- a ETIQUETA de reenvio e a DANFE. O pedido segue com a mesma NF, então
-- não há XML novo; os arquivos vão para um bucket e colunas próprios,
-- separados da NF de devolução e da DANFE original do recebimento
-- (invoice_pdf_url, que nunca é sobrescrita).
--
-- reship_label_url / reship_danfe_url: caminhos em `reship-files`
--   (`<return_id>/<ts>-etiqueta.pdf`, `<return_id>/<ts>-danfe.pdf`).
-- =====================================================================

alter table returns add column if not exists reship_label_url text;
alter table returns add column if not exists reship_danfe_url text;

-- Bucket privado, só PDF, 5 MB (mesmo teto do anexo manual de NF)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reship-files', 'reship-files', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;

-- Cliente só grava na pasta de uma devolução de depositante vinculado a ele
create policy "clients insert reship-files" on storage.objects
  for insert with check (
    bucket_id = 'reship-files'
    and public.is_client()
    and exists (
      select 1 from public.returns r
      where r.id::text = (storage.foldername(name))[1]
        and r.depositor_id is not null
        and public.client_has_depositor(r.depositor_id)
    )
  );

create policy "managers insert reship-files" on storage.objects
  for insert with check (
    bucket_id = 'reship-files'
    and public.is_manager()
  );

create policy "authenticated read reship-files" on storage.objects
  for select using (
    bucket_id = 'reship-files'
    and auth.uid() is not null
  );

create policy "managers delete reship-files" on storage.objects
  for delete using (
    bucket_id = 'reship-files'
    and public.is_manager()
  );
