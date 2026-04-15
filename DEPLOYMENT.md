Deployment and Monitoring Quick Guide

1) Nginx (reverse proxy + load balancing)

Place the example config at `/etc/nginx/sites-available/karumande.conf` and enable it:

```bash
sudo cp deploy/nginx/karumande.conf /etc/nginx/sites-available/karumande.conf
sudo ln -s /etc/nginx/sites-available/karumande.conf /etc/nginx/sites-enabled/karumande.conf
sudo nginx -t
sudo systemctl restart nginx
```

Replace `yourdomain.com` with your domain and adjust `upstream` backend ports if you scale PM2 instances across ports.

2) PM2: persistence and startup

Start app (already configured in `package.json`):

```bash
npm start            # uses pm2 to start ecosystem.config.js
```

Persist PM2 process list across reboots and generate startup script (run once):

```bash
pm2 save
sudo pm2 startup systemd -u $(whoami) --hp $(eval echo ~$USER)
# Follow printed instructions (usually another sudo command to enable the service)
```

Scale instances (if you want more than CPU cores used):

```bash
pm2 scale karumande-school 8   # scale to 8 instances
pm2 save
```

3) Monitoring & Logs

Interactive monitor (real-time metrics):

```bash
pm2 monit
```

View logs (tail):

```bash
pm2 logs karumande-school --lines 200
```

Show process details:

```bash
pm2 list
pm2 show karumande-school
pm2 info 0  # replace 0 with pm2 id
```

View combined PM2 logs files (if using `ecosystem.config.js` log paths):

```bash
tail -n 200 logs/combined.log
tail -n 200 logs/out.log
tail -n 200 logs/error.log
```

4) Health checks and load balancer

- Configure your external load balancer (or Cloud provider) to use the `/api/health` endpoint for health checks.
- For very high traffic, consider running multiple hosts behind a hardware or cloud load balancer and enable sticky sessions only when necessary.

5) Notes and tuning

- Tune `worker_rlimit_nofile` and `worker_connections` in Nginx for many concurrent connections.
- For SSL, set up `certbot` or provide your TLS certificates and update server block to listen on 443.

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

## Backup (MongoDB)

- A backup script is available at `scripts/backup_mongo.sh`. It uses `mongodump` to create timestamped archives and prunes older backups.
- Ensure `mongodump` is installed (part of MongoDB Database Tools) and the backup directory is writable by the user running the cron job.
- Example cron (daily at 02:30):

```cron
30 2 * * * /home/$(whoami)/Karumande/scripts/backup_mongo.sh >> /var/log/mongo-backup.log 2>&1
```

## Monitoring & Alerts

- Lightweight options:
	- Uptime checks: UptimeRobot or cloud provider health checks hitting `/api/health`.
	- Logs & process metrics: `pm2 monit`, `pm2 logs`, and `pm2 save` for persistent monitoring.
	- Prometheus + Grafana: run `node_exporter` and instrument Node.js metrics for production observability.
	- Hosted APM: Datadog, New Relic, or Sentry for application performance insights.

- Alerting: configure alerts for high error rates, high CPU, high memory, and failed backups.

## Next Steps After Load Test Failures

- If load tests show high error rates, inspect application and Nginx logs:

```bash
pm2 logs karumande-school --lines 200
tail -n 200 /var/log/nginx/error.log
tail -n 200 logs/error.log
```

- Common mitigations:
	- Increase PM2 instances or scale horizontally to more hosts behind a load balancer.
	- Tune Nginx (`worker_connections`, `worker_rlimit_nofile`) and the OS file descriptor limits.
	- Verify MongoDB connection pool size and increase if needed.
	- Add Redis caching for expensive or frequently requested endpoints.

