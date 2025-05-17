fetch('stream24h.json')
  .then(res => res.json())
  .then(data => {
    const ul = document.getElementById('planning');
    data.planning.forEach(item => {
      const li = document.createElement('li');
      li.textContent = `${item.time} — ${item.label}`;
      if (item.checked) li.classList.add('checked');
      ul.appendChild(li);
    });

    const ul2 = document.getElementById('donations');
    data.donation_goals.forEach(goal => {
      const li = document.createElement('li');
      li.textContent = `${goal.amount}€ : ${goal.challenge}`;
      ul2.appendChild(li);
    });
  });
