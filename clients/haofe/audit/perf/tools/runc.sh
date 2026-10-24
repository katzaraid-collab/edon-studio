#!/bin/bash
cd /tmp/claude-0/-home-user-edon-studio/39250604-ba72-5066-b62c-771f07ec61a3/scratchpad/agents4/perf
for s in img-desktop img-mobile; do rm -f results/$s-*.json; node measure.js $s 1 results || echo FAIL $s; done
for s in opt-desktop optnf-desktop optb-desktop all-desktop allp0-desktop allp1-desktop opt-mobile optnf-mobile optb-mobile all-mobile allp0-mobile allp1-mobile; do rm -f results/$s-*.json; node measure.js $s 3 results || echo FAIL $s; done
for s in opt-desktop-2x optnl-mobile; do rm -f results/$s-*.json; node measure.js $s 1 results || echo FAIL $s; done
for s in opt-desktop opt-mobile all-desktop all-mobile; do rm -f results-br/$s-*.json; BASE=http://127.0.0.1:8766 node measure.js $s 1 results-br || echo FAIL br $s; done
node trace.js perf-opt.html 1280 820 1 1 trace-opt-desktop
node trace.js perf-opt.html 390 780 3 4 trace-opt-mobile
node trace.js perf-opt-bnf.html 390 780 3 4 trace-all-mobile
echo CDONE
