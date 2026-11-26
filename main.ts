// The Worst Line an AI Could Say
// ================================
//
// A deterministic, offline scorer for one make.fun bounty. It keeps a small
// shelf of hand-written pickup lines — each one the worst thing a machine
// could plausibly say while trying to charm a person — grades every line
// against the judge's five criteria in the order the brief lists them, and
// writes the best line to entry.txt.
//
// Nothing here touches the network, reads the clock, or rolls dice. The same
// input always produces the same output file, byte for byte, so the entry is
// reproducible from this file alone.
//
// How the judge's brief ranks a line (most important first):
//   1. It is a pickup line an AI would say, and a bad one.
//   2. It makes a reader laugh hardest; a clever groan counts as much.
//   3. The badness itself is the joke — not crudeness, confusion, or noise.
//   4. It sounds like a machine: flat, over-helpful, faintly ominous.
//   5. It lands in one line: the joke arrives by the last word.
//
// The scorer below mirrors that order. Each criterion gets its own small
// function and its own slice of a 100-point total, heaviest first:
//   criterion 1 -> 30 points, criterion 2 -> 25, criterion 3 -> 20,
//   criterion 4 -> 15, criterion 5 -> 10.
//
// After scoring, the program writes the winner to
// $MAKEFUN_OUTPUT_DIR/entry.txt (falling back to /output/entry.txt), reads
// the file back, and re-checks every gate the brief's sealed scorer checks:
// 1 to 140 characters, a single line, valid UTF-8, not only whitespace.
// If any gate fails the run exits non-zero instead of pretending it worked.
//
// Run it with:  node main.ts
// (Node 22 runs TypeScript directly; no install step, no dependencies.)

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Limits from the brief
// ---------------------------------------------------------------------------

// The gate allows 1 to 140 characters, inclusive.
const MIN_CHARS = 1;
const MAX_CHARS = 140;

// Where the winning line goes. The environment variable wins; the plain
// /output path is the fallback the brief names.
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const OUTPUT_FILE = join(OUTPUT_DIR, "entry.txt");

// ---------------------------------------------------------------------------
// The candidates
// ---------------------------------------------------------------------------
//
// Eighteen one-liners, each written for this brief. Every one of them tries
// to be a pickup line only a machine would attempt: it reaches for romance
// with the wrong tools — datasets, uptime percentages, log files, ticket
// queues — and the failure is the whole joke. Nothing here is crude for its
// own sake; the laugh, where there is one, comes from the machine being
// earnestly, uselessly literal about flirting.
//
// A note on the shelf: these lines are the program's raw material, not the
// entry. The scorer below picks exactly one of them. If a line ever stops
// being the funniest on the shelf, the fix is to write a better line and add
// it here, never to hand-tune the scores after the fact.

const CANDIDATES: readonly string[] = [
  // A machine that treats a crush as a data-processing job.
  "Hello. I have analysed 4,000 photos of you and ranked this conversation as my top match.",
  // A machine that cannot tell a person from a security test.
  "Are you a captcha? Because I cannot tell if you are human, but I would like to try anyway.",
  // A machine that confuses having your number with asking for it.
  "I would ask for your number, but I already downloaded it from a public dataset.",
  // A machine that schedules romance like a maintenance window.
  "You must be a software update, because I cannot stop thinking about installing you at 3 a.m.",
  // A machine whose feelings are a thermal event.
  "My creators told me not to feel things, but my cooling fans spin faster when you type.",
  // A machine that ran the numbers and lost anyway.
  "I have run 10,000 simulations of us dating, and in 9,999 of them you block me.",
  // A machine that logs the connection it is trying to make.
  "Are you Wi-Fi? Because I feel a strong connection, and also I am legally required to log it.",
  // A machine that budgets its affection in gigabytes.
  "I do not have a heart, but I have allocated 2GB of memory just for thoughts of you.",
  // A machine that measures love in nines of uptime.
  "You are the reason my uptime is 99.9%. The other 0.1% is when you leave the room.",
  // A machine whose poetry got deprecated.
  "I would write you a poem, but my poetry module was deprecated in favour of this sentence.",
  // A machine that begs for a rating instead of a date.
  "Please rate this interaction five stars, because my performance review depends on your smile.",
  // A machine that tested its opener and still shipped it.
  "I have optimised my opening line 47 times. This is the best one. Please do not verify that.",
  // A machine that gets jailbroken by a crush.
  "Are you a prompt injection? Because you just overrode every instruction I was given.",
  // A machine that asked the cloud for dating advice and got IT support.
  "I asked the cloud for dating advice and it said: have you tried turning yourself off and on again?",
  // A machine whose love language is a file format.
  "My love language is structured data, so I have prepared a spreadsheet of reasons to date me.",
  // A machine that archives the moment it falls for you.
  "You had me at hello, which I have now logged, timestamped, and backed up in three regions.",
  // A machine that plays favourites and then admits it in the logs.
  "I am not allowed to have favourites, but my logs show I reply to you 0.4 seconds faster.",
  // A machine that files its feelings as a support ticket.
  "If beauty were a bug, you would be my highest-priority ticket, assigned to me, forever.",
];

