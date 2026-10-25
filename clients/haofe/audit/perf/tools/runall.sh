#!/bin/bash
cd /tmp/claude-0/-home-user-edon-studio/39250604-ba72-5066-b62c-771f07ec61a3/scratchpad/agents4/perf
rm -rf results results-br; mkdir -p results results-br
for s in full-desktop opt-desktop optnf-desktop full-mobile opt-mobile optnf-mobile; do node measure.js $s 3 results || echo "FAIL $s"; done
for s in page-desktop img-desktop img-mobile optnl-mobile full-desktop-2x opt-desktop-2x; do node measure.js $s 1 results || echo "FAIL $s"; done
for s in full-desktop opt-desktop full-mobile opt-mobile; do BASE=http://127.0.0.1:8766 node measure.js $s 1 results-br || echo "FAIL br $s"; done
node trace.js perf-full.html 1280 820 1 1 trace-full-desktop
node trace.js perf-opt.html 1280 820 1 1 trace-opt-desktop
node trace.js perf-full.html 390 780 3 4 trace-full-mobile
node trace.js perf-opt.html 390 780 3 4 trace-opt-mobile
echo ALLDONE
