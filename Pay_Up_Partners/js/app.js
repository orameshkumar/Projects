var App = (function() {
  'use strict';

  var currentScreen = 'collection-screen';

  async function initApp() {
    try {
      // Apply theme first for immediate visual consistency
      Settings.applyTheme();

      // Initialize database
      await DB.init();

      // Initialize all modules
      Settings.init();
      if (typeof License !== 'undefined') await License.init();
      Loans.init();
      ClientMaster.init();
      Collection.init();
      InterestCollection.init();
      if (typeof WhatsApp !== 'undefined') WhatsApp.init();
      PaymentHistory.init();
      Reports.init();
      Backup.init();

      // Setup navigation
      setupTabNavigation();

      // Update app name display
      Settings.updateAppNameDisplay();

      // Register service worker
      registerServiceWorker();

      // Check backup reminder
      Backup.checkBackupReminder();

    } catch (e) {
      console.error('App initialization failed:', e);
      alert('Could not initialize app: ' + e.message);
    }
  }

  function navigateToScreen(screenId) {
    // Hide all screens
    var screens = document.querySelectorAll('.screen');
    screens.forEach(function(screen) {
      screen.setAttribute('hidden', '');
    });

    // Show target screen
    var target = document.getElementById(screenId);
    if (target) target.removeAttribute('hidden');

    // Update active tab
    var tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(function(tab) {
      tab.classList.remove('active');
      if (tab.getAttribute('data-screen') === screenId) {
        tab.classList.add('active');
      }
    });

    currentScreen = screenId;

    // Refresh data on screen switch
    refreshScreenData(screenId);
  }

  function refreshScreenData(screenId) {
    switch (screenId) {
      case 'collection-screen':
        if (typeof Collection !== 'undefined' && Collection.renderCollectionList) {
          var dateInput = document.getElementById('collection-date');
          var date = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
          Collection.renderCollectionList(date);
        }
        break;
      case 'interest-screen':
        if (typeof InterestCollection !== 'undefined' && InterestCollection.renderInterestList) {
          InterestCollection.renderInterestList();
        }
        break;
      case 'history-screen':
        if (typeof PaymentHistory !== 'undefined' && PaymentHistory.renderHistory) {
          PaymentHistory.renderHistory();
        }
        break;
      case 'clients-screen':
        if (typeof ClientMaster !== 'undefined' && ClientMaster.renderClientList) {
          ClientMaster.renderClientList();
        }
        break;
      case 'reports-screen':
        if (typeof Reports !== 'undefined' && Reports.renderReport) {
          Reports.renderReport();
        }
        break;
      case 'settings-screen':
        // Settings init handles its own rendering
        break;
      case 'backup-screen':
        // Backup init handles its own rendering
        break;
    }
  }

  function setupTabNavigation() {
    var tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(function(tab) {
      tab.addEventListener('click', function(e) {
        e.preventDefault();
        var screenId = tab.getAttribute('data-screen');
        if (screenId) navigateToScreen(screenId);
      });
    });

    // Show the default screen (collection)
    navigateToScreen(currentScreen);
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').then(function(reg) {
        console.log('Service Worker registered:', reg.scope);
      }).catch(function(err) {
        console.log('Service Worker registration failed:', err);
      });
    }
  }

  // ─── Start App ───
  document.addEventListener('DOMContentLoaded', initApp);

  return {
    initApp: initApp,
    navigateToScreen: navigateToScreen,
    setupTabNavigation: setupTabNavigation,
    registerServiceWorker: registerServiceWorker
  };
})();
