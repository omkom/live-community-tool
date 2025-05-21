// public/js/admin.js
// Variables globales
let planningData = [];
let ws = null;
let connectionStatus = 'disconnected';

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initWebSocket();
  loadPlanning();
  loadStatus();
  initEventListeners();
  startClock();
});

// Initialisation des onglets
function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const tabContents = document.querySelectorAll('.tab-content');
      tabContents.forEach(content => content.classList.remove('active'));
      
      const tabId = tab.getAttribute('data-tab');
      document.getElementById(`${tabId}-tab`).classList.add('active');
    });
  });
}

// Initialisation WebSocket
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}?type=admin`;
  
  ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    setConnectionStatus('connected');
    showToast('Connexion WebSocket établie', 'success');
  };
  
  ws.onclose = () => {
    setConnectionStatus('disconnected');
    showToast('Connexion WebSocket perdue. Tentative de reconnexion...', 'error');
    setTimeout(initWebSocket, 3000); // Tentative de reconnexion après 3s
  };
  
  ws.onerror = (error) => {
    console.error('Erreur WebSocket:', error);
    setConnectionStatus('error');
  };
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('Message reçu:', data);
      
      if (data.type === 'update') {
        if (data.target === 'planning') {
          loadPlanning();
        } else if (data.target === 'status') {
          loadStatus();
        }
      } else if (data.type === 'init') {
        console.log('Connexion initialisée:', data);
      }
    } catch (e) {
      console.error('Erreur de parsing WebSocket:', e, event.data);
    }
  };
}

// Définir le statut de connexion
function setConnectionStatus(status) {
  connectionStatus = status;
  const statusElement = document.getElementById('connection-status');
  
  switch (status) {
    case 'connected':
      statusElement.innerHTML = '🟢';
      statusElement.title = 'Connecté au serveur';
      break;
    case 'disconnected':
      statusElement.innerHTML = '🔴';
      statusElement.title = 'Déconnecté du serveur';
      break;
    case 'error':
      statusElement.innerHTML = '⚠️';
      statusElement.title = 'Erreur de connexion';
      break;
    default:
      statusElement.innerHTML = '⚪';
      statusElement.title = 'Statut inconnu';
  }
}

// Chargement du planning
function loadPlanning() {
  fetch('/api/planning')
    .then(response => {
      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      planningData = data.planning || [];
      renderPlanningTable();
      renderTimeline();
    })
    .catch(error => {
      console.error('Erreur lors du chargement du planning:', error);
      showToast('Erreur lors du chargement du planning', 'error');
    });
}

// Rendu du tableau de planning
function renderPlanningTable() {
  const tbody = document.querySelector('#planningTable tbody');
  tbody.innerHTML = '';
  
  if (planningData.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.textContent = 'Aucun élément dans le planning. Ajoutez-en un !';
    cell.style.textAlign = 'center';
    cell.style.padding = '20px';
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }
  
  planningData.forEach((item, index) => {
    const row = document.createElement('tr');
    
    // Cellule heure
    const timeCell = document.createElement('td');
    const timeInput = document.createElement('input');
    timeInput.type = 'time';
    timeInput.value = item.time;
    timeInput.addEventListener('change', () => {
      planningData[index].time = timeInput.value;
      renderTimeline();
    });
    timeCell.appendChild(timeInput);
    
    // Cellule label
    const labelCell = document.createElement('td');
    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.value = item.label;
    labelInput.addEventListener('input', () => {
      planningData[index].label = labelInput.value;
      renderTimeline();
    });
    labelCell.appendChild(labelInput);
    
    // Cellule statut
    const statusCell = document.createElement('td');
    const statusInput = document.createElement('input');
    statusInput.type = 'checkbox';
    statusInput.checked = item.checked;
    statusInput.addEventListener('change', () => {
      planningData[index].checked = statusInput.checked;
      renderTimeline();
    });
    statusCell.appendChild(statusInput);
    
    // Cellule actions
    const actionsCell = document.createElement('td');
    
    const upBtn = document.createElement('button');
    upBtn.className = 'btn btn-icon';
    upBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    upBtn.title = 'Monter';
    upBtn.addEventListener('click', () => moveRow(index, -1));
    
    const downBtn = document.createElement('button');
    downBtn.className = 'btn btn-icon';
    downBtn.innerHTML = '<i class="fas fa-arrow-down"></i>';
    downBtn.title = 'Descendre';
    downBtn.addEventListener('click', () => moveRow(index, 1));
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-icon';
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
    deleteBtn.title = 'Supprimer';
    deleteBtn.addEventListener('click', () => {
      if (confirm(`Supprimer "${item.label}" ?`)) {
        planningData.splice(index, 1);
        renderPlanningTable();
        renderTimeline();
      }
    });
    
    actionsCell.appendChild(upBtn);
    actionsCell.appendChild(downBtn);
    actionsCell.appendChild(deleteBtn);
    
    // Ajout des cellules à la ligne
    row.appendChild(timeCell);
    row.appendChild(labelCell);
    row.appendChild(statusCell);
    row.appendChild(actionsCell);
    
    tbody.appendChild(row);
  });
}

// Déplacer une ligne vers le haut ou le bas
function moveRow(index, direction) {
  const newIndex = index + direction;
  
  if (newIndex < 0 || newIndex >= planningData.length) {
    return; // Hors limites
  }
  
  // Échanger les éléments
  [planningData[index], planningData[newIndex]] = [planningData[newIndex], planningData[index]];
  
  renderPlanningTable();
  renderTimeline();
}

// Rendu de la timeline
function renderTimeline() {
  const timeline = document.getElementById('timelineView');
  timeline.innerHTML = '';
  
  // Trier les éléments par heure
  const sortedData = [...planningData].sort((a, b) => a.time.localeCompare(b.time));
  
  // Calculer l'heure actuelle
  const now = new Date();
  const currentHour = now.getHours().toString().padStart(2, '0');
  const currentMinute = now.getMinutes().toString().padStart(2, '0');
  const currentTime = `${currentHour}:${currentMinute}`;
  
  // Trouver l'élément actuel ou prochain
  let currentIndex = -1;
  let nextIndex = -1;
  
  for (let i = 0; i < sortedData.length; i++) {
    if (sortedData[i].time <= currentTime) {
      currentIndex = i;
    } else {
      nextIndex = i;
      break;
    }
  }
  
  sortedData.forEach((item, index) => {
    const timelineItem = document.createElement('div');
    timelineItem.className = 'timeline-item';
    
    if (item.checked) {
      timelineItem.classList.add('done');
    } else if (index === currentIndex) {
      timelineItem.classList.add('current');
    }
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'timeline-time';
    timeSpan.textContent = item.time;
    
    const labelSpan = document.createElement('span');
    labelSpan.textContent = item.label;
    
    timelineItem.appendChild(timeSpan);
    timelineItem.appendChild(labelSpan);
    
    timeline.appendChild(timelineItem);
  });
}

// Chargement du statut
function loadStatus() {
  fetch('/api/status')
    .then(response => {
      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      // Mettre à jour les valeurs des champs existants
      document.getElementById('donation_total').value = data.donation_total;
      document.getElementById('donation_goal').value = data.donation_goal;
      document.getElementById('subs_total').value = data.subs_total;
      document.getElementById('subs_goal').value = data.subs_goal;
      
      // Mettre à jour l'heure de début du stream
      if (data.stream_start_time) {
        // Formatage de la date pour l'input datetime-local
        const startTime = new Date(data.stream_start_time);
        const formattedDate = startTime.toISOString().slice(0, 16);
        document.getElementById('stream_start_time').value = formattedDate;
      } else {
        document.getElementById('stream_start_time').value = '';
      }
      
      // Mettre à jour les affichages visuels
      updateDonationProgress(data.donation_total, data.donation_goal, data.subs_total, data.subs_goal);
    })
    .catch(error => {
      console.error('Erreur lors du chargement du statut:', error);
      showToast('Erreur lors du chargement du statut', 'error');
    });
}

// Modifier la fonction updateStatus() pour inclure l'heure de début
function updateStatus() {
  const donationTotal = parseInt(document.getElementById('donation_total').value, 10) || 0;
  const donationGoal = parseInt(document.getElementById('donation_goal').value, 10) || 1000;
  const subsTotal = parseInt(document.getElementById('subs_total').value, 10) || 0;
  const subsGoal = parseInt(document.getElementById('subs_goal').value, 10) || 50;
  const streamStartTimeInput = document.getElementById('stream_start_time').value;
  
  // Convertir l'heure de début en format ISO pour le stockage
  let streamStartTime = null;
  if (streamStartTimeInput) {
    streamStartTime = new Date(streamStartTimeInput).toISOString();
  }
  
  const payload = {
    donation_total: donationTotal,
    donation_goal: donationGoal,
    subs_total: subsTotal,
    subs_goal: subsGoal,
    stream_start_time: streamStartTime
  };
  
  fetch('/api/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(response => {
      if (!response.ok) {
        return response.json().then(err => {
          throw new Error(err.error || `Erreur HTTP ${response.status}`);
        });
      }
      return response.json();
    })
    .then(data => {
      showToast('Statut mis à jour avec succès', 'success');
      updateDonationProgress(donationTotal, donationGoal, subsTotal, subsGoal);
    })
    .catch(error => {
      console.error('Erreur lors de la mise à jour du statut:', error);
      showToast(`Erreur: ${error.message}`, 'error');
    });
}

// Mise à jour des barres de progression
function updateDonationProgress(donationTotal, donationGoal, subsTotal, subsGoal) {
  document.getElementById('donation-current').textContent = donationTotal;
  document.getElementById('donation-goal').textContent = donationGoal;
  document.getElementById('subs-current').textContent = subsTotal;
  document.getElementById('subs-goal').textContent = subsGoal;
  
  const donationPercent = Math.min(100, Math.round((donationTotal / donationGoal) * 100)) || 0;
  const subsPercent = Math.min(100, Math.round((subsTotal / subsGoal) * 100)) || 0;
  
  document.getElementById('donation-progress').style.width = `${donationPercent}%`;
  document.getElementById('subs-progress').style.width = `${subsPercent}%`;
}

// Initialisation des écouteurs d'événements
function initEventListeners() {
  // Bouton ajout de ligne
  document.getElementById('addPlanningRow').addEventListener('click', () => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    
    planningData.push({
      time: `${hours}:${minutes}`,
      label: 'Nouveau moment',
      checked: false
    });
    
    renderPlanningTable();
    renderTimeline();
  });
  
  // Bouton sauvegarde du planning
  document.getElementById('savePlanning').addEventListener('click', () => {
    savePlanning();
  });
  
  // Bouton tri du planning
  document.getElementById('sortPlanning').addEventListener('click', () => {
    planningData.sort((a, b) => a.time.localeCompare(b.time));
    renderPlanningTable();
    renderTimeline();
    showToast('Planning trié par ordre chronologique', 'info');
  });
  
  // Bouton mise à jour du statut
  document.getElementById('updateStatus').addEventListener('click', () => {
    updateStatus();
  });
  
  // Boutons d'effets
  document.querySelectorAll('.effect-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const effectType = btn.getAttribute('data-effect');
      triggerEffect(effectType);
    });
  });
  
  // Bouton d'envoi de message
  document.getElementById('sendMessage').addEventListener('click', () => {
    sendMessage();
  });
  
  // Compteur de caractères pour le message
  const msgTextarea = document.getElementById('liveMsg');
  msgTextarea.addEventListener('input', () => {
    const count = msgTextarea.value.length;
    document.getElementById('charCount').textContent = count;
  });
  
  // Rafraîchissement des logs
  document.getElementById('refreshLogs').addEventListener('click', () => {
    loadLogs();
  });
}

// Sauvegarde du planning
function savePlanning() {
  if (planningData.length === 0) {
    if (!confirm('Le planning est vide. Confirmer quand même ?')) {
      return;
    }
  }
  
  fetch('/api/planning', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planning: planningData })
  })
    .then(response => {
      if (!response.ok) {
        return response.json().then(err => {
          throw new Error(err.error || `Erreur HTTP ${response.status}`);
        });
      }
      return response.json();
    })
    .then(data => {
      showToast('Planning enregistré avec succès', 'success');
    })
    .catch(error => {
      console.error('Erreur lors de la sauvegarde du planning:', error);
      showToast(`Erreur: ${error.message}`, 'error');
    });
}

// Mise à jour du statut
function updateStatus() {
  const donationTotal = parseInt(document.getElementById('donation_total').value, 10) || 0;
  const donationGoal = parseInt(document.getElementById('donation_goal').value, 10) || 1000;
  const subsTotal = parseInt(document.getElementById('subs_total').value, 10) || 0;
  const subsGoal = parseInt(document.getElementById('subs_goal').value, 10) || 50;
  
  const payload = {
    donation_total: donationTotal,
    donation_goal: donationGoal,
    subs_total: subsTotal,
    subs_goal: subsGoal
  };
  
  fetch('/api/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(response => {
      if (!response.ok) {
        return response.json().then(err => {
          throw new Error(err.error || `Erreur HTTP ${response.status}`);
        });
      }
      return response.json();
    })
    .then(data => {
      showToast('Statut mis à jour avec succès', 'success');
      updateDonationProgress(donationTotal, donationGoal, subsTotal, subsGoal);
    })
    .catch(error => {
      console.error('Erreur lors de la mise à jour du statut:', error);
      showToast(`Erreur: ${error.message}`, 'error');
    });
}

// Déclenchement d'un effet
function triggerEffect(type) {
  fetch('/api/effect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type })
  })
    .then(response => {
      if (!response.ok) {
        return response.json().then(err => {
          throw new Error(err.error || `Erreur HTTP ${response.status}`);
        });
      }
      return response.json();
    })
    .then(data => {
      showToast(`Effet "${type}" déclenché`, 'info');
    })
    .catch(error => {
      console.error('Erreur lors du déclenchement de l\'effet:', error);
      showToast(`Erreur: ${error.message}`, 'error');
    });
}

// Envoi d'un message
function sendMessage() {
  const msgTextarea = document.getElementById('liveMsg');
  const message = msgTextarea.value.trim();
  
  if (!message) {
    showToast('Le message ne peut pas être vide', 'warning');
    return;
  }
  
  fetch('/api/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  })
    .then(response => {
      if (!response.ok) {
        return response.json().then(err => {
          throw new Error(err.error || `Erreur HTTP ${response.status}`);
        });
      }
      return response.json();
    })
    .then(data => {
      showToast('Message envoyé avec succès', 'success');
      msgTextarea.value = '';
      document.getElementById('charCount').textContent = '0';
    })
    .catch(error => {
      console.error('Erreur lors de l\'envoi du message:', error);
      showToast(`Erreur: ${error.message}`, 'error');
    });
}

// Chargement des logs
function loadLogs() {
  fetch('/api/logs')
    .then(response => {
      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      renderLogs(data.logs);
    })
    .catch(error => {
      console.error('Erreur lors du chargement des logs:', error);
      showToast('Erreur lors du chargement des logs', 'error');
    });
}

// Rendu des logs
function renderLogs(logs) {
  const logsContainer = document.getElementById('logsContainer');
  logsContainer.innerHTML = '';
  
  if (!logs || logs.length === 0) {
    logsContainer.innerHTML = '<div class="log-entry">Aucun log disponible</div>';
    return;
  }
  
  logs.forEach(log => {
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    
    const date = new Date(log.timestamp);
    const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'log-time';
    timeSpan.textContent = timeStr;
    
    const typeSpan = document.createElement('span');
    typeSpan.className = `log-type ${log.type.toLowerCase()}`;
    typeSpan.textContent = log.type;
    
    const messageSpan = document.createElement('span');
    messageSpan.className = 'log-message';
    messageSpan.textContent = log.message;
    
    logEntry.appendChild(timeSpan);
    logEntry.appendChild(typeSpan);
    logEntry.appendChild(messageSpan);
    
    logsContainer.appendChild(logEntry);
  });
  
  // Scroll vers le bas
  logsContainer.scrollTop = logsContainer.scrollHeight;
}

// Horloge du stream
function startClock() {
  const updateClock = () => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    
    document.getElementById('stream-clock').textContent = `${hours}:${minutes}:${seconds}`;
  };
  
  updateClock();
  setInterval(updateClock, 1000);
}

// Affichage d'un toast
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = {
    'success': '<i class="fas fa-check-circle"></i>',
    'error': '<i class="fas fa-exclamation-circle"></i>',
    'warning': '<i class="fas fa-exclamation-triangle"></i>',
    'info': '<i class="fas fa-info-circle"></i>'
  };
  
  toast.innerHTML = `${icons[type] || ''} <span>${message}</span>`;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      container.removeChild(toast);
    }, 300);
  }, 3000);
}

// Chargement initial des logs
loadLogs();