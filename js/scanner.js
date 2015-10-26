(function() {
  var results = document.querySelector('#results ul');
  var _handle;

  function isBluetoothEnabled() {
    return navigator.mozSettings.createLock().get('bluetooth.enabled').then(a => {
      return !!a['bluetooth.enabled'];
    });
  }

  function discover() {
    return navigator.mozBluetooth.defaultAdapter.startLeScan([]).then(handle => {
      _handle = handle;

      document.body.classList.add('searching');

      console.log('Start scanning', handle);
      handle.ondevicefound = e => {
        if (results.querySelector(
            '*[data-device="' + e.device.address + '"]')) {
          return;
        }

        // URIBeacon
        var uri = parseRecord(e.scanRecord);
        if (uri) {
          var ele = createNotificationElement(e.device.address, uri);
          ele.onclick = openUrl;
          ele.querySelector('.title').textContent = uri;
          resolveURI(uri, ele);
          return;
        }
      };
    });
  }

  function createNotificationElement(address, uri) {
    var ele = document.createElement('li');
    ele.dataset.device = address;
    ele.innerHTML = `
      <p class="name"></p>
      <p class="link"></p>
      <p class="description"></p>`;

    ele.querySelector('.name').textContent = uri;
    ele.dataset.uri = uri;

    results.appendChild(ele);

    return ele;
  }

  function resolveURI(uri, ele) {
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
        ele.querySelector('.description').textContent =
          bodyEl.textContent;
      }
    };
    x.onerror = err => console.error('Loading', uri, 'failed', err);
    x.open('GET', uri);
    x.send();
  }

  function parseRecord(scanRecord) {
    var data = new Uint8Array(scanRecord);

    for (var b = 0; b < 8; b++) {
      if (data[b] === 0x03 && data[b + 1] === 0x03 &&
          data[b + 2] === 0xd8 && data[b + 3] === 0xfe) {
        break;
      }
    }

    if (b === 8) {
      return false;
    }

    var schemes = [
      'http://www.',
      'https://www.',
      'http://',
      'https://',
      'urn:uuid:'
    ];

    var expansions = [
      '.com/',
      '.org/',
      '.edu/',
      '.net/',
      '.info/',
      '.biz/',
      '.gov/',
      '.com',
      '.org',
      '.edu',
      '.net',
      '.info',
      '.biz',
      '.gov',
    ];

    b += 4;
    var adLength = data[b++];
    var adType = data[b++];
    b += 2; // skip Service UUID
    var flags = data[b++];
    var txPower = data[b++];
    var scheme = data[b++];

    var text = schemes[scheme];
    // it has been 0x06 bytes since we read adLength, so take that into account
    for (var i = b, c = data[i]; i < b + adLength - 0x06; c = data[++i]) {
      if (c < expansions.length) {
        text += expansions[c];
      }
      else {
        text += String.fromCharCode(c);
      }
    }

    return text;
  }

  function stopDiscovery(e) {
    if (e) {
      e.preventDefault();
    }

    document.body.classList.remove('searching');
    navigator.mozBluetooth.defaultAdapter.stopLeScan(_handle);

    return false;
  }

  function openUrl(e) {
    var uri = e.target.dataset.uri;

    stopDiscovery();

    var a = new MozActivity({
      name: 'view',
      data: {
        type: 'url',
        url: uri
      }
    });
    a.onerror = err => console.error('Opening', uri, 'failed', err);
  }

  isBluetoothEnabled()
    .then(enabled => {
      if (!enabled) {
        document.body.classList.add('bt-not-available');
        throw 'Bluetooth not available';
      }
    })
    .then(() => document.body.classList.add('results'))
    .then(() => discover())
    .catch(err => console.error('Could not start physical web', err));
})();
