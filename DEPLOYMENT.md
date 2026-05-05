Deployment and Monitoring Quick Guide

1) Start the application

Run the backend directly:

```bash
npm start
```

2) Monitoring & Logs

Use your terminal, service manager, or hosting platform logs to monitor the process.

3) Health checks and load balancer

- Configure your external load balancer (or Cloud provider) to use the `/api/health` endpoint for health checks.
- For very high traffic, consider running multiple hosts behind a hardware or cloud load balancer and enable sticky sessions only when necessary.

4) Notes and tuning

- For SSL, terminate TLS at your hosting platform or load balancer.

## Load Testing (Staging)

- Use the included `scripts/load_test.js` (uses `autocannon`) for quick staging tests.
- Example: run a short smoke test locally:

```bash
# install dev deps (if not already installed)
npm install --save-dev autocannon

# run test: node scripts/load_test.js <url> <connections> <duration>
node scripts/load_test.js http://localhost:3000 50 15
```

- Start with small concurrency (10-100) and increase until you find the breaking point. Run tests against a staging host, not production.

## Backup (PostgreSQL / Supabase)

- A backup script is available at `scripts/backup_postgres.sh`. It uses `pg_dump` to create timestamped archives and prunes older backups.
- Ensure `pg_dump` is installed and the backup directory is writable by the user running the cron job.
- Example cron (daily at 02:30):

```cron
30 2 * * * /home/$(whoami)/Karumande/scripts/backup_postgres.sh >> /var/log/postgres-backup.log 2>&1
```

## Monitoring & Alerts

- Lightweight options:
	- Uptime checks: UptimeRobot or cloud provider health checks hitting `/api/health`.
	- Logs & process metrics: use your host's process manager or platform logging.
	- Prometheus + Grafana: run `node_exporter` and instrument Node.js metrics for production observability.
	- Hosted APM: Datadog, New Relic, or Sentry for application performance insights.

- Alerting: configure alerts for high error rates, high CPU, high memory, and failed backups.

## Next Steps After Load Test Failures

- If load tests show high error rates, inspect application logs:

```bash
# Replace with the log command for your environment
journalctl -u your-app-service -n 200
```

- Common mitigations:
	- Scale horizontally to more hosts behind a load balancer.
	- Tune OS file descriptor limits and host-level networking settings.
	- Verify PostgreSQL connection pool size and increase if needed.
