// public/js/admin.js

// Variables globales
let planningData = [];
let ws = null;
let connectionStatus = 'disconnected';
let saveStatus = 'idle'; // 'idle', 'saving', 'saved', 'error'
let saveTimeout = null;
let saveDelay = 1000; // délai d'attente avant sauvegarde après changements
let eventQueue = {}; // queue pour les sauvegardes par type

// Intégration Twitch/Streamlabs
let twitchConfig = {
  enabled: false,
  twitch: {
    clientId: '',
    clientSecret: '',
    username: '',
    oauthToken: '',
    channelName: ''
  },
  streamlabs: {
    socketToken: '',
    accessToken: ''
  }
};

// Configuration des événements
let eventsConfig = {
  donationEffect: 'tada',
  subEffect: 'pulse',
  cheerEffect: 'bounce',
  followEffect: 'none',
  raidEffect: 'shake',
  displayMessages: true,
  autoUpdateStats: true
};

// File d'événements en direct
const liveEvents = [];
const MAX_EVENTS = 50;

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initWebSocket();
  loadPlanning();
  loadStatus();
  initEventListeners();
  initAutoSave();
  loadTwitchConfig();
  loadEventsConfig();
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
      
      // Traiter les événements Twitch/Streamlabs
      handleWebSocketEvent(data);
      
      if (data.type === 'update') {
        if (data.target === 'planning') {
          loadPlanning();
        } else if (data.target === 'status') {
          loadStatus();
        }
      }
    } catch (e) {
      console.error('Erreur de parsing WebSocket:', e, event.data);
    }
  };
}

// Initialisation de l'autosave pour tous les champs concernés
function initAutoSave() {
  document.querySelectorAll('.autosave').forEach(element => {
    const saveType = element.dataset.autosave;
    
    if (element.tagName === 'INPUT') {
      if (element.type === 'checkbox') {
        element.addEventListener('change', () => queueSave(saveType));
      } else {
        element.addEventListener('input', () => queueSave(saveType));
        element.addEventListener('change', () => queueSave(saveType, true)); // force save on blur/change
      }
    } else if (element.tagName === 'SELECT') {
      element.addEventListener('change', () => queueSave(saveType));
    } else if (element.tagName === 'TEXTAREA') {
      element.addEventListener('input', () => queueSave(saveType));
      element.addEventListener('change', () => queueSave(saveType, true));
    }
  });
}

// Mettre en file d'attente une sauvegarde avec debouncing par type
function queueSave(saveType, immediate = false) {
  if (eventQueue[saveType]) {
    clearTimeout(eventQueue[saveType]);
  }
  
  setSaveStatus('saving');
  
  const delay = immediate ? 0 : saveDelay;
  
  eventQueue[saveType] = setTimeout(() => {
    switch (saveType) {
      case 'donation':
        updateStatus();
        break;
      case 'planning':
        savePlanning();
        break;
      case 'integration':
        saveTwitchConfig();
        break;
      case 'event-config':
        saveEventsConfig();
        break;
    }
    
    delete eventQueue[saveType];
  }, delay);
}

