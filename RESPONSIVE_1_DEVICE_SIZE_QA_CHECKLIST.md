# RESPONSIVE 1 - Device Size QA Checklist

Date: 2026-06-27

## Sizes

- 390 x 844 mobile
- 430 x 932 large mobile
- 768 x 1024 tablet portrait
- 1024 x 768 tablet landscape
- 1366 x 768 laptop
- 1440 x 900 desktop
- 1920 wide desktop optional

## Pages To Check At Each Size

- `/`
- `/app`
- `/login`
- `/register`
- `/dashboard/parent`
- `/dashboard/garden`
- `/dashboard/staff`
- `/dashboard/inspector`
- `/dashboard/admin`
- `/digital-observer/dashboard`
- one long form: inspector inspection or onboarding form
- one table/list: admin users or provider health
- one modal/drawer: admin full management or upload dialog

## Checks

- no horizontal page overflow
- no clipped primary CTA
- no bottom navigation overlap
- keyboard does not hide submit actions
- dialogs and drawers scroll
- tables scroll inside their container or convert to cards
- RTL ordering remains correct
- desktop is centered and not stretched edge-to-edge
- tablet uses comfortable two-column layouts where appropriate
- mobile preview mode works with `?view=mobile`

## Screenshot Plan

Store screenshots outside production public assets, for example:

```text
docs/qa-screenshots/responsive-1/
```

Critical screenshots:

- homepage mobile/tablet/desktop
- app gateway mobile/tablet/desktop
- login mobile
- register role selection mobile
- parent dashboard mobile
- manager dashboard mobile
- staff dashboard mobile
- inspector dashboard mobile
- admin dashboard tablet/desktop
- Digital Observer dashboard tablet/desktop
- mobile preview mode on desktop
