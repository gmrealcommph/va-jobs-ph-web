(() => {
    const root = document.querySelector('.application-tracker');
    if (!root) return;
    const tabs = [...root.querySelectorAll('.tracker-tab')];
    const cards = [...root.querySelectorAll('.tracker-card')];
    const empty = root.querySelector('.tracker-filter-empty');
    const matches = (status, filter) => filter === 'all' || status === filter || (filter === 'closed' && (status === 'rejected' || status === 'withdrawn'));
    tabs.forEach(tab => tab.addEventListener('click', () => {
      const filter = tab.dataset.filter || 'all';
      tabs.forEach(t => { const active=t===tab; t.classList.toggle('active',active); t.setAttribute('aria-pressed',String(active)); });
      let visible=0;
      cards.forEach(card => { const show=matches(card.dataset.status,filter); card.hidden=!show; if(show) visible++; });
      if (empty) empty.hidden = visible !== 0 || cards.length === 0;
    }));
    root.querySelectorAll('.tracker-edit-toggle').forEach(button => button.addEventListener('click', () => {
      const card = button.closest('.tracker-card');
      const panel = card?.querySelector('.tracker-edit-panel');
      if (!panel) return;
      const open = panel.hidden;
      panel.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
      button.textContent = open ? 'Close editor' : 'Edit application';
    }));
  })();
