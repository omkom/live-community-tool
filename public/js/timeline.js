// public/js/timeline.js - Module avancé pour la timeline interactive
class StreamTimeline {
    /**
     * Constructeur
     * @param {string} elementId ID de l'élément qui contiendra la timeline
     * @param {Object} options Options de configuration
     */
    constructor(elementId, options = {}) {
      // Élément conteneur
      this.container = document.getElementById(elementId);
      if (!this.container) {
        throw new Error(`Élément avec ID "${elementId}" non trouvé`);
      }
  
      // Options par défaut
      this.options = {
        autoScroll: true,
        showCurrentTime: true,
        colorMapping: true,
        useEventTypes: true,
        animateTimeIndicator: true,
        timeFormat: '24h', // '12h' ou '24h'
        hourHeight: 100, // hauteur en pixels pour une heure
        theme: 'dark', // 'dark' ou 'light'
        showEmptyHours: true,
        minTime: null, // heure min en minutes (0-1440), null = auto
        maxTime: null, // heure max en minutes (0-1440), null = auto
        ...options
      };
  
      // Types d'événements et leurs couleurs
      this.eventTypes = {
        'Sport': { color: '#4CAF50', icon: 'fas fa-running' },
        'Cuisine': { color: '#FF9800', icon: 'fas fa-utensils' },
        'Jeu': { color: '#9C27B0', icon: 'fas fa-gamepad' },
        'Talk': { color: '#2196F3', icon: 'fas fa-comments' },
        'SIESTE': { color: '#795548', icon: 'fas fa-bed' },
        'Création': { color: '#E91E63', icon: 'fas fa-paint-brush' },
        'Podcast': { color: '#607D8B', icon: 'fas fa-microphone' },
        'Radio': { color: '#00BCD4', icon: 'fas fa-broadcast-tower' },
        'Défi': { color: '#F44336', icon: 'fas fa-trophy' },
        'Discussion': { color: '#3F51B5', icon: 'fas fa-users' },
        'Réveil': { color: '#FFEB3B', icon: 'fas fa-coffee' },
        'Clôture': { color: '#9E9E9E', icon: 'fas fa-flag-checkered' },
        'default': { color: '#00ffcc', icon: 'fas fa-calendar-check' }
      };
  
      // Données
      this.planningData = [];
      this.timeIndicatorInterval = null;
      this.streamStartTime = null;
  
      // État
      this.minTimeInMinutes = 0;
      this.maxTimeInMinutes = 1440; // 24h * 60min
      this.totalDurationInMinutes = this.maxTimeInMinutes - this.minTimeInMinutes;
      this.currentIndex = -1;
      this.nextIndex = -1;
      this.lastRenderTime = 0;
      this.eventListeners = {};
  
      // Initialisation
      this.init();
    }
  
    /**
     * Initialisation de la timeline
     */
    init() {
      // Ajouter la classe de thème
      this.container.classList.add(`timeline-${this.options.theme}`);
  
      // Créer la structure de base
      this.createTimelineStructure();
  
      // Ajouter les écouteurs d'événements
      this.setupEventListeners();
    }
  
    /**
     * Créer la structure de base de la timeline
     */
    createTimelineStructure() {
      // Vider le conteneur
      this.container.innerHTML = '';
  
      // Créer les éléments structurels
      const timelineWrapper = document.createElement('div');
      timelineWrapper.className = 'timeline-wrapper';
  
      const headerRow = document.createElement('div');
      headerRow.className = 'timeline-header';
      headerRow.innerHTML = `
        <div class="timeline-title">
          <h2>Planning du Stream</h2>
          <div class="timeline-controls">
            <button class="timeline-btn timeline-btn-now" title="Aller à maintenant">
              <i class="fas fa-clock"></i>
            </button>
            <button class="timeline-btn timeline-btn-refresh" title="Rafraîchir">
              <i class="fas fa-sync-alt"></i>
            </button>
          </div>
        </div>
        <div class="timeline-info">
          <div class="timeline-legend">
            <span class="timeline-legend-item">
              <span class="timeline-status-dot status-current"></span> En cours
            </span>
            <span class="timeline-legend-item">
              <span class="timeline-status-dot status-next"></span> À suivre
            </span>
            <span class="timeline-legend-item">
              <span class="timeline-status-dot status-completed"></span> Terminé
            </span>
          </div>
        </div>
      `;
  
      const timelineContent = document.createElement('div');
      timelineContent.className = 'timeline-content';
  
      // Ajouter les éléments au DOM
      timelineWrapper.appendChild(headerRow);
      timelineWrapper.appendChild(timelineContent);
      this.container.appendChild(timelineWrapper);
  
      // Sauvegarder les références
      this.timelineContent = timelineContent;
    }
  
