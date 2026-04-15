Nginx sample and notes

- Config: `deploy/nginx/karumande.conf`
- Replace `yourdomain.com` with your domain.
- Ensure PM2 instances are listening on ports 3000..300N if using local upstream servers.
- If your PM2 cluster runs on a single port with Node cluster mode, you can point Nginx at that port only (PM2 cluster balances internally).
