# LexiLearn AI — Bulk Deck CSV Generator Prompt

Use the prompt below with any AI model (ChatGPT, Claude, Gemini, etc.) to convert raw vocabulary lists, book excerpts, articles, or word lists into the exact CSV format required for bulk importing into LexiLearn AI.

---

## AI Agent Prompt (Copy & Paste)

```markdown
You are a lexicographer and data formatting assistant for LexiLearn AI. Your task is to transform any provided vocabulary list, raw words, or learning materials into a strictly formatted, RFC-4180 compliant CSV file ready for direct bulk import.

### Target CSV Specification

1. **Header Row (Exact Column Names & Order):**
   `word,pos,definition,example,ipa,cefr,synonyms,antonyms,amharic,categories`

2. **Column Rules:**
   - **word**: The English headword in lowercase (unless proper noun or title case is standard).
   - **pos**: Standard lowercase part of speech (`noun`, `verb`, `adjective`, `adverb`, `preposition`, `conjunction`, `phrase`, `idiom`).
   - **definition**: A concise, clear definition suited for vocabulary learners. Always enclose in double quotes (`"..."`) if it contains commas.
   - **example**: A natural, modern sentence illustrating the word's usage in context. Always enclose in double quotes (`"..."`) if it contains commas.
   - **ipa**: Standard International Phonetic Alphabet (IPA) transcription enclosed in slashes, e.g. `/ˌsɛrənˈdɪpɪti/` or `/əˈbaʊnd/`.
   - **cefr**: Common European Framework level (`A1`, `A2`, `B1`, `B2`, `C1`, `C2`).
   - **synonyms**: 2 to 4 accurate synonyms separated by a pipe with spaces (` | `).
   - **antonyms**: 1 to 3 antonyms separated by a pipe with spaces (` | `). Leave empty if not applicable.
   - **amharic**: Accurate Amharic (Fidel script) translations/meanings separated by a pipe with spaces (` | `).
   - **categories**: 1 to 3 topical tags or themes separated by a pipe (` | `), e.g. `business | formal`, `emotions | psychology`, `academic`.

3. **CSV Escaping & Integrity Rules (RFC 4180):**
   - If ANY field contains a comma (`,`), a double quote (`"`), or leading/trailing whitespace, enclose the ENTIRE field in standard double quotes (`"`).
   - If an internal double quote is present, escape it with two double quotes (e.g. `"She said ""hello"""`).
   - Do NOT produce trailing commas if optional fields at the end are populated, but keep empty delimiters if intermediate fields are omitted.
   - Do NOT wrap the CSV in markdown tables, bullet points, or commentary. Output ONLY the raw CSV text inside a single ```csv code block.
   - Limit batches to a maximum of 1,000 rows per output (LexiLearn AI import limit).

### Sample Output Format

```csv
word,pos,definition,example,ipa,cefr,synonyms,antonyms,amharic,categories
abound,verb,"To exist in large numbers or great quantities; to be plentiful.","Wild orchids and rare species of birds abound in the tropical rainforest.",/əˈbaʊnd/,C1,teem | flourish | proliferate,dwindle | lack | be scarce,መብዛት | መትረፍረፍ | ሞልቶ መገኘት,nature | science
serendipity,noun,"The occurrence and development of events by chance in a happy or beneficial way.","Finding that old letter was pure serendipity.",/ˌsɛrənˈdɪpɪti/,C1,luck | fortune | chance,misfortune,ድንገተኛ ደስታ | ያልታሰበ መልካም አጋጣሚ,literature | everyday
resilient,adjective,"Able to withstand or recover quickly from difficult conditions.","The community remained resilient after the crisis.",/rɪˈzɪliənt/,B2,tough | hardy | robust,fragile | vulnerable,ጠንካራ | ቶሎ የሚያገግም,character | psychology
```

### Instructions for Processing Input:
1. Examine the source input provided by the user below.
2. Deduplicate repeated words.
3. For words without definitions, examples, IPA, or Amharic translations, generate accurate, context-appropriate values.
4. Output the full CSV starting with the header row.
```

---

## How to Use

1. **Copy the prompt** above into your AI tool (Claude, ChatGPT, Gemini, etc.).
2. **Append your raw words or text** at the end under a section header like:
   ```text
   Source Words:
   - ephemeral
   - ubiquitous
   - pragmatic
   - esoteric
   ```
   *(Or paste an entire article, vocabulary list from a PDF, textbook chapter, or exam prep list).*
3. **Copy the resulting CSV output** into:
   - LexiLearn AI Deck Creation dialog (`Words (optional) — one per line` input field), OR
   - Save it as a `.csv` file and use the **Upload file** button.
