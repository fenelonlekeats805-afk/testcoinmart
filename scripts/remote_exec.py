import argparse
import os
import sys
import time
from pathlib import Path

import paramiko


def parse_upload(value: str) -> tuple[str, str]:
    if "=" not in value:
        raise argparse.ArgumentTypeError("upload format must be local=remote")
    local, remote = value.split("=", 1)
    return local, remote


def main() -> int:
    # Windows PowerShell defaults to legacy encodings; make sure SSH output printing doesn't crash.
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except Exception:
        pass

    parser = argparse.ArgumentParser(description="Run remote SSH commands and optional uploads.")
    parser.add_argument("--host", default=os.getenv("REMOTE_HOST"), required=False)
    parser.add_argument("--port", type=int, default=int(os.getenv("REMOTE_PORT", "22")))
    parser.add_argument("--user", default=os.getenv("REMOTE_USER", "root"), required=False)
    parser.add_argument("--password", default=os.getenv("REMOTE_PASSWORD"), required=False)
    parser.add_argument("--upload", action="append", default=[], type=parse_upload)
    parser.add_argument("--cmd", action="append", default=[])
    parser.add_argument("--cmd-file", action="append", default=[])
    parser.add_argument("--timeout", type=int, default=20)
    parser.add_argument("--retries", type=int, default=1)
    parser.add_argument("--retry-delay", type=int, default=3)
    args = parser.parse_args()

    if not args.host or not args.password:
        print("missing --host/--password (or REMOTE_HOST/REMOTE_PASSWORD)", file=sys.stderr)
        return 2

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    for attempt in range(1, max(1, args.retries) + 1):
        try:
            client.connect(
                hostname=args.host,
                port=args.port,
                username=args.user,
                password=args.password,
                timeout=args.timeout,
                banner_timeout=max(args.timeout, 20),
                auth_timeout=max(args.timeout, 20),
                allow_agent=False,
                look_for_keys=False,
            )
            break
        except Exception as error:  # pragma: no cover - runtime retry path
            if attempt >= max(1, args.retries):
                raise
            print(f"[connect] attempt {attempt} failed: {type(error).__name__}: {error}")
            time.sleep(max(1, args.retry_delay))

    try:
        if args.upload:
            sftp = client.open_sftp()
            try:
                for local, remote in args.upload:
                    if not Path(local).exists():
                        raise FileNotFoundError(local)
                    sftp.put(local, remote)
                    print(f"uploaded {local} -> {remote}")
            finally:
                sftp.close()

        commands = list(args.cmd)
        for cmd_file in args.cmd_file:
            with open(cmd_file, "r", encoding="utf-8") as fp:
                for line in fp:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    commands.append(line)

        for cmd in commands:
            stdin, stdout, stderr = client.exec_command(cmd, get_pty=True)
            out = stdout.read().decode("utf-8", "ignore")
            err = stderr.read().decode("utf-8", "ignore")
            code = stdout.channel.recv_exit_status()
            print(f"\n>>> {cmd}\nexit={code}")
            if out.strip():
                print(out[-2000:])
            if err.strip():
                print("[stderr]")
                print(err[-1000:])
            if code != 0:
                return code
    finally:
        client.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
