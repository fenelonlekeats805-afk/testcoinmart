import os
import time
import paramiko


HOST = os.getenv("REMOTE_HOST", "192.227.147.140")
PORT = int(os.getenv("REMOTE_PORT", "22"))
USER = os.getenv("REMOTE_USER", "root")
PASSWORD = os.getenv("REMOTE_PASSWORD", "")

if not PASSWORD:
    raise SystemExit("REMOTE_PASSWORD is required")

cmds = [
    "cp /etc/profile /etc/profile.bak.$(date +%s) || true",
    "sed -n '1,27p' /etc/profile > /tmp/profile.clean && mv /tmp/profile.clean /etc/profile",
    "grep -n '/tmp/x86_64.kok\\|x86_32.kok\\|logic.sh' /etc/profile || true",
    "systemctl restart ssh || systemctl restart sshd || true",
    "systemctl restart nginx || true",
    "systemctl restart redis-server || true",
    "systemctl restart postgresql || true",
    "nohup bash -c 'sleep 2; reboot' >/dev/null 2>&1 &",
]

max_attempts = 120
sleep_seconds = 5

for i in range(1, max_attempts + 1):
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(
            hostname=HOST,
            port=PORT,
            username=USER,
            password=PASSWORD,
            timeout=10,
            banner_timeout=20,
            auth_timeout=15,
            allow_agent=False,
            look_for_keys=False,
        )
        print(f"connected on attempt {i}")
        for cmd in cmds:
            stdin, stdout, stderr = client.exec_command(cmd, get_pty=True)
            out = stdout.read().decode("utf-8", "ignore")
            err = stderr.read().decode("utf-8", "ignore")
            code = stdout.channel.recv_exit_status()
            print(f">>> {cmd}\nexit={code}")
            if out.strip():
                print(out[-800:])
            if err.strip():
                print("[stderr]")
                print(err[-400:])
        client.close()
        print("recovery commands sent")
        raise SystemExit(0)
    except Exception as e:
        print(f"attempt {i} failed: {type(e).__name__}: {e}")
        time.sleep(sleep_seconds)

raise SystemExit("failed to recover via ssh after retries")
