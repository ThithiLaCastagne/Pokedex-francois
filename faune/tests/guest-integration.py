"""Exercise automatic browser notebooks against the local Worker, without identity headers."""
import http.cookiejar,json,pathlib,urllib.request,urllib.error,uuid
BASE='http://127.0.0.1:8791'
checks=[]
def client():
 jar=http.cookiejar.CookieJar()
 return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar)),jar
def req(c,path,body=None,headers=None):
 h=dict(headers or {})
 if isinstance(body,bytes): h['Content-Type']='image/jpeg'; data=body
 elif body is not None: h['Content-Type']='application/json';data=json.dumps(body).encode()
 else:data=None
 r=urllib.request.Request(BASE+path,data=data,headers=h)
 try:
  with c[0].open(r,timeout=20) as f:return f.status,f.read(),f.headers
 except urllib.error.HTTPError as e:return e.code,e.read(),e.headers
def get(c):
 status,raw,_=req(c,'/api/data');assert status==200,(status,raw);return json.loads(raw)
def post(c,action,**kwargs):
 status,raw,_=req(c,'/api/data',{'action':action,**kwargs});return status,json.loads(raw)
def ok(label,value):
 assert value,label;checks.append(label)
a,b=client(),client()
ok('no anonymous shared notebook',req(a,'/api/data')[0]==401)
status,raw,h=req(a,'/api/guest',{})
ok('open notebook without sign-in',status==201)
ok('HttpOnly same-site session cookie','HttpOnly' in h['Set-Cookie'] and 'SameSite=Lax' in h['Set-Cookie'] and 'Path=/' in h['Set-Cookie'])
ok('no credential in JSON',set(json.loads(raw))=={'ready','mode'})
pa=get(a);ok('guest mode declared',pa['session']['mode']=='guest')
status,_,h=req(a,'/api/guest',{});ok('same browser reuses its notebook',status==200 and not h.get('Set-Cookie') and get(a)['profile']['id']==pa['profile']['id'])
req(b,'/api/guest',{});pb=get(b);ok('separate visitor identities',pa['profile']['id']!=pb['profile']['id'])
ok('edit guest profile',post(a,'profile',name='Exploratrice test',bio='Sans inscription')[0]==200 and get(a)['profile']['name']=='Exploratrice test')
photo=pathlib.Path('tests/fixtures/photo.jpg').read_bytes();status,raw,_=req(a,'/api/photos',photo);ok('guest photo upload',status==200);url=json.loads(raw)['url']
s={'id':'test-guest','name':'Renard','scientific':'Vulpes vulpes','group':'Mammifères','kingdom':'Animalia','phylum':'Chordata','className':'Mammalia','order':'Carnivora','family':'Canidae','genus':'Vulpes','habitat':'Forêt','diet':'Omnivore','range':'Europe','summary':'Test','status':'LC','sensitive':False,'wiki':'Renard roux'}
o={'species':s,'photos':[url],'date':'2026-10-01T10:20','region':'Région test','notes':'Sans connexion','visibility':'private','sensitive':False,'lat':43,'lng':2}
status,result=post(a,'save',observation=o);ok('guest saves an observation',status==200);oid=result['id']
ok('browser session persists observation',get(a)['observations'][0]['id']==oid)
ok('second visitor cannot access private photo',req(b,url)[0]==403)
ok('second visitor cannot edit observation',post(b,'save',observation={**o,'id':oid})[0]==404)
ok('guest invitations work',post(b,'request',code=pa['profile']['code'])[0]==200 and post(a,'accept',id=pb['profile']['id'])[0]==200)
ok('accepted friend still cannot read private photo',req(b,url)[0]==403)
ok('guest sharing works',post(a,'save',observation={**o,'id':oid,'visibility':'friends'})[0]==200 and req(b,url)[0]==200)
ok('guest coordinates remain private',get(b)['feed'][0]['lat'] is None)
ok('guest comment works',post(b,'comment',id=oid,body='Belle rencontre')[0]==200)
ok('guest revocation works',post(a,'unfriend',id=pb['profile']['id'])[0]==200 and req(b,url)[0]==403)
outsider=client();ok('user ID is not a session credential',req(outsider,'/api/data',headers={'Cookie':'faune_guest='+pa['profile']['id']})[0]==401)
ok('forged token rejected',req(outsider,'/api/data',headers={'Cookie':'faune_guest='+'f'*64})[0]==401)
ok('cross-site session creation blocked',req(outsider,'/api/guest',{},headers={'Origin':'https://unrelated.example'})[0]==403)
ok('cross-site guest write blocked',req(a,'/api/data',{'action':'profile','name':'Tampered','bio':''},headers={'Origin':'https://unrelated.example'})[0]==403)
account='test-account-'+uuid.uuid4().hex
status,raw,_=req(a,'/api/data',headers={'oai-authenticated-user-id':account,'oai-authenticated-user-email':'test@example.test'})
result=json.loads(raw);ok('existing account remains separate',status==200 and result['profile']['id']==account and result['session']['mode']=='account' and not result['observations'])
ok('removing browser cookie does not expose old notebook',req(client(),url)[0]==401)
ok('guest deletion works',post(a,'delete',id=oid)[0]==200 and req(a,url)[0]==404)
print(json.dumps({'passed':len(checks),'checks':checks},ensure_ascii=False,indent=2))
