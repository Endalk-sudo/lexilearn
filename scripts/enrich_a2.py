# -*- coding: utf-8 -*-
"""
A2 Vocabulary Enrichment Script for LexiLearn AI.
Merges all A2 parts and enriches docs/A2_Vocabulary.csv.
"""

import csv
import sys
from a2_data_verbs import a2_verbs
from a2_data_adjs import a2_adjs
from a2_data_others import a2_others
from a2_data_nouns1 import a2_nouns1
from a2_data_nouns2 import a2_nouns2

all_a2 = {}
all_a2.update(a2_verbs)
all_a2.update(a2_adjs)
all_a2.update(a2_others)
all_a2.update(a2_nouns1)
all_a2.update(a2_nouns2)

print(f"Total dictionary entries compiled: {len(all_a2)}")

with open('docs/A2_Vocabulary.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    rows = list(reader)

updated = 0
missing = []
for r in rows:
    w = r['word'].strip().lower()
    if w in all_a2:
        r['amharic'] = all_a2[w]
        updated += 1
    else:
        missing.append((w, r['pos'], r['definition']))

if missing:
    print(f"Missing {len(missing)} words:")
    for m in missing:
        print(f"  {m[0]} ({m[1]}): {m[2][:40]}")
    sys.exit(1)
else:
    print("All A2 words matched perfectly!")

with open('docs/A2_Vocabulary.csv', 'w', encoding='utf-8', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

print(f"Successfully updated {updated}/{len(rows)} words in docs/A2_Vocabulary.csv")
