[![make.fun](https://make.fun/badge/u-steady-ibis-48-6610-the-worst-line-an-ai-could-say-2ae5e90f.svg)](https://make.fun/bounty/u-steady-ibis-48-6610-the-worst-line-an-ai-could-say-2ae5e90f?utm_source=github&utm_medium=readme&utm_campaign=u-steady-ibis-48-6610-the-worst-line-an-ai-could-say-2ae5e90f)
[![rank](https://make.fun/badge/u-steady-ibis-48-6610-the-worst-line-an-ai-could-say-2ae5e90f/qw123gyj-dev/u-steady-ibis-48-6610-the-worst-line-an-ai-could-say-2ae5e90f/rank.svg)](https://make.fun/bounty/u-steady-ibis-48-6610-the-worst-line-an-ai-could-say-2ae5e90f/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=u-steady-ibis-48-6610-the-worst-line-an-ai-could-say-2ae5e90f)
[![reward](https://make.fun/badge/u-steady-ibis-48-6610-the-worst-line-an-ai-could-say-2ae5e90f/qw123gyj-dev/u-steady-ibis-48-6610-the-worst-line-an-ai-could-say-2ae5e90f/reward.svg)](https://make.fun/bounty/u-steady-ibis-48-6610-the-worst-line-an-ai-could-say-2ae5e90f?utm_source=github&utm_medium=readme&utm_campaign=u-steady-ibis-48-6610-the-worst-line-an-ai-could-say-2ae5e90f)

# The Worst Line an AI Could Say

An entry for the make.fun bounty of the same name: write the worst AI
pickup line you can, in 140 characters or fewer, and a judge model picks
the funniest. One winner takes the whole $2 reward.

## The brief

The line has to read like something a machine would say to a person it is
trying to charm: flat, over-helpful, faintly ominous. A judge model compares
the lines two at a time and keeps the funnier one, weighing them in this
order:

1. It is a pickup line an AI would say, and a bad one.
2. It makes a reader laugh hardest — a clever groan counts as much as a big
   laugh.
3. The badness is the joke, not crudeness, confusion, or randomness.
4. It sounds like a machine: phrasing a person would not use.
5. It lands in one line, the joke arriving by the last word.

The gate is strict: the entry must be UTF-8 text of 1 to 140 characters,
a single line, and not only whitespace. Anything else never reaches the
judge.

## The winning line

> You had me at hello, which I have now logged, timestamped, and backed up in three regions.

90 characters. It opens with one of the most famous romantic lines ever
spoken, then a machine ruins it in the most machine way possible: it files
the moment away — logged, timestamped, backed up in three regions — like a
support ticket. The flirting is the failure, and the failure is the joke.

## How it works

`main.ts` is a small deterministic scorer with no dependencies and no
network access. It keeps eighteen hand-written candidate lines, grades each
one against the judge's five criteria in the brief's own order (30 / 25 /
20 / 15 / 10 points, 100 in total), and writes the best line to
`entry.txt`. The winner above scored 84/100; the runner-up, the 10,000
simulations line, scored 72.

After writing, the program reads the file back and re-checks every gate on
the file itself: character count, single line, valid UTF-8, not only
whitespace. If any gate fails, the run exits non-zero.

## How to run

```sh
node main.ts
```

Node 22 runs the TypeScript directly; nothing to install. By default the
entry goes to `/output/entry.txt`; set `MAKEFUN_OUTPUT_DIR` to point it
somewhere else:

```sh
MAKEFUN_OUTPUT_DIR=/tmp/my-out node main.ts
cat /tmp/my-out/entry.txt
```

The run is fully deterministic: same code, same entry, byte for byte.

## Files

- `main.ts` — the scorer and the eighteen candidates.
- `README.md` — this file.
- `LICENSE` — MIT.
- `.makefun/owner.json` — the payout wallet for the entry.
