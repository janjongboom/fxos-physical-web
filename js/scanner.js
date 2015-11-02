/*global parseRecord virtualDom */
(function() {
  var results = document.querySelector('#results');
  var _handle;
  var tree, rootNode; // virtualDom vars

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

  var beacons = {};

  function render() {
    var h = virtualDom.h;

    return h('ul', [
      Object.keys(beacons)
        .map(k=>beacons[k])
        .sort((a, b) => calcDistance(a) - calcDistance(b))
        .map(beacon => {
          return h('li', {
            attributes: { 'data-uri': beacon.uri, 'data-device': beacon.address },
            onclick: openUrl
          }, [
            h('p', { className: 'name' }, [ beacon.title ]),
            h('p', { className: 'link' }, [ beacon.uri ]),
            h('p', { className: 'description' }, [ beacon.description ]),
          ]);
        })
    ]);
  }

  function incrementalRender() {
    var newTree = render();
    var patches = virtualDom.diff(tree, newTree);
    rootNode = virtualDom.patch(rootNode, patches);
    tree = newTree;
  }

  function discover() {
    // clear beacons
    beacons = {};
    incrementalRender();

    return navigator.mozBluetooth.defaultAdapter.startLeScan([]).then(handle => {
      _handle = handle;

      document.body.classList.add('searching');

      console.log('Start scanning', handle);
      handle.ondevicefound = e => {
        if (beacons[e.device.address]) {
          beacons[e.device.address].lastSeen = new Date();
          beacons[e.device.address].rssi = e.rssi;
          return incrementalRender();
        }

        var record = parseRecord(e.scanRecord);
        if (record) {
          beacons[e.device.address] = {
            rssi: e.rssi,
            txPower: record.txPower,
            address: e.device.address,
            uri: record.uri,
            lastSeen: new Date()
          };
          resolveURI(beacons[e.device.address]);
          incrementalRender();
        }
      };
    });
  }

  function resolveURI(beacon, retryCount) {
    retryCount = retryCount || 0;

    var x = new XMLHttpRequest({ mozSystem: true });
    x.onload = e => {
      var h = document.createElement('html');
      h.innerHTML = x.responseText;

      beacon.uri = x.responseURL;

      var titleEl = h.querySelector('title');
      var metaEl = h.querySelector('meta[name="description"]');
      var bodyEl = h.querySelector('body');

      if (titleEl && titleEl.textContent) {
        beacon.title = titleEl.textContent;
      }

      if (metaEl && metaEl.content) {
        beacon.description = metaEl.content;
      }
      else if (bodyEl && bodyEl.textContent) {
        var tx = bodyEl.textContent.substr(0, 115);
        if (tx.length !== bodyEl.textContent.length) tx += '...';
        beacon.description = tx;
      }

      incrementalRender();
    };
    x.onerror = err => {
      // probably lost connection or whatever, retry it
      console.error('Loading', uri, 'failed', err);
      if (++retryCount > 3) {
        console.error('RetryCount too high, giving up...');
        beacon.uri = uri;
        beacon.description = 'Could not fetch information, check your internet connection';
        incrementalRender();
      }
      else {
        setTimeout(() => resolveURI(beacon, retryCount), 300);
      }
    };
    x.open('GET', beacon.uri);
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

  function calcDistance(beacon) {
    // from https://github.com/sandeepmistry/node-eddystone-beacon-scanner/blob/master/lib/eddystone-beacon-scanner.js
    // it seems wildly inaccurate, but useful to check which beacon is closer
    return Math.pow(10, ((beacon.txPower - beacon.rssi) - 41) / 20.0);
  }

  // clean up beacons we didnt see for 10s
  setInterval(() => {
    var b = Object.keys(beacons).filter(k => beacons[k].lastSeen < new Date() - 10000);
    if (b.length) {
      b.forEach(k => delete beacons[k]);
      incrementalRender();
    }
  }, 2000);

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

      // Set up virtualDom
      tree = render();
      rootNode = virtualDom.create(tree);
      results.appendChild(rootNode);
    })
    .then(() => getAdapter())
    .then(() => document.body.classList.add('results'))
    .then(() => discover())
    .catch(err => console.error('Could not start physical web', err));
})();
