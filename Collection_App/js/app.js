// App initialization, navigation, and service worker registration

/**
 * Register the service worker for offline PWA support.
 * Detects updates and shows notification when new version is available.
 */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(function(registration) {
        console.log('Service Worker registered with scope:', registration.scope);

        // Listen for updates
        registration.onupdatefound = function() {
          var installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.onstatechange = function() {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // New version available — notify the user
                showUpdateNotification();
              }
            }
          };
        };
      })
      .catch(function(error) {
        console.error('Service Worker registration failed:', error);
      });
  }
}

/**
 * Show a non-intrusive notification that a new version is available.
 */
function showUpdateNotification() {
  // Check if notification element already exists
  var existing = document.getElementById('update-notification');
  if (existing) return;

  var notification = document.createElement('div');
  notification.id = 'update-notification';
  notification.className = 'update-notification';
  notification.setAttribute('role', 'alert');
  notification.textContent = 'Update available. Restart app to apply.';
  document.body.appendChild(notification);
}

/**
 * Navigate to a screen by its id.
 * Shows the section matching screenId (removes 'hidden', adds 'active' class),
 * hides all other sections (adds 'hidden', removes 'active').
 * Updates the active state on nav tabs (add/remove 'active' class, update aria-current).
 * Refreshes module data when switching to specific screens.
 * @param {string} screenId - The id of the screen section to show
 */
function navigateToScreen(screenId) {
  // Hide all screens
  var screens = document.querySelectorAll('.screen');
  screens.forEach(function(screen) {
    screen.classList.remove('active');
    screen.setAttribute('hidden', '');
  });

  // Show the target screen
  var targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.add('active');
    targetScreen.removeAttribute('hidden');
  }

  // Update nav tab active states and aria-current
  var navTabs = document.querySelectorAll('.nav-tab');
  navTabs.forEach(function(tab) {
    if (tab.getAttribute('data-screen') === screenId) {
      tab.classList.add('active');
      tab.setAttribute('aria-current', 'page');
    } else {
      tab.classList.remove('active');
      tab.removeAttribute('aria-current');
    }
  });

  // Refresh module data when switching to specific screens
  if (screenId === 'collection-section') {
    try {
      if (typeof Collection !== 'undefined' && Collection.init) {
        Collection.init();
      }
    } catch (e) {
      console.error('Error initializing Collection:', e);
    }
  }

  if (screenId === 'history-section') {
    try {
      if (typeof PaymentHistory !== 'undefined' && PaymentHistory.init) {
        PaymentHistory.init();
      }
    } catch (e) {
      console.error('Error initializing PaymentHistory:', e);
    }
  }

  if (screenId === 'reports-section') {
    try {
      if (typeof Reports !== 'undefined' && Reports.init) {
        Reports.init();
      }
    } catch (e) {
      console.error('Error initializing Reports:', e);
    }
  }

  if (screenId === 'interest-section') {
    if (typeof InterestCollection !== 'undefined' && InterestCollection.renderInterestList) {
      InterestCollection.renderInterestList();
    }
  }
}

/**
 * Set up tab navigation event listeners on the bottom nav buttons.
 * Attaches click handlers to all `.nav-tab` buttons.
 * On click, reads `data-screen` attribute and calls navigateToScreen().
 */
function setupTabNavigation() {
  var navTabs = document.querySelectorAll('.nav-tab');
  navTabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      var screenId = tab.getAttribute('data-screen');
      if (screenId) {
        navigateToScreen(screenId);
      }
    });
  });
}

/**
 * Read AppName from localStorage, default to "ABC Debt Collection".
 * Update #app-name-header textContent and document.title.
 */
function updateAppName() {
  var appName = localStorage.getItem('app_name') || 'ABC Debt Collection';
  var header = document.getElementById('app-name-header');
  if (header) {
    header.textContent = appName;
  }
  document.title = appName;
}

/**
 * Main initialization function.
 * Initializes DB, sets up navigation, and initializes all modules.
 * Defensive — catches errors from modules that aren't loaded yet.
 */
async function initApp() {
  // Apply saved theme immediately to avoid flash
  try {
    if (typeof Settings !== 'undefined' && Settings.applyTheme && Settings.getTheme) {
      Settings.applyTheme(Settings.getTheme());
    }
  } catch (e) {
    // Ignore — will use default light theme
  }

  // Initialize database
  try {
    if (typeof DB !== 'undefined' && DB.init) {
      await DB.init();
      console.log('Database initialized');
    }
  } catch (e) {
    console.error('Database initialization failed:', e);
  }

  // Set up tab navigation
  setupTabNavigation();

  // Initialize Settings module
  try {
    if (typeof Settings !== 'undefined' && Settings.init) {
      Settings.init();
    }
  } catch (e) {
    console.error('Error initializing Settings:', e);
  }

  // Initialize ClientMaster module
  try {
    if (typeof ClientMaster !== 'undefined' && ClientMaster.init) {
      ClientMaster.init();
    }
  } catch (e) {
    console.error('Error initializing ClientMaster:', e);
  }

  // Initialize Collection module
  try {
    if (typeof Collection !== 'undefined' && Collection.init) {
      Collection.init();
    }
  } catch (e) {
    console.error('Error initializing Collection:', e);
  }

  // Initialize InterestCollection module
  try {
    if (typeof InterestCollection !== 'undefined' && InterestCollection.init) {
      InterestCollection.init();
    }
  } catch (e) {
    console.error('Error initializing InterestCollection:', e);
  }

  // Initialize PaymentHistory module
  try {
    if (typeof PaymentHistory !== 'undefined' && PaymentHistory.init) {
      PaymentHistory.init();
    }
  } catch (e) {
    console.error('Error initializing PaymentHistory:', e);
  }

  // Initialize Reports module
  try {
    if (typeof Reports !== 'undefined' && Reports.init) {
      Reports.init();
    }
  } catch (e) {
    console.error('Error initializing Reports:', e);
  }

  // Update app name from settings
  updateAppName();

  // Initialize Backup module and check reminder
  try {
    if (typeof Backup !== 'undefined' && Backup.init) {
      Backup.init();
      Backup.checkBackupReminder();
    }
  } catch (e) {
    console.error('Error initializing Backup:', e);
  }

  // Register service worker
  registerServiceWorker();
}

// Initialize app on DOMContentLoaded
document.addEventListener('DOMContentLoaded', initApp);
