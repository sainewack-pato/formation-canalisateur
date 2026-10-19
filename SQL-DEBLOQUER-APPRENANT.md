# Débloquer un apprenant après paiement (modules 2–8)

## 1. Une seule fois — ajouter la colonne is_paid

```sql
alter table public.progressions
  add column if not exists is_paid boolean default false;

alter table public.progressions
  add column if not exists paid_at timestamptz;
```

## 2. Débloquer un apprenant (après preuve Wave / WhatsApp)

```sql
update public.progressions
set is_paid = true,
    paid_at = now(),
    updated_at = now()
where email = 'email-de-lapprenant@exemple.com';
```

## 3. Vérifier

```sql
select email, user_name, is_paid, paid_at, completed_modules, best_score
from public.progressions
order by updated_at desc;
```

## 4. Rebloquer (si besoin)

```sql
update public.progressions
set is_paid = false,
    paid_at = null
where email = 'email-de-lapprenant@exemple.com';
```

## Règles métier

- Module 1 (`m01`) : toujours gratuit
- Modules 2 à 8 : accessibles uniquement si `is_paid = true`
- Validation manuelle par GIE I2DS après preuve de paiement
