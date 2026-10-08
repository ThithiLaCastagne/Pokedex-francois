"""Local-only integration check. Synthetic dispatcher identities never enter production code.
Run after local D1 migrations + sites-preview start: python tests/api-integration.py
"""
import urllib.request,urllib.error,json,uuid,pathlib
BASE='http://127.0.0.1:8791'
run=uuid.uuid4().hex[:8]
A='test-a-'+run; B='test-b-'+run; C='test-c-'+run
checks=[]
def req(path,who=None,body=None,raw=False):
 headers={}
 if who: headers.update({'oai-authenticated-user-id':who,'oai-authenticated-user-email':who+'@example.test'})
 if body is not None:headers['Content-Type']='image/jpeg' if raw else 'application/json'
 data=body if raw else json.dumps(body).encode() if body is not None else None
 r=urllib.request.Request(BASE+path,headers=headers,data=data)
 try:
  with urllib.request.urlopen(r,timeout=20) as f:return f.status,f.read()
 except urllib.error.HTTPError as e:return e.code,e.read()
def get(who):
 code,b=req('/api/data',who);assert code==200,(code,b);return json.loads(b)
def post(who,action,**kwargs):
 code,b=req('/api/data',who,{'action':action,**kwargs});return code,json.loads(b)
def ok(name,p):
 assert p,name;checks.append(name)
ok('anonymous blocked',req('/api/data')[0]==401)
a=get(A);b=get(B);get(C)
photo=pathlib.Path('tests/fixtures/photo.jpg').read_bytes()
payload=b'Exif\x00\x00FAKE GPS PRIVATE';segment=b'\xff\xe1'+(len(payload)+2).to_bytes(2,'big')+payload
image=photo[:2]+segment+photo[2:]
code,raw=req('/api/photos',A,image,True);ok('photo upload',code==200);url=json.loads(raw)['url']
ok('GPS metadata removed',b'FAKE GPS PRIVATE' not in req(url,A)[1]);ok('photo private',req(url,B)[0]==403)
species={'id':'manual-test','name':'Renard roux','scientific':'Vulpes vulpes','group':'Mammifères','kingdom':'Animalia','phylum':'Chordata','className':'Mammalia','order':'Carnivora','family':'Canidae','genus':'Vulpes','habitat':'Forêts','diet':'Omnivore','range':'Europe','summary':'Observation de test','status':'LC','sensitive':False,'wiki':'Renard roux'}
o={'species':species,'photos':[url],'date':'2026-10-01T10:20','region':'Région test','notes':'Test automatisé local','visibility':'private','sensitive':False,'lat':43.12345,'lng':1.98765}
code,d=post(A,'save',observation=o);ok('create observation',code==200);oid=d['id'];own=get(A)['observations'][0];ok('location rounded',own['lat']==43 and own['lng']==2)
ok('outsider feed empty',not get(B)['feed']);ok('ownership protected',post(B,'save',observation={**o,'id':oid})[0]==404)
ok('other-user photo blocked',post(B,'save',observation=o)[0]==403)
ok('friend request',post(B,'request',code=a['profile']['code'])[0]==200)
ok('pending cannot read photo',req(url,B)[0]==403)
ok('accept friend',post(A,'accept',id=B)[0]==200)
ok('private observation still blocked',req(url,B)[0]==403)
o['visibility']='friends';ok('share observation',post(A,'save',observation={**o,'id':oid})[0]==200)
feed=get(B)['feed'];ok('friend sees shared observation',len(feed)==1 and feed[0]['id']==oid)
ok('coordinates never shared',feed[0]['lat'] is None and feed[0]['lng'] is None)
ok('accepted friend can see photo',req(url,B)[0]==200);ok('third party blocked',req(url,C)[0]==403)
ok('reaction',post(B,'like',id=oid,value=True)[0]==200 and get(A)['feed'][0]['likes']==1)
ok('comment',post(B,'comment',id=oid,body='Belle rencontre !')[0]==200)
ok('outsider comment blocked',post(C,'comment',id=oid,body='intrusion')[0]==404)
o['species']={**species,'scientific':'Lynx lynx','name':'Lynx boréal','sensitive':False};post(A,'save',observation={**o,'id':oid});own=get(A)['observations'][0];feed=get(B)['feed'][0]
ok('sensitive protection enforced server-side',own['sensitive'] and own['lat'] is None and own['lng'] is None)
ok('sensitive region hidden from friends',feed['region']=='Lieu protégé')
ok('remove friend',post(A,'unfriend',id=B)[0]==200);ok('photo access revoked',req(url,B)[0]==403);ok('feed access revoked',not get(B)['feed'])
ok('delete own observation',post(A,'delete',id=oid)[0]==200);ok('deleted observation absent',not get(A)['observations']);ok('deleted photo absent',req(url,A)[0]==404)
ok('invalid image rejected',req('/api/photos',A,b'not a jpeg',True)[0]==400)
print(json.dumps({'passed':len(checks),'checks':checks},ensure_ascii=False,indent=2))
