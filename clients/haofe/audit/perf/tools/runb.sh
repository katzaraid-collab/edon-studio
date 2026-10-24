#!/bin/bash
cd /tmp/claude-0/-home-user-edon-studio/39250604-ba72-5066-b62c-771f07ec61a3/scratchpad/agents4/perf
for s in optb-desktop all-desktop optb-mobile all-mobile; do node measure.js $s 3 results || echo "FAIL $s"; done
for s in all-desktop all-mobile; do BASE=http://127.0.0.1:8766 node measure.js $s 1 results-br || echo "FAIL br $s"; done
node trace.js perf-opt-bnf.html 390 780 3 4 trace-all-mobile
echo BDONE