// Mettre à jour le statut de sauvegarde visuel
function setSaveStatus(status) {
  saveStatus = status;
  
  const saveIndicator = document.getElementById('save-status');
  
  saveIndicator.classList.remove('saving', 'saved', 'error');
  
  if (status === 'saving') {
    saveIndicator.classList.add('saving');
    saveIndicator.title = 'Sauvegarde en cours...';
  } else if (status === 'saved') {
    saveIndicator.classList.add('saved');
    saveIndicator.title = 'Modifications enregistrées';
    
    setTimeout(() => {
      saveIndicator.style.opacity = '0';
    }, 2000);
  } else if (status === 'error') {
    saveIndicator.classList.add('error');
    saveIndicator.title = 'Erreur de sauvegarde';
  } else {
    saveIndicator.style.opacity = '0';
  }
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
      queueSave('planning');
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
      queueSave('planning');
    });
    labelCell.appendChild(labelInput);
    
    // Cellule statut
    const statusCell = document.createElement('td');
    statusCell.style.textAlign = 'center';
    const statusInput = document.createElement('input');
    statusInput.type = 'checkbox';
    statusInput.checked = item.checked;
    statusInput.addEventListener('change', () => {
      planningData[index].checked = statusInput.checked;
      renderTimeline();
      queueSave('planning');
    });
    statusCell.appendChild(statusInput);
    
    // Cellule actions
    const actionsCell = document.createElement('td');
    actionsCell.style.textAlign = 'right';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-icon';
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
    deleteBtn.title = 'Supprimer';
    deleteBtn.addEventListener('click', () => {
      if (confirm(`Supprimer "${item.label}" ?`)) {
        planningData.splice(index, 1);
        renderPlanningTable();
        renderTimeline();
        queueSave('planning');
      }
    });
    
    actionsCell.appendChild(deleteBtn);
    
    // Ajout des cellules à la ligne
    row.appendChild(timeCell);
    row.appendChild(labelCell);
    row.appendChild(statusCell);
    row.appendChild(actionsCell);
    
    tbody.appendChild(row);
  });
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
      if (!sortedData[i].checked) {
        currentIndex = i;
      }
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
    } else if (index === nextIndex) {
      timelineItem.classList.add('next');
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

// Sauvegarde du planning
function savePlanning() {
  // Trier par heure
  planningData.sort((a, b) => a.time.localeCompare(b.time));
  
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
      setSaveStatus('saved');
    })
    .catch(error => {
      console.error('Erreur lors de la sauvegarde du planning:', error);
      setSaveStatus('error');
      showToast(`Erreur: ${error.message}`, 'error');
    });
}

// Mise à jour du statut
function updateStatus() {
  const donationTotal = parseFloat(document.getElementById('donation_total').value) || 0;
  const donationGoal = parseFloat(document.getElementById('donation_goal').value) || 1000;
  const subsTotal = parseInt(document.getElementById('subs_total').value, 10) || 0;
  const subsGoal = parseInt(document.getElementById('subs_goal').value, 10) || 50;
  const streamStartTimeInput = document.getElementById('stream_start_time');
  
  // Convertir l'heure de début en format ISO pour le stockage
  let streamStartTime = null;
  if (streamStartTimeInput && streamStartTimeInput.value) {
    streamStartTime = new Date(streamStartTimeInput.value).toISOString();
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
      setSaveStatus('saved');
      updateDonationProgress(donationTotal, donationGoal, subsTotal, subsGoal);
    })
    .catch(error => {
      console.error('Erreur lors de la mise à jour du statut:', error);
      setSaveStatus('error');
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
  const addPlanningBtn = document.getElementById('addPlanningRow');
  if (addPlanningBtn) {
    addPlanningBtn.addEventListener('click', () => {
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
      queueSave('planning');
    });
  }
  
  // Bouton tri du planning
  const sortPlanningBtn = document.getElementById('sortPlanning');
  if (sortPlanningBtn) {
    sortPlanningBtn.addEventListener('click', () => {
      planningData.sort((a, b) => a.time.localeCompare(b.time));
      renderPlanningTable();
      renderTimeline();
      showToast('Planning trié par ordre chronologique', 'info');
      queueSave('planning');
    });
  }
  
  // Bouton pour aller à l'élément courant
  const jumpToCurrentBtn = document.getElementById('jumpToCurrent');
  if (jumpToCurrentBtn) {
    jumpToCurrentBtn.addEventListener('click', () => {
      scrollToCurrentItem();
    });
  }
  
  // Boutons d'effets
  document.querySelectorAll('.effect-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const effectType = btn.getAttribute('data-effect');
      triggerEffect(effectType);
    });
  });
  
  // Bouton d'envoi de message
  const sendMessageBtn = document.getElementById('sendMessage');
  if (sendMessageBtn) {
    sendMessageBtn.addEventListener('click', () => {
      sendMessage();
    });
  }
  
  // Compteur de caractères pour le message
  const msgTextarea = document.getElementById('liveMsg');
  if (msgTextarea) {
    msgTextarea.addEventListener('input', () => {
      const count = msgTextarea.value.length;
      const charCountEl = document.getElementById('charCount');
      if (charCountEl) {
        charCountEl.textContent = count;
      }
    });
  }
  
  // Rafraîchissement des logs
  const refreshLogsBtn = document.getElementById('refreshLogs');
  if (refreshLogsBtn) {
    refreshLogsBtn.addEventListener('click', () => {
      loadLogs();
    });
  }
  
  // Test de connexion Twitch - CORRECTION ICI
  const testTwitchBtn = document.getElementById('test-twitch-connection');
  if (testTwitchBtn) {
    testTwitchBtn.addEventListener('click', () => {
      testTwitchConnection();
    });
  } else {
    console.warn('Element test-twitch-connection not found - will retry later');
    // Réessayer après 1 seconde
    setTimeout(() => {
      const testTwitchBtnRetry = document.getElementById('test-twitch-connection');
      if (testTwitchBtnRetry) {
        testTwitchBtnRetry.addEventListener('click', () => {
          testTwitchConnection();
        });
      }
    }, 1000);
  }
  
  // Bouton pour effacer les événements
  const clearEventsBtn = document.getElementById('clear-events');
  if (clearEventsBtn) {
    clearEventsBtn.addEventListener('click', () => {
      liveEvents.length = 0;
      renderLiveEvents();
      showToast('Liste d\'événements effacée', 'info');
    });
  }
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

