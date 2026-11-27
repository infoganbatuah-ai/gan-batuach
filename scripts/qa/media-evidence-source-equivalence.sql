-- Synthetic, isolated PostgreSQL fixture for the media-evidence source choice.
-- No real Site or camera IDs. The original FROM LATERAL statement is invalid
-- SQL; this compares its documented intent with the repaired correlated query.
begin;
create temp table qa_sites (id int primary key);
create temp table qa_sources (id int primary key, site_id int, status text, health_status text, created_at int);
insert into qa_sites values (1),(2),(3);
insert into qa_sources values
  (10,1,'offline','healthy',1),
  (11,1,'ready','healthy',2),
  (12,1,'ready','healthy',3),
  (20,2,'ready','bad',1),
  (21,2,'active','unknown',2);

do $$
declare
  mismatches integer;
begin
  with reference as (
    select s.id site_id, c.id source_id
    from qa_sites s
    left join lateral (
      select cs.id from qa_sources cs
      where cs.site_id=s.id
        and coalesce(cs.status,'') in ('connected','active','ready')
        and coalesce(cs.health_status,'') in ('healthy','unknown')
      order by cs.created_at asc limit 1
    ) c on true
  ), repaired as (
    select s.id site_id, c.id source_id
    from qa_sites s left join qa_sources c on c.id=(
      select cs.id from qa_sources cs
      where cs.site_id=s.id
        and coalesce(cs.status,'') in ('connected','active','ready')
        and coalesce(cs.health_status,'') in ('healthy','unknown')
      order by cs.created_at asc limit 1
    )
  )
  select count(*) into mismatches
  from ((select * from reference except select * from repaired)
    union all (select * from repaired except select * from reference)) diff;
  if mismatches <> 0 then raise exception 'media source selection differs'; end if;
end;
$$;
rollback;
