# LexiLearn AI Mentor — Upgrade Notes

## What is now real

- Agentic tutoring loop: observe → diagnose → decide → generate → validate → persist.
- Structured JSON contracts with schema validation and one repair attempt.
- Persistent mentor projects, branches, nodes, attempts, feedback, skill mastery, error cards, turns, profile, and local knowledge.
- Focus-locked branching curriculum with difficulty ceilings.
- Self-relevant next-question generation using mastery + due errors + recent attempt history.
- Six-dimensional evaluation: grammar, spelling, naturalness, register, pragmatics, task completion.
- Inline correction data, native version, one-lesson feedback, follow-up retrieval question, and root-cause diagnosis.
- Hint ladder without immediately leaking the answer.
- Error cards scheduled for future repair.
- Mastery updated after attempts.
- Local RAG hook using Ollama embeddings and a built-in grammar knowledge seed.
- Three-pane Mentor UI: learning map, challenge/answer pane, persistent memory pane.
- Keyboard-first interactions: H for hint, R for next after feedback, Cmd/Ctrl+Enter to submit.
- SpeechSynthesis read-aloud for question/native answer.

## Recommended local setup

Set `OLLAMA_MODEL` to an instruction model you have installed. Set `OLLAMA_EMBED_MODEL` to an embedding model. Current Ollama documentation supports JSON-schema structured outputs and tool calling; this implementation uses the structured-output capability for the contract layer. The built-in embedding provider defaults to `nomic-embed-text-v2-moe` for multilingual retrieval and can be changed with `OLLAMA_EMBED_MODEL`.

## Product suggestions

1. Make Mentor the adaptive engine behind Learn, Review, and Quiz instead of a separate isolated feature.
2. Add pronunciation mode with Whisper/Piper so the same learner model scores spoken English.
3. Add a weekly "Coach report" generated from mastery/error history: top 3 weaknesses, wins, next week's plan.
4. Add branch mastery gates: e.g. unlock advanced interview scenarios after prerequisite mastery reaches 75%.
5. Add confidence calibration: track overconfidence and underconfidence and show a small calibration chart.
6. Add an offline job queue for slow local inference, with visible "thinking" state and resumable requests.
7. Add corpus-backed naturalness retrieval later, especially for collocations and business English.
8. Keep the Mentor persona single and consistent; change pedagogy by mode, not by character.


## Model recommendation (verified against current Ollama catalog)

For this app, `qwen3:8b` is a strong default because the current Ollama listing identifies Qwen3 as supporting tool calling, thinking, and 100+ languages/dialects; the 8B Q4_K_M package is about 5.2 GB. `nomic-embed-text-v2-moe` is a good multilingual retrieval option; its current Ollama listing describes multilingual retrieval across about 100 languages and a ~958 MB package. Ollama's current API also supports JSON-schema structured outputs directly, which is what the Mentor contract layer uses.


## Complete AI expansion

The Coach Lab adds four connected surfaces: skill mastery map, weekly coach reports, browser speech practice, and naturalness coaching. Pronunciation scoring intentionally uses speech-to-text evidence and does not pretend to measure phonemes from microphone audio. For true phoneme-level scoring, add a local acoustic pipeline later (Whisper/whisper.cpp + forced alignment or a dedicated pronunciation model).

The default local model is `qwen3:8b`; embeddings use `nomic-embed-text-v2-moe`. Run `ollama pull qwen3:8b` and `ollama pull nomic-embed-text-v2-moe`.