// Fonction pour faire défiler jusqu'à l'élément courant dans la timeline
function scrollToCurrentItem() {
  const currentItem = document.querySelector('.timeline-item.current');
  
  if (currentItem) {
    const container = document.getElementById('timelineView');
    container.scrollTop = currentItem.offsetTop - (container.clientHeight / 2) + (currentItem.clientHeight / 2);
  } else {
    // Si aucun élément courant, scroll vers le haut
    document.getElementById('timelineView').scrollTop = 0;
  }
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

// ----- INTÉGRATION TWITCH/STREAMLABS -----

// Chargement des configurations
function loadTwitchConfig() {
  fetch('/api/twitch/config')
    .then(response => {
      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      twitchConfig = data.config || twitchConfig;
      updateTwitchForm();
      updateStreamlabsForm();
    })
    .catch(error => {
      console.error('Erreur lors du chargement de la config Twitch:', error);
      showToast('Erreur lors du chargement de la configuration Twitch', 'error');
    });
}

// Mise à jour du formulaire Twitch
function updateTwitchForm() {
  const twitchEnabledEl = document.getElementById('twitch-enabled');
  if (!twitchEnabledEl) return;
  twitchEnabledEl.checked = twitchConfig.enabled;

  const clientIdEl = document.getElementById('twitch_client_id');
  if (clientIdEl) clientIdEl.value = twitchConfig.twitch?.clientId || '';
  const clientSecretEl = document.getElementById('twitch_client_secret');
  if (clientSecretEl) clientSecretEl.value = twitchConfig.twitch?.clientSecret || '';
  const channelEl = document.getElementById('twitch_channel');
  if (channelEl) channelEl.value = twitchConfig.twitch?.channelName || '';
  const usernameEl = document.getElementById('twitch_username');
  if (usernameEl) usernameEl.value = twitchConfig.twitch?.username || '';
  const oauthTokenEl = document.getElementById('twitch_oauth_token');
  if (oauthTokenEl) oauthTokenEl.value = twitchConfig.twitch?.oauthToken || '';

  // Mettre à jour l'indicateur de statut (config)
  const statusBadge = document.getElementById('twitch-status');
  if (statusBadge) {
    if (twitchConfig.enabled) {
      statusBadge.textContent = 'Activé';
      statusBadge.classList.add('connected');
    } else {
      statusBadge.textContent = 'Désactivé';
      statusBadge.classList.remove('connected');
    }
  }
}

// Mise à jour du formulaire Streamlabs
function updateStreamlabsForm() {
  const streamlabsEnabledEl = document.getElementById('streamlabs-enabled');
  if (!streamlabsEnabledEl) return;
  streamlabsEnabledEl.checked = twitchConfig.enabled;

  const socketTokenEl = document.getElementById('streamlabs_socket_token');
  if (socketTokenEl) socketTokenEl.value = twitchConfig.streamlabs?.socketToken || '';
  const accessTokenEl = document.getElementById('streamlabs_access_token');
  if (accessTokenEl) accessTokenEl.value = twitchConfig.streamlabs?.accessToken || '';

  // Mettre à jour l'indicateur de statut (config)
  const statusBadge = document.getElementById('streamlabs-status');
  if (statusBadge) {
    if (twitchConfig.enabled && twitchConfig.streamlabs?.socketToken) {
      statusBadge.textContent = 'Activé';
      statusBadge.classList.add('connected');
    } else {
      statusBadge.textContent = 'Désactivé';
      statusBadge.classList.remove('connected');
    }
  }
}

// Sauvegarde de la configuration Twitch et Streamlabs (combinée pour autosave)
function saveTwitchConfig() {
  const config = {
    enabled: document.getElementById('twitch-enabled').checked,
    twitch: {
      clientId: document.getElementById('twitch_client_id').value,
      clientSecret: document.getElementById('twitch_client_secret').value,
      channelName: document.getElementById('twitch_channel').value,
      username: document.getElementById('twitch_username').value,
      oauthToken: document.getElementById('twitch_oauth_token').value
    },
    streamlabs: {
      socketToken: document.getElementById('streamlabs_socket_token').value,
      accessToken: document.getElementById('streamlabs_access_token').value
    }
  };
  
  fetch('/api/twitch/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
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
      twitchConfig = data.config;
      updateTwitchForm();
      updateStreamlabsForm();
      setSaveStatus('saved');
      showToast('Configuration temporaire mise à jour pour cette session uniquement. Modifiez le fichier .env pour des changements permanents.', 'info');
    })
    .catch(error => {
      console.error('Erreur lors de la sauvegarde de la config Twitch:', error);
      setSaveStatus('error');
      showToast(`Erreur: ${error.message}`, 'error');
    });
}

