/* Direction A · המקום — prototype behaviour.
 *
 * shell.js mounts the <template id="proto"> of a.html up to four times at once and
 * calls PROTO.init(root, ctx) for each mount (see the contract at the top of shell.js).
 * Everything here works inside `root` only.
 *
 *   1. Checker floor: builds the two rows of tiles; a.css lays them diagonally.
 *   2. Shelf tabs: ARIA tabs with a roving tabindex. In RTL, ArrowLeft is "next".
 *
 * No cleanup is returned: every listener sits on an element inside `root`, and the
 * shell throws the whole mount away before it rebuilds it.
 */
(function () {
  'use strict';

  var FLOOR_COLUMNS = 44;
  var FLOOR_ROWS = 2;

  /* 1. Checker floor. --d is each tile's place along the diagonal (a.css turns it into a delay). */
  function layFloor(root) {
    var floor = root.querySelector('[data-floor]');
    if (!floor) return;
    var html = '';
    for (var col = 0; col < FLOOR_COLUMNS; col++) {
      for (var row = 0; row < FLOOR_ROWS; row++) {
        var terracotta = (col + row) % 2 ? 't' : '';
        html += '<span class="' + terracotta + '" style="--d:' + (col + row * 3) + '"></span>';
      }
    }
    floor.innerHTML = html;
  }

  /* 2. Shelf tabs. Selecting a tab shows its panel and replays the cards' entry (.enter). */
  function setupTabs(root) {
    var tabs = [].slice.call(root.querySelectorAll('[role=tab]'));

    function panelOf(tab) {
      return root.querySelector('#' + tab.getAttribute('aria-controls'));
    }

    function select(index, moveFocus) {
      tabs.forEach(function (tab, i) {
        var selected = i === index;
        var panel = panelOf(tab);
        tab.setAttribute('aria-selected', selected ? 'true' : 'false');
        tab.tabIndex = selected ? 0 : -1;
        panel.hidden = !selected;
        panel.classList.remove('enter');
        if (selected) {
          void panel.offsetWidth; // restart the CSS animation
          panel.classList.add('enter');
        }
      });
      if (moveFocus) tabs[index].focus();
    }

    function onKey(e, index) {
      var last = tabs.length - 1;
      var next = null;
      if (e.key === 'ArrowLeft') next = index === last ? 0 : index + 1;  // RTL: left = next
      if (e.key === 'ArrowRight') next = index === 0 ? last : index - 1;
      if (e.key === 'Home') next = 0;
      if (e.key === 'End') next = last;
      if (next === null) return;
      e.preventDefault();
      select(next, true);
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(i, false); });
      tab.addEventListener('keydown', function (e) { onKey(e, i); });
    });
  }

  window.PROTO = {
    init: function (root) {
      layFloor(root);
      setupTabs(root);
    }
  };
})();
