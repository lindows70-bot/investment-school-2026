You are reviewing a Next.js + TypeScript investment-education app (Korean UI). This is a READ-ONLY review: do not modify any file.

Read first, in this order:
1. docs/reviews/2026-10-11-codex-judgment-logic.md — the change list (sections ①–⑨) and seven open questions.
2. CLAUDE.md sections "⛔ 절대 원칙" and "제2원칙" — the project's rules (no fabricated precision, same metric = same value on every screen).

Then read these files and review the logic named in the change list:
- src/lib/lynchAnalysis.ts (lynchFairValue, calcFairMultiple, sanitizeEps)
- src/lib/pegBaseEffect.ts
- src/lib/fyEps.ts
- src/app/api/stock-info/route.ts (KR fyEps / epsBasis / peBasis; US fyEps)
- src/app/api/financials/route.ts (DART fetch, chain ratio, kMed scaling, account matching, US fundamentalsTimeSeries fallback)
- src/lib/macroPhaseScreener.ts (screenOne: pegGrad0 / eyScore0 prefilter, pegPeak, value/quality scores)
- src/lib/axisSnapshot.ts
- src/app/api/research-verdict/route.ts (pegPeak read/compute, buy gate, oneLiner)
- src/app/api/lynch-earnings-tracer/route.ts (currentEps / currentEpsBasis)
- src/lib/usSmartHistory.ts and scripts/verify-usm-no-backdate.mjs

What I want:
- Answer each of the seven questions in the review doc with a concrete yes/no and the code path (file:line).
- Report defects as P1 (wrong number or wrong verdict reaches a screen / invariant silently passes when it should fail) or P2 (fragile, likely to break later). For each: file:line, a concrete input that triggers it, the wrong output, and the smallest fix.
- Do NOT report style, naming, or comment wording. Do NOT report things the doc already lists as deliberate design unless you can show a concrete input where the design produces a self-contradicting screen.
- If you are guessing (cannot trace the input to the output), label it "unverified".

Output: a short list, most severe first. Korean or English is fine.