// Test de connexion Twitch
function testTwitchConnection() {
  showToast('Test de connexion Twitch en cours...', 'info');
  
  fetch('/api/twitch/test', {
    method: 'POST'
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
      if (data.success) {
        showToast('Connexion Twitch réussie!', 'success');
      } else {
        showToast(`Erreur de connexion: ${data.message}`, 'error');
      }
    })
    .catch(error => {
      console.error('Erreur de test de connexion Twitch:', error);
      showToast(`Erreur: ${error.message}`, 'error');
    });
}

// Test de connexion Streamlabs
function testStreamlabsConnection() {
  showToast('Test de connexion Streamlabs en cours...', 'info');
  
  fetch('/api/streamlabs/test', {
    method: 'POST'
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
      if (data.success) {
        showToast('Connexion Streamlabs réussie!', 'success');
      } else {
        showToast(`Erreur de connexion: ${data.message}`, 'error');
      }
    })
    .catch(error => {
      console.error('Erreur de test de connexion Streamlabs:', error);
      showToast(`Erreur: ${error.message}`, 'error');
    });
}

// Chargement de la configuration des événements
function loadEventsConfig() {
  // Charger depuis le localStorage
  const savedConfig = localStorage.getItem('eventsConfig');
  if (savedConfig) {
    eventsConfig = { ...eventsConfig, ...JSON.parse(savedConfig) };
  }
  
  // Mise à jour des formulaires (quitter si non présent)
  const donationEl = document.getElementById('event-donation-effect');
  if (!donationEl) return;
  donationEl.value = eventsConfig.donationEffect;
  const subEl = document.getElementById('event-sub-effect');
  if (subEl) subEl.value = eventsConfig.subEffect;
  const cheerEl = document.getElementById('event-cheer-effect');
  if (cheerEl) cheerEl.value = eventsConfig.cheerEffect;
  const displayMsgsEl = document.getElementById('display-messages');
  if (displayMsgsEl) displayMsgsEl.checked = eventsConfig.displayMessages;
  const autoUpdateEl = document.getElementById('auto-update-stats');
  if (autoUpdateEl) autoUpdateEl.checked = eventsConfig.autoUpdateStats;
}