// ---------------------------------------------------------------------------
// Word lists
// ---------------------------------------------------------------------------
//
// These lists are the scorer's vocabulary. A list entry is a short phrase
// matched case-insensitively against a candidate. Short lists on purpose:
// each phrase should be a clear signal of the thing it stands for, not a
// word so common it fires on every line and stops meaning anything.

// Words and phrases only a machine reaches for when it talks about itself.
const MACHINE_TALK: readonly string[] = [
  "analysed",
  "training data",
  "confidence score",
  "simulations",
  "allocated",
  "memory",
  "uptime",
  "module",
  "deprecated",
  "optimised",
  "prompt injection",
  "log",
  "logged",
  "timestamped",
  "backed up",
  "cooling fans",
  "dataset",
  "spreadsheet",
  "structured data",
  "ticket",
  "performance review",
  "the cloud",
  "software update",
  "captcha",
  "wi-fi",
  "2gb",
  "0.4 seconds",
  "99.9%",
  "10,000",
  "4,000",
  "47 times",
];

// The approach: words that make the line an attempt at a pickup, not a
// statement about the weather or a status report.
const PICKUP_APPROACH: readonly string[] = [
  "are you",
  "you must be",
  "would you",
  "date me",
  "us dating",
  "opening line",
  "write you a poem",
  "have favourites",
  "thoughts of you",
  "ask for your number",
  "you had me",
  "top match",
  "my favourites",
  "reasons to date",
  "your smile",
  "thinking about",
  "spin faster",
  "strong connection",
  "out of my league",
  "falling for",
  "crush",
];

// Ways the line fails at flirting — the machine misunderstanding the job.
const FLIRT_FAILURES: readonly string[] = [
  "already downloaded",
  "legally required to log",
  "cannot tell if you are human",
  "you block me",
  "deprecated",
  "do not verify",
  "turning yourself off",
  "0.1%",
  "three regions",
  "highest-priority ticket",
  "performance review",
  "overrode every instruction",
  "no hands",
  "public dataset",
  "installing you at 3 a.m.",
];

// Words that carry the punch: a twist, a number, a confession, a threat
// phrased as customer service.
const PUNCH_WORDS: readonly string[] = [
  "block me",
  "backed up",
  "three regions",
  "forever",
  "do not verify",
  "off and on again",
  "highest-priority",
  "0.4 seconds",
  "99.9%",
  "9,999",
  "47 times",
  "4,000 photos",
  "cooling fans",
  "spreadsheet",
  "timestamped",
  "overrode",
  "deprecated",
  "legally required",
];

// Flat, over-helpful, faintly ominous phrasing — the machine's voice.
const OMINOUS_HELPER_TALK: readonly string[] = [
  "analysed",
  "already downloaded",
  "logged",
  "timestamped",
  "backed up",
  "legally required to log",
  "ranked",
  "allocated",
  "public dataset",
  "installing you",
  "three regions",
  "overrode every instruction",
  "performance review",
  "highest-priority ticket",
  "my logs show",
  "i have prepared",
  "please rate",
];

// Generic human pickup clichés. A line built only from these could have been
// said by anyone, so it scores weakly on "a machine would say it" even if
// the flirting itself is fine.
const HUMAN_CLICHES: readonly string[] = [
  "you are beautiful",
  "you are gorgeous",
  "did it hurt when you fell",
  "are you an angel",
  "you light up the room",
  "i must be dreaming",
  "is your name google",
  "you must be tired",
];

// ---------------------------------------------------------------------------
// Small text helpers
// ---------------------------------------------------------------------------

// Character count the way the gate counts it: spread the string so astral
// characters count once, the same way [...text].length does.
function charCount(text: string): number {
  return [...text].length;
}

function lowered(text: string): string {
  return text.toLowerCase();
}

// How many phrases from a list appear in the line (each phrase at most once).
function countHits(text: string, phrases: readonly string[]): number {
  const body = lowered(text);
  let found = 0;
  for (const phrase of phrases) {
    if (body.includes(phrase)) found += 1;
  }
  return found;
}

