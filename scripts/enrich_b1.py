# -*- coding: utf-8 -*-
"""
B1 Vocabulary Enrichment Script for LexiLearn AI.
Merges all B1 parts and enriches docs/B1_Vocabulary.csv.
"""

import csv
import sys
from b1_data_verbs import b1_verbs
from b1_data_adjs import b1_adjs_and_others
from b1_data_nouns1 import b1_nouns1
from b1_data_nouns2 import b1_nouns2

all_b1 = {}
all_b1.update(b1_verbs)
all_b1.update(b1_adjs_and_others)
all_b1.update(b1_nouns1)
all_b1.update(b1_nouns2)

print(f"Total dictionary entries compiled: {len(all_b1)}")

with open('docs/B1_Vocabulary.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    rows = list(reader)

updated = 0
missing = []
for r in rows:
    w = r['word'].strip().lower()
    if w in all_b1:
        r['amharic'] = all_b1[w]
        updated += 1
    else:
        missing.append((w, r['pos'], r['definition']))

if missing:
    print(f"Missing {len(missing)} words:")
    for m in missing:
        print(f"  {m[0]} ({m[1]}): {m[2][:40]}")
    sys.exit(1)
else:
    print("All B1 words matched perfectly!")

with open('docs/B1_Vocabulary.csv', 'w', encoding='utf-8', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

print(f"Successfully updated {updated}/{len(rows)} words in docs/B1_Vocabulary.csv")
