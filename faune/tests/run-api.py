import subprocess,time,urllib.request,pathlib,os
root=pathlib.Path(__file__).resolve().parents[1]
log=open('/tmp/faune-worker-test.log','w')
p=subprocess.Popen(['npm','start','--','--port','8791'],cwd=root,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
try:
 for i in range(25):
  try:urllib.request.urlopen('http://127.0.0.1:8791/',timeout=1);break
  except Exception:time.sleep(.5)
 else:raise RuntimeError(pathlib.Path('/tmp/faune-worker-test.log').read_text()[-2000:])
 for script in ['api-integration.py','guest-integration.py']:
  subprocess.run(['python',str(root/'tests'/script)],cwd=root,check=True)
finally:
 import signal
 os.killpg(p.pid,signal.SIGTERM)
