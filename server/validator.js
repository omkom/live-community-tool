// server/validator.js
/**
 * Valide un élément du planning
 * @param {Object} item Élément du planning
 * @returns {boolean} Validité de l'élément
 */
function planningItem(item) {
    // Vérifier que l'élément est un objet
    if (!item || typeof item !== 'object') {
      return false;
    }
    
    // Vérifier les propriétés requises
    if (!('time' in item) || !('label' in item) || !('checked' in item)) {
      return false;
    }
    
    // Vérifier les types
    if (typeof item.time !== 'string' || typeof item.label !== 'string' || typeof item.checked !== 'boolean') {
      return false;
    }
    
    // Valider le format de l'heure (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(item.time)) {
      return false;
    }
    
    // Vérifier la longueur du label
    if (item.label.length === 0 || item.label.length > 100) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Valide les données de statut
   * @param {Object} data Données de statut
   * @returns {boolean} Validité des données
   */
  function statusData(data) {
    // Vérifier que les données sont un objet
    if (!data || typeof data !== 'object') {
      return false;
    }
    
    // Vérifier les propriétés requises
    const requiredProps = ['donation_total', 'donation_goal', 'subs_total', 'subs_goal'];
    for (const prop of requiredProps) {
      if (!(prop in data)) {
        return false;
      }
    }
    
    // Vérifier les types
    if (typeof data.donation_total !== 'number' || 
        typeof data.donation_goal !== 'number' || 
        typeof data.subs_total !== 'number' || 
        typeof data.subs_goal !== 'number') {
      return false;
    }
    
    // Vérifier les valeurs
    if (data.donation_total < 0 || 
        data.donation_goal < 0 || 
        data.subs_total < 0 || 
        data.subs_goal < 0) {
      return false;
    }
    
    return true;
  }
  
  module.exports = {
    planningItem,
    statusData
  };