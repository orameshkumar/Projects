// App initialization, routing, and service worker registration

/**
 * Register the service worker for offline PWA support.
 */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then((registration) => {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  }
}

/**
 * Navigate to a screen by its id.
 * Hides all screens, shows the target, and updates nav tab states.
 * Refreshes module data when switching to specific screens.
 * @param {string} screenId - The id of the screen section to show
 */
function navigateToScreen(screenId) {
  // Hide all screens
  const screens = document.querySelectorAll('.screen');
  screens.forEach((screen) => {
    screen.classList.remove('active');
    screen.setAttribute('hidden', '');
  });

  // Show the target screen
  const targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.add('active');
    targetScreen.removeAttribute('hidden');
  }

  // Update nav tab active states and aria-current
  const navTabs = document.querySelectorAll('.nav-tab');
  navTabs.forEach((tab) => {
    if (tab.getAttribute('data-screen') === screenId) {
      tab.classList.add('active');
      tab.setAttribute('aria-current', 'page');
    } else {
      tab.classList.remove('active');
      tab.removeAttribute('aria-current');
    }
  });

  // Refresh module data when switching tabs
  if (screenId === 'billing-screen' && typeof Billing !== 'undefined' && Billing.refreshItems) {
    Billing.refreshItems();
  }
  if (screenId === 'history-screen' && typeof BillHistory !== 'undefined' && BillHistory.loadAndRenderBills) {
    BillHistory.loadAndRenderBills();
  }
}

/**
 * Set up tab navigation event listeners on the bottom nav buttons.
 */
function setupTabNavigation() {
  const bottomNav = document.querySelector('.bottom-nav');
  if (!bottomNav) return;

  bottomNav.addEventListener('click', (event) => {
    const tab = event.target.closest('.nav-tab');
    if (!tab) return;

    const screenId = tab.getAttribute('data-screen');
    if (screenId) {
      navigateToScreen(screenId);
    }
  });
}

/**
 * Initialize the application.
 * Sets up database, tab navigation, and defaults to Item Master screen.
 */
async function initApp() {
  // Initialize database if DB module is available
  if (typeof DB !== 'undefined' && DB.init) {
    try {
      await DB.init();
      console.log('Database initialized');
    } catch (error) {
      console.error('Database initialization failed:', error);
    }
  }

  // Set up tab navigation
  setupTabNavigation();

  // Default to Item Master screen
  navigateToScreen('item-master-screen');

  // Initialize other modules if their init functions are available
  if (typeof ItemMaster !== 'undefined' && ItemMaster.init) {
    ItemMaster.init();
  }
  if (typeof Billing !== 'undefined' && Billing.init) {
    Billing.init();
  }
  if (typeof BillHistory !== 'undefined' && BillHistory.init) {
    BillHistory.init();
  }
  if (typeof Reports !== 'undefined' && Reports.init) {
    Reports.init();
  }
  if (typeof VoiceEngine !== 'undefined' && VoiceEngine.init) {
    VoiceEngine.init();
  }
  if (typeof Settings !== 'undefined' && Settings.init) {
    Settings.init();
  }
}

// Register service worker and initialize app on DOM ready
registerServiceWorker();
document.addEventListener('DOMContentLoaded', initApp);
