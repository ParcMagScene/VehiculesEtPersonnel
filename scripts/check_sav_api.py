#!/usr/bin/env python3
import json, urllib.request

BASE = 'http://localhost:3003/api'

# Login
req = urllib.request.Request(f'{BASE}/login', 
    data=json.dumps({"username":"admin","password":"admin"}).encode(),
    headers={'Content-Type': 'application/json'})
try:
    resp = urllib.request.urlopen(req)
    token = json.loads(resp.read())['token']
except Exception as e:
    print(f"Login failed: {e}")
    exit(1)

# Get SAV tickets
req2 = urllib.request.Request(f'{BASE}/sav-tickets',
    headers={'Authorization': f'Bearer {token}'})
resp2 = urllib.request.urlopen(req2)
data = json.loads(resp2.read())

print(f"Total tickets: {len(data)}")
linked = [t for t in data if t.get('equipment_name')]
unlinked = [t for t in data if not t.get('equipment_name')]
print(f"Avec equipment_name: {len(linked)}")
print(f"Sans equipment_name: {len(unlinked)}")

if linked:
    t = linked[0]
    print(f"Exemple lié: id={t['id']}, equipment_name={t['equipment_name']}, eq_id={t.get('equipment_id')}")

if unlinked:
    for t in unlinked[:3]:
        eq_keys = {k: t[k] for k in t if 'equip' in k.lower() or 'name' in k.lower()}
        print(f"Non lié: id={t['id']}, eq_id={t.get('equipment_id')}, related_keys={eq_keys}")
