import datetime as dt
import json
import shlex
import subprocess
from pathlib import Path
from typing import Any

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[4]
CWD = ROOT / 'rabbitmq'
ID = 'ORD-b7a74952-2957-49cb-a5db-f88d7b2ce443'
DC = ['docker', 'compose', '-p', 'qa-taller-integracion-rabbitmq']
GET = ['curl', '--silent', '--show-error', '--fail', '--max-time', '3', '--user', 'admin:admin', 'http://localhost:15672/api/queues/%2F/pedidos']

def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()

def run(name, cmd, timeout=15):
    (OUT / (name + '-comando.txt')).write_text(shlex.join(cmd) + '\n')
    (OUT / (name + '-inicio.txt')).write_text(now() + '\n')
    try:
        p = subprocess.run(cmd, cwd=CWD, capture_output=True, timeout=timeout)
        code, stdout, stderr = p.returncode, p.stdout, p.stderr
    except subprocess.TimeoutExpired as e:
        code, stdout, stderr = 124, e.stdout or b'', (e.stderr or b'') + b'\nTIMEOUT\n'
    for suffix, content in [('stdout', stdout), ('stderr', stderr)]:
        (OUT / f'{name}-{suffix}.txt').write_bytes(content)
    (OUT / (name + '-exitcode.txt')).write_text(str(code) + '\n')
    (OUT / (name + '-fin.txt')).write_text(now() + '\n')
    if code:
        raise RuntimeError(f'{name}: exitcode {code}')
    return stdout.decode()

def psparse(text):
    try:
        return [json.loads(line) for line in text.splitlines() if line.strip()]
    except json.JSONDecodeError as exc:
        raise ValueError('Compose no devolvió JSON válido') from exc

def counts(q):
    return {k: q.get(k) for k in ['durable', 'consumers', 'messages_ready', 'messages_unacknowledged', 'messages']}

result: dict[str, Any] = {'orderId': ID, 'published_utc': '2026-10-27T01:39:39.627Z', 'started_utc': now()}
try:
    ps = psparse(run('01-pre-compose', DC + ['ps', '-a', '--format', 'json']))
    q = json.loads(run('02-pre-management', GET))
    result['before'] = counts(q)
    workers = [p for p in ps if p['Service'] == 'notification-worker']
    assert len(workers) == 2 and all(p['State'] == 'exited' for p in workers), 'Precondición workers cambió'
    assert counts(q) == {'durable': True, 'consumers': 0, 'messages_ready': 1, 'messages_unacknowledged': 0, 'messages': 1}, 'Precondición cola cambió'
    run('03-start', DC + ['start', 'notification-worker'])
    # Una sola espera acotada, sin reintentos de publicación ni de start.
    wait = '''import json, subprocess, time, sys
end = time.monotonic() + 45
ID = "ORD-b7a74952-2957-49cb-a5db-f88d7b2ce443"
dc = ["docker", "compose", "-p", "qa-taller-integracion-rabbitmq"]
while time.monotonic() < end:
    remaining = end - time.monotonic()
    try:
        logs = subprocess.run(dc + ["logs", "--no-color", "--timestamps", "notification-worker"], capture_output=True, text=True, timeout=min(3, remaining))
        print(logs.stdout, end=""); print(logs.stderr, file=sys.stderr, end="")
        if logs.returncode: sys.exit(logs.returncode)
        remaining = end - time.monotonic()
        if remaining <= 0: break
        q = subprocess.run(["curl", "--silent", "--show-error", "--fail", "--max-time", "3", "--user", "admin:admin", "http://localhost:15672/api/queues/%2F/pedidos"], capture_output=True, text=True, timeout=min(3, remaining))
        print(q.stdout); print(q.stderr, file=sys.stderr, end="")
        if q.returncode: sys.exit(q.returncode)
        data = json.loads(q.stdout)
        lines = [line for line in logs.stdout.splitlines() if ID in line]
        if all(any(event in line for line in lines) for event in ["order_received", "order_processed"]) and all(data.get(k) == v for k,v in {"consumers":2,"messages_ready":0,"messages_unacknowledged":0,"messages":0}.items()):
            sys.exit(0)
    except subprocess.TimeoutExpired:
        break
    time.sleep(min(1, max(0, end-time.monotonic())))
print("TIMEOUT: condición no verificada en 45 segundos", file=sys.stderr)
sys.exit(124)
'''
    try:
        run('04-espera-45s', ['python3', '-c', wait], timeout=46)
        result['wait_verified'] = True
    except Exception as e:
        result['wait_verified'] = False
        result['wait_failure'] = str(e)
    for service in ['orders-api', 'rabbitmq', 'notification-worker']:
        text = run('05-logs-' + service, DC + ['logs', '--no-color', '--timestamps', service])
        (OUT / ('logs-mismo-id-' + service + '.txt')).write_text('\n'.join(line for line in text.splitlines() if ID in line) + '\n')
    q = json.loads(run('06-final-management', GET))
    (OUT / 'management-final.json').write_text(json.dumps(q, indent=2) + '\n')
    result['final'] = counts(q)
    ps = psparse(run('07-final-compose', DC + ['ps', '-a', '--format', 'json']))
    result['containers'] = [{k: p.get(k) for k in ['Name','Service','State','Health']} for p in ps]
    result['health_verified'] = all(p['State'] == 'running' for p in ps) and len([p for p in ps if p['Service'] == 'notification-worker']) == 2 and all(p.get('Health') == 'healthy' for p in ps if p['Service'] in ['orders-api','rabbitmq'])
    result['status'] = 'consumo_verificado' if result['wait_verified'] and result['health_verified'] else 'fallo_validacion'
except Exception as e:
    result['status'] = 'detenido_sin_reconstruccion'
    result['failure'] = str(e)
result['finished_utc'] = now()
(OUT / 'resultado-final.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
raise SystemExit(0 if result['status'] == 'consumo_verificado' else 1)