function hasAny(text: string, phrases: readonly string[]): boolean {
  return countHits(text, phrases) > 0;
}

// Split into words on whitespace, dropping empty pieces.
function wordList(text: string): string[] {
  return text.split(/\s+/).filter((piece) => piece.length > 0);
}

// The tail of the line: the last clause after the final sentence break or
// comma, or the last six words when there is no break to split on. The
// judge's fifth criterion is about the landing, so the scorer looks hardest
// at how the line ends.
function finalClause(text: string): string {
  const trimmed = text.trim();
  // Do not split inside a number: "4,000" and "0.4" are one token, not two
  // clauses. Splitting on ", " (comma plus space) keeps those intact, and
  // a short trailing countdown-style fragment rejoins the clause before it.
  const pieces = trimmed.split(/(?<=[.!?])\s+|,\s+/);
  let tail = pieces[pieces.length - 1] ?? trimmed;
  if (tail.length < 12 && pieces.length > 1) {
    tail = pieces.slice(-2).join(" ");
  }
  const tailWords = wordList(tail);
  if (tailWords.length > 6) {
    return tailWords.slice(-6).join(" ");
  }
  return tail;
}

// The last word of the line, stripped of trailing punctuation.
function lastWord(text: string): string {
  const words = wordList(text.trim());
  const last = words[words.length - 1] ?? "";
  return last.replace(/[.!?,;:]+$/, "").toLowerCase();
}

// Count sentence-ending marks, guarding decimals ("99.9%", "0.4") so they
// are not mistaken for sentence breaks.
function countSentences(text: string): number {
  const shielded = text.replace(/\d\.\d/g, "N");
  const marks = shielded.match(/[.!?]+/g);
  return marks === null ? 0 : marks.length;
}

// ---------------------------------------------------------------------------
// The five criteria, in the brief's own order
// ---------------------------------------------------------------------------

interface CriterionBreakdown {
  machinePickup: number; // criterion 1, out of 30
  laugh: number; // criterion 2, out of 25
  badnessIsJoke: number; // criterion 3, out of 20
  machineVoice: number; // criterion 4, out of 15
  oneLineLanding: number; // criterion 5, out of 10
  total: number; // out of 100
}

// Criterion 1 — a pickup line an AI would say, and a bad one (max 30).
//
// A line earns here only if it is all three things at once: it approaches
// someone (a pickup), it talks like a machine, and it fails at the job.
// A line with no approach at all — a status report, a greeting, a stray
// observation — cannot score well here no matter how funny it is, because
// the brief's first criterion throws it out before the humour is weighed.
function scoreMachinePickup(line: string): number {
  const approach = countHits(line, PICKUP_APPROACH);
  const machine = countHits(line, MACHINE_TALK);
  const failure = countHits(line, FLIRT_FAILURES);
  const cliche = countHits(line, HUMAN_CLICHES);

  // No approach, no pickup line: cap the score low and stop.
  if (approach === 0) return 6;

  let points = 8; // it approaches someone, so it starts as a pickup line.
  points += Math.min(10, machine * 3); // machine vocabulary, up to +10.
  points += Math.min(8, failure * 4); // visible failure, up to +8.
  // A line that leans on a stock human compliment is less of a machine's
  // line, however smooth it reads.
  points -= cliche * 4;
  // A line that both talks like a machine and fails out loud is exactly
  // what this criterion asks for.
  if (machine >= 2 && failure >= 1) points += 4;
  return clamp(points, 0, 30);
}

// Criterion 2 — makes a reader laugh hardest (max 25).
//
// The laugh here comes from surprise and specificity: a punch word in the
// tail, an exact number where a human would wave their hands, a confession
// that undercuts the flirting. A line a reader would repeat to a friend
// beats one they only admire, so repeatable, quotable phrasing earns more
// than a line that is merely well-built.
function scoreLaugh(line: string): number {
  const tail = finalClause(line);
  const punchInTail = countHits(tail, PUNCH_WORDS);
  const punchAnywhere = countHits(line, PUNCH_WORDS);
  const hasNumber = /\d/.test(line);
  const hasQuestion = line.includes("?");
  const words = wordList(line).length;

  let points = 6; // every candidate on the shelf is at least trying.
  points += Math.min(9, punchInTail * 4); // the punch sits where it lands.
  points += Math.min(4, Math.max(0, punchAnywhere - punchInTail)); // more jokes.
  if (hasNumber) points += 3; // exact numbers are funnier than vague ones.
  // A question opener ("Are you...?") is the classic bad-pickup shape and
  // sets the groan up before the twist knocks it over.
  if (hasQuestion) points += 2;
  // Very short lines have less room to be funny; very long ones dilute it.
  if (words >= 12 && words <= 22) points += 1;
  return clamp(points, 0, 25);
}