// Sauvegarde de la configuration des événements
function saveEventsConfig() {
  eventsConfig = {
    donationEffect: document.getElementById('event-donation-effect').value,
    subEffect: document.getElementById('event-sub-effect').value,
    cheerEffect: document.getElementById('event-cheer-effect').value,
    displayMessages: document.getElementById('display-messages').checked,
    autoUpdateStats: document.getElementById('auto-update-stats').checked
  };
  
  // Sauvegarder dans le localStorage
  localStorage.setItem('eventsConfig', JSON.stringify(eventsConfig));
  setSaveStatus('saved');
}

// Ajouter un événement à la liste
function addLiveEvent(eventType, eventData) {
  // Formatage de l'heure
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  
  // Créer l'objet événement
  const event = {
    type: eventType,
    time: timeStr,
    data: eventData,
    date: now
  };
  
  // Ajouter au tableau (en limitant la taille)
  liveEvents.unshift(event);
  if (liveEvents.length > MAX_EVENTS) {
    liveEvents.pop();
  }
  
  // Mettre à jour l'affichage
  renderLiveEvents();
  
  // Déclencher les effets si configurés
  triggerEventEffects(eventType, eventData);
}

// Traitement des effets pour les événements
function triggerEventEffects(eventType, eventData) {
  let effectType = null;
  let message = null;
  
  // Déterminer le type d'effet selon l'événement
  switch (eventType) {
    case 'donation':
      effectType = eventsConfig.donationEffect;
      message = `${eventData.username} a donné ${eventData.amount}${eventData.currency || '€'}!`;
      
      // Mettre à jour les statistiques si configuré
      if (eventsConfig.autoUpdateStats) {
        updateDonationStats(parseFloat(eventData.amount));
      }
      break;
      
    case 'subscription':
      effectType = eventsConfig.subEffect;
      message = `${eventData.username} s'est abonné${eventData.isResub ? ' pour ' + eventData.months + ' mois' : ''}!`;
      
      // Mettre à jour les statistiques si configuré
      if (eventsConfig.autoUpdateStats) {
        const subsTotal = parseInt(document.getElementById('subs_total').value || '0', 10) + 1;
        document.getElementById('subs_total').value = subsTotal;
        queueSave('donation');
      }
      break;
      
    case 'cheer':
      effectType = eventsConfig.cheerEffect;
      message = `${eventData.username} a donné ${eventData.bits} bits!`;
      
      // Mettre à jour les statistiques si configuré (conversion bits en euros)
      if (eventsConfig.autoUpdateStats) {
        const donationAmount = eventData.bits / 100; // Approximativement 100 bits = 1€
        const donationTotal = parseFloat(document.getElementById('donation_total').value || '0') + donationAmount;
        document.getElementById('donation_total').value = donationTotal.toFixed(2);
        queueSave('donation');
      }
      break;
  }
  
  // Déclencher l'effet si configuré
  if (effectType && effectType !== 'none') {
    triggerEffect(effectType);
  }
  
  // Envoyer le message si configuré
  if (eventsConfig.displayMessages && message) {
    sendMessage(message);
  }
}

