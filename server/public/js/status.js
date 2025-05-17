// public/js/status.js
// Variables globales
let ws = null;
let statusData = null;
let planningData = null;
let startTime = new Date();

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
  initWebSocket();
  loadStatus();
  loadPlanning();
  startClock();
});

// Initialisation WebSocket
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}?type=status`;
  
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
        if (data.target === 'status') {
          loadStatus();
        } else if (data.target === 'planning') {
          loadPlanning();
        }
      }
    } catch (e) {
      console.error('Erreur de parsing WebSocket:', e, event.data);
    }
  };
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
      updateCurrentActivity();
    })
    .catch(error => {
      console.error('Erreur lors du chargement du planning:', error);
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
  const updateTime = document.getElementById('update-time');
  
  // Mettre à jour les valeurs
  let animateDonation = false;
  let animateSubs = false;
  
  // Vérifier s'il s'agit d'une mise à jour (pour animer)
  if (donationCurrent.textContent !== statusData.donation_total.toString()) {
    animateDonation = true;
  }
  
  if (subsCurrent.textContent !== statusData.subs_total.toString()) {
    animateSubs = true;
  }
  
  // Mettre à jour les textes
  donationCurrent.textContent = statusData.donation_total;
  donationGoal.textContent = statusData.donation_goal;
  subsCurrent.textContent = statusData.subs_total;
  subsGoal.textContent = statusData.subs_goal;
  
  // Calculer les pourcentages
  const donationPercent = Math.min(100, Math.round((statusData.donation_total / statusData.donation_goal) * 100));
  const subsPercent = Math.min(100, Math.round((statusData.subs_total / statusData.subs_goal) * 100));
  
  // Mettre à jour les barres de progression avec animation
  donationProgress.style.width = `${donationPercent}%`;
  subsProgress.style.width = `${subsPercent}%`;
  
  // Ajouter une animation si changement
  if (animateDonation) {
    const section = donationProgress.closest('.progress-section');
    section.classList.remove('pulse-animation');
    void section.offsetWidth; // Force reflow
    section.classList.add('pulse-animation');
  }
  
  if (animateSubs) {
    const section = subsProgress.closest('.progress-section');
    section.classList.remove('pulse-animation');
    void section.offsetWidth; // Force reflow
    section.classList.add('pulse-animation');
  }
  
  // Mettre à jour l'heure de mise à jour
  if (statusData.last_update) {
    const lastUpdate = new Date(statusData.last_update);
    const now = new Date();
    const diffMinutes = Math.round((now - lastUpdate) / (1000 * 60));
    
    if (diffMinutes < 1) {
      updateTime.textContent = 'à l\'instant';
    } else if (diffMinutes === 1) {
      updateTime.textContent = 'il y a 1 minute';
    } else {
      updateTime.textContent = `il y a ${diffMinutes} minutes`;
    }
  } else {
    updateTime.textContent = 'à l\'instant';
  }
}

// Mettre à jour l'activité en cours
function updateCurrentActivity() {
  if (!planningData || planningData.length === 0) return;
  
  const activityName = document.getElementById('activity-name');
  
  // Trouver l'activité en cours ou prochaine
  const now = new Date();
  const currentHour = now.getHours().toString().padStart(2, '0');
  const currentMinute = now.getMinutes().toString().padStart(2, '0');
  const currentTime = `${currentHour}:${currentMinute}`;
  
  // Trier le planning par heure
  const sortedPlanning = [...planningData].sort((a, b) => a.time.localeCompare(b.time));
  
  // Trouver l'activité en cours ou prochaine
  let currentActivity = null;
  let nextActivity = null;
  
  for (let i = 0; i < sortedPlanning.length; i++) {
    if (sortedPlanning[i].time <= currentTime) {
      currentActivity = sortedPlanning[i];
    } else {
      nextActivity = sortedPlanning[i];
      break;
    }
  }
  
  // Afficher l'activité en cours ou prochaine
  if (currentActivity) {
    activityName.textContent = currentActivity.label;
  } else if (nextActivity) {
    activityName.textContent = `Prochainement: ${nextActivity.label}`;
  } else {
    activityName.textContent = 'Aucune activité prévue';
  }
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
    
    // Mettre à jour l'activité actuelle chaque minute
    if (seconds === '00') {
      updateCurrentActivity();
    }
  };
  
  updateClock();
  setInterval(updateClock, 1000);
}

// Mettre à jour toutes les 30 secondes
setInterval(() => {
  loadStatus();
}, 30000);