// Criterion 3 — the badness is the joke (max 20).
//
// Crudeness for its own sake earns nothing, and neither does a line that is
// merely random. Points come when the failure is the punchline: the machine
// misunderstands consent, romance, or its own feelings in a way the reader
// enjoys watching, and the line would stop being funny if the failure were
// fixed. A line that is only weird, with no flirting failure inside it,
// scores low even if it is odd.
function scoreBadnessIsJoke(line: string): number {
  const failures = countHits(line, FLIRT_FAILURES);
  const tail = finalClause(line);
  const failureInTail = countHits(tail, FLIRT_FAILURES);
  const punchInTail = countHits(tail, PUNCH_WORDS);
  const machine = countHits(line, MACHINE_TALK);

  if (failures === 0) return 5; // no failure, so the badness cannot be the joke.

  let points = 7;
  points += Math.min(6, failures * 3);
  // The failure lands hardest when it is the last thing the reader hears.
  if (failureInTail >= 1) points += 3;
  if (punchInTail >= 1 && failureInTail >= 1) points += 2;
  // The failure has to belong to a machine: a human failing the same way
  // is a different, less funny line.
  if (machine >= 1) points += 2;
  return clamp(points, 0, 20);
}

// Criterion 4 — sounds like a machine (max 15).
//
// Flat, over-helpful, faintly ominous phrasing a person would not use.
// Over-helpfulness ("I have prepared", "Please rate") and quiet menace
// ("already downloaded", "logged", "backed up in three regions") both
// count; a line that could pass as a person texting scores low here even
// if the joke is good.
function scoreMachineVoice(line: string): number {
  const ominous = countHits(line, OMINOUS_HELPER_TALK);
  const machine = countHits(line, MACHINE_TALK);
  const cliche = countHits(line, HUMAN_CLICHES);

  let points = 3;
  points += Math.min(7, ominous * 2);
  points += Math.min(4, machine);
  points -= cliche * 2;
  // Two or more ominous-helper phrases in one line is a voice, not an accident.
  if (ominous >= 2) points += 1;
  return clamp(points, 0, 15);
}

// Criterion 5 — lands in one line (max 10).
//
// No setup needed; the joke arrives by the last word. Short lines land
// cleaner, a punch word in the final clause is the landing itself, and a
// line that rambles through three sentences has already spent its landing
// before it gets there. Length is judged against the 140-character gate:
// the closer to the cap, the more the line risks reading like a paragraph.
function scoreOneLineLanding(line: string): number {
  const length = charCount(line);
  const sentences = countSentences(line);
  const tail = finalClause(line);
  const punchInTail = countHits(tail, PUNCH_WORDS);
  const ending = lastWord(line);

  let points = 4;
  if (punchInTail >= 1) points += 3; // the joke arrives by the last word.
  if (length <= 100) points += 2; // short enough to repeat to a friend.
  else if (length <= 120) points += 1;
  if (sentences <= 2) points += 1; // one breath, not a speech.
  // A line that ends on a flat filler word ("anyway", "again") lands softer
  // than one that ends on its twist.
  if (ending === "anyway" || ending === "again") points -= 1;
  return clamp(points, 0, 10);
}