    /**
     * Configurer les écouteurs d'événements
     */
    setupEventListeners() {
      // Bouton "Aller à maintenant"
      const nowButton = this.container.querySelector('.timeline-btn-now');
      if (nowButton) {
        nowButton.addEventListener('click', () => {
          this.scrollToCurrentTime();
        });
      }
  
      // Bouton "Rafraîchir"
      const refreshButton = this.container.querySelector('.timeline-btn-refresh');
      if (refreshButton) {
        refreshButton.addEventListener('click', () => {
          this.emit('refresh-requested');
          this.renderTimeline(true);
        });
      }
  
      // Gestion du redimensionnement de la fenêtre
      window.addEventListener('resize', this.debounce(() => {
        this.renderTimeline(false);
      }, 250));
    }
  
    /**
     * Fonction debounce pour limiter la fréquence d'appel
     * @param {Function} func Fonction à exécuter
     * @param {number} wait Délai d'attente en ms
     * @returns {Function} Fonction avec debounce
     */
    debounce(func, wait) {
      let timeout;
      return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
      };
    }
  
    /**
     * Charger le planning depuis le serveur
     * @returns {Promise<Array>} Données du planning
     */
    async loadPlanning() {
      try {
        const response = await fetch('/api/planning');
        if (!response.ok) {
          throw new Error(`Erreur HTTP ${response.status}`);
        }
        const data = await response.json();
        this.updatePlanning(data.planning || []);
        return this.planningData;
      } catch (error) {
        console.error('Erreur lors du chargement du planning:', error);
        this.emit('error', error);
        return [];
      }
    }
  
    /**
     * Mettre à jour les données du planning
     * @param {Array} planning Données du planning
     */
    updatePlanning(planning) {
      this.planningData = planning;
      this.renderTimeline(true);
      this.emit('planning-updated', planning);
    }
  
    /**
     * Définir l'heure de début du stream
     * @param {Date|string} startTime Heure de début
     */
    setStreamStartTime(startTime) {
      if (typeof startTime === 'string') {
        this.streamStartTime = new Date(startTime);
      } else {
        this.streamStartTime = startTime;
      }
      this.emit('stream-start-updated', this.streamStartTime);
  
      // Mettre à jour l'horloge si nécessaire
      if (this.clockElement) {
        this.updateStreamClock();
      }
    }
  
    /**
     * Ajouter un élément d'horloge du stream
     * @param {string} elementId ID de l'élément d'horloge
     */
    addStreamClock(elementId) {
      this.clockElement = document.getElementById(elementId);
      if (!this.clockElement) {
        console.error(`Élément horloge avec ID "${elementId}" non trouvé`);
        return;
      }
  
      // Démarrer l'horloge
      this.updateStreamClock();
      setInterval(() => this.updateStreamClock(), 1000);
    }
  
    /**
     * Mettre à jour l'horloge du stream
     */
    updateStreamClock() {
      if (!this.clockElement || !this.streamStartTime) return;
  
      const now = new Date();
      const diff = now - this.streamStartTime;
  
      // Calculer heures, minutes, secondes écoulées
      const hours = Math.floor(diff / (1000 * 60 * 60)).toString().padStart(2, '0');
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
      const seconds = Math.floor((diff % (1000 * 60)) / 1000).toString().padStart(2, '0');
  
      this.clockElement.textContent = `${hours}:${minutes}:${seconds}`;
    }
  
    /**
     * Rendu de la timeline
     * @param {boolean} forceRender Forcer un rendu complet
     */
    renderTimeline(forceRender = false) {
      const now = Date.now();
  
      // Limiter les rendus complets pour des raisons de performance
      if (!forceRender && (now - this.lastRenderTime < 5000)) {
        this.updateTimeIndicator();
        this.updateCurrentStatus();
        return;
      }
  
      this.lastRenderTime = now;
  
      // Vérifier si le conteneur existe
      if (!this.timelineContent) return;
  
      // Vider la timeline
      this.timelineContent.innerHTML = '';
  
      // Si pas de données, afficher un message
      if (!this.planningData || this.planningData.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'timeline-empty';
        empty.textContent = 'Aucun élément dans le planning pour le moment.';
        this.timelineContent.appendChild(empty);
        return;
      }
  
      // Trier les éléments par heure
      const sortedData = [...this.planningData].sort((a, b) => a.time.localeCompare(b.time));
  
      // Déterminer les bornes de temps pour la journée (min et max)
      this.calculateTimeRange(sortedData);
  
      // Créer le conteneur principal de la timeline
      const timeline = document.createElement('div');
      timeline.className = 'timeline';
      timeline.dataset.minTime = this.minTimeInMinutes;
      timeline.dataset.maxTime = this.maxTimeInMinutes;
      timeline.dataset.duration = this.totalDurationInMinutes;
  
      // Créer la ligne centrale
      const timelineLine = document.createElement('div');
      timelineLine.className = 'timeline-line';
      timeline.appendChild(timelineLine);
  
      // Ajouter les marqueurs d'heures
      this.addHourMarkers(timeline);
  
      // Définir la hauteur de la timeline en fonction de la plage horaire
      const heightPerMinute = this.options.hourHeight / 60;
      const timelineHeight = this.totalDurationInMinutes * heightPerMinute;
      timeline.style.height = `${timelineHeight}px`;
  
      // Calculer l'heure actuelle
      const dateNow = new Date();
      const currentHour = dateNow.getHours();
      const currentMinute = dateNow.getMinutes();
      const currentTimeInMinutes = currentHour * 60 + currentMinute;
      const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
  
      // Trouver l'élément actuel et le prochain
      this.findCurrentAndNextItems(sortedData, currentTimeStr);
  
      // Ajouter l'indicateur d'heure actuelle
      if (this.options.showCurrentTime) {
        this.addTimeIndicator(timeline, currentTimeInMinutes);
      }
  
      // Ajouter les éléments du planning
      sortedData.forEach((item, index) => {
        this.addTimelineItem(timeline, item, index);
      });
  
      // Ajouter la timeline au conteneur
      this.timelineContent.appendChild(timeline);
  
      // Afficher les informations "En cours" et "À venir"
      this.updateNowPlaying(sortedData);
  
      // Auto-scroll vers l'élément en cours si demandé
      if (this.options.autoScroll) {
        this.scrollToCurrentTime();
      }
    }
  
    /**
     * Calculer la plage horaire pour la timeline
     * @param {Array} sortedData Données triées par heure
     */
    calculateTimeRange(sortedData) {
      // Utiliser les valeurs configurées si elles existent
      if (this.options.minTime !== null && this.options.maxTime !== null) {
        this.minTimeInMinutes = this.options.minTime;
        this.maxTimeInMinutes = this.options.maxTime;
        this.totalDurationInMinutes = this.maxTimeInMinutes - this.minTimeInMinutes;
        return;
      }
  
      // Sinon, calculer automatiquement
      let minTimeInMinutes = 24 * 60;  // Initialiser à la fin de la journée
      let maxTimeInMinutes = 0;        // Initialiser au début de la journée
  
      sortedData.forEach(item => {
        const [hours, minutes] = item.time.split(':').map(Number);
        const timeInMinutes = hours * 60 + minutes;
  
        if (timeInMinutes < minTimeInMinutes) minTimeInMinutes = timeInMinutes;
        if (timeInMinutes > maxTimeInMinutes) maxTimeInMinutes = timeInMinutes;
      });
  
      // Ajouter des marges pour éviter que le premier et le dernier événement soient collés aux bords
      this.minTimeInMinutes = Math.max(0, minTimeInMinutes - 60);  // -1h
      this.maxTimeInMinutes = Math.min(24 * 60, maxTimeInMinutes + 120);  // +2h
      this.totalDurationInMinutes = this.maxTimeInMinutes - this.minTimeInMinutes;
    }
  
    /**
     * Ajouter les marqueurs d'heures
     * @param {HTMLElement} timeline Élément timeline
     */
    addHourMarkers(timeline) {
      const hourMarkers = document.createElement('div');
      hourMarkers.className = 'hour-markers';
  
      // Calculer l'heure de début (arrondie à l'heure inférieure)
      const startHour = Math.floor(this.minTimeInMinutes / 60);
      const endHour = Math.ceil(this.maxTimeInMinutes / 60);
  
      // Ajouter les marqueurs pour chaque heure
      for (let hour = startHour; hour <= endHour; hour++) {
        const hourInMinutes = hour * 60;
  
        // Ne pas afficher les heures hors de la plage visible
        if (hourInMinutes < this.minTimeInMinutes || hourInMinutes > this.maxTimeInMinutes) continue;
  
        // Calculer la position verticale en pourcentage
        const positionPercentage = ((hourInMinutes - this.minTimeInMinutes) / this.totalDurationInMinutes) * 100;
  
        // Créer le marqueur d'heure
        const hourMarker = document.createElement('div');
        hourMarker.className = 'hour-marker';
        hourMarker.style.top = `${positionPercentage}%`;
  
        // Format d'heure (12h ou 24h)
        let hourDisplay = hour;
        let amPm = '';
        if (this.options.timeFormat === '12h') {
          hourDisplay = hour % 12 || 12;
          amPm = hour < 12 ? 'AM' : 'PM';
        }
  
        // Créer l'étiquette d'heure
        const hourLabel = document.createElement('div');
        hourLabel.className = 'hour-marker-label';
        hourLabel.textContent = `${hourDisplay.toString().padStart(2, '0')}:00${amPm}`;
        hourMarker.appendChild(hourLabel);
  
        hourMarkers.appendChild(hourMarker);
      }
  
      timeline.appendChild(hourMarkers);
    }
  
    /**
     * Trouver l'élément actuel et le prochain
     * @param {Array} sortedData Données triées par heure
     * @param {string} currentTimeStr Heure actuelle au format "HH:MM"
     */
    findCurrentAndNextItems(sortedData, currentTimeStr) {
      this.currentIndex = -1;
      this.nextIndex = -1;
  
      for (let i = 0; i < sortedData.length; i++) {
        const itemTime = sortedData[i].time;
  
        if (itemTime <= currentTimeStr) {
          if (!sortedData[i].checked) {
            this.currentIndex = i;
          }
        } else if (this.nextIndex === -1) {
          this.nextIndex = i;
          break;
        }
      }
  
      this.emit('current-item-changed', this.currentIndex >= 0 ? sortedData[this.currentIndex] : null);
      this.emit('next-item-changed', this.nextIndex >= 0 ? sortedData[this.nextIndex] : null);
    }
  
    /**
     * Ajouter l'indicateur d'heure actuelle
     * @param {HTMLElement} timeline Élément timeline
     * @param {number} currentTimeInMinutes Heure actuelle en minutes
     */
    addTimeIndicator(timeline, currentTimeInMinutes) {
      // Ne pas ajouter l'indicateur si l'heure actuelle est hors de la plage visible
      if (currentTimeInMinutes < this.minTimeInMinutes || currentTimeInMinutes > this.maxTimeInMinutes) {
        return;
      }
  
      // Calculer la position verticale en pourcentage
      const positionPercentage = ((currentTimeInMinutes - this.minTimeInMinutes) / this.totalDurationInMinutes) * 100;
  
      // Créer l'indicateur de temps actuel
      const timeIndicator = document.createElement('div');
      timeIndicator.className = 'current-time-indicator';
      timeIndicator.id = 'current-time-indicator';
      timeIndicator.style.top = `${positionPercentage}%`;
  
      // Créer le label de temps actuel
      const timeLabel = document.createElement('div');
      timeLabel.className = 'current-time-label';
      timeLabel.id = 'current-time-label';
      
      // Format 12h ou 24h
      const currentHour = Math.floor(currentTimeInMinutes / 60);
      const currentMin = currentTimeInMinutes % 60;
      
      if (this.options.timeFormat === '12h') {
        const hour12 = currentHour % 12 || 12;
        const amPm = currentHour < 12 ? 'AM' : 'PM';
        timeLabel.textContent = `${hour12}:${currentMin.toString().padStart(2, '0')} ${amPm}`;
      } else {
        timeLabel.textContent = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`;
      }
      
      timeLabel.style.top = `${positionPercentage}%`;
  
      timeline.appendChild(timeIndicator);
      timeline.appendChild(timeLabel);
  
      // Configurer l'animation de l'indicateur si activée
      if (this.options.animateTimeIndicator) {
        // Arrêter l'animation précédente si elle existe
        if (this.timeIndicatorInterval) {
          clearInterval(this.timeIndicatorInterval);
        }
  
        // Mettre à jour l'indicateur toutes les 10 secondes
        this.timeIndicatorInterval = setInterval(() => {
          this.updateTimeIndicator();
        }, 10000);
      }
    }
  
    /**
     * Ajouter un élément de planning à la timeline
     * @param {HTMLElement} timeline Élément timeline
     * @param {Object} item Élément du planning
     * @param {number} index Index dans le tableau
     */
    addTimelineItem(timeline, item, index) {
      // Calculer la position verticale en pourcentage
      const [hours, minutes] = item.time.split(':').map(Number);
      const timeInMinutes = hours * 60 + minutes;
      const positionPercentage = ((timeInMinutes - this.minTimeInMinutes) / this.totalDurationInMinutes) * 100;
  
      // Créer l'élément de timeline
      const timelineItem = document.createElement('div');
      timelineItem.className = 'timeline-item';
      timelineItem.dataset.index = index;
      timelineItem.dataset.time = item.time;
      timelineItem.dataset.label = item.label;
      timelineItem.dataset.checked = item.checked.toString();
  
      // Détecter le type d'événement
      const eventType = this.detectEventType(item.label);
      const eventConfig = this.getEventConfig(eventType);
      timelineItem.dataset.type = eventType;
  
      // Ajouter la classe gauche/droite en alternance
      timelineItem.classList.add(index % 2 === 0 ? 'left' : 'right');
  
      // Ajouter les classes d'état
      if (item.checked) {
        timelineItem.classList.add('done');
      } else if (index === this.currentIndex) {
        timelineItem.classList.add('current');
      } else if (index === this.nextIndex) {
        timelineItem.classList.add('next');
      }
  
      // Positionner l'élément par le haut à l'horaire exact
      timelineItem.style.top = `${positionPercentage}%`;
  
      // Créer le contenu de l'élément
      const timelineContent = document.createElement('div');
      timelineContent.className = 'timeline-content';
  
      // Appliquer la couleur spécifique au type d'événement si l'option est activée
      if (this.options.colorMapping) {
        if (timelineItem.classList.contains('current')) {
          timelineContent.style.borderColor = '#ff3300';
          timelineContent.style.boxShadow = `0 0 15px ${eventConfig.color}`;
        } else {
          if (timelineItem.classList.contains('left')) {
            timelineContent.style.borderRight = `3px solid ${eventConfig.color}`;
          } else {
            timelineContent.style.borderLeft = `3px solid ${eventConfig.color}`;
          }
        }
      }
  
      // Créer un conteneur pour l'heure et le titre
      const contentHeader = document.createElement('div');
      contentHeader.className = 'timeline-content-header';
  
      // Créer l'icône et l'heure
      const timeSpan = document.createElement('span');
      timeSpan.className = 'timeline-time';
  
      // Ajouter une icône selon le statut et le type
      const icon = document.createElement('i');
      if (item.checked) {
        icon.className = 'fas fa-check-circle';
      } else if (index === this.currentIndex) {
        icon.className = 'fas fa-play-circle';
      } else if (this.options.useEventTypes) {
        icon.className = eventConfig.icon;
      } else {
        icon.className = 'fas fa-clock';
      }
  
      icon.style.color = eventConfig.color;
  
      timeSpan.appendChild(icon);
      
      // Format 12h ou 24h pour l'affichage de l'heure
      let timeDisplay = item.time;
      if (this.options.timeFormat === '12h') {
        const [hour, minute] = item.time.split(':').map(Number);
        const hour12 = hour % 12 || 12;
        const amPm = hour < 12 ? 'AM' : 'PM';
        timeDisplay = `${hour12}:${minute.toString().padStart(2, '0')} ${amPm}`;
      }
      
      timeSpan.appendChild(document.createTextNode(` ${timeDisplay}`));
  
      // Créer le titre de l'événement
      const titleSpan = document.createElement('span');
      titleSpan.className = 'timeline-title';
      titleSpan.textContent = item.label;
  
      // Ajouter un badge d'état si nécessaire
      if (index === this.currentIndex) {
        const badge = document.createElement('span');
        badge.className = 'timeline-badge current';
        badge.textContent = 'EN COURS';
        titleSpan.appendChild(document.createTextNode(' '));
        titleSpan.appendChild(badge);
      } else if (index === this.nextIndex) {
        const badge = document.createElement('span');
        badge.className = 'timeline-badge next';
        badge.textContent = 'À SUIVRE';
        titleSpan.appendChild(document.createTextNode(' '));
        titleSpan.appendChild(badge);
      }
  
      // Assembler le header (heure + titre)
      contentHeader.appendChild(timeSpan);
      contentHeader.appendChild(titleSpan);
  
      // Assembler le contenu
      timelineContent.appendChild(contentHeader);
  
      // Événements de l'élément
      timelineItem.addEventListener('click', () => {
        this.emit('item-clicked', item, index);
      });
  
      timelineItem.appendChild(timelineContent);
      timeline.appendChild(timelineItem);
    }
  
    /**
     * Mettre à jour l'indicateur de temps actuel
     */
    updateTimeIndicator() {
      const timeIndicator = document.getElementById('current-time-indicator');
      const timeLabel = document.getElementById('current-time-label');
  
      if (!timeIndicator || !timeLabel) return;
  
      // Calculer l'heure actuelle
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentSecond = now.getSeconds();
      const currentTimeInMinutes = currentHour * 60 + currentMinute + (currentSecond / 60);
  
      // Format 12h ou 24h
      let timeDisplay = '';
      if (this.options.timeFormat === '12h') {
        const hour12 = currentHour % 12 || 12;
        const amPm = currentHour < 12 ? 'AM' : 'PM';
        timeDisplay = `${hour12}:${currentMinute.toString().padStart(2, '0')} ${amPm}`;
      } else {
        timeDisplay = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
      }
  
      // Récupérer la timeline
      const timeline = timeIndicator.parentElement;
      if (!timeline) return;
  
      // Récupérer les données de la timeline
      const minTimeInMinutes = parseInt(timeline.dataset.minTime || '0');
      const totalDurationInMinutes = parseInt(timeline.dataset.duration || '1440');
  
      // Calculer la nouvelle position en pourcentage
      if (totalDurationInMinutes > 0) {
        const positionPercentage = ((currentTimeInMinutes - minTimeInMinutes) / totalDurationInMinutes) * 100;
  
        // Ne mettre à jour que si l'indicateur est dans la plage visible
        if (positionPercentage >= 0 && positionPercentage <= 100) {
          // Utiliser CSS transition pour une animation fluide
          timeIndicator.style.transition = 'top 1s linear';
          timeLabel.style.transition = 'top 1s linear';
  
          timeIndicator.style.top = `${positionPercentage}%`;
          timeLabel.style.top = `${positionPercentage}%`;
          timeLabel.textContent = timeDisplay;
        }
      }
    }
  
    /**
     * Mettre à jour le statut actuel/à venir
     */
    updateCurrentStatus() {
      // Cette méthode est appelée périodiquement pour mettre à jour l'état sans refaire le rendu complet
      if (!this.planningData || this.planningData.length === 0) return;
  
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
  
      // Trier les éléments par heure
      const sortedData = [...this.planningData].sort((a, b) => a.time.localeCompare(b.time));
  
      // Trouver l'élément actuel ou prochain
      const oldCurrentIndex = this.currentIndex;
      const oldNextIndex = this.nextIndex;
  
      this.findCurrentAndNextItems(sortedData, currentTimeStr);
  
      // Si l'élément actuel ou à venir a changé, mettre à jour les classes
      if (oldCurrentIndex !== this.currentIndex || oldNextIndex !== this.nextIndex) {
        // Réinitialiser les classes de tous les éléments
        document.querySelectorAll('.timeline-item').forEach((item, index) => {
          item.classList.remove('current', 'next');
          if (index === this.currentIndex) {
            item.classList.add('current');
          } else if (index === this.nextIndex) {
            item.classList.add('next');
          }
        });
  
        // Mettre à jour l'affichage "En cours" et "À venir"
        this.updateNowPlaying(sortedData);
      }
    }
  
    /**
     * Mettre à jour l'affichage "En cours" et "À venir"
     * @param {Array} sortedData Données triées par heure
     */
    updateNowPlaying(sortedData) {
      // Obtenir ou créer l'élément "En cours"
      let nowPlaying = document.querySelector('.timeline-now-playing');
      if (!nowPlaying) {
        nowPlaying = document.createElement('div');
        nowPlaying.className = 'timeline-now-playing';
        this.container.querySelector('.timeline-info').appendChild(nowPlaying);
      }
  
      // Obtenir ou créer l'élément "À venir"
      let comingUp = document.querySelector('.timeline-coming-up');
      if (!comingUp) {
        comingUp = document.createElement('div');
        comingUp.className = 'timeline-coming-up';
        this.container.querySelector('.timeline-info').appendChild(comingUp);
      }
  
      // Mettre à jour "En cours"
      if (this.currentIndex !== -1) {
        const currentItem = sortedData[this.currentIndex];
        const eventConfig = this.getEventConfig(this.detectEventType(currentItem.label));
        
        nowPlaying.innerHTML = `
          <span class="timeline-now-playing-icon" style="color: ${eventConfig.color}">
            <i class="${eventConfig.icon}"></i>
          </span>
          <span class="timeline-now-playing-text">
            <span class="timeline-now-playing-label">En cours:</span>
            <strong>${currentItem.label}</strong>
          </span>
        `;
        nowPlaying.style.display = 'flex';
      } else {
        nowPlaying.style.display = 'none';
      }
  
      // Mettre à jour "À venir"
      if (this.nextIndex !== -1) {
        const nextItem = sortedData[this.nextIndex];
        const eventConfig = this.getEventConfig(this.detectEventType(nextItem.label));
        
        comingUp.innerHTML = `
          <span class="timeline-coming-up-icon" style="color: ${eventConfig.color}">
            <i class="${eventConfig.icon}"></i>
          </span>
          <span class="timeline-coming-up-text">
            <span class="timeline-coming-up-label">À suivre:</span>
            <strong>${nextItem.label}</strong> (${nextItem.time})
          </span>
        `;
        comingUp.style.display = 'flex';
      } else {
        comingUp.style.display = 'none';
      }
    }
  
    /**
     * Faire défiler vers l'heure actuelle
     */
    scrollToCurrentTime() {
      // Récupérer l'indicateur de temps actuel
      const timeIndicator = document.getElementById('current-time-indicator');
      if (!timeIndicator) return;
  
      // Calculer la position de défilement
      const timelineContent = this.timelineContent;
      const timelineHeight = timelineContent.scrollHeight;
      const containerHeight = timelineContent.clientHeight;
      const indicatorPosition = timelineHeight * parseFloat(timeIndicator.style.top) / 100;
  
      // Faire défiler vers l'indicateur (centré)
      const scrollPosition = indicatorPosition - (containerHeight / 2);
      timelineContent.scrollTo({
        top: Math.max(0, scrollPosition),
        behavior: 'smooth'
      });
    }
  
    /**
     * Faire défiler vers un élément spécifique
     * @param {number} index Index de l'élément
     */
    scrollToItem(index) {
      // Récupérer l'élément
      const item = document.querySelector(`.timeline-item[data-index="${index}"]`);
      if (!item) return;
  
      // Calculer la position de défilement
      const timelineContent = this.timelineContent;
      const timelineHeight = timelineContent.scrollHeight;
      const containerHeight = timelineContent.clientHeight;
      const itemPosition = timelineHeight * parseFloat(item.style.top) / 100;
  
      // Faire défiler vers l'élément (centré)
      const scrollPosition = itemPosition - (containerHeight / 2);
      timelineContent.scrollTo({
        top: Math.max(0, scrollPosition),
        behavior: 'smooth'
      });
  
      // Mettre en évidence l'élément
      item.classList.add('highlight');
      setTimeout(() => {
        item.classList.remove('highlight');
      }, 2000);
    }
  
    /**
     * Détecter le type d'événement à partir du libellé
     * @param {string} label Libellé de l'événement
     * @returns {string} Type d'événement
     */
    detectEventType(label) {
      if (!this.options.useEventTypes) return 'default';
  
      const labelLower = label.toLowerCase();
      for (const [type, config] of Object.entries(this.eventTypes)) {
        if (labelLower.includes(type.toLowerCase())) {
          return type;
        }
      }
      return 'default';
    }
  
    /**
     * Obtenir la configuration pour un type d'événement
     * @param {string} type Type d'événement
     * @returns {Object} Configuration
     */
    getEventConfig(type) {
      return this.eventTypes[type] || this.eventTypes.default;
    }
  
    /**
     * Mettre à jour un élément du planning
     * @param {number} index Index de l'élément
     * @param {Object} updates Mises à jour
     */
    updateItem(index, updates) {
      if (index < 0 || index >= this.planningData.length) return;
  
      // Mettre à jour l'élément
      this.planningData[index] = {
        ...this.planningData[index],
        ...updates
      };
  
      // Regénérer la timeline
      this.renderTimeline(true);
    }
  
    /**
     * Obtenir l'élément actuel
     * @returns {Object|null} Élément actuel
     */
    getCurrentItem() {
      if (this.currentIndex >= 0 && this.currentIndex < this.planningData.length) {
        return this.planningData[this.currentIndex];
      }
      return null;
    }
  
    /**
     * Obtenir le prochain élément
     * @returns {Object|null} Prochain élément
     */
    getNextItem() {
      if (this.nextIndex >= 0 && this.nextIndex < this.planningData.length) {
        return this.planningData[this.nextIndex];
      }
      return null;
    }
  
    /**
     * S'abonner à un événement
     * @param {string} event Nom de l'événement
     * @param {Function} callback Fonction de callback
     */
    on(event, callback) {
      if (!this.eventListeners[event]) {
        this.eventListeners[event] = [];
      }
      this.eventListeners[event].push(callback);
    }
  
    /**
     * Émettre un événement
     * @param {string} event Nom de l'événement
     * @param  {...any} args Arguments
     */
    emit(event, ...args) {
      if (this.eventListeners[event]) {
        this.eventListeners[event].forEach(callback => {
          try {
            callback(...args);
          } catch (error) {
            console.error(`Erreur dans le callback de l'événement ${event}:`, error);
          }
        });
      }
    }
  }
  
  // Export pour utilisation dans d'autres modules
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = StreamTimeline;
  }