# Free deployment checklist

This project uses a Render free web service with a Neon free PostgreSQL database.

## Important limits

- Render free web services sleep after inactivity and the first request after sleep can be slow.
- Render free PostgreSQL is not used because the current free database has a 30-day expiration.
- Neon Free is used for PostgreSQL. At the time of this setup it has no fixed expiration, but storage, compute-hours, egress, and provider policies still apply.
- The free setup is for testing and low traffic. Do not treat it as a payment-production SLA.

## 1. Create the database

1. Create a Neon project.
2. Create a PostgreSQL database.
3. Copy the pooled connection string. It normally contains `sslmode=require`.
4. Keep the connection string private.

## 2. Put the repository on GitHub

The repository must contain `render.yaml` at its root. The repository root for Render is the `GeekFaka` directory.

## 3. Deploy the Blueprint

1. Open Render and choose `New -> Blueprint`.
2. Connect the GitHub repository and select the branch.
3. Review the `angel-faka` web service.
4. Set these secret values when Render prompts for them:
   - `DATABASE_URL`: Neon pooled PostgreSQL connection string.
   - `NEXT_PUBLIC_URL`: the final Render URL, for example `https://angel-faka.onrender.com`.
   - `ADMIN_USERNAME`: the platform administrator username.
   - `ADMIN_PASSWORD`: a new long random password. Do not reuse the local password.
5. Deploy.

The Blueprint generates `JWT_SECRET` and `RETENTION_PURGE_TOKEN` automatically. Keep both private.

## 4. Configure GitHub Actions cleanup

The repository contains `.github/workflows/retention-purge.yml`.

In GitHub repository settings, add these Actions secrets:

- `APP_URL`: the public HTTPS URL without a trailing slash.
- `RETENTION_PURGE_TOKEN`: the exact value from Render.

The workflow runs once per day and can also be started manually from the Actions page.

## 5. First login and checks

1. Open `/admin/login`.
2. Log in with the new production administrator credentials.
3. Open `/admin/merchants` and confirm the default `ANGEL旗舰` merchant is `APPROVED`.
4. Open `/merchant/register` and create a test merchant.
5. Approve it from `/admin/merchants`.
6. Confirm it can log in at `/merchant/login`.
7. Keep payment disabled until payment credentials are configured intentionally.

## 6. Before sharing the URL

- Replace every local secret.
- Do not commit `.env`, Neon URLs, payment secrets, or GitHub Actions secrets.
- Export the Neon database periodically. The application-level 14-day cleanup is not a backup.
- Remember that Render free instances sleep and Neon free limits can suspend the database when quotas are exceeded.
