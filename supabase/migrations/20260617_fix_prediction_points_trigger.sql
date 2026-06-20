-- Oprava triggeru, který brání zápisu bodů do predictions po začátku zápasu.
-- Cron/admin musí moci aktualizovat points/exact_hit/winner_or_draw_hit/unique_exact
-- i poté, co zápas začal/skonal.

do $$
declare
  func_rec record;
begin
  -- Najdi trigger funkci podle známé chybové zprávy
  for func_rec in
    select p.proname as func_name, n.nspname as schema_name
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_trigger t on t.tgfoid = p.oid
    where t.tgrelid = 'predictions'::regclass
      and p.prosrc ilike '%Tip nelze změnit – zápas už začal%'
  loop
    -- Přepiš funkci tak, aby povolovala body/exact_hit/winner_or_draw_hit/unique_exact kdykoliv
    execute format(
      'create or replace function %I.%I()
       returns trigger as $func$
       begin
         -- Povol změny bodového ohodnocení i po začátku zápasu
         if (
           new.points is distinct from old.points or
           new.exact_hit is distinct from old.exact_hit or
           new.winner_or_draw_hit is distinct from old.winner_or_draw_hit or
           new.unique_exact is distinct from old.unique_exact
         ) then
           return new;
         end if;

         -- Původní ochrana: zabránit změně tipu po začátku zápasu
         if exists (
           select 1 from matches where id = new.match_id and kickoff_at <= now()
         ) then
           raise exception ''Tip nelze změnit – zápas už začal'';
         end if;

         return new;
       end;
       $func$ language plpgsql',
      func_rec.schema_name, func_rec.func_name
    );

    raise notice 'Opravena trigger funkce %.%', func_rec.schema_name, func_rec.func_name;
  end loop;
end $$;
