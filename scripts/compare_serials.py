#!/usr/bin/env python3
import csv, re

# Read Interventions
interventions = []
with open('public/imports/Interventions Locmat.csv', 'r', encoding='utf-8-sig') as f:
    next(f)  # Skip title row
    reader = csv.DictReader(f, delimiter=';')
    for row in reader:
        sn = row.get('Numéro de série', '').strip()
        name = row.get('Nom Article', '').strip()
        code = row.get('Code Article', '').strip()
        interventions.append({'sn': sn, 'name': name, 'code': code})

# Read Fusion
fusions = []
with open('public/imports/Locmat Fusion.csv', 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f, delimiter=';')
    for row in reader:
        sn = row.get('Numéro de série', '').strip()
        name = row.get('Nom', '').strip()
        code = row.get('Code Libre', '').strip()
        fusions.append({'sn': sn, 'name': name, 'code': code})

print(f'Interventions: {len(interventions)} lignes')
print(f'Fusion: {len(fusions)} lignes')
print()

# Unique serial numbers
int_sns = set(i['sn'] for i in interventions if i['sn'])
fus_sns = set(f['sn'] for f in fusions if f['sn'])

print(f'SN uniques - Interventions: {len(int_sns)}, Fusion: {len(fus_sns)}')
print(f'Match exact: {len(int_sns & fus_sns)}')
print(f'Interventions SANS match: {len(int_sns - fus_sns)}')
print()

# Find special characters in intervention SNs
print('=== Caracteres speciaux dans SN Interventions ===')
special_int = []
for sn in sorted(int_sns):
    specials = re.findall(r'[^a-zA-Z0-9]', sn)
    if specials:
        in_fusion = sn in fus_sns
        special_int.append((sn, specials, in_fusion))

print(f'{len(special_int)} SN avec caracteres speciaux sur {len(int_sns)}')
for sn, chars, matched in special_int[:30]:
    chars_str = ' '.join(repr(c) for c in set(chars))
    print(f'  {repr(sn):50s} chars=[{chars_str}] match_fusion={matched}')

print()
print('=== Caracteres speciaux dans SN Fusion ===')
special_fus = []
for sn in sorted(fus_sns):
    specials = re.findall(r'[^a-zA-Z0-9]', sn)
    if specials:
        special_fus.append((sn, specials))

print(f'{len(special_fus)} SN avec caracteres speciaux sur {len(fus_sns)}')
for sn, chars in special_fus[:30]:
    chars_str = ' '.join(repr(c) for c in set(chars))
    print(f'  {repr(sn):50s} chars=[{chars_str}]')

# Try to match by normalizing (strip spaces, dashes, dots)
print()
print('=== Correspondances par normalisation ===')
def normalize(sn):
    return re.sub(r'[\s\-\.\t]+', '', sn).upper()

fus_norm_map = {}
for f in fusions:
    if f['sn']:
        key = normalize(f['sn'])
        if key not in fus_norm_map:
            fus_norm_map[key] = []
        fus_norm_map[key].append(f)

unmatched_int = []
matched_after_norm = 0
for i in interventions:
    if not i['sn']:
        continue
    if i['sn'] in fus_sns:
        continue  # already exact match
    norm_key = normalize(i['sn'])
    if norm_key in fus_norm_map:
        matched_after_norm += 1
        if matched_after_norm <= 20:
            fmatch = fus_norm_map[norm_key][0]
            print(f'  INT: {repr(i["sn"]):40s} -> FUS: {repr(fmatch["sn"]):40s} (name: {i["name"][:40]})')
    else:
        unmatched_int.append(i)

print(f'\nCorrespondances apres normalisation: {matched_after_norm}')
print(f'Toujours sans correspondance: {len(unmatched_int)}')

# Show some unmatched with names to help find matches
print()
print('=== SN Interventions sans correspondance (premiers 30) ===')
# Build name map for fusion
fus_name_norm = {}
for f in fusions:
    key = re.sub(r'[^a-z0-9]', '', f['name'].lower())
    if key not in fus_name_norm:
        fus_name_norm[key] = []
    fus_name_norm[key].append(f)

for item in unmatched_int[:30]:
    name_key = re.sub(r'[^a-z0-9]', '', item['name'].lower())
    name_match = fus_name_norm.get(name_key, [])
    if name_match:
        print(f'  SN={repr(item["sn"]):30s} name={item["name"][:40]:40s} -> FUS_SN={repr(name_match[0]["sn"])} FUS_name={name_match[0]["name"][:40]}')
    else:
        print(f'  SN={repr(item["sn"]):30s} name={item["name"][:40]:40s} -> NO NAME MATCH')

# Also try matching by code
print()
print('=== Match par Code Article <-> Code Libre ===')
fus_code_map = {}
for f in fusions:
    if f['code']:
        c = f['code'].strip().lstrip('*')
        if c not in fus_code_map:
            fus_code_map[c] = []
        fus_code_map[c].append(f)

code_matches = 0
sn_mismatches_via_code = []
for item in unmatched_int:
    code = item['code'].strip().lstrip('*')
    if code in fus_code_map:
        for fm in fus_code_map[code]:
            code_matches += 1
            if fm['sn'] != item['sn'] and code_matches <= 20:
                sn_mismatches_via_code.append((item, fm))

print(f'Correspondances par code: {code_matches}')
print(f'Avec SN differents:')
for i, f in sn_mismatches_via_code[:20]:
    print(f'  Code={i["code"]:20s} INT_SN={repr(i["sn"]):30s} FUS_SN={repr(f["sn"]):30s}')
    print(f'    INT_name={i["name"][:50]}')
    print(f'    FUS_name={f["name"][:50]}')
