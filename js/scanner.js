/*global parseRecord */
(function() {
  var results = document.querySelector('#results ul');
  var _handle;

  function isBluetoothEnabled() {
    return navigator.mozSettings.createLock().get('bluetooth.enabled').then(a => {
      return !!a['bluetooth.enabled'];
    });
  }

  function getAdapter() {
    return new Promise(function(res, rej) {
      function check(count) {
        if (++count > 5) {
          return rej('Could not get adapter');
        }
        if (navigator.mozBluetooth.defaultAdapter) {
          return res(navigator.mozBluetooth.defaultAdapter);
        }
        setTimeout(() => check(count), 300);
      }
      check(0);
    });
  }

  function discover() {
    return navigator.mozBluetooth.defaultAdapter.startLeScan([]).then(handle => {
      _handle = handle;

      document.body.classList.add('searching');

      console.log('Start scanning', handle);
      handle.ondevicefound = e => {
        var currEl = results.querySelector(
            '*[data-device="' + e.device.address + '"]');
        if (currEl) {
          currEl.dataset.rssi = e.rssi;
          return;
        }

        var record = parseRecord(e.scanRecord);
        if (record) {
          var ele = createNotificationElement(e.device.address, e.rssi, record);
          ele.onclick = openUrl;
          ele.querySelector('.name').textContent = record.uri;
          resolveURI(record.uri, ele);
          return;
        }
      };
    });
  }

  function createNotificationElement(address, rssi, record) {
    var ele = document.createElement('li');
    ele.dataset.device = address;
    ele.dataset.rssi = rssi;
    ele.dataset.txPower = record.txPower;
    ele.innerHTML = `
      <p class="name"></p>
      <p class="link"></p>
      <p class="description"></p>`;

    ele.querySelector('.name').textContent = record.uri;
    ele.dataset.uri = record.uri;

    results.appendChild(ele);

    return ele;
  }

  function resolveURI(uri, ele, retryCount) {
    retryCount = retryCount || 0;

    var x = new XMLHttpRequest({ mozSystem: true });
    x.onload = e => {
      var h = document.createElement('html');
      h.innerHTML = x.responseText;

      ele.querySelector('.link').textContent = x.responseURL;

      var titleEl = h.querySelector('title');
      var metaEl = h.querySelector('meta[name="description"]');
      var bodyEl = h.querySelector('body');

      if (titleEl && titleEl.textContent) {
        ele.querySelector('.name').textContent = titleEl.textContent;
      }

      if (metaEl && metaEl.content) {
        ele.querySelector('.description').textContent =
          metaEl.content;
      }
      else if (bodyEl && bodyEl.textContent) {
        var tx = bodyEl.textContent.substr(0, 115);
        if (tx.length !== bodyEl.textContent.length) tx += '...';
        ele.querySelector('.description').textContent = tx;
      }
    };
    x.onerror = err => {
      // probably lost connection or whatever, retry it
      console.error('Loading', uri, 'failed', err);
      if (++retryCount > 3) {
        console.error('RetryCount too high, giving up...');
        ele.querySelector('.link').textContent = uri;
        ele.querySelector('.description').textContent =
          'Could not fetch information, check your internet connection';
      }
      else {
        setTimeout(() => resolveURI(uri, ele, retryCount), 300);
      }
    };
    x.open('GET', uri);
    x.send();
  }

  function stopDiscovery(e) {
    if (e) {
      e.preventDefault();
    }

    document.body.classList.remove('searching');
    try {
      navigator.mozBluetooth.defaultAdapter.stopLeScan(_handle);
    }
    catch (ex) {
      // dunno if this can fail
    }

    return false;
  }

  function openUrl(e) {
    var uri = e.currentTarget.dataset.uri;

    var a = new MozActivity({
      name: 'view',
      data: {
        type: 'url',
        url: uri
      }
    });
    a.onerror = err => console.error('Opening', uri, 'failed', err);
  }

  window.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      stopDiscovery();
    }
    else {
      discover();
    }
  });

  isBluetoothEnabled()
    .then(enabled => {
      if (!enabled) {
        document.body.classList.add('bt-not-available');
        throw 'Bluetooth not available';
      }
    })
    .then(() => getAdapter())
    .then(() => document.body.classList.add('results'))
    .then(() => discover())
    .catch(err => console.error('Could not start physical web', err));
})();
