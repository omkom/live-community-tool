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
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
  
  // Convertir l'heure actuelle en minutes depuis minuit pour le calcul de position
  const currentTimeInMinutes = currentHour * 60 + currentMinute;
  
  // Trouver l'élément actuel ou prochain
  let currentIndex = -1;
  
  for (let i = 0; i < sortedData.length; i++) {
    if (sortedData[i].time <= currentTimeStr && !sortedData[i].checked) {
      currentIndex = i;
    }
  }
  
  // Déterminer les bornes de temps pour la journée (min et max)
  let minTimeInMinutes = 24 * 60;  // Initialiser à la fin de la journée
  let maxTimeInMinutes = 0;        // Initialiser au début de la journée
  
  sortedData.forEach(item => {
    const [hours, minutes] = item.time.split(':').map(Number);
    const timeInMinutes = hours * 60 + minutes;
    
    if (timeInMinutes < minTimeInMinutes) minTimeInMinutes = timeInMinutes;
    if (timeInMinutes > maxTimeInMinutes) maxTimeInMinutes = timeInMinutes;
  });
  
  // Ajouter des marges pour éviter que le premier et le dernier événement soient collés aux bords
  minTimeInMinutes = Math.max(0, minTimeInMinutes - 60);  // -1h
  maxTimeInMinutes = Math.min(24 * 60, maxTimeInMinutes + 60);  // +1h
  
  // Durée totale en minutes
  const totalDurationInMinutes = maxTimeInMinutes - minTimeInMinutes;
  
  // Ajouter les marqueurs d'heures (une ligne par heure)
  for (let hour = Math.floor(minTimeInMinutes / 60); hour <= Math.ceil(maxTimeInMinutes / 60); hour++) {
    const hourInMinutes = hour * 60;
    
    // Calculer la position verticale en pourcentage
    const positionPercentage = ((hourInMinutes - minTimeInMinutes) / totalDurationInMinutes) * 100;
    
    // Créer le marqueur d'heure
    const hourMarker = document.createElement('div');
    hourMarker.className = 'timeline-hour-marker';
    hourMarker.style.top = `${positionPercentage}%`;
    
    // Créer le label d'heure
    const hourLabel = document.createElement('div');
    hourLabel.className = 'timeline-hour-label';
    hourLabel.textContent = `${hour.toString().padStart(2, '0')}:00`;
    hourLabel.style.top = `${positionPercentage}%`;
    
    timeline.appendChild(hourMarker);
    timeline.appendChild(hourLabel);
  }
  
  // Ajouter l'indicateur d'heure actuelle
  if (currentTimeInMinutes >= minTimeInMinutes && currentTimeInMinutes <= maxTimeInMinutes) {
    // Calculer la position verticale en pourcentage
    const positionPercentage = ((currentTimeInMinutes - minTimeInMinutes) / totalDurationInMinutes) * 100;
    
    // Créer l'indicateur de temps actuel
    const timeIndicator = document.createElement('div');
    timeIndicator.className = 'current-time-indicator';
    timeIndicator.style.top = `${positionPercentage}%`;
    
    // Créer le label de temps actuel
    const timeLabel = document.createElement('div');
    timeLabel.className = 'current-time-label';
    timeLabel.textContent = `⏱️ ${currentTimeStr}`;
    timeLabel.style.top = `${positionPercentage}%`;
    
    timeline.appendChild(timeIndicator);
    timeline.appendChild(timeLabel);
  }
  
  // Afficher les éléments du planning en position absolue avec style alterné
  sortedData.forEach((item, index) => {
    // Calculer la position verticale en pourcentage
    const [hours, minutes] = item.time.split(':').map(Number);
    const timeInMinutes = hours * 60 + minutes;
    const positionPercentage = ((timeInMinutes - minTimeInMinutes) / totalDurationInMinutes) * 100;
    
    const timelineItem = document.createElement('div');
    timelineItem.className = 'timeline-item';
    
    // Positionner l'élément
    timelineItem.style.top = `${positionPercentage}%`;
    
    // Déterminer le côté (gauche/droite)
    if (index % 2 === 0) {
      timelineItem.classList.add('left');
    } else {
      timelineItem.classList.add('right');
    }
    
    // Ajouter les classes d'état
    if (item.checked) {
      timelineItem.classList.add('done');
    } else if (index === currentIndex) {
      timelineItem.classList.add('current');
    }
    
    const timelineContent = document.createElement('div');
    timelineContent.className = 'timeline-content';
    
    // Créer l'icône d'heure
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
    
    // Créer le titre de l'événement
    const titleSpan = document.createElement('div');
    titleSpan.className = 'timeline-title';
    titleSpan.textContent = item.label;
    
    if (item.checked) {
      titleSpan.style.textDecoration = 'line-through';
      titleSpan.style.color = 'var(--mid)';
    }
    
    timelineContent.appendChild(timeSpan);
    timelineContent.appendChild(titleSpan);
    
    timelineItem.appendChild(timelineContent);
    timeline.appendChild(timelineItem);
  });
  
  // Stocker les informations de temps pour les mises à jour
  timeline.dataset.minTime = minTimeInMinutes;
  timeline.dataset.maxTime = maxTimeInMinutes;
  timeline.dataset.duration = totalDurationInMinutes;
}

// Fonction pour mettre à jour uniquement l'indicateur de temps
function updateTimeIndicator() {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;
  const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
  
  const timeIndicator = document.querySelector('.current-time-indicator');
  const timeLabel = document.querySelector('.current-time-label');
  
  if (timeIndicator && timeLabel) {
    // Récupérer les bornes de temps depuis data attributes
    const timeline = document.getElementById('timeline');
    const minTimeInMinutes = parseInt(timeline.dataset.minTime || 0);
    const totalDurationInMinutes = parseInt(timeline.dataset.duration || (24 * 60));
    
    if (totalDurationInMinutes > 0) {
      const positionPercentage = ((currentTimeInMinutes - minTimeInMinutes) / totalDurationInMinutes) * 100;
      
      // Ne mettre à jour que si l'indicateur est dans la plage visible
      if (positionPercentage >= 0 && positionPercentage <= 100) {
        timeIndicator.style.top = `${positionPercentage}%`;
        timeLabel.style.top = `${positionPercentage}%`;
        timeLabel.textContent = `⏱️ ${currentTimeStr}`;
      }
    }
  }
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
    
    // Mettre à jour uniquement l'indicateur de temps toutes les 10 secondes
    // pour éviter de reconstruire toute la timeline trop fréquemment
    if (parseInt(seconds) % 10 === 0) {
      updateTimeIndicator();
    }
    
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