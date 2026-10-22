-- Registre officiel des attestations ECO-SUD – Formation Canalisateur
-- À appliquer uniquement après revue; ne modifie ni ne supprime les données existantes.

create or replace function public.issue_attestation()
returns table(numero text, date_delivrance date)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_modules text[];
  v_score integer;
  v_year text := to_char(current_date, 'YYYY');
  v_prefix text;
  v_next integer;
  v_numero text;
begin
  if v_user_id is null then
    raise exception 'Connexion requise pour délivrer une attestation';
  end if;

  -- Une attestation déjà émise est retournée telle quelle, sans nouveau numéro.
  return query
    select a.numero, a.date_delivrance
    from public.attestations a
    where a.user_id = v_user_id;
  if found then
    return;
  end if;

  -- Vérifier les conditions à partir des données conservées côté serveur.
  select lp.completed_modules, lp.best_score
    into v_modules, v_score
    from public.learner_progress lp
    where lp.user_id = v_user_id
    for update;

  if not found then
    raise exception 'Progression apprenant introuvable';
  end if;

  if (
    select count(distinct module_id)
    from unnest(coalesce(v_modules, array[]::text[])) as completed(module_id)
    where completed.module_id = any(array['m01','m02','m03','m04','m05','m06','m07','m08']::text[])
  ) < 8 then
    raise exception 'Les huit modules doivent être validés';
  end if;

  if coalesce(v_score, 0) < 12 then
    raise exception 'Le quiz final doit atteindre au moins 12/15';
  end if;

  v_prefix := 'I2DS-ECO-CAN-' || v_year || '-';

  -- Verrou par année pour éviter que deux émissions simultanées choisissent le même numéro.
  perform pg_advisory_xact_lock(hashtext('i2ds-attestation-' || v_year)::bigint);

  -- Recontrôler après le verrou, au cas où une autre requête aurait émis cette attestation.
  return query
    select a.numero, a.date_delivrance
    from public.attestations a
    where a.user_id = v_user_id;
  if found then
    return;
  end if;

  select coalesce(max(substring(a.numero from '([0-9]{4})$')::integer), 0) + 1
    into v_next
    from public.attestations a
    where a.numero like v_prefix || '%'
      and a.numero ~ '[0-9]{4}$';

  v_numero := v_prefix || lpad(v_next::text, 4, '0');

  insert into public.attestations (user_id, numero, date_delivrance)
    values (v_user_id, v_numero, current_date);

  return query
    select a.numero, a.date_delivrance
    from public.attestations a
    where a.user_id = v_user_id;
end;
$$;

revoke all on function public.issue_attestation() from public;
grant execute on function public.issue_attestation() to authenticated;