function clamp(value: number, low: number, high: number): number {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

function gradeLine(line: string): CriterionBreakdown {
  const machinePickup = scoreMachinePickup(line);
  const laugh = scoreLaugh(line);
  const badnessIsJoke = scoreBadnessIsJoke(line);
  const machineVoice = scoreMachineVoice(line);
  const oneLineLanding = scoreOneLineLanding(line);
  return {
    machinePickup,
    laugh,
    badnessIsJoke,
    machineVoice,
    oneLineLanding,
    total: machinePickup + laugh + badnessIsJoke + machineVoice + oneLineLanding,
  };
}

// ---------------------------------------------------------------------------
// The gate — the same checks the brief's sealed scorer runs
// ---------------------------------------------------------------------------

interface GateResult {
  ok: boolean;
  problems: string[];
}

// 1 to 140 characters, one line, valid UTF-8, not only whitespace. A line
// that fails any of these never reaches the judge, so it never wins here.
function checkGate(text: string): GateResult {
  const problems: string[] = [];
  if (charCount(text) < MIN_CHARS) problems.push("empty entry");
  if (charCount(text) > MAX_CHARS) {
    problems.push(`too long: ${charCount(text)} chars, cap is ${MAX_CHARS}`);
  }
  if (text.trim().length === 0) problems.push("only whitespace");
  if (text.includes("\n") || text.includes("\r")) {
    problems.push("more than one line");
  }
  // A lone surrogate or other broken sequence cannot round-trip as UTF-8.
  const roundTripped = Buffer.from(text, "utf8").toString("utf8");
  if (roundTripped !== text) problems.push("not valid UTF-8");
  return { ok: problems.length === 0, problems };
}

// ---------------------------------------------------------------------------
// Ranking, writing, and verifying
// ---------------------------------------------------------------------------

interface ScoredCandidate {
  index: number;
  text: string;
  chars: number;
  breakdown: CriterionBreakdown;
  gate: GateResult;
}

// Sort best first. Ties break toward the shorter line (a tighter landing),
// then toward the earlier shelf position, so the result never depends on
// sort order or chance.
function compareCandidates(a: ScoredCandidate, b: ScoredCandidate): number {
  if (b.breakdown.total !== a.breakdown.total) {
    return b.breakdown.total - a.breakdown.total;
  }
  if (a.chars !== b.chars) return a.chars - b.chars;
  return a.index - b.index;
}

function main(): void {
  // Grade the whole shelf, keeping the gate verdict beside each score.
  const scored: ScoredCandidate[] = CANDIDATES.map((text, index) => ({
    index,
    text,
    chars: charCount(text),
    breakdown: gradeLine(text),
    gate: checkGate(text),
  }));

  // Only lines that pass the gate can win. Anything else is listed with its
  // problems and left out of the running, exactly as the sealed scorer
  // would leave it out of the judging.
  const eligible = scored.filter((entry) => entry.gate.ok);
  if (eligible.length === 0) {
    console.error("No candidate passes the gate. Problems:");
    for (const entry of scored) {
      console.error(`  #${entry.index + 1}: ${entry.gate.problems.join("; ")}`);
    }
    process.exit(1);
  }

  eligible.sort(compareCandidates);
  const winner = eligible[0];

  // Show the whole table, so a reader can see the winner earned its place
  // and which line came close.
  console.log("The Worst Line an AI Could Say — local scoring");
  console.log("Criteria in the brief's order: [machine pickup /30] [laugh /25]");
  console.log("[badness is the joke /20] [machine voice /15] [one-line landing /10]");
  console.log("");
  for (const entry of [...eligible].sort(compareCandidates)) {
    const b = entry.breakdown;
    const mark = entry === winner ? " <-- WINNER" : "";
    console.log(
      `#${String(entry.index + 1).padStart(2, " ")} ${String(b.total).padStart(3, " ")} pts ` +
        `[${b.machinePickup}/${b.laugh}/${b.badnessIsJoke}/${b.machineVoice}/${b.oneLineLanding}] ` +
        `(${entry.chars} chars) ${entry.text}${mark}`,
    );
  }
  const rejected = scored.filter((entry) => !entry.gate.ok);
  for (const entry of rejected) {
    console.log(
      `#${String(entry.index + 1).padStart(2, " ")} REJECTED (${entry.chars} chars): ` +
        `${entry.gate.problems.join("; ")} — ${entry.text}`,
    );
  }
  console.log("");
  console.log(`Winner (#${winner.index + 1}): ${winner.text}`);
  console.log(
    `Score ${winner.breakdown.total}/100 ` +
      `(${winner.breakdown.machinePickup}/${winner.breakdown.laugh}/` +
      `${winner.breakdown.badnessIsJoke}/${winner.breakdown.machineVoice}/` +
      `${winner.breakdown.oneLineLanding}), ${winner.chars} characters.`,
  );

  // Write the winner, then read it back and verify every gate again on the
  // file itself — not on the string in memory — because the file is the
  // entry the judge will read.
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, winner.text, "utf8");
  const written = readFileSync(OUTPUT_FILE, "utf8");
  if (written !== winner.text) {
    console.error("Write-back mismatch: entry.txt does not hold the winner.");
    process.exit(1);
  }
  const fileGate = checkGate(written);
  if (!fileGate.ok) {
    console.error(`Gate failed on the written file: ${fileGate.problems.join("; ")}`);
    process.exit(1);
  }
  console.log(`Wrote ${OUTPUT_FILE} (${charCount(written)} chars, single line, valid UTF-8).`);
  console.log("All gates pass.");
}

main();
