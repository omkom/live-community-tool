// public/js/index.js
// Variables globales
let ws = null;
let planningData = [];
let statusData = null;
let startTime = new Date();

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
  initWebSocket();
  loadPlanning();
  loadStatus();
  startClock();
});

// Initialisation WebSocket
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}?type=viewer`;
  
  ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    console.log('Connexion WebSocket établie');
  };
  
  ws.onclose = () => {
    console.log('Connexion WebSocket perdue. Tentative de reconnexion...');
    setTimeout(initWebSocket, 3000); // Tentative de reconnexion après 3s
  };
  
  ws.onerror = (error) => {
    console.error('Erreur WebSocket:', error);
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
      }
    } catch (e) {
      console.error('Erreur de parsing WebSocket:', e, event.data);
    }
  };
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
      renderTimeline();
    })
    .catch(error => {
      console.error('Erreur lors du chargement du planning:', error);
    });
}

// Rendu de la timeline
function renderTimeline() {
  const timeline = document.getElementById('timeline');
  timeline.innerHTML = '';
  
  if (planningData.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'timeline-empty';
    empty.textContent = 'Aucun élément dans le planning pour le moment.';
    timeline.appendChild(empty);
    return;
  }
  
  // Trier les éléments par heure
  const sortedData = [...planningData].sort((a, b) => a.time.localeCompare(b.time));
  
  // Calculer l'heure actuelle
  const now = new Date();
  const currentHour = now.getHours().toString().padStart(2, '0');
  const currentMinute = now.getMinutes().toString().padStart(2, '0');
  const currentTime = `${currentHour}:${currentMinute}`;
  
  // Trouver l'élément actuel ou prochain
  let currentIndex = -1;
  
  for (let i = 0; i < sortedData.length; i++) {
    if (sortedData[i].time <= currentTime && !sortedData[i].checked) {
      currentIndex = i;
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
    
    const timelineContent = document.createElement('div');
    timelineContent.className = 'timeline-content';
    
    const timeSpan = document.createElement('div');
    timeSpan.className = 'timeline-time';
    
    // Ajouter une icône selon le statut
    const icon = document.createElement('i');
    if (item.checked) {
      icon.className = 'fas fa-check-circle';
    } else if (index === currentIndex) {
      icon.className = 'fas fa-play-circle';
    } else {
      icon.className = 'fas fa-clock';
    }
    
    timeSpan.appendChild(icon);
    timeSpan.appendChild(document.createTextNode(` ${item.time}`));
    
    const titleSpan = document.createElement('div');
    titleSpan.className = 'timeline-title';
    titleSpan.textContent = item.label;
    
    timelineContent.appendChild(timeSpan);
    timelineContent.appendChild(titleSpan);
    
    timelineItem.appendChild(timelineContent);
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
      statusData = data;
      updateStatusDisplay();
    })
    .catch(error => {
      console.error('Erreur lors du chargement du statut:', error);
    });
}

// Mise à jour de l'affichage du statut
function updateStatusDisplay() {
  if (!statusData) return;
  
  // Récupérer les éléments DOM
  const donationCurrent = document.getElementById('donation-current');
  const donationGoal = document.getElementById('donation-goal');
  const donationProgress = document.getElementById('donation-progress');
  const subsCurrent = document.getElementById('subs-current');
  const subsGoal = document.getElementById('subs-goal');
  const subsProgress = document.getElementById('subs-progress');
  
  // Mettre à jour les valeurs
  donationCurrent.textContent = statusData.donation_total;
  donationGoal.textContent = statusData.donation_goal;
  subsCurrent.textContent = statusData.subs_total;
  subsGoal.textContent = statusData.subs_goal;
  
  // Calculer les pourcentages
  const donationPercent = Math.min(100, Math.round((statusData.donation_total / statusData.donation_goal) * 100));
  const subsPercent = Math.min(100, Math.round((statusData.subs_total / statusData.subs_goal) * 100));
  
  // Mettre à jour les barres de progression
  donationProgress.style.width = `${donationPercent}%`;
  subsProgress.style.width = `${subsPercent}%`;
}

// Horloge du stream
function startClock() {
  const updateClock = () => {
    const now = new Date();
    const diff = now - startTime;
    
    // Calculer heures, minutes, secondes écoulées
    const hours = Math.floor(diff / (1000 * 60 * 60)).toString().padStart(2, '0');
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
    const seconds = Math.floor((diff % (1000 * 60)) / 1000).toString().padStart(2, '0');
    
    document.getElementById('stream-time').textContent = `${hours}:${minutes}:${seconds}`;
    
    // Mettre à jour la timeline chaque minute
    if (seconds === '00') {
      renderTimeline();
    }
  };
  
  updateClock();
  setInterval(updateClock, 1000);
}

// Mettre à jour toutes les 30 secondes
setInterval(() => {
  loadStatus();
}, 30000);