// Rendu de la liste des événements en direct
function renderLiveEvents() {
  const container = document.getElementById('live-events');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (liveEvents.length === 0) {
    container.innerHTML = '<div class="empty-events">Aucun événement pour le moment</div>';
    return;
  }
  
  // Icônes pour les différents types d'événements
  const icons = {
    donation: '<i class="fas fa-donate" style="color: #4CAF50;"></i>',
    subscription: '<i class="fas fa-star" style="color: #9C27B0;"></i>',
    follow: '<i class="fas fa-user-plus" style="color: #2196F3;"></i>',
    cheer: '<i class="fas fa-gem" style="color: #FF9800;"></i>',
    raid: '<i class="fas fa-users" style="color: #E91E63;"></i>'
  };
  
  // Afficher les événements
  liveEvents.forEach(event => {
    const eventElement = document.createElement('div');
    eventElement.className = `event-item ${event.type}`;
    
    // Formater le contenu selon le type d'événement
    let eventContent = '';
    switch (event.type) {
      case 'donation':
        eventContent = `<strong>${event.data.username}</strong> a fait un don de <strong>${event.data.amount}${event.data.currency || '€'}</strong>`;
        if (event.data.message) {
          eventContent += ` : "${event.data.message}"`;
        }
        break;
        
      case 'subscription':
        if (event.data.isResub) {
          eventContent = `<strong>${event.data.username}</strong> s'est réabonné pour <strong>${event.data.months} mois</strong>`;
        } else {
          eventContent = `<strong>${event.data.username}</strong> s'est abonné`;
        }
        if (event.data.message) {
          eventContent += ` : "${event.data.message}"`;
        }
        break;
        
      case 'follow':
        eventContent = `<strong>${event.data.username}</strong> suit maintenant la chaîne`;
        break;
        
      case 'cheer':
        eventContent = `<strong>${event.data.username}</strong> a envoyé <strong>${event.data.bits} bits</strong>`;
        if (event.data.message) {
          eventContent += ` : "${event.data.message}"`;
        }
        break;
        
      case 'raid':
        eventContent = `<strong>${event.data.username}</strong> a raid avec <strong>${event.data.viewers} viewers</strong>`;
        break;
    }
    
    eventElement.innerHTML = `
      <div class="event-icon">${icons[event.type] || '<i class="fas fa-bell"></i>'}</div>
      <div class="event-content">
        <div class="event-type">${event.type.toUpperCase()}</div>
        <div>${eventContent}</div>
      </div>
      <div class="event-time">${event.time}</div>
    `;
    
    container.appendChild(eventElement);
  });
}

// Traitement des messages WebSocket pour les événements
function handleWebSocketEvent(data) {
  if (!data || !data.type) return;
  
  // Les événements liés à Twitch/Streamlabs
  if (data.type === 'twitch_event' || data.type === 'streamlabs_event') {
    const { eventType, eventData } = data;
    if (eventType && eventData) {
      addLiveEvent(eventType, eventData);
    }
  }
}

async function checkConnectionStatus() {
  try {
    const [twitchResponse, streamlabsResponse] = await Promise.allSettled([
      fetch('/api/twitch/status'),
      fetch('/api/streamlabs/status')
    ]);

    // Twitch status
    if (twitchResponse.status === 'fulfilled' && twitchResponse.value.ok) {
      const twitchData = await twitchResponse.value.json();
      const twitchStatusEl = document.getElementById('twitch-status');
      if (twitchStatusEl) {
        twitchStatusEl.textContent = twitchData.connected ? 'Connected' : 'Disconnected';
      }
    }

    // Streamlabs status  
    if (streamlabsResponse.status === 'fulfilled' && streamlabsResponse.value.ok) {
      const streamlabsData = await streamlabsResponse.value.json();
      const streamlabsStatusEl = document.getElementById('streamlabs-status');
      if (streamlabsStatusEl) {
        streamlabsStatusEl.textContent = streamlabsData.connected ? 'Connected' : 'Disconnected';
      }
    }
  } catch (error) {
    console.error('Error checking connection status:', error);
  }
}

// Call the function to check connection status when the page loads
window.onload = checkConnectionStatus;

// Chargement initial des logs
loadLogs();