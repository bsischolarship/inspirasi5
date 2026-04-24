/* =========================================================================
   BSI MULTISELECT — drop-in multi-select widget for <select> elements
   ============================================================================

   Usage:
     BsisMultiSelect.attach(document.getElementById('fk-awardee'), {
       placeholder: 'Semua Kampus',      // label ketika tidak ada yang dipilih
       searchable: true,                 // show search box inside dropdown (default: true)
       itemLabelSingular: 'Kampus',      // dipakai untuk label "N Kampus dipilih"
     });

   What it does:
     - Hides the original <select> element (keeps it in DOM as the source of truth)
     - Sets `multiple` attribute on the select so native stores multiple selections
     - Renders a beautiful dropdown UI (button trigger + checkbox list + search)
     - When user selects/deselects, updates <select>'s selected options AND
       dispatches a `change` event so existing `onchange` handlers keep working
     - Overrides `select.value` getter so reading it returns comma-separated string

   After attach:
     select.value         → "UBSI,USBI"      (comma-separated, all selected)
     select.valuesArray   → ["UBSI","USBI"]  (array — new helper)
     select.setValues(['UBSI'])              (new helper to set programmatically)
     BsisMultiSelect.refresh(select)         (re-render options, e.g., after populating)

   ========================================================================= */
(function(global){
  'use strict';

  const DATA_KEY = '_bsisMsInstance';
  const ATTACHED_CLASS = 'bsis-ms-attached';

  // Inject CSS once
  let _cssInjected = false;
  function _injectCSS(){
    if (_cssInjected) return;
    _cssInjected = true;
    const css = `
.bsis-ms{ position:relative; font-family:inherit; }
.bsis-ms-hidden{ display:none !important; }
.bsis-ms-trigger{
  box-sizing:border-box;
  display:flex;align-items:center;justify-content:space-between;gap:8px;
  padding:7px 11px;font-size:12.5px;font-family:inherit;font-weight:500;
  border:1.5px solid #e5e7eb;border-radius:9px;
  background:#f9fafb;color:#6b7280;outline:none;cursor:pointer;
  transition:border-color .15s, box-shadow .15s, background .15s;
  text-align:left;
  min-width:120px; width:auto;
  line-height:1.4;
}
.bsis-ms-trigger:hover{ border-color:#d1d5db;background:#fff; }
.bsis-ms-trigger:focus,
.bsis-ms-trigger.is-open{
  border-color:#0055a5;
  background:#fff;
  box-shadow:0 0 0 3px rgba(0,85,165,.1);
}
.bsis-ms-label{
  flex:1;min-width:0;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.bsis-ms-label.has-value{ color:#0055a5;font-weight:600; }
.bsis-ms-chev{
  width:11px;height:11px;flex-shrink:0;color:#9ca3af;
  transition:transform .2s;
}
.bsis-ms-trigger.is-open .bsis-ms-chev{ transform:rotate(180deg);color:#0055a5; }

.bsis-ms-dropdown{
  position:absolute;top:calc(100% + 4px);left:0;
  min-width:220px; max-width:360px;
  z-index:9999;
  background:#fff;border:1px solid #e5e7eb;
  border-radius:10px;
  box-shadow:0 8px 24px rgba(15,23,42,.12);
  max-height:340px;display:flex;flex-direction:column;
  animation: bsisMsDrop .18s ease;
}
.bsis-ms-dropdown[hidden]{ display:none !important; }
.bsis-ms-dropdown.align-right{ left:auto; right:0; }
@keyframes bsisMsDrop{
  from{opacity:0;transform:translateY(-4px);}
  to{opacity:1;transform:none;}
}
.bsis-ms-search-wrap{
  position:relative;padding:8px 8px 6px;
  border-bottom:1px solid #f3f4f6;
}
.bsis-ms-search-wrap svg{
  position:absolute;left:18px;top:50%;transform:translateY(-50%);
  width:12px;height:12px;color:#9ca3af;pointer-events:none;
}
.bsis-ms-search{
  width:100%;box-sizing:border-box;
  padding:7px 10px 7px 28px;font-size:12.5px;font-family:inherit;
  border:1px solid #e5e7eb;border-radius:7px;background:#f9fafb;
  outline:none;transition:all .15s;color:#111827;
}
.bsis-ms-search:focus{ border-color:#0055a5;background:#fff; }
.bsis-ms-quick{
  display:flex;align-items:center;gap:6px;
  padding:6px 10px;border-bottom:1px solid #f3f4f6;
  background:#fafbfc;
}
.bsis-ms-action{
  padding:4px 10px;font-size:11px;font-weight:700;font-family:inherit;
  border:1px solid #e5e7eb;border-radius:6px;background:#fff;
  color:#374151;cursor:pointer;transition:all .15s;
}
.bsis-ms-action:hover{ border-color:#0055a5;color:#0055a5;background:#f0f9ff; }
.bsis-ms-count{
  margin-left:auto;font-size:10.5px;color:#6b7280;font-weight:600;
  letter-spacing:.02em;
}
.bsis-ms-options{
  overflow-y:auto;overflow-x:hidden;
  padding:4px;flex:1;min-height:60px;
}
.bsis-ms-options::-webkit-scrollbar{ width:6px; }
.bsis-ms-options::-webkit-scrollbar-thumb{ background:#d1d5db;border-radius:3px; }
.bsis-ms-options::-webkit-scrollbar-track{ background:transparent; }
.bsis-ms-opt{
  display:flex;align-items:center;gap:9px;
  padding:7px 10px;border-radius:7px;cursor:pointer;
  font-size:12.5px;color:#374151;
  transition:background .12s;
  position:relative;
}
.bsis-ms-opt:hover{ background:#f3f4f6; }
.bsis-ms-opt.is-checked{ background:#eff6ff;color:#1e3a8a;font-weight:600; }
.bsis-ms-opt input{ position:absolute;opacity:0;pointer-events:none; }
.bsis-ms-check{
  width:17px;height:17px;flex-shrink:0;
  border:1.5px solid #d1d5db;border-radius:5px;
  background:#fff;
  display:flex;align-items:center;justify-content:center;
  transition:all .12s;
}
.bsis-ms-check svg{ width:11px;height:11px;color:#fff;opacity:0;transition:opacity .1s; }
.bsis-ms-opt.is-checked .bsis-ms-check{
  background:linear-gradient(135deg,#0055a5 0%,#00a79d 100%);
  border-color:#0055a5;
}
.bsis-ms-opt.is-checked .bsis-ms-check svg{ opacity:1; }
.bsis-ms-txt{
  flex:1;min-width:0;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.bsis-ms-empty{
  padding:20px 12px;text-align:center;color:#9ca3af;
  font-size:12px;
}
`;
    const style = document.createElement('style');
    style.id = 'bsis-multiselect-css';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function _esc(s){
    return String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function _svgCheck(){
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  }
  function _svgSearch(){
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  }
  function _svgChev(){
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>';
  }

  // Close all open dropdowns (one-at-a-time UX)
  let _openInstances = new Set();
  document.addEventListener('click', (e) => {
    _openInstances.forEach(inst => {
      if (!inst.wrap.contains(e.target)) inst.close();
    });
  });

  class MultiSelectInstance {
    constructor(selectEl, opts){
      opts = opts || {};
      this.sel     = selectEl;
      this.placeholder       = opts.placeholder      || selectEl.dataset.placeholder      || 'Pilih...';
      this.itemLabelSingular = opts.itemLabelSingular|| selectEl.dataset.itemlabel        || 'item';
      this.searchable        = opts.searchable !== undefined ? opts.searchable : true;

      // Make the select multi + hidden
      this.sel.setAttribute('multiple', 'multiple');
      this.sel.classList.add('bsis-ms-hidden');

      // Build wrapper + trigger + dropdown
      this.wrap = document.createElement('div');
      this.wrap.className = 'bsis-ms';
      selectEl.parentNode.insertBefore(this.wrap, selectEl);
      this.wrap.appendChild(selectEl);

      this.trigger = document.createElement('button');
      this.trigger.type = 'button';
      this.trigger.className = 'bsis-ms-trigger';
      this.trigger.setAttribute('aria-haspopup', 'listbox');
      this.trigger.setAttribute('aria-expanded', 'false');
      this.trigger.innerHTML =
        '<span class="bsis-ms-label"></span>' +
        '<span class="bsis-ms-chev">' + _svgChev() + '</span>';
      this.labelEl = this.trigger.querySelector('.bsis-ms-label');
      this.chevEl  = this.trigger.querySelector('.bsis-ms-chev');
      this.wrap.appendChild(this.trigger);

      this.dropdown = document.createElement('div');
      this.dropdown.className = 'bsis-ms-dropdown';
      this.dropdown.setAttribute('hidden', '');
      let searchHTML = '';
      if (this.searchable) {
        searchHTML =
          '<div class="bsis-ms-search-wrap">' +
            _svgSearch() +
            '<input type="text" class="bsis-ms-search" placeholder="Cari ' + _esc(this.itemLabelSingular.toLowerCase()) + '..." />' +
          '</div>';
      }
      this.dropdown.innerHTML = searchHTML +
        '<div class="bsis-ms-quick">' +
          '<button type="button" class="bsis-ms-action" data-action="all">Pilih Semua</button>' +
          '<button type="button" class="bsis-ms-action" data-action="clear">Batalkan</button>' +
          '<span class="bsis-ms-count">0 dipilih</span>' +
        '</div>' +
        '<div class="bsis-ms-options"></div>';
      this.wrap.appendChild(this.dropdown);

      this.searchEl = this.dropdown.querySelector('.bsis-ms-search');
      this.optsEl   = this.dropdown.querySelector('.bsis-ms-options');
      this.countEl  = this.dropdown.querySelector('.bsis-ms-count');
      this.allBtn   = this.dropdown.querySelector('[data-action="all"]');
      this.clearBtn = this.dropdown.querySelector('[data-action="clear"]');

      // Override select.value getter to return comma-separated selected
      // (so existing `.value` reads get the multi-value string)
      Object.defineProperty(this.sel, 'value', {
        get: function(){
          return Array.from(this.selectedOptions).map(o => o.value).filter(v => v !== '').join(',');
        },
        set: function(v){
          const vals = String(v||'').split(',').map(s => s.trim()).filter(Boolean);
          Array.from(this.options).forEach(o => { o.selected = vals.includes(o.value); });
        },
        configurable: true,
      });

      // Expose helpers on the select element
      this.sel.valuesArray = function(){
        return Array.from(this.selectedOptions).map(o => o.value).filter(v => v !== '');
      };
      this.sel.setValues = function(arr){
        const set = new Set(arr || []);
        Array.from(this.options).forEach(o => { o.selected = set.has(o.value); });
        // Re-render widget
        const inst = this[DATA_KEY];
        if (inst) { inst.renderOptions(''); inst.syncLabel(); }
      };

      // Event wiring
      this.trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        this.isOpen() ? this.close() : this.open();
      });
      if (this.searchEl) {
        this.searchEl.addEventListener('input', () => this.renderOptions(this.searchEl.value));
        this.searchEl.addEventListener('click', (e) => e.stopPropagation());
      }
      this.allBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const filter = this.searchEl ? this.searchEl.value : '';
        this.selectAllVisible(filter);
      });
      this.clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.clearAll();
      });
      this.dropdown.addEventListener('click', (e) => e.stopPropagation());

      // Save reference
      this.sel[DATA_KEY] = this;
      this.sel.classList.add(ATTACHED_CLASS);

      // Initial render
      this.syncLabel();
    }

    isOpen(){ return !this.dropdown.hasAttribute('hidden'); }

    open(){
      // Close siblings
      _openInstances.forEach(inst => { if (inst !== this) inst.close(); });
      this.dropdown.removeAttribute('hidden');
      this.trigger.classList.add('is-open');
      this.trigger.setAttribute('aria-expanded', 'true');
      this.renderOptions(this.searchEl ? this.searchEl.value : '');
      // Flip dropdown if it would overflow right
      const rect = this.dropdown.getBoundingClientRect();
      if (rect.right > window.innerWidth - 10) {
        this.dropdown.classList.add('align-right');
      } else {
        this.dropdown.classList.remove('align-right');
      }
      if (this.searchEl) {
        this.searchEl.value = '';
        setTimeout(() => this.searchEl && this.searchEl.focus(), 30);
      }
      _openInstances.add(this);
    }

    close(){
      this.dropdown.setAttribute('hidden', '');
      this.trigger.classList.remove('is-open');
      this.trigger.setAttribute('aria-expanded', 'false');
      _openInstances.delete(this);
    }

    renderOptions(filterText){
      const q = (filterText || '').trim().toLowerCase();
      const opts = Array.from(this.sel.options).filter(o => o.value !== '');
      // Filter
      const visible = q
        ? opts.filter(o => (o.value + ' ' + (o.textContent||'')).toLowerCase().includes(q))
        : opts;

      if (!visible.length) {
        this.optsEl.innerHTML = '<div class="bsis-ms-empty">Tidak ada pilihan</div>';
        return;
      }

      const html = visible.map(o => {
        const label = o.textContent || o.value;
        const checked = o.selected;
        return '<label class="bsis-ms-opt' + (checked ? ' is-checked' : '') + '" data-value="' + _esc(o.value) + '">' +
          '<input type="checkbox" value="' + _esc(o.value) + '"' + (checked ? ' checked' : '') + '/>' +
          '<span class="bsis-ms-check">' + _svgCheck() + '</span>' +
          '<span class="bsis-ms-txt">' + _esc(label) + '</span>' +
        '</label>';
      }).join('');
      this.optsEl.innerHTML = html;

      // Wire checkbox handlers
      Array.from(this.optsEl.querySelectorAll('input[type="checkbox"]')).forEach(cb => {
        cb.addEventListener('change', () => {
          const val = cb.value;
          const opt = Array.from(this.sel.options).find(o => o.value === val);
          if (opt) opt.selected = cb.checked;
          const optDiv = cb.closest('.bsis-ms-opt');
          if (optDiv) optDiv.classList.toggle('is-checked', cb.checked);
          this.syncLabel();
          // Fire change event on select for existing onchange handlers
          this.sel.dispatchEvent(new Event('change', { bubbles: true }));
        });
      });
    }

    selectAllVisible(filterText){
      const q = (filterText || '').trim().toLowerCase();
      const opts = Array.from(this.sel.options).filter(o => o.value !== '');
      const visible = q ? opts.filter(o => (o.value + ' ' + (o.textContent||'')).toLowerCase().includes(q)) : opts;
      visible.forEach(o => { o.selected = true; });
      this.renderOptions(filterText);
      this.syncLabel();
      this.sel.dispatchEvent(new Event('change', { bubbles: true }));
    }

    clearAll(){
      Array.from(this.sel.options).forEach(o => { o.selected = false; });
      this.renderOptions(this.searchEl ? this.searchEl.value : '');
      this.syncLabel();
      this.sel.dispatchEvent(new Event('change', { bubbles: true }));
    }

    syncLabel(){
      const selected = Array.from(this.sel.selectedOptions).filter(o => o.value !== '');
      const n = selected.length;
      if (n === 0) {
        this.labelEl.textContent = this.placeholder;
        this.labelEl.classList.remove('has-value');
      } else if (n === 1) {
        this.labelEl.textContent = selected[0].textContent || selected[0].value;
        this.labelEl.classList.add('has-value');
      } else {
        this.labelEl.textContent = n + ' ' + this.itemLabelSingular + ' dipilih';
        this.labelEl.classList.add('has-value');
      }
      if (this.countEl) this.countEl.textContent = n + ' dipilih';
    }
  }

  const API = {
    attach(selectEl, opts){
      if (!selectEl || selectEl.tagName !== 'SELECT') return null;
      if (selectEl.classList.contains(ATTACHED_CLASS)) {
        return selectEl[DATA_KEY] || null;
      }
      _injectCSS();
      return new MultiSelectInstance(selectEl, opts || {});
    },
    // Re-render after options have been added/removed (e.g., after buildFilters())
    refresh(selectEl){
      const inst = selectEl && selectEl[DATA_KEY];
      if (!inst) return;
      inst.renderOptions(inst.searchEl ? inst.searchEl.value : '');
      inst.syncLabel();
    },
    // Attach all matching selects on the page
    attachAll(selector, opts){
      document.querySelectorAll(selector).forEach(el => {
        if (el.tagName === 'SELECT') API.attach(el, opts || {});
      });
    },
    // Read selected values as array
    getValues(selectEl){
      if (!selectEl) return [];
      if (typeof selectEl.valuesArray === 'function') return selectEl.valuesArray();
      return selectEl.value ? [selectEl.value] : [];
    },
  };

  global.BsisMultiSelect = API;
})(window);
